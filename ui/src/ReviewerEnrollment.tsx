// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react";
import { pureCircuits } from "@midnight-review/contract";
import {
  loadOrCreateBrowserSecret,
  reviewerEnrollmentScope,
} from "./browser-secret";
import { appConfig } from "./config";

const toHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const ReviewerEnrollment = () => {
  const reviewerKey = useMemo(() => {
    const secret = loadOrCreateBrowserSecret(
      reviewerEnrollmentScope(appConfig.networkId, appConfig.itemId),
    );
    return toHex(pureCircuits.deriveReviewerKey(secret));
  }, []);
  const [copied, setCopied] = useState(false);

  const copyReviewerKey = async () => {
    await navigator.clipboard.writeText(reviewerKey);
    setCopied(true);
  };

  return (
    <main className="page" data-testid="reviewer-enrollment-screen">
      <section className="panel setup-panel">
        <p className="setup-eyebrow">리뷰어 준비</p>
        <h1>이 브라우저를 리뷰어로 등록</h1>
        <p className="setup-copy">
          비밀키는 이 브라우저 안에만 저장됩니다. 아래 공개 reviewerKey만
          운영자에게 전달하세요.
        </p>
        <code className="setup-key" data-testid="reviewer-public-key">
          {reviewerKey}
        </code>
        <button className="button primary" onClick={copyReviewerKey}>
          {copied ? "복사됨" : "공개 reviewerKey 복사"}
        </button>
        <p className="hint">
          비밀키는 화면·클립보드·URL에 표시하지 않습니다.
        </p>
      </section>
    </main>
  );
};
