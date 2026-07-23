// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import {
  ComparisonSession,
  type DemoAccount,
  type SubmissionResult,
} from "./comparison-simulators";

type BoardProps = {
  label: string;
  title: string;
  message?: string;
  reviews: readonly string[];
};

const BlindBoard = ({ label, title, message, reviews }: BoardProps) => (
  <section className="compare-board" aria-label={`${title} 블라인드 게시판`}>
    <header className="compare-board-header">
      <p>{label}</p>
      <h2>{title}</h2>
    </header>
    <div className="compare-review-list" aria-live="polite">
      {reviews.length === 0 ? (
        <p className="compare-empty">아직 리뷰가 없습니다</p>
      ) : (
        reviews.map((review, index) => (
          <article className="compare-review" key={`${index}-${review}`}>
            {review}
          </article>
        ))
      )}
    </div>
    {message && (
      <p className="compare-result" role="status">
        {message}
      </p>
    )}
  </section>
);

export const ComparisonDemo = () => {
  const [session, setSession] = useState(() => new ComparisonSession());
  const [account, setAccount] = useState<DemoAccount>("ineligible");
  const [body, setBody] = useState("배송은 빨랐지만 포장이 아쉬웠습니다");
  const [result, setResult] = useState<SubmissionResult>();

  const submit = () => {
    const review = body.trim();
    if (!review) return;
    setResult(session.submit(account, review));
  };

  const reset = () => {
    setSession(new ComparisonSession());
    setAccount("ineligible");
    setBody("배송은 빨랐지만 포장이 아쉬웠습니다");
    setResult(undefined);
  };

  return (
    <main className="compare-page" data-testid="access-control-comparison">
      <header className="compare-hero">
        <p className="compare-product">무선 키보드 K2</p>
        <h1>블라인드 리뷰</h1>
        <div className="compare-account" aria-label="데모 계정 선택">
          <button
            className={account === "ineligible" ? "selected" : undefined}
            onClick={() => setAccount("ineligible")}
            type="button"
          >
            구매 기록 없음
          </button>
          <button
            className={account === "eligible" ? "selected" : undefined}
            onClick={() => setAccount("eligible")}
            type="button"
          >
            구매 확인됨
          </button>
        </div>
        <label className="compare-label" htmlFor="comparison-review">
          리뷰
        </label>
        <textarea
          id="comparison-review"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="compare-actions">
          <button
            className="button primary"
            disabled={body.trim().length === 0}
            onClick={submit}
            type="button"
          >
            같은 리뷰 제출
          </button>
          <button className="compare-reset" onClick={reset} type="button">
            처음부터
          </button>
        </div>
      </header>

      <div className="compare-boards">
        <BlindBoard
          label="기존 방식"
          title="ownPublicKey"
          message={result?.unsafeMessage}
          reviews={result?.unsafeReviews ?? []}
        />
        <BlindBoard
          label="최종 계약"
          title="Merkle"
          message={result?.merkleMessage}
          reviews={result?.merkleReviews ?? []}
        />
      </div>
    </main>
  );
};
