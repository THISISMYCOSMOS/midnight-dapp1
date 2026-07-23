// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { appConfig } from "./config";
import { deployReviewApi } from "./midnight/browser-providers";

const fromReviewerKey = (value: string): Uint8Array => {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("reviewerKey는 64자리 16진수여야 합니다");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
};

const messageFor = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const OperatorDeployment = () => {
  const [reviewerKeys, setReviewerKeys] = useState(["", "", ""]);
  const [deploying, setDeploying] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string>();
  const [contractAddress, setContractAddress] = useState<string>();

  const updateKey = (index: number, value: string) => {
    setReviewerKeys((current) =>
      current.map((key, keyIndex) => (keyIndex === index ? value : key)),
    );
  };

  const deploy = async () => {
    setDeploymentError(undefined);
    setContractAddress(undefined);

    try {
      if (!appConfig.indexerUri || !appConfig.indexerWsUri) {
        throw new Error("Preprod 인덱서 주소가 설정되지 않았습니다");
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
    } catch (error) {
      setDeploymentError(messageFor(error));
    } finally {
      setDeploying(false);
    }
  };

  const boardUrl = contractAddress
    ? `${window.location.origin}/?contract=${encodeURIComponent(contractAddress)}`
    : undefined;

  return (
    <main className="page" data-testid="operator-deployment-screen">
      <section className="panel setup-panel">
        <p className="setup-eyebrow">운영자 설정</p>
        <h1>Lace로 리뷰 계약 배포</h1>
        <p className="setup-copy">
          리뷰어에게 받은 공개 reviewerKey 3개만 입력합니다. 리뷰어 비밀키는
          입력하지 않습니다.
        </p>
        <div className="setup-fields">
          {reviewerKeys.map((key, index) => (
            <label key={index}>
              리뷰어 {index + 1} 공개키
              <input
                aria-label={`리뷰어 ${index + 1} 공개키`}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(event) => updateKey(index, event.target.value)}
              />
            </label>
          ))}
        </div>
        <button
          className="button primary"
          disabled={deploying}
          onClick={deploy}
        >
          {deploying ? "Lace 확인·배포 중" : "Lace 연결 후 배포"}
        </button>
        {deploymentError && (
          <p className="form-error">{deploymentError}</p>
        )}
        {contractAddress && boardUrl && (
          <div className="setup-result" data-testid="deployment-result">
            <p>배포된 계약 주소</p>
            <code className="setup-key">{contractAddress}</code>
            <a className="button outline setup-link" href={boardUrl}>
              이 계약으로 게시판 열기
            </a>
          </div>
        )}
      </section>
    </main>
  );
};
