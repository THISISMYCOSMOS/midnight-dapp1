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

const bytes = (value: number): Uint8Array =>
  Uint8Array.from({ length: 32 }, () => value);

const unsafeAdminKey = bytes(21);

export class UnsafeComparisonSession {
  private readonly unsafeContract: UnsafeContract<UnsafePrivateState>;
  private unsafeContext: CircuitContext<UnsafePrivateState>;

  constructor() {
    this.unsafeContract = new UnsafeContract<UnsafePrivateState>({});
    const unsafeInitial = this.unsafeContract.initialState(
      createConstructorContext<UnsafePrivateState>({}, {
        bytes: unsafeAdminKey,
      }),
    );
    this.unsafeContext = createCircuitContext(
      sampleContractAddress(),
      unsafeInitial.currentZswapLocalState,
      unsafeInitial.currentContractState,
      unsafeInitial.currentPrivateState,
    );
  }

  private getUnsafeLedger(): UnsafeLedger {
    return unsafeLedger(this.unsafeContext.currentQueryContext.state);
  }

  submit(body: string): readonly string[] {
    this.unsafeContext = {
      ...this.unsafeContext,
      currentZswapLocalState: emptyZswapLocalState({
        bytes: this.getUnsafeLedger().admin.bytes,
      }),
    };
    this.unsafeContext = this.unsafeContract.impureCircuits.submitReview(
      this.unsafeContext,
      body,
    ).context;
    return [...this.getUnsafeLedger().reviews];
  }
}
