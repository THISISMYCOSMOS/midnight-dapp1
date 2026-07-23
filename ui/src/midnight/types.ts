// SPDX-License-Identifier: Apache-2.0

import type {
  Contract,
  ReviewPrivateState,
  Witnesses,
} from "@midnight-review/contract";
import type { FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";

export const reviewPrivateStateKey = "reviewPrivateState";
export type ReviewPrivateStateId = typeof reviewPrivateStateKey;

export type ReviewPrivateStates = {
  readonly reviewPrivateState: ReviewPrivateState;
};

export type ReviewCompiledContract = Contract<
  ReviewPrivateState,
  Witnesses<ReviewPrivateState>
>;

export type ReviewCircuitKeys = Exclude<
  keyof ReviewCompiledContract["impureCircuits"],
  number | symbol
>;

export type ReviewProviders = MidnightProviders<
  ReviewCircuitKeys,
  ReviewPrivateStateId,
  ReviewPrivateState
>;

export type DeployedReviewContract = FoundContract<ReviewCompiledContract>;
