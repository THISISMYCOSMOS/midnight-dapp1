// SPDX-License-Identifier: Apache-2.0
// Adapted from midnightntwrk/example-bboard for the approved deploy-wallet-only exception.

import { Buffer } from "node:buffer";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import {
  createKeystore,
  type UnshieldedWalletState,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import type { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import type { Logger } from "pino";
import * as Rx from "rxjs";

const unshieldedSeed = (seed: string): Uint8Array => {
  const result = HDWallet.fromSeed(Buffer.from(seed, "hex")) as {
    type: "seedOk";
    hdWallet: HDWallet;
  };
  if (result.type !== "seedOk") {
    throw new Error("운영자 지갑 seed를 읽지 못했습니다");
  }
  const derived = result.hdWallet
    .selectAccount(0)
    .selectRole(Roles.NightExternal)
    .deriveKeyAt(0);
  if (derived.type === "keyOutOfBounds") {
    throw new Error("운영자 지갑 키 파생 범위를 벗어났습니다");
  }
  return derived.key;
};

export const ensureDust = async (
  logger: Logger,
  seed: string,
  unshieldedState: UnshieldedWalletState,
  wallet: WalletFacade,
): Promise<string | undefined> => {
  const currentDust = await wallet.dust.waitForSyncedState();
  if (currentDust.balance(new Date()) > 0n) {
    logger.info({ operatorDustBalance: currentDust.balance(new Date()).toString() });
    return undefined;
  }

  const utxos = unshieldedState.availableCoins.filter(
    (coin) => !coin.meta.registeredForDustGeneration,
  );
  if (utxos.length === 0) {
    throw new Error(
      "등록 가능한 tNIGHT UTXO가 없고 DUST 잔액도 없습니다",
    );
  }

  logger.info({ dustRegistrationUtxos: utxos.length });
  const keystore = createKeystore(unshieldedSeed(seed), getNetworkId());
  const recipe = await wallet.registerNightUtxosForDustGeneration(
    utxos,
    keystore.getPublicKey(),
    (payload) => keystore.signData(payload),
    currentDust.address,
  );
  const transaction = await wallet.finalizeRecipe(recipe);
  const transactionId = await wallet.submitTransaction(transaction);
  const balance = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.map((state) => state.dust.balance(new Date())),
      Rx.filter((value) => value > 0n),
      Rx.timeout({ first: 600_000 }),
    ),
  );
  logger.info({
    dustRegistration: {
      transactionId,
      balance: balance.toString(),
    },
  });
  return transactionId;
};
