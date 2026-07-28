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
    const simulator = new ReviewSimulator(
      eligibleSecrets[0],
      eligibleSecrets,
      itemA,
    );

    const ledger = simulator.submitReview("배송이 빨랐습니다");

    expect([...ledger.reviews]).toEqual(["배송이 빨랐습니다"]);
    expect(
      ledger.nullifiers.member(
        simulator.nullifier(eligibleSecrets[0], itemA),
      ),
    ).toBe(true);
  });

  it("rejects a second review for the same item", () => {
    const simulator = new ReviewSimulator(
      eligibleSecrets[0],
      eligibleSecrets,
      itemA,
    );
    simulator.submitReview("첫 번째 리뷰");

    expect(() => simulator.submitReview("두 번째 리뷰")).toThrow(
      "Review already submitted for this item",
    );
  });

  it("rejects a user outside the eligibility tree", () => {
    const simulator = new ReviewSimulator(bytes(9), eligibleSecrets, itemA);

    expect(() => simulator.submitReview("미자격 리뷰")).toThrow(
      "Reviewer is not eligible",
    );
  });

  it("derives different nullifiers for separate product contracts", () => {
    const productA = new ReviewSimulator(
      eligibleSecrets[0],
      eligibleSecrets,
      itemA,
    );
    const productB = new ReviewSimulator(
      eligibleSecrets[0],
      eligibleSecrets,
      itemB,
    );

    productA.submitReview("상품 A 리뷰");
    productB.submitReview("상품 B 리뷰");

    expect(
      productA.nullifier(eligibleSecrets[0], productA.getLedger().productId),
    ).not.toEqual(
      productB.nullifier(eligibleSecrets[0], productB.getLedger().productId),
    );
    expect([...productA.getLedger().reviews]).toEqual(["상품 A 리뷰"]);
    expect([...productB.getLedger().reviews]).toEqual(["상품 B 리뷰"]);
  });

  it("rejects deployment with duplicate eligible reviewer keys", () => {
    const duplicateSecrets = [
      eligibleSecrets[0],
      eligibleSecrets[0],
      eligibleSecrets[2],
    ];

    expect(
      () => new ReviewSimulator(eligibleSecrets[0], duplicateSecrets, itemA),
    ).toThrow("Eligible reviewer keys must be distinct");
  });
});
