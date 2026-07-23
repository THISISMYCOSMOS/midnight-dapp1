// SPDX-License-Identifier: Apache-2.0

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type {
  Ledger,
  Witnesses,
} from "./managed/review/contract/index.js";

export type ReviewPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createReviewPrivateState = (
  secretKey: Uint8Array,
): ReviewPrivateState => ({ secretKey });

type EligibilityPath = NonNullable<
  ReturnType<Ledger["eligible"]["findPathForLeaf"]>
>;

const ineligiblePath = (reviewerKey: Uint8Array): EligibilityPath => ({
  leaf: reviewerKey,
  path: Array.from({ length: 10 }, () => ({
    sibling: { field: 0n },
    goes_left: false,
  })),
});

export const witnesses: Witnesses<ReviewPrivateState> = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, ReviewPrivateState>) => [
    privateState,
    privateState.secretKey,
  ],

  findEligibilityPath: (
    { ledger, privateState }: WitnessContext<Ledger, ReviewPrivateState>,
    reviewerKey: Uint8Array,
  ) => [
    privateState,
    ledger.eligible.findPathForLeaf(reviewerKey) ??
      ineligiblePath(reviewerKey),
  ],
};
