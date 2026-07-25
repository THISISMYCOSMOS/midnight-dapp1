// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { appConfig } from "./config";
import { demoUsers } from "./demo-users";
import {
  deployReviewApi,
  inspectPreprodWallet,
  type PreprodWalletCheck,
} from "./midnight/browser-providers";
import type { PublicTransactionRecord } from "./midnight/review-api";

const fromReviewerKey = (value: string): Uint8Array => {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("reviewerKey는 64자리 16진수여야 합니다");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
};

const initialReviewerKey = (): string => {
  const value =
    new URLSearchParams(window.location.search).get("reviewerKey") ?? "";
  return /^[0-9a-fA-F]{64}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : "";
};

const messageFor = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const OperatorDeployment = () => {
  // 데모 편의: 세 자격키 입력을 데모 리뷰어 3명의 공개 파생키로 기본 채운다.
  // (`/compare`의 사용자 1·2·3과 동일한 키. 값은 수정 가능.)
  const [reviewerKeys, setReviewerKeys] = useState(() => [
    initialReviewerKey() || demoUsers[0].reviewerKeyHex,
    demoUsers[1].reviewerKeyHex,
    demoUsers[2].reviewerKeyHex,
  ]);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [walletCheck, setWalletCheck] = useState<PreprodWalletCheck>();
  const [testTokensConfirmed, setTestTokensConfirmed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string>();
  const [contractAddress, setContractAddress] = useState<string>();
  const [deploymentTransaction, setDeploymentTransaction] =
    useState<PublicTransactionRecord>();

  const updateKey = (index: number, value: string) => {
    setReviewerKeys((current) =>
      current.map((key, keyIndex) => (keyIndex === index ? value : key)),
    );
  };

  const checkWallet = async () => {
    setCheckingWallet(true);
    setWalletCheck(undefined);
    setDeploymentError(undefined);
    try {
      if (!appConfig.indexerUri || !appConfig.indexerWsUri) {
        throw new Error("Preprod 인덱서 주소가 설정되지 않았습니다");
      }
      const result = await inspectPreprodWallet({
        networkId: appConfig.networkId,
        indexerUri: appConfig.indexerUri,
        indexerWsUri: appConfig.indexerWsUri,
        itemId: appConfig.itemId,
      });
      setWalletCheck(result);
    } catch (error) {
      setDeploymentError(messageFor(error));
    } finally {
      setCheckingWallet(false);
    }
  };

  const deploy = async () => {
    setDeploymentError(undefined);
    setContractAddress(undefined);
    setDeploymentTransaction(undefined);

    try {
      if (!appConfig.indexerUri || !appConfig.indexerWsUri) {
        throw new Error("Preprod 인덱서 주소가 설정되지 않았습니다");
      }
      if (!walletCheck || walletCheck.networkId !== "preprod") {
        throw new Error("Preprod 지갑 점검을 먼저 완료해야 합니다");
      }
      if (BigInt(walletCheck.dustBalance) <= 0n) {
        throw new Error("테스트용 tDUST 잔액이 필요합니다");
      }
      if (!testTokensConfirmed) {
        throw new Error("테스트 토큰만 사용한다는 확인이 필요합니다");
      }
      const normalized = reviewerKeys.map((key) => key.trim().toLowerCase());
      if (new Set(normalized).size !== 3) {
        throw new Error("서로 다른 reviewerKey 3개가 필요합니다");
      }
      const initialEligible = normalized.map(fromReviewerKey);

      setDeploying(true);
      const api = await deployReviewApi(
        {
          networkId: appConfig.networkId,
          indexerUri: appConfig.indexerUri,
          indexerWsUri: appConfig.indexerWsUri,
          itemId: appConfig.itemId,
        },
        initialEligible,
      );
      setContractAddress(api.contractAddress);
      setDeploymentTransaction(api.deploymentTransaction);
    } catch (error) {
      setDeploymentError(messageFor(error));
    } finally {
      setDeploying(false);
    }
  };

  const boardUrl = contractAddress
    ? `${window.location.origin}/compare?contract=${encodeURIComponent(contractAddress)}`
    : undefined;

  return (
    <main className="page" data-testid="operator-deployment-screen">
      <section className="panel setup-panel">
        <p className="setup-eyebrow">운영자 설정</p>
        <h1>Lace로 리뷰 계약 배포</h1>
        <p className="setup-copy">
          대응 비밀키가 있는 실제 리뷰어 공개키 3개. 난수 키는 쓰지 않습니다.
        </p>
        <div className="setup-fields">
          {reviewerKeys.map((key, index) => (
            <label key={index}>
              실제 리뷰어 공개키 {index + 1}
              <input
                aria-label={`실제 리뷰어 공개키 ${index + 1}`}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(event) => updateKey(index, event.target.value)}
              />
            </label>
          ))}
        </div>
        <button
          className="button outline"
          disabled={checkingWallet || deploying}
          onClick={checkWallet}
          type="button"
        >
          {checkingWallet ? "Preprod 지갑 점검 중" : "Preprod 지갑 점검"}
        </button>
        {walletCheck && (
          <dl className="setup-checks" data-testid="preprod-wallet-check">
            <div>
              <dt>네트워크</dt>
              <dd>{walletCheck.networkId}</dd>
            </div>
            <div>
              <dt>Mainnet</dt>
              <dd>사용하지 않음</dd>
            </div>
            <div>
              <dt>Proof Server</dt>
              <dd>{walletCheck.proofServerUri}</dd>
            </div>
            <div>
              <dt>테스트용 tDUST 잔액</dt>
              <dd>{walletCheck.dustBalance}</dd>
            </div>
          </dl>
        )}
        <label className="setup-confirm">
          <input
            checked={testTokensConfirmed}
            onChange={(event) => setTestTokensConfirmed(event.target.checked)}
            type="checkbox"
          />
          공식 Faucet의 테스트용 tNIGHT·tDUST만 사용하며 실제 돈을 쓰지
          않습니다
        </label>
        <button
          className="button primary"
          disabled={
            deploying ||
            !walletCheck ||
            BigInt(walletCheck.dustBalance) <= 0n ||
            !testTokensConfirmed
          }
          onClick={deploy}
          type="button"
        >
          {deploying
            ? "Lace 승인·Preprod 배포 중"
            : "최종 Merkle 계약 Preprod 배포"}
        </button>
        {deploymentError && (
          <p className="form-error">{deploymentError}</p>
        )}
        {contractAddress && boardUrl && (
          <div className="setup-result" data-testid="deployment-result">
            <p>배포된 계약 주소</p>
            <code className="setup-key">{contractAddress}</code>
            {deploymentTransaction && (
              <>
                <p>배포 트랜잭션 ID</p>
                <code className="setup-key">
                  {deploymentTransaction.txId}
                </code>
                <p>확정 블록 {deploymentTransaction.blockHeight}</p>
              </>
            )}
            <a className="button outline setup-link" href={boardUrl}>
              이 계약으로 비교 게시판 열기
            </a>
          </div>
        )}
      </section>
    </main>
  );
};
