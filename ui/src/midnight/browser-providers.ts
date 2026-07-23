// SPDX-License-Identifier: Apache-2.0

import {
  type ConnectedAPI,
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

export const createPublicDataProvider = (
  indexerUri: string,
  indexerWsUri: string,
) => indexerPublicDataProvider(indexerUri, indexerWsUri, window.WebSocket);

const compatibleConnectorVersion = "4.x";

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
        5_000,
      ),
    ),
  ]);
  await connection.getConnectionStatus();
  return connection;
};

export const connectReviewApi = async (
  config: BrowserConnectionConfig,
  secretKey: Uint8Array,
): Promise<ReviewApi> => {
  const connectedApi = await connectToWallet(config.networkId);
  const walletConfig = await connectedApi.getConfiguration();
  if (!walletConfig.proverServerUri) {
    throw new Error("지갑에서 proof server 주소를 받지 못했습니다");
  }
  const addresses = await connectedApi.getShieldedAddresses();
  const zkConfigProvider = new FetchZkConfigProvider<ReviewCircuitKeys>(
    window.location.origin,
    fetch.bind(window),
  );
  const privateStateProvider = inMemoryPrivateStateProvider<
    ReviewPrivateStateId,
    ReviewPrivateState
  >();

  const providers: ReviewProviders = {
    privateStateProvider,
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      walletConfig.proverServerUri,
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

  return ReviewApi.join(
    providers,
    config.contractAddress,
    secretKey,
    config.itemId,
  );
};
