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

export type BrowserConnectionConfig = {
  readonly networkId: string;
  readonly contractAddress: ContractAddress;
  readonly indexerUri: string;
  readonly indexerWsUri: string;
  readonly itemId: Uint8Array;
};

export type BrowserDeploymentConfig = Omit<
  BrowserConnectionConfig,
  "contractAddress"
>;

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

const assertPreprodRequest = (config: BrowserDeploymentConfig): void => {
  if (config.networkId !== "preprod") {
    throw new Error("발표용 MVP는 Preprod 네트워크만 사용할 수 있습니다");
  }
  if (
    config.indexerUri !== preprodIndexerUri ||
    config.indexerWsUri !== preprodIndexerWsUri
  ) {
    throw new Error("공식 Preprod 인덱서 주소가 아닙니다");
  }
};

const assertPreprodWallet = (configuration: Configuration): string => {
  if (configuration.networkId !== "preprod") {
    throw new Error(
      `Lace 네트워크가 Preprod가 아닙니다: ${configuration.networkId}`,
    );
  }

  if (!configuration.proverServerUri) {
    throw new Error("Lace에서 Proof Server 주소를 받지 못했습니다");
  }

  let proofServerUrl: URL;
  try {
    proofServerUrl = new URL(configuration.proverServerUri);
  } catch {
    throw new Error(
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
    throw new Error(
      `Lace Proof Server가 로컬 6300이 아닙니다: ${configuration.proverServerUri}`,
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

const connectToWallet = async (networkId: string): Promise<ConnectedAPI> => {
  const deadline = Date.now() + 1_000;
  let wallet = firstCompatibleWallet();

  while (!wallet && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    wallet = firstCompatibleWallet();
  }

  if (!wallet) {
    throw new Error("Midnight Lace 지갑을 찾지 못했습니다");
  }

  const connection = await Promise.race([
    wallet.connect(networkId),
    new Promise<never>((_, reject) =>
      window.setTimeout(
        () => reject(new Error("지갑 연결 응답 시간이 초과되었습니다")),
        walletApprovalTimeoutMs,
      ),
    ),
  ]);
  await connection.getConnectionStatus();
  return connection;
};

const connectReviewProviders = async (
  config: BrowserDeploymentConfig,
): Promise<ReviewProviders> => {
  assertPreprodRequest(config);
  const connectedApi = await connectToWallet(config.networkId);
  const walletConfig = await connectedApi.getConfiguration();
  const proofServerUri = assertPreprodWallet(walletConfig);
  const addresses = await connectedApi.getShieldedAddresses();
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
      proofServerUri,
      zkConfigProvider,
    ),
    publicDataProvider: createPublicDataProvider(
      config.indexerUri,
      config.indexerWsUri,
    ),
    walletProvider: {
      getCoinPublicKey: () => addresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => addresses.shieldedEncryptionPublicKey,
      balanceTx: async (
        transaction: UnboundTransaction,
        _ttl?: Date,
      ): Promise<FinalizedTransaction> => {
        const balanced = await connectedApi.balanceUnsealedTransaction(
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
        await connectedApi.submitTransaction(toHex(transaction.serialize()));
        return transaction.identifiers()[0];
      },
    },
  };
};

export const inspectPreprodWallet = async (
  config: BrowserDeploymentConfig,
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
    config.itemId,
  );
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
