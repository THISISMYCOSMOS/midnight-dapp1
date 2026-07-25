// SPDX-License-Identifier: Apache-2.0

import {
  createCircuitContext,
  createConstructorContext,
  emptyZswapLocalState,
  sampleContractAddress,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract as UnsafeContract,
  ledger as unsafeLedger,
  type Ledger as UnsafeLedger,
} from "../../contract/comparison/managed/unsafe-review/contract/index.js";

type UnsafePrivateState = Record<string, never>;

const toHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

const randomIdentity = (): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(32));

// ownPublicKey 비교 기준선(unsafe-review.compact)은 리뷰어를 그 사람의 *공개키*로
// 식별한다. 인가된 리뷰어의 공개키는 생성 시 ledger `admin` 슬롯에 기록되고, 제출할
// 때마다 회로가 그 값을 평문으로 다시 읽어 대조한다. 즉 게시된 모든 글에는 공개 원장에서
// 그대로 읽히는 작성자가 붙는다. 이것은 실제로 작동하는 접근제어다 — 다만 리뷰어를
// 익명으로 인가할 방법이 없어 자격과 익명을 동시에 표현하지 못한다.
//
// 여기에는 admin 키를 다른 호출자에 복사해 억지로 통과시키는 "도용"이 없다. 호출자는
// 인가된 그 리뷰어 본인이고, 요점은 오직 "그 신원이 공개된다"는 것뿐이다.
export class UnsafeComparisonSession {
  private readonly unsafeContract: UnsafeContract<UnsafePrivateState>;
  private unsafeContext: CircuitContext<UnsafePrivateState>;

  constructor(private readonly authorIdentity: Uint8Array = randomIdentity()) {
    this.unsafeContract = new UnsafeContract<UnsafePrivateState>({});
    const unsafeInitial = this.unsafeContract.initialState(
      createConstructorContext<UnsafePrivateState>(
        {},
        { bytes: authorIdentity },
      ),
    );
    this.unsafeContext = createCircuitContext(
      sampleContractAddress(),
      emptyZswapLocalState({ bytes: authorIdentity }),
      unsafeInitial.currentContractState,
      unsafeInitial.currentPrivateState,
    );
  }

  private getUnsafeLedger(): UnsafeLedger {
    return unsafeLedger(this.unsafeContext.currentQueryContext.state);
  }

  // ledger가 공개하는 작성자 키(admin 슬롯). 계약 상태를 읽는 누구나 이 게시판에서
  // 누가 글을 쓸 수 있는지 곧바로 알게 된다.
  exposedAuthorHex(): string {
    return toHex(this.getUnsafeLedger().admin.bytes);
  }

  submit(body: string): readonly string[] {
    this.unsafeContext = this.unsafeContract.impureCircuits.submitReview(
      this.unsafeContext,
      body,
    ).context;
    return [...this.getUnsafeLedger().reviews];
  }

  // admin이 아닌 임의 호출자로 제출을 시도한다. 실제 회로가
  // `ownPublicKey() == admin`을 확인하고 막는다 → 등록되지 않은 사용자는
  // ownPublicKey 기준선에서도 글을 남기지 못한다. 세션 상태는 바꾸지 않는다.
  // 차단되면 회로의 에러 메시지를 반환하고, (예상과 달리) 통과되면 undefined.
  attemptOutsider(body: string): string | undefined {
    const outsiderContext = {
      ...this.unsafeContext,
      currentZswapLocalState: emptyZswapLocalState({ bytes: randomIdentity() }),
    };
    try {
      this.unsafeContract.impureCircuits.submitReview(outsiderContext, body);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
}
