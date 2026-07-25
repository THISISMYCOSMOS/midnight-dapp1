// SPDX-License-Identifier: Apache-2.0
//
// 발표 데모 전용 다중 리뷰어. 한 브라우저에서 자격자 3명을 전환하며 각자 리뷰가
// 실제로 작성되는지 보이기 위한 것이다. 세 비밀키가 한 곳(한 브라우저)에 모여
// 있으므로 발표에서는 "외부 관찰자 기준 k=3"까지만 주장하고 "admin조차 모른다"는
// 과잉 주장은 피한다 (AGENTS.md §1 범위 조정 2026-07-24).
//
// 비밀키는 VITE_DEMO_SECRET_1/2/3(테스트넷 데모 키, .env.local·gitignore)에서 읽고,
// 없으면 브라우저 localStorage에 유저별로 생성한다. 실제 금전 가치가 없는 키다.

import { pureCircuits } from "@midnight-review/contract";

export type DemoUser = {
  readonly id: number;
  readonly label: string;
  readonly secret: Uint8Array;
  readonly reviewerKey: Uint8Array;
  readonly reviewerKeyHex: string;
};

const toHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

const fromHex = (value: string): Uint8Array =>
  Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );

const isSecret = (value: string | undefined | null): value is string =>
  !!value && /^[0-9a-fA-F]{64}$/.test(value);

const storageKey = (id: number): string => `midnight-review:demo-user:v1:${id}`;

const secretFor = (id: number): Uint8Array => {
  const injected = (import.meta.env as Record<string, string | undefined>)[
    `VITE_DEMO_SECRET_${id}`
  ];
  if (isSecret(injected)) return fromHex(injected.toLowerCase());

  const stored = localStorage.getItem(storageKey(id));
  if (isSecret(stored)) return fromHex(stored);

  const generated = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(storageKey(id), toHex(generated));
  return generated;
};

export const demoUsers: readonly DemoUser[] = [1, 2, 3].map((id) => {
  const secret = secretFor(id);
  const reviewerKey = pureCircuits.deriveReviewerKey(secret);
  return {
    id,
    label: `사용자 ${id}`,
    secret,
    reviewerKey,
    reviewerKeyHex: toHex(reviewerKey),
  };
});
