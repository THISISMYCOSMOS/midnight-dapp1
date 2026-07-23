// SPDX-License-Identifier: Apache-2.0

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";

const localDataRoot =
  process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share");

export const projectRoot = resolve(import.meta.dirname, "..", "..");
export const operatorDataRoot = join(
  localDataRoot,
  "midnight-review",
  "operator",
);
export const reviewerDataRoot = join(
  localDataRoot,
  "midnight-review",
  "reviewers",
);

export const preprodEnvironment: EnvironmentConfiguration = {
  walletNetworkId: "preprod",
  networkId: "preprod",
  indexer: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  nodeWS: "wss://rpc.preprod.midnight.network",
  faucet: "https://midnight-tmnight-preprod.nethermind.dev/",
  proofServer: "http://127.0.0.1:6300",
};
