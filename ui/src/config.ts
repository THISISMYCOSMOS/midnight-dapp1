// SPDX-License-Identifier: Apache-2.0

import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type { NetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const defaultNetworkId = "preprod";
const preprodIndexerUri =
  "https://indexer.preprod.midnight.network/api/v4/graphql";
const preprodIndexerWsUri =
  "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";

const defaultItemId = (): Uint8Array => {
  const result = new Uint8Array(32);
  result.set(new TextEncoder().encode("midnight-review:item:xr-200:v1"));
  return result;
};

const labelToItemId = (label: string): Uint8Array => {
  const result = new Uint8Array(32);
  result.set(new TextEncoder().encode(label).slice(0, 32));
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

// 테스트용 상품 전환. nullifier는 (비밀키, itemId)로 파생되므로 itemId를 바꾸면
// 중복 차단이 풀려 같은 계약에서 세 사용자가 다시 제출할 수 있다.
// 주의: reviews 목록은 상품별이 아니라 계약 전역이라 이전 리뷰는 그대로 남는다.
// 게시판까지 비우려면 /deploy로 계약을 새로 배포해야 한다(온체인 삭제는 불가능).
//   /compare?item=test2   또는   /compare?item=<64자리 hex>
const itemIdFromUrl = (): Uint8Array | undefined => {
  const value = new URLSearchParams(window.location.search).get("item")?.trim();
  if (!value) return undefined;
  return /^[0-9a-fA-F]{64}$/.test(value)
    ? parseBytes32(value.toLowerCase())
    : labelToItemId(value);
};

const networkId = (
  import.meta.env.VITE_NETWORK_ID ?? defaultNetworkId
) as NetworkId;

export const appConfig = {
  networkId,
  // URL의 ?contract= 를 우선한다. env 값은 기본 배포 주소일 뿐이며, 새 계약을
  // 명시적으로 가리키려는 URL 파라미터가 이를 덮어써야 한다.
  contractAddress: (
    new URLSearchParams(window.location.search).get("contract") ||
    import.meta.env.VITE_CONTRACT_ADDRESS ||
    undefined
  ) as
    | ContractAddress
    | undefined,
  indexerUri: (
    import.meta.env.VITE_INDEXER_URI ||
    (networkId === "preprod" ? preprodIndexerUri : undefined)
  ) as string | undefined,
  indexerWsUri: (
    import.meta.env.VITE_INDEXER_WS_URI ||
    (networkId === "preprod" ? preprodIndexerWsUri : undefined)
  ) as string | undefined,
  productName:
    (import.meta.env.VITE_PRODUCT_NAME as string | undefined) ??
    "무선 이어폰 XR-200",
  itemId: itemIdFromUrl() ?? parseBytes32(import.meta.env.VITE_PRODUCT_ID_HEX),
};
