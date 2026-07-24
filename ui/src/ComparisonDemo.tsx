// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react";
import type { Subscription } from "rxjs";
import {
  loadOrCreateBrowserSecret,
  reviewerEnrollmentScope,
} from "./browser-secret";
import { UnsafeComparisonSession } from "./comparison-simulators";
import { appConfig } from "./config";
import {
  connectReviewApi,
  createPublicDataProvider,
} from "./midnight/browser-providers";
import {
  observeReviewState,
  type PublicTransactionRecord,
  type ReviewApi,
  type ReviewAuthorState,
} from "./midnight/review-api";

type WalletStatus = "disconnected" | "connecting" | "connected";
type MessageTone = "success" | "error";

type BoardProps = {
  label: string;
  title: string;
  message?: string;
  messageTone?: MessageTone;
  reviews: readonly string[];
  transaction?: PublicTransactionRecord & {
    readonly elapsedSeconds: string;
  };
};

const BlindBoard = ({
  label,
  title,
  message,
  messageTone,
  reviews,
  transaction,
}: BoardProps) => (
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
      <p
        className={`compare-result ${messageTone ?? ""}`.trim()}
        role="status"
      >
        {message}
      </p>
    )}
    {transaction && (
      <dl className="compare-transaction">
        <div>
          <dt>거래 ID</dt>
          <dd>{transaction.txId}</dd>
        </div>
        <div>
          <dt>확정 블록</dt>
          <dd>{transaction.blockHeight}</dd>
        </div>
        <div>
          <dt>소요 시간</dt>
          <dd>{transaction.elapsedSeconds}초</dd>
        </div>
      </dl>
    )}
  </section>
);

const translatedError = (
  error: unknown,
): { readonly message: string; readonly comparable: boolean } => {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("Reviewer is not eligible")) {
    return {
      message: "등록되지 않은 리뷰어라 Preprod 거래가 차단됐습니다",
      comparable: true,
    };
  }
  if (raw.includes("Review already submitted for this item")) {
    return {
      message: "이미 이 상품에 리뷰를 남겨 Preprod 거래가 차단됐습니다",
      comparable: true,
    };
  }
  return {
    message: `Preprod 거래를 완료하지 못했습니다: ${raw}`,
    comparable: false,
  };
};

export const ComparisonDemo = () => {
  const [unsafeSession, setUnsafeSession] = useState(
    () => new UnsafeComparisonSession(),
  );
  const [unsafeReviews, setUnsafeReviews] = useState<readonly string[]>([]);
  const [merkleReviews, setMerkleReviews] = useState<readonly string[]>([]);
  const [body, setBody] = useState("배송은 빨랐지만 포장이 아쉬웠습니다");
  const [unsafeMessage, setUnsafeMessage] = useState<string>();
  const [merkleMessage, setMerkleMessage] = useState<string>();
  const [merkleTone, setMerkleTone] = useState<MessageTone>();
  const [transaction, setTransaction] = useState<
    (PublicTransactionRecord & { readonly elapsedSeconds: string }) | undefined
  >();
  const [walletStatus, setWalletStatus] =
    useState<WalletStatus>("disconnected");
  const [authorState, setAuthorState] = useState<ReviewAuthorState>();
  const [connectionError, setConnectionError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const apiRef = useRef<ReviewApi | undefined>(undefined);
  const authorSubscription = useRef<Subscription | undefined>(undefined);

  useEffect(() => {
    if (
      !appConfig.contractAddress ||
      !appConfig.indexerUri ||
      !appConfig.indexerWsUri
    ) {
      return;
    }

    const provider = createPublicDataProvider(
      appConfig.indexerUri,
      appConfig.indexerWsUri,
    );
    const subscription = observeReviewState(
      provider,
      appConfig.contractAddress,
    ).subscribe({
      next: (state) => setMerkleReviews(state.reviews),
      error: () =>
        setConnectionError("Preprod 게시판 상태를 불러오지 못했습니다"),
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(
    () => () => {
      authorSubscription.current?.unsubscribe();
    },
    [],
  );

  const connectWallet = async () => {
    if (
      !appConfig.contractAddress ||
      !appConfig.indexerUri ||
      !appConfig.indexerWsUri
    ) {
      setConnectionError("Preprod 계약 주소가 필요합니다");
      return;
    }

    setWalletStatus("connecting");
    setConnectionError(undefined);
    try {
      const api = await connectReviewApi(
        {
          networkId: appConfig.networkId,
          contractAddress: appConfig.contractAddress,
          indexerUri: appConfig.indexerUri,
          indexerWsUri: appConfig.indexerWsUri,
          itemId: appConfig.itemId,
        },
        loadOrCreateBrowserSecret(
          appConfig.contractAddress,
          reviewerEnrollmentScope(appConfig.networkId, appConfig.itemId),
        ),
      );
      apiRef.current = api;
      authorSubscription.current?.unsubscribe();
      authorSubscription.current = api.state$.subscribe({
        next: (state) => {
          setAuthorState(state);
          setMerkleReviews(state.reviews);
        },
        error: (error) =>
          setConnectionError(translatedError(error).message),
      });
      setWalletStatus("connected");
    } catch (error) {
      setWalletStatus("disconnected");
      setConnectionError(translatedError(error).message);
    }
  };

  const submit = async () => {
    const review = body.trim();
    const api = apiRef.current;
    if (!review || !api || submitting) return;

    setSubmitting(true);
    setUnsafeMessage(undefined);
    setMerkleMessage(undefined);
    setMerkleTone(undefined);
    setTransaction(undefined);
    const startedAt = Date.now();

    try {
      const finalized = await api.submitReview(review);
      const elapsedSeconds = ((Date.now() - startedAt) / 1_000).toFixed(1);
      setUnsafeReviews(unsafeSession.submit(review));
      setUnsafeMessage("로컬 기준선에서는 게시되었습니다");
      setMerkleMessage("Preprod 거래가 확정되었습니다");
      setMerkleTone("success");
      setTransaction({ ...finalized, elapsedSeconds });
    } catch (error) {
      const result = translatedError(error);
      if (result.comparable) {
        setUnsafeReviews(unsafeSession.submit(review));
        setUnsafeMessage("로컬 기준선에서는 게시되었습니다");
      }
      setMerkleMessage(result.message);
      setMerkleTone("error");
    } finally {
      setSubmitting(false);
    }
  };

  const resetLocalResult = () => {
    const nextSession = new UnsafeComparisonSession();
    setUnsafeSession(nextSession);
    setUnsafeReviews([]);
    setUnsafeMessage(undefined);
    setMerkleMessage(undefined);
    setMerkleTone(undefined);
    setTransaction(undefined);
  };

  const reviewerStatus =
    walletStatus !== "connected"
      ? "지갑 연결 전"
      : !authorState
        ? "자격 확인 중"
        : !authorState.eligible
          ? "등록되지 않은 리뷰어"
          : authorState.alreadyReviewed
            ? "등록된 리뷰어 · 이미 작성"
            : "등록된 리뷰어";

  return (
    <main className="compare-page" data-testid="access-control-comparison">
      <header className="compare-hero">
        <p className="compare-product">무선 이어폰 XR-200 · Preprod</p>
        <h1>블라인드 리뷰</h1>
        <div className="compare-network-state" aria-live="polite">
          <span>{reviewerStatus}</span>
          {appConfig.contractAddress ? (
            <code>{appConfig.contractAddress}</code>
          ) : (
            <span>배포된 계약 주소가 필요합니다</span>
          )}
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
          {walletStatus !== "connected" ? (
            <button
              className="button primary"
              disabled={
                walletStatus === "connecting" || !appConfig.contractAddress
              }
              onClick={connectWallet}
              type="button"
            >
              {walletStatus === "connecting"
                ? "Preprod 지갑 연결 중"
                : "Preprod 지갑 연결"}
            </button>
          ) : (
            <button
              className="button primary"
              disabled={body.trim().length === 0 || submitting}
              onClick={submit}
              type="button"
            >
              {submitting ? "증명 생성·거래 확인 중" : "같은 리뷰 제출"}
            </button>
          )}
          <button
            className="compare-reset"
            onClick={resetLocalResult}
            type="button"
          >
            로컬 결과만 초기화
          </button>
        </div>
        {connectionError && <p className="form-error">{connectionError}</p>}
      </header>

      <div className="compare-boards">
        <BlindBoard
          label="ownPublicKey 비교 기준 — 로컬 데모"
          title="ownPublicKey"
          message={unsafeMessage}
          messageTone="success"
          reviews={unsafeReviews}
        />
        <BlindBoard
          label="Merkle 자격 증명 — Preprod 실제 거래"
          title="Merkle"
          message={merkleMessage}
          messageTone={merkleTone}
          reviews={merkleReviews}
          transaction={transaction}
        />
      </div>
    </main>
  );
};
