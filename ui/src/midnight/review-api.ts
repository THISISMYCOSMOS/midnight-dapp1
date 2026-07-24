// SPDX-License-Identifier: Apache-2.0

import {
  ReviewContract,
  createReviewPrivateState,
  ledger,
  pureCircuits,
  type ReviewPrivateState,
} from "@midnight-review/contract";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { PublicDataProvider } from "@midnight-ntwrk/midnight-js-types";
import { map, type Observable } from "rxjs";
import {
  reviewPrivateStateKey,
  type DeployedReviewContract,
  type ReviewCompiledContract,
  type ReviewProviders,
} from "./types";

export type ReviewPublicState = {
  readonly reviews: readonly string[];
};

export type ReviewAuthorState = ReviewPublicState & {
  readonly eligible: boolean;
  readonly alreadyReviewed: boolean;
};

export type PublicTransactionRecord = {
  readonly txId: string;
  readonly blockHeight: number;
  readonly blockTimestamp: number;
};

export const observeReviewState = (
  publicDataProvider: PublicDataProvider,
  contractAddress: ContractAddress,
): Observable<ReviewPublicState> =>
  publicDataProvider
    .contractStateObservable(contractAddress, { type: "latest" })
    .pipe(
      map((contractState) => ({
        reviews: [...ledger(contractState.data).reviews],
      })),
    );

export class ReviewApi {
  readonly state$: Observable<ReviewAuthorState>;

  private constructor(
    private readonly deployedContract: DeployedReviewContract,
    providers: ReviewProviders,
    private readonly itemId: Uint8Array,
    privateState: ReviewPrivateState,
  ) {
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.contractAddress, { type: "latest" })
      .pipe(
        map((contractState) => {
          const currentLedger = ledger(contractState.data);
          const reviewerKey = pureCircuits.deriveReviewerKey(
            privateState.secretKey,
          );
          const nullifier = pureCircuits.deriveNullifier(
            privateState.secretKey,
            itemId,
          );

          return {
            reviews: [...currentLedger.reviews],
            eligible:
              currentLedger.eligible.findPathForLeaf(reviewerKey) !== undefined,
            alreadyReviewed: currentLedger.nullifiers.member(nullifier),
          };
        }),
      );
  }

  get contractAddress(): ContractAddress {
    return this.deployedContract.deployTxData.public.contractAddress;
  }

  get deploymentTransaction(): PublicTransactionRecord {
    const { txId, blockHeight, blockTimestamp } =
      this.deployedContract.deployTxData.public;
    return {
      txId,
      blockHeight,
      blockTimestamp,
    };
  }

  async submitReview(body: string): Promise<PublicTransactionRecord> {
    const { public: finalized } =
      await this.deployedContract.callTx.submitReview(this.itemId, body);
    return {
      txId: finalized.txId,
      blockHeight: finalized.blockHeight,
      blockTimestamp: finalized.blockTimestamp,
    };
  }

  static async deploy(
    providers: ReviewProviders,
    initialEligible: readonly Uint8Array[],
    deploymentPrivateStateSecret: Uint8Array,
    itemId: Uint8Array,
  ): Promise<ReviewApi> {
    const privateState = createReviewPrivateState(deploymentPrivateStateSecret);
    const deployedContract = await deployContract(providers, {
      compiledContract: ReviewContract,
      privateStateId: reviewPrivateStateKey,
      initialPrivateState: privateState,
      args: [[...initialEligible]],
    });

    return new ReviewApi(deployedContract, providers, itemId, privateState);
  }

  static async join(
    providers: ReviewProviders,
    contractAddress: ContractAddress,
    secretKey: Uint8Array,
    itemId: Uint8Array,
  ): Promise<ReviewApi> {
    const privateState = createReviewPrivateState(secretKey);
    const deployedContract = await findDeployedContract<ReviewCompiledContract>(
      providers,
      {
        contractAddress,
        compiledContract: ReviewContract,
        privateStateId: reviewPrivateStateKey,
        initialPrivateState: privateState,
      },
    );

    return new ReviewApi(deployedContract, providers, itemId, privateState);
  }
}
