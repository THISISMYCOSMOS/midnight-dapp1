import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  findEligibilityPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
                      pk_0: Uint8Array): [PS, { leaf: Uint8Array,
                                                path: { sibling: { field: bigint
                                                                 },
                                                        goes_left: boolean
                                                      }[]
                                              }];
}

export type ImpureCircuits<PS> = {
  submitReview(context: __compactRuntime.CircuitContext<PS>, body_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  submitReview(context: __compactRuntime.CircuitContext<PS>, body_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  deriveReviewerKey(sk_0: Uint8Array): Uint8Array;
  deriveNullifier(sk_0: Uint8Array, itemId_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  deriveReviewerKey(context: __compactRuntime.CircuitContext<PS>,
                    sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveNullifier(context: __compactRuntime.CircuitContext<PS>,
                  sk_0: Uint8Array,
                  itemId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  submitReview(context: __compactRuntime.CircuitContext<PS>, body_0: string): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  eligible: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined
  };
  readonly productId: Uint8Array;
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
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
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initialEligible_0: Uint8Array[],
               initialProductId_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
