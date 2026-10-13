// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { appConfig } from "./config";
import { getDemoUsers } from "./demo-users";
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
  // 기본값은 비어 있다. 예전에는 데모 리뷰어 3명의 파생키로 채웠는데, 그 키의 비밀키는
  // 운영자 브라우저 localStorage에서 생성된 것이라 운영자가 세 비밀키를 전부 갖게 됐다
  // (§6.5 위반, 익명 집합이 사실상 k=1). 데모 키는 아래 버튼으로 명시적으로 채우고,
  // 그때 대응 비밀키가 어디 있는지 경고를 띄운다.
  const [reviewerKeys, setReviewerKeys] = useState(() => [
    initialReviewerKey(),
    "",
    "",
  ]);
  const [demoKeyWarning, setDemoKeyWarning] = useState<string>();
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

  // 데모 키를 명시적으로 채운다. 이 버튼을 누르기 전에는 비밀키가 만들어지지 않는다.
  const fillDemoKeys = () => {
    const users = getDemoUsers();
    setReviewerKeys(users.map((user) => user.reviewerKeyHex));
    const browserKeys = users.filter((user) => user.origin === "browser").length;
    setDemoKeyWarning(
      browserKeys > 0
        ? `데모 키 ${browserKeys}개의 비밀키가 이 브라우저에만 있습니다 · 운영자가 비밀키를 알면 작성자를 특정할 수 있어 익명성이 성립하지 않습니다 (발표 녹화용으로만 쓰고, 실제 리뷰어 등록에는 쓰지 마세요)`
        : "VITE_DEMO_SECRET_1·2·3에서 읽은 데모 키입니다 · 실제 리뷰어 등록에는 쓰지 마세요",
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
          리뷰어가 자기 브라우저에서 만든 공개 reviewerKey 3개를 받아 넣습니다.
          비밀키는 리뷰어 쪽에만 있어야 합니다.
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
          className="compare-reset"
          disabled={deploying}
          onClick={fillDemoKeys}
          type="button"
        >
          데모 키로 채우기
        </button>
        {demoKeyWarning && (
          <p className="form-error" role="status">
            {demoKeyWarning}
          </p>
        )}
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
