// SPDX-License-Identifier: Apache-2.0
//
// 발표 데모 전용 다중 리뷰어. 한 브라우저에서 자격자 3명을 전환하며 각자 리뷰가
// 실제로 작성되는지 보이기 위한 것이다. 세 비밀키가 한 곳(한 브라우저)에 모여
// 있으므로 발표에서는 "외부 관찰자 기준 k=3"까지만 주장하고 "admin조차 모른다"는
// 과잉 주장은 피한다 (AGENTS.md §1 범위 조정 2026-07-24).
//
// 비밀키는 VITE_DEMO_SECRET_1/2/3(테스트넷 데모 키, .env.local·gitignore)에서 읽고,
// 없으면 브라우저 localStorage에 유저별로 생성한다. 실제 금전 가치가 없는 키다.
//
// 주의 — 이 모듈은 비밀키를 만든다. 그래서 `demoUsers` 상수를 모듈 최상위에서 계산하지
// 않는다. 예전에는 그랬고, 그 결과 `/deploy`(운영자 화면)가 이 모듈을 import하는 것만으로
// 운영자 브라우저에 리뷰어 비밀키 3개가 생성됐다. 운영자가 비밀키를 알면 공개 nullifier를
// 재계산해 작성자를 특정할 수 있다(AGENTS.md §6.5). 필요한 화면이 `getDemoUsers()`를
// 명시적으로 부를 때만 만들어진다.

import { pureCircuits } from "@midnight-review/contract";

export type DemoUser = {
  readonly id: number;
  readonly label: string;
  readonly secret: Uint8Array;
  readonly reviewerKey: Uint8Array;
  readonly reviewerKeyHex: string;
  // 이 키가 어디서 왔는가. "browser"는 대응 비밀키가 이 브라우저 localStorage에만 있는
  // 값이라는 뜻이며, 자격 트리에 넣으면 익명성이 성립하지 않는다(§1 범위 조정 2026-07-24).
  readonly origin: "env" | "browser";
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

const secretFor = (
  id: number,
): { readonly secret: Uint8Array; readonly origin: "env" | "browser" } => {
  const injected = (import.meta.env as Record<string, string | undefined>)[
    `VITE_DEMO_SECRET_${id}`
  ];
  if (isSecret(injected)) {
    return { secret: fromHex(injected.toLowerCase()), origin: "env" };
  }

  const stored = localStorage.getItem(storageKey(id));
  if (isSecret(stored)) return { secret: fromHex(stored), origin: "browser" };

  const generated = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(storageKey(id), toHex(generated));
  return { secret: generated, origin: "browser" };
};

let cached: readonly DemoUser[] | undefined;

// 호출한 화면에서만 비밀키를 만든다. 결과는 세션 안에서 재사용한다 — 부를 때마다
// 새로 만들면 같은 화면 안에서 사용자 1의 파생키가 달라진다.
export const getDemoUsers = (): readonly DemoUser[] => {
  cached ??= [1, 2, 3].map((id) => {
    const { secret, origin } = secretFor(id);
    const reviewerKey = pureCircuits.deriveReviewerKey(secret);
    return {
      id,
      label: `사용자 ${id}`,
      secret,
      reviewerKey,
      reviewerKeyHex: toHex(reviewerKey),
      origin,
    };
  });
  return cached;
};
