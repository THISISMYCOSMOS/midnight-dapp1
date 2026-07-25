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
import type {
  ContractAddress,
  ContractState,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { PublicDataProvider } from "@midnight-ntwrk/midnight-js-types";
import {
  Subject,
  concatMap,
  defer,
  filter,
  from,
  map,
  merge,
  type Observable,
} from "rxjs";
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
// isEligible·hasNullifier는 마지막으로 관측한 온체인 상태를 그대로 조회한다. 회로가
// 하는 것과 같은 계산이지만 회로 내부를 들여다보는 것은 아니다 — 화면에서도 그렇게
// 표기한다. ledgerFields는 이 계약이 실제로 저장하는 필드 목록이며, 작성자 필드가 없다는
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

// 계약 상태를 가져오는 두 경로를 합친다. 실측(2026-07-25, Preprod):
//   queryContractState(HTTP)          864 ~ 1372 ms
//   contractStateObservable 첫 emit  10110 ~ 11426 ms
// 구독만 쓰면 화면이 10초 넘게 비어 있어 "리뷰가 안 올라간다"로 보인다. HTTP 조회로
// 즉시 채우고, 이후 변화는 구독으로 받는다. refresh$는 제출 직후 강제 재조회용이다.
const contractStates = (
  publicDataProvider: PublicDataProvider,
  contractAddress: ContractAddress,
  refresh$?: Observable<void>,
): Observable<ContractState> =>
  merge(
    defer(() => from(publicDataProvider.queryContractState(contractAddress))),
    refresh$
      ? refresh$.pipe(
          concatMap(() =>
            from(publicDataProvider.queryContractState(contractAddress)),
          ),
        )
      : from<ContractState[]>([]),
    publicDataProvider.contractStateObservable(contractAddress, {
      type: "latest",
    }),
  ).pipe(filter((state): state is ContractState => state !== null));

export const observeReviewState = (
  publicDataProvider: PublicDataProvider,
  contractAddress: ContractAddress,
  reviewerKeys: readonly Uint8Array[] = [],
): Observable<ReviewBoardState> =>
  contractStates(publicDataProvider, contractAddress).pipe(
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
  private readonly refresh$ = new Subject<void>();

  private constructor(
    private readonly deployedContract: DeployedReviewContract,
    providers: ReviewProviders,
    private readonly itemId: Uint8Array,
    privateState: ReviewPrivateState,
  ) {
    this.state$ = contractStates(
      providers.publicDataProvider,
      this.contractAddress,
      this.refresh$,
    )
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

  // 온체인 상태를 즉시 다시 읽는다. 구독 첫 emit이 실측 10초라 그것만 기다리면 방금 올린
  // 리뷰가 한참 뒤에야 보인다.
  refresh(): void {
    this.refresh$.next();
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
    this.refresh();
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
