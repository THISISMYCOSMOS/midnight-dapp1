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

export const consumeImportedBrowserSecret = (contractScope: string): void => {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const imported = fragment.get("secret");

  if (validSecret(imported)) {
    localStorage.setItem(storageKey(contractScope), imported.toLowerCase());
  }

  if (imported !== null) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
};

export const loadOrCreateBrowserSecret = (
  contractScope: string,
): Uint8Array => {
  const stored = localStorage.getItem(storageKey(contractScope));
  if (validSecret(stored)) return fromHex(stored);

  const generated = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(storageKey(contractScope), toHex(generated));
  return generated;
};
