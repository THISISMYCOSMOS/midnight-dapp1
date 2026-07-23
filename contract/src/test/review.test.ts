// SPDX-License-Identifier: Apache-2.0

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";
import { ReviewSimulator } from "./review-simulator.js";

setNetworkId("undeployed");

const bytes = (value: number): Uint8Array =>
  Uint8Array.from({ length: 32 }, () => value);

const eligibleSecrets = [bytes(1), bytes(2), bytes(3)] as const;
const itemA = bytes(10);
const itemB = bytes(11);

describe("Review smart contract", () => {
  it("accepts one review from an eligible user", () => {
    const simulator = new ReviewSimulator(eligibleSecrets[0], eligibleSecrets);

    const ledger = simulator.submitReview(itemA, "배송이 빨랐습니다");

    expect([...ledger.reviews]).toEqual(["배송이 빨랐습니다"]);
    expect(
      ledger.nullifiers.member(
        simulator.nullifier(eligibleSecrets[0], itemA),
      ),
    ).toBe(true);
  });

  it("rejects a second review for the same item", () => {
    const simulator = new ReviewSimulator(eligibleSecrets[0], eligibleSecrets);
    simulator.submitReview(itemA, "첫 번째 리뷰");

    expect(() => simulator.submitReview(itemA, "두 번째 리뷰")).toThrow(
      "Review already submitted for this item",
    );
  });

  it("rejects a user outside the eligibility tree", () => {
    const simulator = new ReviewSimulator(bytes(9), eligibleSecrets);

    expect(() => simulator.submitReview(itemA, "미자격 리뷰")).toThrow(
      "Reviewer is not eligible",
    );
  });

  it("allows the same eligible user to review a different item", () => {
    const simulator = new ReviewSimulator(eligibleSecrets[0], eligibleSecrets);
    simulator.submitReview(itemA, "상품 A 리뷰");
    const ledger = simulator.submitReview(itemB, "상품 B 리뷰");

    expect([...ledger.reviews]).toEqual(["상품 B 리뷰", "상품 A 리뷰"]);
  });
});
