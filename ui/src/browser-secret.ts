// SPDX-License-Identifier: Apache-2.0

const storageKey = (contractScope: string): string =>
  `midnight-review:secret-key:v1:${contractScope}`;

const fromHex = (value: string): Uint8Array =>
  Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );

const toHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

const validSecret = (value: string | null): value is string =>
  value !== null && /^[0-9a-fA-F]{64}$/.test(value);

// URL 조각(#secret=)에서 비밀키를 자동 수입하던 로직은 제거했다. 보안 모델 전체가
// 32바이트 비밀에 걸려 있는데 이를 URL에 담아 로드만으로 저장하면, 링크 공유·브라우저
// 히스토리·리퍼러로 유출된다. 등록 화면의 "비밀키는 URL에 표시하지 않습니다" 약속과도
// 모순이었다. 비밀키는 이 브라우저에서 생성·보관하거나(ReviewerEnrollment) 데모용
// 주입 값(VITE_DEMO_SECRET_*)으로만 다룬다.

export const loadOrCreateBrowserSecret = (
  contractScope: string,
  fallbackScope?: string,
): Uint8Array => {
  const stored = localStorage.getItem(storageKey(contractScope));
  if (validSecret(stored)) return fromHex(stored);

  if (fallbackScope) {
    const fallback = localStorage.getItem(storageKey(fallbackScope));
    if (validSecret(fallback)) {
      localStorage.setItem(storageKey(contractScope), fallback.toLowerCase());
      return fromHex(fallback);
    }
  }

  const generated = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(storageKey(contractScope), toHex(generated));
  return generated;
};

export const reviewerEnrollmentScope = (
  networkId: string,
  itemId: Uint8Array,
): string => `enrollment:${networkId}:${toHex(itemId)}`;
