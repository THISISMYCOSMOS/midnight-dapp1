// SPDX-License-Identifier: Apache-2.0

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";
import { ReviewSimulator } from "./review-simulator.js";
import { UnsafeReviewSimulator } from "./unsafe-review-simulator.js";

setNetworkId("undeployed");

const bytes = (value: number): Uint8Array =>
  Uint8Array.from({ length: 32 }, () => value & 0xff);

const eligibleSecrets = [bytes(1), bytes(2), bytes(3)] as const;
const adminKey = bytes(21);
const attackerKey = bytes(99);
const itemId = bytes(10);

describe("ownPublicKey versus Merkle access control", () => {
  it("shows the same ineligible submission bypassing ownPublicKey and failing Merkle", () => {
    const unsafe = new UnsafeReviewSimulator(adminKey, attackerKey);
    const merkle = new ReviewSimulator(attackerKey, eligibleSecrets);

    expect(() => unsafe.submitReview("미자격 사용자의 리뷰")).toThrow(
      "Only the registered reviewer can submit",
    );
    expect([...unsafe.getLedger().reviews]).toEqual([]);

    unsafe.copyPublicAdminIntoClaim();
    expect([...unsafe.submitReview("미자격 사용자의 리뷰").reviews]).toEqual([
      "미자격 사용자의 리뷰",
    ]);

    expect(() => merkle.submitReview(itemId, "미자격 사용자의 리뷰")).toThrow(
      "Reviewer is not eligible",
    );
    expect([...merkle.getLedger().reviews]).toEqual([]);
  });

  it("keeps the final Merkle review anonymous in its public ledger shape", () => {
    const merkle = new ReviewSimulator(eligibleSecrets[0], eligibleSecrets);

    const publicLedger = merkle.submitReview(itemId, "자격자의 블라인드 리뷰");

    expect([...publicLedger.reviews]).toEqual(["자격자의 블라인드 리뷰"]);
    expect(Object.keys(publicLedger).sort()).toEqual([
      "eligible",
      "nullifiers",
      "reviews",
    ]);
    expect("reviewerKey" in publicLedger).toBe(false);
  });
});

describe("comparison stress", () => {
  it(
    "repeats 200 independent ineligible attacks with stable opposite outcomes",
    () => {
      for (let index = 0; index < 200; index += 1) {
        const attacker = bytes(index + 32);
        const unsafe = new UnsafeReviewSimulator(adminKey, attacker);
        const merkle = new ReviewSimulator(attacker, eligibleSecrets);
        const body = `공격 시도 ${index}`;

        unsafe.copyPublicAdminIntoClaim();
        expect([...unsafe.submitReview(body).reviews]).toEqual([body]);
        expect(() => merkle.submitReview(bytes(index + 40), body)).toThrow(
          "Reviewer is not eligible",
        );
        expect([...merkle.getLedger().reviews]).toEqual([]);
      }
    },
    30_000,
  );

  it("preserves Merkle state across repeated failures and user switches", () => {
    const merkle = new ReviewSimulator(eligibleSecrets[0], eligibleSecrets);

    for (let index = 0; index < 64; index += 1) {
      merkle.submitReview(bytes(index + 40), `정상 리뷰 ${index}`);
    }
    expect(merkle.getLedger().reviews.length()).toBe(64n);

    merkle.switchUser(attackerKey);
    for (let index = 0; index < 64; index += 1) {
      expect(() =>
        merkle.submitReview(bytes(index + 120), `미자격 리뷰 ${index}`),
      ).toThrow("Reviewer is not eligible");
    }
    expect(merkle.getLedger().reviews.length()).toBe(64n);

    merkle.switchUser(eligibleSecrets[0]);
    for (let index = 0; index < 32; index += 1) {
      expect(() => merkle.submitReview(bytes(40), "중복 리뷰")).toThrow(
        "Review already submitted for this item",
      );
    }
    expect(merkle.getLedger().reviews.length()).toBe(64n);
  });
});
