import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  submitReview(context: __compactRuntime.CircuitContext<PS>, body_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  submitReview(context: __compactRuntime.CircuitContext<PS>, body_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  submitReview(context: __compactRuntime.CircuitContext<PS>, body_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly admin: { bytes: Uint8Array };
  reviews: {
    isEmpty(): boolean;
    length(): bigint;
    head(): { is_some: boolean, value: string };
    [Symbol.iterator](): Iterator<string>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
