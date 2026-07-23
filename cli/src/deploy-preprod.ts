// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { WebSocket } from "ws";
import pino from "pino";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  ReviewContract,
  createReviewPrivateState,
  type Contract,
  type ReviewPrivateState,
  type Witnesses,
} from "@midnight-review/contract";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import {
  operatorDataRoot,
  preprodEnvironment,
  projectRoot,
} from "./config.js";
import { ensureDust } from "./generate-dust.js";
import { inMemoryPrivateStateProvider } from "./in-memory-private-state-provider.js";
import { OperatorWallet } from "./wallet.js";
import { ensureNightFunds, syncWallet } from "./wallet-utils.js";

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["seed", "*.seed", "secret", "*.secret", "secretKey", "*.secretKey"],
    censor: "[REDACTED]",
  },
});

const reviewPrivateStateKey = "reviewPrivateState";
type ReviewPrivateStateId = typeof reviewPrivateStateKey;
type ReviewCompiledContract = Contract<
  ReviewPrivateState,
  Witnesses<ReviewPrivateState>
>;
type ReviewCircuitKeys = Exclude<
  keyof ReviewCompiledContract["impureCircuits"],
  number | symbol
>;
type ReviewProviders = MidnightProviders<
  ReviewCircuitKeys,
  ReviewPrivateStateId,
  ReviewPrivateState
>;

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const reviewerKeysFile = resolve(
  argument("--reviewer-keys") ??
    join(projectRoot, "deployment", "reviewer-keys.json"),
);
const prepareWalletOnly = process.argv.includes("--prepare-wallet-only");
const operatorSeedFile = join(operatorDataRoot, "preprod-wallet.seed");
const deploymentFile = join(projectRoot, "deployment", "preprod.json");
const uiEnvironmentFile = join(projectRoot, "ui", ".env.local");

const loadReviewerKeys = async (): Promise<
  [Uint8Array, Uint8Array, Uint8Array]
> => {
  const parsed = JSON.parse(
    await readFile(reviewerKeysFile, "utf8"),
  ) as unknown;
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    !parsed.every(
      (value) => typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value),
    )
  ) {
    throw new Error(
      "reviewer-keys.json에는 64자리 16진수 reviewerKey가 정확히 3개 있어야 합니다",
    );
  }
  const [first, second, third] = parsed as [string, string, string];
  return [
    Buffer.from(first, "hex"),
    Buffer.from(second, "hex"),
    Buffer.from(third, "hex"),
  ];
};

const loadOrCreateOperatorSeed = async (): Promise<string> => {
  await mkdir(dirname(operatorSeedFile), { recursive: true });
  try {
    const existing = (await readFile(operatorSeedFile, "utf8")).trim();
    if (!/^[0-9a-f]{64}$/.test(existing)) {
      throw new Error("운영자 지갑 seed 파일 형식이 잘못되었습니다");
    }
    return existing;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const seed = randomBytes(32).toString("hex");
  await writeFile(operatorSeedFile, seed, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return seed;
};

const assertProofServer = async (): Promise<void> => {
  const response = await fetch(preprodEnvironment.proofServer);
  if (!response.ok) {
    throw new Error(`proof server 응답 실패: HTTP ${response.status}`);
  }
  logger.info({ proofServerStatus: response.status });
};

setNetworkId("preprod");
await assertProofServer();

const reviewerKeys = prepareWalletOnly ? undefined : await loadReviewerKeys();
const seed = await loadOrCreateOperatorSeed();
const wallet = await OperatorWallet.build(logger, preprodEnvironment, seed);

try {
  await wallet.start();
  await syncWallet(logger, wallet.wallet);
  const unshieldedState = await ensureNightFunds(
    logger,
    wallet.wallet,
    preprodEnvironment,
  );
  await ensureDust(logger, seed, unshieldedState, wallet.wallet);
  await syncWallet(logger, wallet.wallet);

  if (prepareWalletOnly) {
    logger.info("Preprod 운영자 지갑 준비가 끝났습니다");
  } else {
    if (!reviewerKeys) {
      throw new Error("배포에 필요한 reviewerKey가 없습니다");
    }

    const zkConfigPath = join(
      projectRoot,
      "contract",
      "dist",
      "managed",
      "review",
    );
    const zkConfigProvider =
      new NodeZkConfigProvider<ReviewCircuitKeys>(zkConfigPath);
    const providers: ReviewProviders = {
      privateStateProvider: inMemoryPrivateStateProvider<
        ReviewPrivateStateId,
        ReviewPrivateState
      >(),
      publicDataProvider: indexerPublicDataProvider(
        preprodEnvironment.indexer,
        preprodEnvironment.indexerWS,
      ),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(
        preprodEnvironment.proofServer,
        zkConfigProvider,
      ),
      walletProvider: wallet,
      midnightProvider: wallet,
    };

    logger.info("Preprod에 리뷰 계약을 배포합니다");
    const deployed = await deployContract<ReviewCompiledContract>(providers, {
      compiledContract: ReviewContract,
      privateStateId: reviewPrivateStateKey,
      initialPrivateState: createReviewPrivateState(randomBytes(32)),
      args: [reviewerKeys],
    });

    const publicData = deployed.deployTxData.public;
    const result = {
      networkId: "preprod",
      contractAddress: publicData.contractAddress,
      txHash: publicData.txHash,
      blockHeight: publicData.blockHeight.toString(),
      reviewerKeys: reviewerKeys.map((key) => Buffer.from(key).toString("hex")),
      indexer: preprodEnvironment.indexer,
      indexerWS: preprodEnvironment.indexerWS,
      proofServer: preprodEnvironment.proofServer,
    };

    await mkdir(dirname(deploymentFile), { recursive: true });
    await writeFile(deploymentFile, `${JSON.stringify(result, null, 2)}\n`);
    await writeFile(
      uiEnvironmentFile,
      [
        "VITE_NETWORK_ID=preprod",
        `VITE_CONTRACT_ADDRESS=${result.contractAddress}`,
        `VITE_INDEXER_URI=${result.indexer}`,
        `VITE_INDEXER_WS_URI=${result.indexerWS}`,
        "VITE_PRODUCT_ID_HEX=",
        "VITE_PRODUCT_NAME=무선 이어폰 XR-200",
        "",
      ].join("\n"),
    );
    logger.info({
      contractDeployed: {
        contractAddress: result.contractAddress,
        txHash: result.txHash,
        blockHeight: result.blockHeight,
        deploymentFile,
      },
    });
  }
} finally {
  await wallet.stop();
}
