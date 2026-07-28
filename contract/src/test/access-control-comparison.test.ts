// SPDX-License-Identifier: Apache-2.0

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";
import { ReviewSimulator } from "./review-simulator.js";
import { UnsafeReviewSimulator } from "./unsafe-review-simulator.js";

setNetworkId("undeployed");

const bytes = (value: number): Uint8Array =>
  Uint8Array.from({ length: 32 }, () => value & 0xff);

const eligibleSecrets = [bytes(1), bytes(2), bytes(3)] as const;
const outsiderSecret = bytes(4);
const attackerKey = bytes(99);
const itemId = bytes(10);

describe("ownPublicKey baseline exposes a public admin value; Merkle keeps anonymity", () => {
  it("records the compared admin value in the ownPublicKey ledger", () => {
    const adminValue = bytes(21);
    const unsafe = new UnsafeReviewSimulator(adminValue);

    const publicLedger = unsafe.submit("자격자의 리뷰");

    expect([...publicLedger.reviews]).toEqual(["자격자의 리뷰"]);
    // admin 슬롯은 공개 원장 필드다. ownPublicKey 컨텍스트 값과 비교할 뿐,
    // 호출자가 그 키를 소유했다는 사실은 증명하지 않는다.
    expect("admin" in publicLedger).toBe(true);
    expect([...unsafe.exposedAdminValue()]).toEqual([...adminValue]);
  });

  it("keeps the Merkle author absent from the public ledger", () => {
    const merkle = new ReviewSimulator(
      eligibleSecrets[0],
      eligibleSecrets,
      itemId,
    );

    const publicLedger = merkle.submitReview("자격자의 블라인드 리뷰");

    expect([...publicLedger.reviews]).toEqual(["자격자의 블라인드 리뷰"]);
    expect(Object.keys(publicLedger).sort()).toEqual([
      "eligible",
      "nullifiers",
      "productId",
      "reviews",
    ]);
    expect("reviewerKey" in publicLedger).toBe(false);
    // ownPublicKey 기준선과 달리 작성자 신원 슬롯 자체가 없다.
    expect("admin" in publicLedger).toBe(false);
  });

  it("blocks an ineligible reviewer on Merkle without revealing identity", () => {
    const merkle = new ReviewSimulator(attackerKey, eligibleSecrets, itemId);

    expect(() => merkle.submitReview("미등록 리뷰")).toThrow(
      "Reviewer is not eligible",
    );
    expect([...merkle.getLedger().reviews]).toEqual([]);
  });
});

describe("anonymity set k=3", () => {
  it("admits all three eligible derived keys and rejects a fourth", () => {
    const merkle = new ReviewSimulator(
      eligibleSecrets[0],
      eligibleSecrets,
      itemId,
    );

    // 세 자격자 파생키 모두 자격 트리에서 경로를 찾는다 → 관찰자 기준 k=3.
    for (const secret of eligibleSecrets) {
      const reviewerKey = merkle.reviewerKey(secret);
      expect(
        merkle.getLedger().eligible.findPathForLeaf(reviewerKey),
      ).toBeDefined();
    }

    // 트리에 없는 네 번째 키는 경로가 없다.
    const outsiderKey = merkle.reviewerKey(outsiderSecret);
    expect(
      merkle.getLedger().eligible.findPathForLeaf(outsiderKey),
    ).toBeUndefined();
  });

  it("lets each of the three eligible reviewers post a review", () => {
    eligibleSecrets.forEach((secret, index) => {
      const merkle = new ReviewSimulator(secret, eligibleSecrets, itemId);
      const ledger = merkle.submitReview(`자격자 ${index} 리뷰`);
      expect([...ledger.reviews]).toEqual([`자격자 ${index} 리뷰`]);
    });

    const outsider = new ReviewSimulator(
      outsiderSecret,
      eligibleSecrets,
      itemId,
    );
    expect(() => outsider.submitReview("네 번째 미등록 리뷰")).toThrow(
      "Reviewer is not eligible",
    );
  });
});

describe("comparison stress", () => {
  it("blocks 200 independent ineligible reviewers on Merkle", () => {
    for (let index = 0; index < 200; index += 1) {
      const attacker = bytes(index + 32);
      const merkle = new ReviewSimulator(
        attacker,
        eligibleSecrets,
        bytes(index + 40),
      );
      expect(() => merkle.submitReview(`공격 시도 ${index}`)).toThrow(
        "Reviewer is not eligible",
      );
      expect([...merkle.getLedger().reviews]).toEqual([]);
    }
    // 실측 4.9s / 10.0s / 14.6s로 3배까지 흔들린다(머신 부하). 30초는 여유가 2배뿐이라
    // 실제로 한 번 초과했다. 형제 테스트와 같은 60초로 맞춘다 — 단언은 그대로다.
  }, 60_000);

  it("preserves Merkle state across repeated failures and user switches", () => {
    const merkle = new ReviewSimulator(
      eligibleSecrets[0],
      eligibleSecrets,
      itemId,
    );

    for (const [index, secret] of eligibleSecrets.entries()) {
      merkle.switchUser(secret);
      merkle.submitReview(`정상 리뷰 ${index}`);
    }
    expect(merkle.getLedger().reviews.length()).toBe(3n);

    merkle.switchUser(attackerKey);
    for (let index = 0; index < 64; index += 1) {
      expect(() => merkle.submitReview(`미자격 리뷰 ${index}`)).toThrow(
        "Reviewer is not eligible",
      );
    }
    expect(merkle.getLedger().reviews.length()).toBe(3n);

    merkle.switchUser(eligibleSecrets[0]);
    for (let index = 0; index < 32; index += 1) {
      expect(() => merkle.submitReview("중복 리뷰")).toThrow(
        "Review already submitted for this item",
      );
    }
    expect(merkle.getLedger().reviews.length()).toBe(3n);
  });
});
