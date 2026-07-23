// SPDX-License-Identifier: Apache-2.0

import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const defaultItemId = (): Uint8Array => {
  const result = new Uint8Array(32);
  result.set(new TextEncoder().encode("midnight-review:item:xr-200:v1"));
  return result;
};

const parseBytes32 = (value: string | undefined): Uint8Array => {
  if (!value) return defaultItemId();
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("VITE_PRODUCT_ID_HEX must contain exactly 64 hex characters");
  }
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
};

export const appConfig = {
  networkId: (import.meta.env.VITE_NETWORK_ID ?? "undeployed") as NetworkId,
  contractAddress: (import.meta.env.VITE_CONTRACT_ADDRESS || undefined) as
    | ContractAddress
    | undefined,
  indexerUri: import.meta.env.VITE_INDEXER_URI as string | undefined,
  indexerWsUri: import.meta.env.VITE_INDEXER_WS_URI as string | undefined,
  productName:
    (import.meta.env.VITE_PRODUCT_NAME as string | undefined) ??
    "무선 이어폰 XR-200",
  itemId: parseBytes32(import.meta.env.VITE_PRODUCT_ID_HEX),
};
