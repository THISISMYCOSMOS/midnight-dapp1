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

// ownPublicKey 비교 기준선(unsafe-review.compact)은 공개 컨텍스트 값을 공개 ledger의
// `admin` 값과 비교한다. 이 값은 트랜잭션 서명자와 암호학적으로 결합되지 않으므로
// 호출자가 키를 소유했다는 사실을 증명하지 않는다. admin 값도 누구나 읽을 수 있어
// 최종 인가 계약으로 사용하면 안 된다.
export class UnsafeComparisonSession {
  private readonly unsafeContract: UnsafeContract<UnsafePrivateState>;
  private unsafeContext: CircuitContext<UnsafePrivateState>;

  constructor(private readonly adminValue: Uint8Array = randomIdentity()) {
    this.unsafeContract = new UnsafeContract<UnsafePrivateState>({});
    const unsafeInitial = this.unsafeContract.initialState(
      createConstructorContext<UnsafePrivateState>(
        {},
        { bytes: adminValue },
      ),
    );
    this.unsafeContext = createCircuitContext(
      sampleContractAddress(),
      emptyZswapLocalState({ bytes: adminValue }),
      unsafeInitial.currentContractState,
      unsafeInitial.currentPrivateState,
    );
  }

  private getUnsafeLedger(): UnsafeLedger {
    return unsafeLedger(this.unsafeContext.currentQueryContext.state);
  }

  // ledger가 공개하는 admin 슬롯의 비교값.
  exposedAdminHex(): string {
    return toHex(this.getUnsafeLedger().admin.bytes);
  }

  submit(body: string): readonly string[] {
    this.unsafeContext = this.unsafeContract.impureCircuits.submitReview(
      this.unsafeContext,
      body,
    ).context;
    return [...this.getUnsafeLedger().reviews];
  }

  // admin과 다른 공개 컨텍스트 값으로 제출을 시도한다. 세션 상태는 바꾸지 않는다.
  // 차단되면 회로의 에러 메시지를 반환하고, 예상과 달리 통과되면 undefined.
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
