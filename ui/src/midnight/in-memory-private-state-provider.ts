// SPDX-License-Identifier: Apache-2.0

import type {
  ContractAddress,
  SigningKey,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from "@midnight-ntwrk/midnight-js-types";

export const inMemoryPrivateStateProvider = <
  PSI extends PrivateStateId,
  PS,
>(): PrivateStateProvider<PSI, PS> => {
  const privateStates = new Map<ContractAddress, Map<PSI, PS>>();
  const signingKeys = new Map<ContractAddress, SigningKey>();
  let currentAddress: ContractAddress | undefined;

  const requireAddress = (): ContractAddress => {
    if (!currentAddress) {
      throw new Error("Contract address has not been set");
    }
    return currentAddress;
  };

  const statesFor = (address: ContractAddress): Map<PSI, PS> => {
    let states = privateStates.get(address);
    if (!states) {
      states = new Map<PSI, PS>();
      privateStates.set(address, states);
    }
    return states;
  };

  const encode = <T,>(value: T): string => JSON.stringify(value);
  const decode = <T,>(value: string): T => JSON.parse(value) as T;

  return {
    setContractAddress(address): void {
      currentAddress = address;
    },
    set(key, state): Promise<void> {
      statesFor(requireAddress()).set(key, state);
      return Promise.resolve();
    },
    get(key): Promise<PS | null> {
      return Promise.resolve(statesFor(requireAddress()).get(key) ?? null);
    },
    remove(key): Promise<void> {
      statesFor(requireAddress()).delete(key);
      return Promise.resolve();
    },
    clear(): Promise<void> {
      privateStates.delete(requireAddress());
      return Promise.resolve();
    },
    setSigningKey(address, signingKey): Promise<void> {
      signingKeys.set(address, signingKey);
      return Promise.resolve();
    },
    getSigningKey(address): Promise<SigningKey | null> {
      return Promise.resolve(signingKeys.get(address) ?? null);
    },
    removeSigningKey(address): Promise<void> {
      signingKeys.delete(address);
      return Promise.resolve();
    },
    clearSigningKeys(): Promise<void> {
      signingKeys.clear();
      return Promise.resolve();
    },
    exportPrivateStates(
      _options?: ExportPrivateStatesOptions,
    ): Promise<PrivateStateExport> {
      const address = requireAddress();
      const states = Object.fromEntries(
        [...statesFor(address)].map(([key, value]) => [key, encode(value)]),
      );
      return Promise.resolve({
        format: "midnight-private-state-export",
        encryptedPayload: encode({ address, states }),
        salt: "midnight-review-memory-state",
      });
    },
    importPrivateStates(
      exportData: PrivateStateExport,
      options?: ImportPrivateStatesOptions,
    ): Promise<ImportPrivateStatesResult> {
      const target = statesFor(requireAddress());
      const payload = decode<{ states?: Record<string, string> }>(
        exportData.encryptedPayload,
      );
      const strategy = options?.conflictStrategy ?? "error";
      let imported = 0;
      let skipped = 0;
      let overwritten = 0;

      for (const [rawKey, serialized] of Object.entries(payload.states ?? {})) {
        const key = rawKey as PSI;
        if (target.has(key)) {
          if (strategy === "skip") {
            skipped += 1;
            continue;
          }
          if (strategy === "error") {
            return Promise.reject(
              new Error(`Private state conflict for '${rawKey}'`),
            );
          }
          overwritten += 1;
        } else {
          imported += 1;
        }
        target.set(key, decode<PS>(serialized));
      }

      return Promise.resolve({ imported, skipped, overwritten });
    },
    exportSigningKeys(
      _options?: ExportSigningKeysOptions,
    ): Promise<SigningKeyExport> {
      return Promise.resolve({
        format: "midnight-signing-key-export",
        encryptedPayload: encode({ keys: Object.fromEntries(signingKeys) }),
        salt: "midnight-review-memory-signing-keys",
      });
    },
    importSigningKeys(
      exportData: SigningKeyExport,
      options?: ImportSigningKeysOptions,
    ): Promise<ImportSigningKeysResult> {
      const payload = decode<{ keys?: Record<ContractAddress, SigningKey> }>(
        exportData.encryptedPayload,
      );
      const strategy = options?.conflictStrategy ?? "error";
      let imported = 0;
      let skipped = 0;
      let overwritten = 0;

      for (const [address, signingKey] of Object.entries(payload.keys ?? {})) {
        const contractAddress = address as ContractAddress;
        if (signingKeys.has(contractAddress)) {
          if (strategy === "skip") {
            skipped += 1;
            continue;
          }
          if (strategy === "error") {
            return Promise.reject(
              new Error(`Signing key conflict for '${address}'`),
            );
          }
          overwritten += 1;
        } else {
          imported += 1;
        }
        signingKeys.set(contractAddress, signingKey);
      }

      return Promise.resolve({ imported, skipped, overwritten });
    },
  };
};
