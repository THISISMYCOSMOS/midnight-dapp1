// SPDX-License-Identifier: Apache-2.0

import { UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import type {
  FacadeState,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import type { UnshieldedWalletState } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import {
  unshieldedToken,
  type UnshieldedTokenType,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import {
  FaucetClient,
  type EnvironmentConfiguration,
} from "@midnight-ntwrk/testkit-js";
import type { Logger } from "pino";
import * as Rx from "rxjs";

const isComplete = (progress: unknown): boolean => {
  const candidate = progress as { isStrictlyComplete?: () => boolean };
  return candidate?.isStrictlyComplete?.() === true;
};

const isSynced = (state: FacadeState): boolean =>
  isComplete(state.shielded.state.progress) &&
  isComplete(state.dust.state.progress) &&
  isComplete(state.unshielded.progress);

export const syncWallet = async (
  logger: Logger,
  wallet: WalletFacade,
): Promise<FacadeState> => {
  logger.info("지갑 상태를 동기화하는 중입니다");
  const state = await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter(isSynced),
      Rx.timeout({ first: 600_000 }),
    ),
  );
  logger.info({
    walletSynced: {
      night: state.unshielded.balances[unshieldedToken().raw]?.toString() ?? "0",
      dust: state.dust.balance(new Date()).toString(),
    },
  });
  return state;
};

const unshieldedAddress = (
  state: UnshieldedWalletState,
): string =>
  UnshieldedAddress.codec
    .encode(getNetworkId(), state.address)
    .toString();

const hasFunds = (
  state: UnshieldedWalletState,
  token: UnshieldedTokenType,
): boolean => (state.balances[token.raw] ?? 0n) > 0n;

export const ensureNightFunds = async (
  logger: Logger,
  wallet: WalletFacade,
  environment: EnvironmentConfiguration,
): Promise<UnshieldedWalletState> => {
  const token = unshieldedToken();
  let state = await Rx.firstValueFrom(wallet.unshielded.state);
  const address = unshieldedAddress(state);
  logger.info({ operatorUnshieldedAddress: address });

  if (!hasFunds(state, token)) {
    if (!environment.faucet) {
      throw new Error("Preprod faucet 주소가 없습니다");
    }
    logger.info("공식 Preprod faucet에 tNIGHT를 요청합니다");
    await new FaucetClient(environment.faucet, logger).requestTokens(address);
    state = await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.filter(
          (facadeState) =>
            isSynced(facadeState) &&
            hasFunds(facadeState.unshielded, token),
        ),
        Rx.map((facadeState) => facadeState.unshielded),
        Rx.timeout({ first: 600_000 }),
      ),
    );
  }

  logger.info({
    operatorNightBalance: state.balances[token.raw]?.toString() ?? "0",
  });
  return state;
};
