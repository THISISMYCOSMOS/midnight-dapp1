// SPDX-License-Identifier: Apache-2.0

import {
  createCircuitContext,
  createConstructorContext,
  emptyZswapLocalState,
  sampleContractAddress,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
  type Ledger,
} from "../../comparison/managed/unsafe-review/contract/index.js";

type UnsafePrivateState = Record<string, never>;

// ownPublicKey 비교 기준선(unsafe-review.compact)을 정직하게 구동한다.
// 인가된 리뷰어의 공개키가 생성 시 admin 슬롯에 기록되고, 호출자는 그 리뷰어 본인이다.
// 여기에는 admin 키를 다른 호출자에 복사하는 "도용"이 없다 — 요점은 오직 "작성자
// 신원이 공개 원장에 남는다"이며, 그래서 익명·자격을 동시에 표현하지 못한다는 것이다.
export class UnsafeReviewSimulator {
  readonly contract: Contract<UnsafePrivateState>;
  circuitContext: CircuitContext<UnsafePrivateState>;

  constructor(authorIdentity: Uint8Array) {
    this.contract = new Contract<UnsafePrivateState>({});

    const { currentContractState, currentPrivateState } =
      this.contract.initialState(
        createConstructorContext<UnsafePrivateState>(
          {},
          { bytes: authorIdentity },
        ),
      );

    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      emptyZswapLocalState({ bytes: authorIdentity }),
      currentContractState,
      currentPrivateState,
    );
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  // 공개 원장(admin 슬롯)이 그대로 노출하는 작성자 공개키.
  exposedAuthorKey(): Uint8Array {
    return this.getLedger().admin.bytes;
  }

  submit(body: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.submitReview(
      this.circuitContext,
      body,
    ).context;
    return this.getLedger();
  }
}
