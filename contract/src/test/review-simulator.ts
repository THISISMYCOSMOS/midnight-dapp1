// SPDX-License-Identifier: Apache-2.0

import {
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from "../managed/review/contract/index.js";
import {
  createReviewPrivateState,
  type ReviewPrivateState,
  witnesses,
} from "../witnesses.js";

export class ReviewSimulator {
  readonly contract: Contract<ReviewPrivateState>;
  circuitContext: CircuitContext<ReviewPrivateState>;

  constructor(
    activeSecretKey: Uint8Array,
    eligibleSecretKeys: readonly Uint8Array[],
  ) {
    if (eligibleSecretKeys.length !== 3) {
      throw new Error("The demo constructor requires exactly three eligible keys");
    }

    this.contract = new Contract<ReviewPrivateState>(witnesses);
    const initialEligible = eligibleSecretKeys.map((secretKey) =>
      pureCircuits.deriveReviewerKey(secretKey),
    );
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(
          createReviewPrivateState(activeSecretKey),
          "0".repeat(64),
        ),
        initialEligible,
      );

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  switchUser(secretKey: Uint8Array): void {
    this.circuitContext.currentPrivateState =
      createReviewPrivateState(secretKey);
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  reviewerKey(secretKey: Uint8Array): Uint8Array {
    return pureCircuits.deriveReviewerKey(secretKey);
  }

  nullifier(secretKey: Uint8Array, itemId: Uint8Array): Uint8Array {
    return pureCircuits.deriveNullifier(secretKey, itemId);
  }

  submitReview(itemId: Uint8Array, body: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.submitReview(
      this.circuitContext,
      itemId,
      body,
    ).context;
    return this.getLedger();
  }
}
