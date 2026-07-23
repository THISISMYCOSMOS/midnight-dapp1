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

export class UnsafeReviewSimulator {
  readonly actualWalletKey: Uint8Array;
  readonly contract: Contract<UnsafePrivateState>;
  circuitContext: CircuitContext<UnsafePrivateState>;

  constructor(adminKey: Uint8Array, actualWalletKey: Uint8Array) {
    this.actualWalletKey = actualWalletKey;
    this.contract = new Contract<UnsafePrivateState>({});

    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext<UnsafePrivateState>({}, { bytes: adminKey }),
      );

    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );
    this.claimPublicKey(actualWalletKey);
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  claimPublicKey(claimedKey: Uint8Array): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentZswapLocalState: emptyZswapLocalState({ bytes: claimedKey }),
    };
  }

  copyPublicAdminIntoClaim(): void {
    this.claimPublicKey(this.getLedger().admin.bytes);
  }

  submitReview(body: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.submitReview(
      this.circuitContext,
      body,
    ).context;
    return this.getLedger();
  }
}
