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

// 정직한 witness는 자격자면 실제 Merkle 경로를, 아니면 아래 더미 경로를 반환한다.
// 두 경우 모두 leaf = reviewerKey(회로가 caller의 in-circuit 파생키로 계산한 값)다.
//
// 주의: review.compact의 `assert(reviewerKey == path.leaf, ...)`는 죽은 코드가 아니다.
// witness는 신뢰할 수 없으므로, 악의적 witness가 다른 자격자의 유효 경로를 leaf만 바꿔
// 제시해 우회하는 것을 이 assert가 막는다(leaf를 caller의 파생키에 묶는다). 절대 제거
// 하지 말 것 — 제거하면 실제 우회 구멍이 생긴다. review.compact는 손대지 않는다.
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
