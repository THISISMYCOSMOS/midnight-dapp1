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

// ownPublicKey 비교 기준선(unsafe-review.compact)을 그대로 구동한다.
// 공개 컨텍스트 값이 생성 시 admin 슬롯에 기록되고, 제출 때 같은 종류의 값을 비교한다.
// 이 비교는 호출자가 해당 키를 소유했다는 사실을 증명하지 않으므로 최종 인가 계약으로
// 사용하면 안 된다. admin 값이 공개 원장에 남는다는 점도 함께 관측한다.
export class UnsafeReviewSimulator {
  readonly contract: Contract<UnsafePrivateState>;
  circuitContext: CircuitContext<UnsafePrivateState>;

  constructor(adminValue: Uint8Array) {
    this.contract = new Contract<UnsafePrivateState>({});

    const { currentContractState, currentPrivateState } =
      this.contract.initialState(
        createConstructorContext<UnsafePrivateState>(
          {},
          { bytes: adminValue },
        ),
      );

    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      emptyZswapLocalState({ bytes: adminValue }),
      currentContractState,
      currentPrivateState,
    );
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  // 공개 원장(admin 슬롯)에 저장된 비교값.
  exposedAdminValue(): Uint8Array {
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
