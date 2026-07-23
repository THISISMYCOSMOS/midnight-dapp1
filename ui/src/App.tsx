// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from "react";
import type { Subscription } from "rxjs";
import { loadOrCreateBrowserSecret } from "./browser-secret";
import { appConfig } from "./config";
import {
  connectReviewApi,
  createPublicDataProvider,
} from "./midnight/browser-providers";
import {
  observeReviewState,
  type ReviewApi,
  type ReviewAuthorState,
} from "./midnight/review-api";

type Screen = "list" | "write" | "submitting" | "success";
type WalletStatus = "disconnected" | "connecting" | "connected";

const messageFor = (error: unknown): string =>
  error instanceof Error
    ? error.message
        .replace(
          "Review already submitted for this item",
          "이 상품에는 이미 리뷰를 남기셨습니다",
        )
        .replace(
          "Reviewer is not eligible",
          "리뷰는 구매 확인된 분만 쓸 수 있습니다",
        )
    : String(error);

export const App = () => {
  const [screen, setScreen] = useState<Screen>("list");
  const [reviews, setReviews] = useState<readonly string[]>([]);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [body, setBody] = useState("");
  const [submittedBody, setSubmittedBody] = useState("");
  const [walletStatus, setWalletStatus] =
    useState<WalletStatus>("disconnected");
  const [authorState, setAuthorState] = useState<ReviewAuthorState>();
  const [connectionError, setConnectionError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
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
      next: (state) => {
        setReviews(state.reviews);
        setLedgerLoaded(true);
        setReadFailed(false);
      },
      error: () => setReadFailed(true),
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (screen !== "submitting") return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(
    () => () => {
      authorSubscription.current?.unsubscribe();
    },
    [],
  );

  const blockReason = useMemo(() => {
    if (walletStatus !== "connected") {
      return "리뷰를 쓰려면 지갑을 연결해야 합니다";
    }
    if (!authorState) return "자격 상태를 확인하고 있습니다";
    if (!authorState.eligible) {
      return "리뷰는 구매 확인된 분만 쓸 수 있습니다";
    }
    if (authorState.alreadyReviewed) {
      return "이 상품에는 이미 리뷰를 남기셨습니다";
    }
    return undefined;
  }, [authorState, walletStatus]);

  const connectWallet = async () => {
    if (
      !appConfig.contractAddress ||
      !appConfig.indexerUri ||
      !appConfig.indexerWsUri
    ) {
      setConnectionError("계약 주소와 인덱서 주소를 먼저 설정해야 합니다");
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
        loadOrCreateBrowserSecret(appConfig.contractAddress),
      );
      apiRef.current = api;
      authorSubscription.current?.unsubscribe();
      authorSubscription.current = api.state$.subscribe({
        next: (state) => {
          setAuthorState(state);
          setReviews(state.reviews);
          setLedgerLoaded(true);
          setReadFailed(false);
        },
        error: (error) => setConnectionError(messageFor(error)),
      });
      setWalletStatus("connected");
    } catch (error) {
      setWalletStatus("disconnected");
      setConnectionError(messageFor(error));
    }
  };

  const submit = async () => {
    const api = apiRef.current;
    if (!api || blockReason || !body.trim()) return;

    setSubmitError(undefined);
    setScreen("submitting");
    try {
      await api.submitReview(body.trim());
      setSubmittedBody(body.trim());
      setScreen("success");
    } catch (error) {
      setSubmitError(messageFor(error));
      setScreen("write");
    }
  };

  if (screen === "list") {
    const hasReadConfig =
      !!appConfig.contractAddress &&
      !!appConfig.indexerUri &&
      !!appConfig.indexerWsUri;
    const emptyMessage = !hasReadConfig
      ? "리뷰 연결 설정이 필요합니다"
      : readFailed
        ? "리뷰를 불러오지 못했습니다"
        : !ledgerLoaded
          ? "리뷰를 불러오는 중입니다"
          : "아직 리뷰가 없습니다";

    return (
      <main className="page" data-testid="review-list-screen">
        <section className="panel">
          <h1>{appConfig.productName}</h1>
          <div className="review-list">
            {reviews.length === 0 ? (
              <p className="empty">{emptyMessage}</p>
            ) : (
              reviews.map((review, index) => (
                <article className="review" key={`${index}-${review}`}>
                  {review}
                </article>
              ))
            )}
          </div>
          <button className="button primary" onClick={() => setScreen("write")}>
            리뷰 쓰기
          </button>
        </section>
      </main>
    );
  }

  if (screen === "submitting") {
    return (
      <main className="page" data-testid="review-submitting-screen">
        <section className="panel">
          <h1>제출 중</h1>
          <div className="body-preview">{body}</div>
          <div className="steps">
            <div className="step">
              <span>자격 확인</span>
              <small>완료</small>
            </div>
            <div className="step active">
              <span>증명 생성 · 트랜잭션 전송</span>
              <small>진행 중 · {elapsed}초</small>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "success") {
    return (
      <main className="page" data-testid="review-success-screen">
        <section className="panel">
          <h1>제출되었습니다</h1>
          <div className="submitted-review">{submittedBody}</div>
          <p className="hint">
            이 화면을 벗어나면 어느 리뷰가 내 것인지 확인할 수 없습니다
          </p>
          <button
            className="button outline"
            onClick={() => {
              setBody("");
              setSubmittedBody("");
              setScreen("list");
            }}
          >
            목록으로
          </button>
        </section>
      </main>
    );
  }

  const formDisabled = blockReason !== undefined;
  return (
    <main className="page" data-testid="review-write-screen">
      <section className="panel">
        <button className="back" onClick={() => setScreen("list")}>
          ← 목록
        </button>
        <h1>리뷰 쓰기</h1>
        <textarea
          aria-label="리뷰 본문"
          disabled={formDisabled}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        {blockReason && <p className="hint">{blockReason}</p>}
        {submitError && (
          <p className="form-error">{submitError} · 작성한 내용은 남아 있습니다</p>
        )}
        {connectionError && <p className="form-error">{connectionError}</p>}
        {walletStatus !== "connected" ? (
          <button
            className="button primary"
            disabled={walletStatus === "connecting"}
            onClick={connectWallet}
          >
            {walletStatus === "connecting" ? "연결 중" : "지갑 연결"}
          </button>
        ) : (
          <button
            className="button primary"
            disabled={formDisabled || body.trim().length === 0}
            onClick={submit}
          >
            제출
          </button>
        )}
      </section>
    </main>
  );
};
