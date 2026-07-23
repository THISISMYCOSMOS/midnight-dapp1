// SPDX-License-Identifier: Apache-2.0

import {
  DustSecretKey,
  LedgerParameters,
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
  ZswapSecretKeys,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import type { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import type { Logger } from "pino";
import { firstValueFrom } from "rxjs";
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from "@midnight-ntwrk/testkit-js";

type UnshieldedKeystore = {
  getPublicKey(): unknown;
  signData(payload: Uint8Array): string;
};

export class OperatorWallet implements MidnightProvider, WalletProvider {
  private constructor(
    private readonly logger: Logger,
    readonly wallet: WalletFacade,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    private readonly unshieldedKeystore: UnshieldedKeystore,
  ) {}

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(
    transaction: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      transaction,
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl },
    );
    const signed = await this.wallet.signRecipe(recipe, (payload) =>
      this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signed);
  }

  submitTx(transaction: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(transaction);
  }

  async start(): Promise<void> {
    this.logger.info("운영자 지갑 동기화를 시작합니다");
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  stop(): Promise<void> {
    return this.wallet.stop();
  }

  static async build(
    logger: Logger,
    environment: EnvironmentConfiguration,
    seed: string,
  ): Promise<OperatorWallet> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };
    const result = (await FluentWalletBuilder.forEnvironment(environment)
      .withDustOptions(dustOptions)
      .withSeed(seed)
      .buildWithoutStarting()) as unknown as {
      wallet: WalletFacade;
      seeds: { shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };

    // The official example initializes the shielded state stream before
    // starting the facade. Without this subscription the facade emitted no
    // state and the Preprod sync timed out.
    await firstValueFrom(result.wallet.shielded.state);

    return new OperatorWallet(
      logger,
      result.wallet,
      ZswapSecretKeys.fromSeed(result.seeds.shielded),
      DustSecretKey.fromSeed(result.seeds.dust),
      result.keystore,
    );
  }
}
