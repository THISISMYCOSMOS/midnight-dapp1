// SPDX-License-Identifier: Apache-2.0

import {
  type ConnectedAPI,
  type Configuration,
  type InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  fromHex,
  toHex,
  type ContractAddress,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {
  Binding,
  type FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  type TransactionId,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import semver from "semver";
import { ReviewApi } from "./review-api";
import { inMemoryPrivateStateProvider } from "./in-memory-private-state-provider";
import type {
  ReviewCircuitKeys,
  ReviewPrivateStateId,
  ReviewProviders,
} from "./types";
import type { ReviewPrivateState } from "@midnight-review/contract";

// 우리가 직접 쓴, 사용자가 읽고 조치할 수 있는 오류. 라이브러리 원문 오류와 구분해
// 화면에 그대로 띄우기 위한 표식이다(AGENTS.md §2.6: 내부 에러 문자열 노출 금지).
export class WalletSetupError extends Error {}

type BrowserNetworkConfig = {
  readonly networkId: string;
  readonly indexerUri: string;
  readonly indexerWsUri: string;
};

export type BrowserConnectionConfig = BrowserNetworkConfig & {
  readonly contractAddress: ContractAddress;
};

export type BrowserDeploymentConfig = BrowserNetworkConfig & {
  readonly itemId: Uint8Array;
};

export type PreprodWalletCheck = {
  readonly networkId: string;
  readonly proofServerUri: string;
  readonly dustBalance: string;
  readonly dustCap: string;
};

export const createPublicDataProvider = (
  indexerUri: string,
  indexerWsUri: string,
) => indexerPublicDataProvider(indexerUri, indexerWsUri, window.WebSocket);

const compatibleConnectorVersion = "4.x";
const walletApprovalTimeoutMs = 120_000;
const preprodIndexerUri =
  "https://indexer.preprod.midnight.network/api/v4/graphql";
const preprodIndexerWsUri =
  "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";

const assertPreprodRequest = (config: BrowserNetworkConfig): void => {
  if (config.networkId !== "preprod") {
    throw new WalletSetupError("발표용 MVP는 Preprod 네트워크만 사용할 수 있습니다");
  }
  if (
    config.indexerUri !== preprodIndexerUri ||
    config.indexerWsUri !== preprodIndexerWsUri
  ) {
    throw new WalletSetupError("공식 Preprod 인덱서 주소가 아닙니다");
  }
};

const assertPreprodWallet = (configuration: Configuration): string => {
  if (configuration.networkId !== "preprod") {
    throw new WalletSetupError(
      `Lace 네트워크가 Preprod가 아닙니다: ${configuration.networkId}`,
    );
  }

  if (!configuration.proverServerUri) {
    throw new WalletSetupError("Lace에서 Proof Server 주소를 받지 못했습니다");
  }

  let proofServerUrl: URL;
  try {
    proofServerUrl = new URL(configuration.proverServerUri);
  } catch {
    throw new WalletSetupError(
      `Lace Proof Server 주소가 올바르지 않습니다: ${configuration.proverServerUri}`,
    );
  }

  const isLocalHost =
    proofServerUrl.hostname === "localhost" ||
    proofServerUrl.hostname === "127.0.0.1";
  const isRootPath =
    (proofServerUrl.pathname === "" || proofServerUrl.pathname === "/") &&
    proofServerUrl.search === "" &&
    proofServerUrl.hash === "";

  if (
    proofServerUrl.protocol !== "http:" ||
    !isLocalHost ||
    proofServerUrl.port !== "6300" ||
    proofServerUrl.username !== "" ||
    proofServerUrl.password !== "" ||
    !isRootPath
  ) {
    // 실제로 여기서 막혀 원인을 찾는 데 시간을 쓴 적이 있다. 무엇을 바꿔야 하는지까지 적는다.
    throw new WalletSetupError(
      `Lace의 Proof Server가 로컬이 아닙니다 (현재 ${configuration.proverServerUri}) — Lace 설정에서 http://127.0.0.1:6300 으로 바꾸세요`,
    );
  }

  return proofServerUrl.origin;
};

const firstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === "object" &&
      "apiVersion" in wallet &&
      semver.satisfies(wallet.apiVersion, compatibleConnectorVersion),
  );
};

// 확장이 주입한 커넥터 목록을 그대로 보고한다. "못 찾았다"만으로는 미설치·잠금·
// 버전 불일치를 구분할 수 없어 발표 직전에 원인을 못 찾는다.
const injectedWalletSummary = (): string => {
  if (!window.midnight) return "";
  return Object.entries(window.midnight)
    .map(([name, wallet]) => {
      const version =
        wallet && typeof wallet === "object" && "apiVersion" in wallet
          ? String((wallet as InitialAPI).apiVersion)
          : "버전 미상";
      return `${name}@${version}`;
    })
    .join(", ");
};

const connectToWallet = async (networkId: string): Promise<ConnectedAPI> => {
  // 확장 주입이 늦는 경우가 있어 3초까지 기다린다(하드 새로고침 직후 클릭).
  const deadline = Date.now() + 3_000;
  let wallet = firstCompatibleWallet();

  while (!wallet && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    wallet = firstCompatibleWallet();
  }

  if (!wallet) {
    const injected = injectedWalletSummary();
    throw new WalletSetupError(
      injected
        ? `호환되는 Midnight 지갑이 없습니다 — 발견: ${injected} / 필요: ${compatibleConnectorVersion}`
        : "Midnight 지갑 확장을 찾지 못했습니다 — Lace 설치·잠금 해제 후 새로고침하세요",
    );
  }

  const connection = await Promise.race([
    wallet.connect(networkId),
    new Promise<never>((_, reject) =>
      window.setTimeout(
        () => reject(new WalletSetupError("지갑 연결 응답 시간이 초과되었습니다")),
        walletApprovalTimeoutMs,
      ),
    ),
  ]);
  await connection.getConnectionStatus();
  return connection;
};

type ReviewWalletContext = {
  readonly connectedApi: ConnectedAPI;
  readonly proofServerUri: string;
  readonly addresses: Awaited<
    ReturnType<ConnectedAPI["getShieldedAddresses"]>
  >;
  // 인덱서 연결은 리뷰어와 무관하므로 세션당 하나만 만든다. join마다 새로 만들면
  // 사용자 전환·미등록 시도를 반복하는 동안 WebSocket이 정리되지 않고 쌓인다.
  readonly publicDataProvider: ReturnType<typeof createPublicDataProvider>;
};

// 지갑을 한 번 연결한다. 이 결과(connectedApi)를 재사용하면 사용자 전환 때
// Lace 승인을 다시 받지 않아도 된다.
const connectReviewWallet = async (
  config: BrowserNetworkConfig,
): Promise<ReviewWalletContext> => {
  assertPreprodRequest(config);
  const connectedApi = await connectToWallet(config.networkId);
  const walletConfig = await connectedApi.getConfiguration();
  const proofServerUri = assertPreprodWallet(walletConfig);
  const addresses = await connectedApi.getShieldedAddresses();
  return {
    connectedApi,
    proofServerUri,
    addresses,
    publicDataProvider: createPublicDataProvider(
      config.indexerUri,
      config.indexerWsUri,
    ),
  };
};

// join 때마다 새 private state provider를 만든다 — 리뷰어마다 private state를 격리하기
// 위해서다. 지갑 연결과 인덱서 연결은 재사용하므로 Lace 팝업도 WebSocket도 늘지 않는다.
const buildReviewProviders = (
  wallet: ReviewWalletContext,
): ReviewProviders => {
  const zkConfigProvider = new FetchZkConfigProvider<ReviewCircuitKeys>(
    window.location.origin,
    fetch.bind(window),
  );
  const privateStateProvider = inMemoryPrivateStateProvider<
    ReviewPrivateStateId,
    ReviewPrivateState
  >();

  return {
    privateStateProvider,
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      wallet.proofServerUri,
      zkConfigProvider,
    ),
    publicDataProvider: wallet.publicDataProvider,
    walletProvider: {
      getCoinPublicKey: () => wallet.addresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () =>
        wallet.addresses.shieldedEncryptionPublicKey,
      balanceTx: async (
        transaction: UnboundTransaction,
        _ttl?: Date,
      ): Promise<FinalizedTransaction> => {
        const balanced = await wallet.connectedApi.balanceUnsealedTransaction(
          toHex(transaction.serialize()),
        );
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          "signature",
          "proof",
          "binding",
          fromHex(balanced.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (
        transaction: FinalizedTransaction,
      ): Promise<TransactionId> => {
        await wallet.connectedApi.submitTransaction(
          toHex(transaction.serialize()),
        );
        return transaction.identifiers()[0];
      },
    },
  };
};

const connectReviewProviders = async (
  config: BrowserNetworkConfig,
): Promise<ReviewProviders> =>
  buildReviewProviders(await connectReviewWallet(config));

export const inspectPreprodWallet = async (
  config: BrowserNetworkConfig,
): Promise<PreprodWalletCheck> => {
  assertPreprodRequest(config);
  const connectedApi = await connectToWallet(config.networkId);
  const configuration = await connectedApi.getConfiguration();
  const proofServerUri = assertPreprodWallet(configuration);
  const dust = await connectedApi.getDustBalance();

  return {
    networkId: configuration.networkId,
    proofServerUri,
    dustBalance: dust.balance.toString(),
    dustCap: dust.cap.toString(),
  };
};

export const connectReviewApi = async (
  config: BrowserConnectionConfig,
  secretKey: Uint8Array,
): Promise<ReviewApi> => {
  const providers = await connectReviewProviders(config);
  return ReviewApi.join(
    providers,
    config.contractAddress,
    secretKey,
  );
};

// 지갑을 한 번만 연결하고, 이후 리뷰어 비밀키만 바꿔가며 join한다.
// 데모에서 사용자 1·2·3을 전환할 때 Lace 승인을 반복하지 않기 위한 것이다.
export type ReviewSession = {
  readonly join: (secretKey: Uint8Array) => Promise<ReviewApi>;
};

export const connectReviewSession = async (
  config: BrowserConnectionConfig,
): Promise<ReviewSession> => {
  const wallet = await connectReviewWallet(config);
  return {
    join: (secretKey: Uint8Array) =>
      ReviewApi.join(
        buildReviewProviders(wallet),
        config.contractAddress,
        secretKey,
      ),
  };
};

export const deployReviewApi = async (
  config: BrowserDeploymentConfig,
  initialEligible: readonly Uint8Array[],
): Promise<ReviewApi> => {
  const providers = await connectReviewProviders(config);
  const deploymentPrivateStateSecret = crypto.getRandomValues(
    new Uint8Array(32),
  );
  return ReviewApi.deploy(
    providers,
    initialEligible,
    deploymentPrivateStateSecret,
    config.itemId,
  );
};
