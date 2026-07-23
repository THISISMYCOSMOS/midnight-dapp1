// SPDX-License-Identifier: Apache-2.0

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import * as CompiledReviewContract from "./managed/review/contract/index.js";
import * as ReviewWitnesses from "./witnesses.js";

export * from "./managed/review/contract/index.js";
export * from "./witnesses.js";

const compiledReviewContract = CompiledContract.make<
  CompiledReviewContract.Contract<ReviewWitnesses.ReviewPrivateState>
>(
  "Review",
  CompiledReviewContract.Contract<ReviewWitnesses.ReviewPrivateState>,
);

const compiledReviewContractWithWitnesses = CompiledContract.withWitnesses(
  compiledReviewContract,
  ReviewWitnesses.witnesses,
);

export const ReviewContract = CompiledContract.withCompiledFileAssets(
  compiledReviewContractWithWitnesses,
  "./managed/review",
);
