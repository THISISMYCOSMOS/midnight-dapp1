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

// 지갑 없이 읽는 게시판 상태. eligibleFlags는 조회한 파생키가 이 계약의 자격 트리에
// 있는지이며, 리뷰어 본인 상태(ReviewAuthorState)와 달리 비밀키가 필요 없다.
//
// isEligible·hasNullifier는 마지막으로 관측한 원장 상태를 그대로 조회한다. 회로가
// 하는 것과 같은 계산이지만 회로 내부를 들여다보는 것은 아니다 — 화면에서도 그렇게
// 표기한다. ledgerFields는 이 계약의 실제 원장 필드 목록이며, 작성자 필드가 없다는
// 사실을 주장이 아니라 관측으로 보이기 위한 것이다.
export type ReviewBoardState = ReviewPublicState & {
  readonly eligibleFlags: readonly boolean[];
  readonly ledgerFields: readonly string[];
  readonly isEligible: (reviewerKey: Uint8Array) => boolean;
  readonly hasNullifier: (nullifier: Uint8Array) => boolean;
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
  reviewerKeys: readonly Uint8Array[] = [],
): Observable<ReviewBoardState> =>
  publicDataProvider
    .contractStateObservable(contractAddress, { type: "latest" })
    .pipe(
      map((contractState) => {
        const currentLedger = ledger(contractState.data);
        return {
          reviews: [...currentLedger.reviews],
          eligibleFlags: reviewerKeys.map(
            (key) => currentLedger.eligible.findPathForLeaf(key) !== undefined,
          ),
          ledgerFields: Object.keys(currentLedger).sort(),
          isEligible: (key: Uint8Array) =>
            currentLedger.eligible.findPathForLeaf(key) !== undefined,
          hasNullifier: (nullifier: Uint8Array) =>
            currentLedger.nullifiers.member(nullifier),
        };
      }),
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
