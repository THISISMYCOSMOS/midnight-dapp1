// SPDX-License-Identifier: Apache-2.0

import {
  Contract as MerkleContract,
  createReviewPrivateState,
  ledger as merkleLedger,
  pureCircuits,
  witnesses,
  type Ledger as MerkleLedger,
  type ReviewPrivateState,
} from "@midnight-review/contract";
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

export type DemoAccount = "ineligible" | "eligible";

export type SubmissionResult = {
  unsafeMessage: string;
  merkleMessage: string;
  unsafeReviews: readonly string[];
  merkleReviews: readonly string[];
};

type UnsafePrivateState = Record<string, never>;

const bytes = (value: number): Uint8Array =>
  Uint8Array.from({ length: 32 }, () => value);

const eligibleSecrets = [bytes(1), bytes(2), bytes(3)] as const;
const ineligibleSecret = bytes(9);
const unsafeAdminKey = bytes(21);
const itemId = bytes(10);

const messageFor = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Reviewer is not eligible")) {
    return "리뷰는 구매 확인된 분만 쓸 수 있습니다";
  }
  if (message.includes("Review already submitted for this item")) {
    return "이미 이 상품에 리뷰를 남기셨습니다";
  }
  return "제출하지 못했습니다";
};

export class ComparisonSession {
  private readonly unsafeContract: UnsafeContract<UnsafePrivateState>;
  private unsafeContext: CircuitContext<UnsafePrivateState>;
  private readonly merkleContract: MerkleContract<ReviewPrivateState>;
  private merkleContext: CircuitContext<ReviewPrivateState>;

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

    this.merkleContract = new MerkleContract<ReviewPrivateState>(witnesses);
    const initialEligible = eligibleSecrets.map((secretKey) =>
      pureCircuits.deriveReviewerKey(secretKey),
    );
    const merkleInitial = this.merkleContract.initialState(
      createConstructorContext(
        createReviewPrivateState(ineligibleSecret),
        "0".repeat(64),
      ),
      initialEligible,
    );
    this.merkleContext = createCircuitContext(
      sampleContractAddress(),
      merkleInitial.currentZswapLocalState,
      merkleInitial.currentContractState,
      merkleInitial.currentPrivateState,
    );
  }

  private getUnsafeLedger(): UnsafeLedger {
    return unsafeLedger(this.unsafeContext.currentQueryContext.state);
  }

  private getMerkleLedger(): MerkleLedger {
    return merkleLedger(this.merkleContext.currentQueryContext.state);
  }

  submit(account: DemoAccount, body: string): SubmissionResult {
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

    this.merkleContext.currentPrivateState = createReviewPrivateState(
      account === "eligible" ? eligibleSecrets[0] : ineligibleSecret,
    );
    let merkleMessage = "게시되었습니다";
    try {
      this.merkleContext = this.merkleContract.impureCircuits.submitReview(
        this.merkleContext,
        itemId,
        body,
      ).context;
    } catch (error) {
      merkleMessage = messageFor(error);
    }

    return {
      unsafeMessage: "게시되었습니다",
      merkleMessage,
      unsafeReviews: [...this.getUnsafeLedger().reviews],
      merkleReviews: [...this.getMerkleLedger().reviews],
    };
  }
}
