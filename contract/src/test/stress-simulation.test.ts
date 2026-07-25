// SPDX-License-Identifier: Apache-2.0
//
// 스트레스·시뮬레이션 테스트. 발표 데모의 핵심 불변식을 실제 컴파일된 회로로 검증한다:
//   - k=3 자격 트리에서 세 자격자 모두 게시 / 미등록자 차단
//   - nullifier: 사용자·상품별 1회, 사용자 전환·상품 전환은 독립
//   - 파생키·nullifier 충돌 없음
//   - ownPublicKey 기준선(Q2): 등록된 작성자만 게시(신원 노출), 미등록 호출자는 차단, 중복 방지 없음

import {
  createCircuitContext,
  createConstructorContext,
  emptyZswapLocalState,
  sampleContractAddress,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, expect, it } from "vitest";
import {
  Contract as UnsafeContract,
  ledger as unsafeLedger,
} from "../../comparison/managed/unsafe-review/contract/index.js";
import { pureCircuits } from "../managed/review/contract/index.js";
import { ReviewSimulator } from "./review-simulator.js";

setNetworkId("undeployed");

// 32바이트 안에 n을 넣어 서로 다른 키/상품을 만든다 (재현 가능·충돌 없음).
const keyOf = (n: number): Uint8Array => {
  const a = new Uint8Array(32);
  a[0] = n & 0xff;
  a[1] = (n >>> 8) & 0xff;
  a[2] = (n >>> 16) & 0xff;
  a[3] = (n >>> 24) & 0xff;
  return a;
};

const hex = (v: Uint8Array): string => Buffer.from(v).toString("hex");

type UnsafeState = Record<string, never>;

const newUnsafe = (
  adminKey: Uint8Array,
): { contract: UnsafeContract<UnsafeState>; ctx: CircuitContext<UnsafeState> } => {
  const contract = new UnsafeContract<UnsafeState>({});
  const init = contract.initialState(
    createConstructorContext<UnsafeState>({}, { bytes: adminKey }),
  );
  const ctx = createCircuitContext(
    sampleContractAddress(),
    emptyZswapLocalState({ bytes: adminKey }),
    init.currentContractState,
    init.currentPrivateState,
  );
  return { contract, ctx };
};

describe("stress: Merkle 3-user demo flow", () => {
  it("runs 100 rounds of the full 사용자 1·2·3 flow keeping every invariant", () => {
    for (let round = 0; round < 100; round += 1) {
      const base = round * 1000;
      const eligible = [keyOf(base + 1), keyOf(base + 2), keyOf(base + 3)];
      const item = keyOf(base + 100);
      const sim = new ReviewSimulator(eligible[0], eligible);

      // 세 자격자가 같은 상품에 각각 한 번씩 게시 → 리뷰 3건.
      eligible.forEach((secret, index) => {
        sim.switchUser(secret);
        sim.submitReview(item, `r${round}-u${index}`);
      });
      expect(sim.getLedger().reviews.length()).toBe(3n);

      // 같은 자격자의 재작성은 nullifier로 차단 (리뷰 수 불변).
      eligible.forEach((secret) => {
        sim.switchUser(secret);
        expect(() => sim.submitReview(item, "중복")).toThrow(
          "Review already submitted for this item",
        );
      });
      expect(sim.getLedger().reviews.length()).toBe(3n);

      // 트리에 없는 키는 차단.
      sim.switchUser(keyOf(base + 500));
      expect(() => sim.submitReview(item, "미등록")).toThrow(
        "Reviewer is not eligible",
      );

      // 같은 자격자가 다른 상품에는 게시 가능 (nullifier가 상품별로 다름).
      sim.switchUser(eligible[0]);
      sim.submitReview(keyOf(base + 200), "다른 상품");
      expect(sim.getLedger().reviews.length()).toBe(4n);

      // 원장은 절대 작성자(reviewerKey)를 노출하지 않는다.
      expect("reviewerKey" in sim.getLedger()).toBe(false);
      expect(Object.keys(sim.getLedger()).sort()).toEqual([
        "eligible",
        "nullifiers",
        "reviews",
      ]);
    }
  }, 120_000);

  it("admits exactly the three eligible keys among 500 candidates each round", () => {
    for (let round = 0; round < 20; round += 1) {
      const base = round * 10_000;
      const eligible = [keyOf(base + 1), keyOf(base + 2), keyOf(base + 3)];
      const sim = new ReviewSimulator(eligible[0], eligible);
      const tree = sim.getLedger().eligible;

      for (const secret of eligible) {
        expect(tree.findPathForLeaf(sim.reviewerKey(secret))).toBeDefined();
      }
      // 자격자가 아닌 497개 후보는 전부 트리에 없어야 한다.
      for (let n = 4; n < 500; n += 1) {
        expect(
          tree.findPathForLeaf(sim.reviewerKey(keyOf(base + n))),
        ).toBeUndefined();
      }
    }
  }, 60_000);
});

describe("stress: derivation collision-freedom", () => {
  it("derives 3000 unique reviewerKeys and nullifiers with no collision", () => {
    const keys = new Set<string>();
    const nullifiers = new Set<string>();
    const item = keyOf(777);
    for (let n = 0; n < 3000; n += 1) {
      const secret = keyOf(n);
      const key = hex(pureCircuits.deriveReviewerKey(secret));
      const nullifier = hex(pureCircuits.deriveNullifier(secret, item));
      expect(keys.has(key)).toBe(false);
      expect(nullifiers.has(nullifier)).toBe(false);
      keys.add(key);
      nullifiers.add(nullifier);
    }
    expect(keys.size).toBe(3000);
    expect(nullifiers.size).toBe(3000);
  });

  it("nullifier is deterministic per (secret,item) and varies by item and secret", () => {
    const s1 = keyOf(1);
    const s2 = keyOf(2);
    const itemA = keyOf(10);
    const itemB = keyOf(11);

    expect(pureCircuits.deriveNullifier(s1, itemA)).toEqual(
      pureCircuits.deriveNullifier(s1, itemA),
    );
    expect(pureCircuits.deriveNullifier(s1, itemA)).not.toEqual(
      pureCircuits.deriveNullifier(s1, itemB),
    );
    expect(pureCircuits.deriveNullifier(s1, itemA)).not.toEqual(
      pureCircuits.deriveNullifier(s2, itemA),
    );
  });
});

describe("stress: ownPublicKey baseline (Q2 honest behavior)", () => {
  it("registered author posts with exposed identity; 300 outsiders all blocked", () => {
    const admin = keyOf(21);
    const { contract, ctx } = newUnsafe(admin);

    // 등록된 작성자(=admin)가 게시 → 성공, 신원(admin 키)이 원장에 노출.
    const posted = contract.impureCircuits.submitReview(ctx, "정품 후기").context;
    const ledger = unsafeLedger(posted.currentQueryContext.state);
    expect([...ledger.reviews]).toEqual(["정품 후기"]);
    expect(hex(ledger.admin.bytes)).toBe(hex(admin));

    // 미등록 호출자 300명 전부 차단, 원장 불변 (attemptOutsider 비변형성도 함께 확인).
    for (let n = 0; n < 300; n += 1) {
      const outsiderCtx: CircuitContext<UnsafeState> = {
        ...posted,
        currentZswapLocalState: emptyZswapLocalState({
          bytes: keyOf(10_000 + n),
        }),
      };
      expect(() =>
        contract.impureCircuits.submitReview(outsiderCtx, `침입 ${n}`),
      ).toThrow("Only the registered reviewer can submit");
    }
    expect(unsafeLedger(posted.currentQueryContext.state).reviews.length()).toBe(
      1n,
    );
  }, 60_000);

  it("has no duplicate prevention: registered author can repost the same body", () => {
    const admin = keyOf(42);
    const { contract, ctx } = newUnsafe(admin);
    let current = ctx;
    for (let n = 0; n < 5; n += 1) {
      current = contract.impureCircuits.submitReview(current, "같은 글").context;
    }
    expect(unsafeLedger(current.currentQueryContext.state).reviews.length()).toBe(
      5n,
    );
  });
});
