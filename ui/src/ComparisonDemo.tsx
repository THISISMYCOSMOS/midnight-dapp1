// SPDX-License-Identifier: Apache-2.0

import { pureCircuits } from "@midnight-review/contract";
import { useEffect, useRef, useState } from "react";
import type { Subscription } from "rxjs";
import { ProofTrace, type TraceRun, type TraceStep } from "./ProofTrace";
import { UnsafeComparisonSession } from "./comparison-simulators";
import { appConfig } from "./config";
import { demoUsers } from "./demo-users";
import {
  WalletSetupError,
  connectReviewSession,
  createPublicDataProvider,
  type ReviewSession,
} from "./midnight/browser-providers";
import {
  observeReviewState,
  type PublicTransactionRecord,
  type ReviewApi,
  type ReviewAuthorState,
  type ReviewBoardState,
} from "./midnight/review-api";

type WalletStatus = "disconnected" | "connecting" | "connected";
type MessageTone = "success" | "error";

// 데모 자격자 수. constructor의 Vector<3>와 배포 설정에 맞춘 상수다.
// 설계상 트리 깊이 10 → 자격자 최대 1024명, 발표 데모는 3명으로 k=3.
const ELIGIBLE_COUNT = 3;

type BoardReview = {
  readonly body: string;
  // 온체인에서 읽히는 작성자 키(hex). unsafe 기준선에서만 존재한다.
  readonly authorHex?: string;
};

type AuthorNote = {
  readonly text: string;
  readonly exposed: boolean;
};

type BoardProps = {
  label: string;
  title: string;
  message?: string;
  messageTone?: MessageTone;
  reviews: readonly BoardReview[];
  authorNote: AuthorNote;
  anonymitySet?: string;
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
  authorNote,
  anonymitySet,
  transaction,
}: BoardProps) => (
  <section className="compare-board" aria-label={`${title} 블라인드 게시판`}>
    <header className="compare-board-header">
      <p>{label}</p>
      <h2>{title}</h2>
      <p
        className={`compare-author-note ${authorNote.exposed ? "exposed" : "hidden"}`}
      >
        {authorNote.text}
      </p>
      {anonymitySet && <p className="compare-anon-set">{anonymitySet}</p>}
    </header>
    <div className="compare-review-list" aria-live="polite">
      {reviews.length === 0 ? (
        <p className="compare-empty">아직 리뷰가 없습니다</p>
      ) : (
        reviews.map((review, index) => (
          <article className="compare-review" key={`${index}-${review.body}`}>
            <p className="compare-review-body">{review.body}</p>
            {review.authorHex && (
              <p className="compare-review-author exposed">
                작성자 {review.authorHex.slice(0, 8)}… · 온체인에서 읽힘
              </p>
            )}
          </article>
        ))
      )}
    </div>
    {message && (
      <p className={`compare-result ${messageTone ?? ""}`.trim()} role="status">
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

const shortHex = (value: Uint8Array): string =>
  `${Array.from(value.slice(0, 4), (byte) => byte.toString(16).padStart(2, "0")).join("")}…`;

// 회로 assert 원문에서 사유만 뽑는다. 없으면 원문을 자른다 — 지어내지 않는다.
const assertReason = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("Reviewer is not eligible")) return "자격 증명 실패";
  if (raw.includes("Review already submitted for this item"))
    return "중복 nullifier";
  return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
};

type ErrorKind = "ineligible" | "duplicate" | "other";

const translatedError = (
  error: unknown,
): { readonly message: string; readonly kind: ErrorKind } => {
  const raw = error instanceof Error ? error.message : String(error);
  // 두 실패 모두 로컬 회로 실행(증명 생성 이전)의 assert에서 걸린다. 거래는 만들어지지
  // 않고 Preprod에 도달하지 않으므로 "체인이 거절했다"고 쓰지 않는다(AGENTS.md §2.9).
  if (raw.includes("Reviewer is not eligible")) {
    return {
      message: "등록되지 않은 리뷰어입니다",
      kind: "ineligible",
    };
  }
  if (raw.includes("Review already submitted for this item")) {
    return {
      message: "이미 이 상품에 리뷰를 남기셨습니다",
      kind: "duplicate",
    };
  }
  return { message: "Preprod 거래를 완료하지 못했습니다", kind: "other" };
};

// 연결 실패는 게시판이 아니라 상단에 뜬다. 우리가 쓴 오류는 조치가 적혀 있으니
// 그대로 보여주고, 라이브러리 원문은 사용자 언어로 바꿔 내보낸다.
const connectionMessage = (error: unknown): string =>
  error instanceof WalletSetupError
    ? error.message
    : "Preprod 계약에 연결하지 못했습니다 · 계약 주소와 네트워크를 확인하세요";

export const ComparisonDemo = () => {
  const [unsafeSession, setUnsafeSession] = useState(
    () => new UnsafeComparisonSession(),
  );
  const [unsafeReviews, setUnsafeReviews] = useState<readonly BoardReview[]>([]);
  const [merkleReviews, setMerkleReviews] = useState<readonly string[]>([]);
  const [body, setBody] = useState("배송은 빨랐지만 포장이 아쉬웠습니다");
  const [unsafeMessage, setUnsafeMessage] = useState<string>();
  // unsafe 게시는 성공도 실패도 아니다 — 작동하지만 신원을 노출한다. 중립(무색)이
  // 기본이고 실제로 차단됐을 때만 error 색을 쓴다.
  const [unsafeTone, setUnsafeTone] = useState<MessageTone>();
  const [merkleMessage, setMerkleMessage] = useState<string>();
  const [merkleTone, setMerkleTone] = useState<MessageTone>();
  const [transaction, setTransaction] = useState<
    (PublicTransactionRecord & { readonly elapsedSeconds: string }) | undefined
  >();
  const [walletStatus, setWalletStatus] =
    useState<WalletStatus>("disconnected");
  const [authorState, setAuthorState] = useState<ReviewAuthorState>();
  const [connectionError, setConnectionError] = useState<string>();
  // 배포된 계약의 자격 트리와 이 브라우저의 데모 파생키를 대조한 결과. 정적 파일이
  // 아니라 계약이 진실이므로 공개 상태에서 직접 읽는다. undefined = 아직 못 읽음.
  const [demoKeysEligible, setDemoKeysEligible] =
    useState<readonly boolean[]>();
  const [submitting, setSubmitting] = useState(false);
  // 리뷰어 전환은 지갑 연결이 아니다. walletStatus를 건드리면 화면이 "지갑 연결 중"
  // 버튼으로 되돌아가 사용자가 Lace 재연결로 오해한다. 전환은 이 플래그로만 표시한다.
  const [switchingUser, setSwitchingUser] = useState(false);
  const [activeUserId, setActiveUserId] = useState(demoUsers[0].id);
  const [runs, setRuns] = useState<readonly TraceRun[]>([]);
  const [ledgerFields, setLedgerFields] = useState<readonly string[]>();
  // 실행 중인 단계의 경과 시간. 화면에서 유일하게 움직이는 값이다(§2.6).
  const [runningMs, setRunningMs] = useState<number>();
  const runningSince = useRef<number | undefined>(undefined);
  const boardState = useRef<ReviewBoardState | undefined>(undefined);
  const apiRef = useRef<ReviewApi | undefined>(undefined);
  const sessionRef = useRef<ReviewSession | undefined>(undefined);
  const authorSubscription = useRef<Subscription | undefined>(undefined);

  // 연결된 지갑 세션으로 특정 리뷰어 비밀키를 join하고 상태를 구독한다.
  // 지갑 재연결이 없으므로 Lace 팝업이 다시 뜨지 않는다.
  const bindReviewer = async (session: ReviewSession, secret: Uint8Array) => {
    const api = await session.join(secret);
    apiRef.current = api;
    authorSubscription.current?.unsubscribe();
    authorSubscription.current = api.state$.subscribe({
      next: (state) => {
        setAuthorState(state);
        setMerkleReviews(state.reviews);
      },
      // 상태 스트림이 끊긴 것이지 거래가 실패한 게 아니다. 거래 문구를 쓰지 않는다.
      error: () => setConnectionError("Preprod 게시판 상태를 불러오지 못했습니다"),
    });
  };

  const activeUser =
    demoUsers.find((user) => user.id === activeUserId) ?? demoUsers[0];
  // 제출·전환 중에는 입력을 잠근다. 전환 중에는 apiRef가 아직 옛 사용자를 가리킨다.
  const busy = submitting || switchingUser;

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
      demoUsers.map((user) => user.reviewerKey),
    ).subscribe({
      next: (state) => {
        boardState.current = state;
        setMerkleReviews(state.reviews);
        setDemoKeysEligible(state.eligibleFlags);
        setLedgerFields(state.ledgerFields);
      },
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

  // 실행 중인 단계의 경과 시간을 100ms마다 갱신한다. 대기를 숨기지 않기 위한 것이다(§2.6).
  useEffect(() => {
    const running = runs.some((run) =>
      run.steps.some((step) => step.status === "running"),
    );
    if (!running) {
      setRunningMs(undefined);
      return;
    }
    const id = window.setInterval(() => {
      if (runningSince.current !== undefined) {
        setRunningMs(performance.now() - runningSince.current);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [runs]);

  // 제출 뒤 온체인에 실제로 반영됐는지는 계약 상태 구독으로 확인한다. 성공을 주장하지
  // 않고 nullifier가 온체인에 올라온 것을 읽어서 표시한다.
  useEffect(() => {
    if (!authorState?.alreadyReviewed) return;
    setRuns((prev) =>
      prev.map((run, index) =>
        index === prev.length - 1
          ? {
              ...run,
              steps: run.steps.map((step) =>
                step.id === "confirm" && step.status === "running"
                  ? {
                      ...step,
                      status: "done" as const,
                      detail: "게시판에 반영됨",
                    }
                  : step,
              ),
            }
          : run,
      ),
    );
  }, [authorState?.alreadyReviewed]);

  const appendToRun = (runId: string, step: TraceStep) =>
    setRuns((prev) =>
      prev.map((run) =>
        run.id === runId ? { ...run, steps: [...run.steps, step] } : run,
      ),
    );

  // ownPublicKey 기준선의 단계를 같은 회차에 덧붙인다. 값은 실제 컴파일된 비교
  // 계약을 로컬에서 실행해 얻은 것이다 — Preprod 거래가 아니라는 표기를 유지한다.
  const traceUnsafe = (
    runId: string,
    outcome:
      | { readonly kind: "posted"; readonly ms: number }
      | { readonly kind: "blocked" },
  ) => {
    const group = "ownPublicKey · 로컬 시뮬레이터";
    if (outcome.kind === "blocked") {
      appendToRun(runId, {
        id: "unsafe-auth",
        label: "ownPublicKey 대조",
        scope: "simulator",
        status: "failed",
        detail: "호출자 ≠ admin",
        group,
      });
      appendToRun(runId, {
        id: "unsafe-post",
        label: "게시",
        scope: "simulator",
        status: "skipped",
        detail: "차단됨",
        group,
      });
      return;
    }
    appendToRun(runId, {
      id: "unsafe-auth",
      label: "ownPublicKey 대조",
      scope: "simulator",
      status: "done",
      detail: `admin ${unsafeSession.exposedAuthorHex().slice(0, 8)}… · 호출자 일치`,
      group,
    });
    appendToRun(runId, {
      id: "unsafe-dup",
      label: "중복 확인",
      scope: "simulator",
      status: "skipped",
      detail: "이 계약에는 중복 검사가 없음",
      group,
    });
    appendToRun(runId, {
      id: "unsafe-post",
      label: "게시",
      scope: "simulator",
      status: "done",
      detail: `reviews ${unsafeSession.reviewCount()}건`,
      ms: outcome.ms,
      group,
    });
  };

  // 제출 한 번을 단계로 기록한다. 두 제출 경로가 같은 함수를 쓰므로 한쪽만 정직해지는
  // 일이 없다. 값은 전부 실제로 계산·조회·실측한 것이다.
  const runTraced = async (
    secret: Uint8Array,
    submit: () => Promise<PublicTransactionRecord>,
    options: { readonly confirmOnLedger: boolean; readonly label: string },
  ): Promise<
    | {
        readonly ok: true;
        readonly finalized: PublicTransactionRecord;
        readonly runId: string;
      }
    | { readonly ok: false; readonly error: unknown; readonly runId: string }
  > => {
    const board = boardState.current;
    const runId = `run-${Date.now()}`;
    // 새 제출은 이전 로그를 지우고 시작한다. 방금 한 제출만 화면에 남는다.
    setRuns([
      { id: runId, startedAt: Date.now(), label: options.label, steps: [] },
    ]);
    const inRun = (
      update: (steps: readonly TraceStep[]) => readonly TraceStep[],
    ) =>
      setRuns((prev) =>
        prev.map((run) =>
          run.id === runId ? { ...run, steps: update(run.steps) } : run,
        ),
      );
    const publish = (step: TraceStep) => inRun((steps) => [...steps, step]);

    // 파생과 그 값의 온체인 조회는 한 줄로 합친다. 따로 찍으면 회차마다 같은 줄이
    // 두 배로 쌓여 정작 판정("경로 있음/없음")이 묻힌다.
    const keyStartedAt = performance.now();
    const reviewerKey = pureCircuits.deriveReviewerKey(secret);
    const keyMs = performance.now() - keyStartedAt;
    publish({
      id: "eligibility",
      group: "Merkle · Preprod",
      label: "자격 확인",
      scope: board ? "localLedger" : "local",
      status: "done",
      detail: `reviewerKey ${shortHex(reviewerKey)} · ${
        board
          ? board.isEligible(reviewerKey)
            ? "경로 있음"
            : "경로 없음"
          : "계약 상태 미수신"
      }`,
      ms: keyMs,
    });

    const nullifierStartedAt = performance.now();
    const nullifier = pureCircuits.deriveNullifier(secret, appConfig.itemId);
    const nullifierMs = performance.now() - nullifierStartedAt;
    publish({
      id: "duplicate",
      group: "Merkle · Preprod",
      label: "중복 확인",
      scope: board ? "localLedger" : "local",
      status: "done",
      detail: `nullifier ${shortHex(nullifier)} · ${
        board
          ? board.hasNullifier(nullifier)
            ? "이미 있음"
            : "없음"
          : "계약 상태 미수신"
      }`,
      ms: nullifierMs,
    });

    const submitStartedAt = performance.now();
    runningSince.current = submitStartedAt;
    publish({
      id: "submit",
      group: "Merkle · Preprod",
      label: "회로 실행 · 증명 · 서명 · 제출",
      scope: "network",
      status: "running",
    });

    const settle = (step: TraceStep) => {
      inRun((steps) => [...steps.slice(0, -1), step]);
      runningSince.current = undefined;
    };

    try {
      const finalized = await submit();
      settle({
        id: "submit",
        group: "Merkle · Preprod",
        label: "회로 실행 · 증명 · 서명 · 제출",
        scope: "network",
        status: "done",
        detail: `블록 ${finalized.blockHeight}`,
        ms: performance.now() - submitStartedAt,
      });
      if (options.confirmOnLedger) {
        publish({
          id: "confirm",
          group: "Merkle · Preprod",
          label: "리뷰 반영",
          scope: "ledger",
          status: "running",
          detail: "확인 중",
        });
      }
      return { ok: true, finalized, runId };
    } catch (error) {
      settle({
        id: "submit",
        group: "Merkle · Preprod",
        label: "회로 실행 · 증명 · 서명 · 제출",
        scope: "network",
        status: "failed",
        detail: assertReason(error),
        ms: performance.now() - submitStartedAt,
      });
      publish({
        id: "confirm",
        group: "Merkle · Preprod",
        label: "리뷰 반영",
        scope: "ledger",
        status: "skipped",
        detail: "거래가 만들어지지 않음",
      });
      return { ok: false, error, runId };
    }
  };

  // 인가된 리뷰어(=admin) 본인이 게시한다. 작성자 공개키는 온체인에 남는다.
  const postUnsafe = (session: UnsafeComparisonSession, review: string) => {
    session.submit(review);
    const authorHex = session.exposedAuthorHex();
    setUnsafeReviews((prev) => [{ body: review, authorHex }, ...prev]);
  };

  const requireConfig = (): boolean => {
    if (
      !appConfig.contractAddress ||
      !appConfig.indexerUri ||
      !appConfig.indexerWsUri
    ) {
      setConnectionError("Preprod 계약 주소가 필요합니다");
      return false;
    }
    return true;
  };

  const connectWallet = async () => {
    if (!requireConfig()) return;

    setWalletStatus("connecting");
    setConnectionError(undefined);
    try {
      const session = await connectReviewSession({
        networkId: appConfig.networkId,
        contractAddress: appConfig.contractAddress!,
        indexerUri: appConfig.indexerUri!,
        indexerWsUri: appConfig.indexerWsUri!,
        itemId: appConfig.itemId,
      });
      sessionRef.current = session;
      await bindReviewer(session, activeUser.secret);
      setWalletStatus("connected");
    } catch (error) {
      setWalletStatus("disconnected");
      setConnectionError(connectionMessage(error));
    }
  };

  // 자격자 익명 작성. Merkle: 작성자 미상으로 게시. unsafe: 작성자 키 노출.
  // 같은 자격자가 다시 누르면 Merkle는 nullifier로 중복 차단, unsafe는 재게시.
  const submitEligible = async () => {
    const review = body.trim();
    const api = apiRef.current;
    if (!review || !api || busy) return;

    setSubmitting(true);
    setUnsafeMessage(undefined);
    setUnsafeTone(undefined);
    setMerkleMessage(undefined);
    setMerkleTone(undefined);
    setTransaction(undefined);
    const startedAt = Date.now();

    try {
      const outcome = await runTraced(
        activeUser.secret,
        () => api.submitReview(review),
        { confirmOnLedger: true, label: `${activeUser.label} · 자격자로 제출` },
      );

      if (outcome.ok) {
        const elapsedSeconds = ((Date.now() - startedAt) / 1_000).toFixed(1);
        const unsafeStartedAt = performance.now();
        postUnsafe(unsafeSession, review);
        traceUnsafe(outcome.runId, {
          kind: "posted",
          ms: performance.now() - unsafeStartedAt,
        });
        setUnsafeMessage(
          "게시됨 · 작성자 공개키가 온체인에 남음 · 사용자 1·2·3 공통 신원",
        );
        setMerkleMessage("Preprod 거래 확정");
        setMerkleTone("success");
        setTransaction({ ...outcome.finalized, elapsedSeconds });
      } else {
        const result = translatedError(outcome.error);
        if (result.kind === "duplicate") {
          // 같은 자격자의 재작성: Merkle는 nullifier로 차단, unsafe는 중복 방지가
          // 없어 같은 글을 다시 게시한다.
          const unsafeStartedAt = performance.now();
          postUnsafe(unsafeSession, review);
          traceUnsafe(outcome.runId, {
            kind: "posted",
            ms: performance.now() - unsafeStartedAt,
          });
          setUnsafeMessage("같은 사용자의 글이 재게시됨");
        } else if (result.kind === "ineligible") {
          // 연결된 사용자가 배포된 자격 트리에 없다. unsafe에 게시하지 않는다.
          setUnsafeMessage(
            "이 사용자가 배포된 자격 트리에 없습니다 · 계약 주소를 확인하세요",
          );
          setUnsafeTone("error");
        }
        setMerkleMessage(result.message);
        setMerkleTone("error");
      }
    } catch (error) {
      // 추적 밖에서 터진 예외까지 여기서 흡수한다. 잡지 않으면 submitting이 true로
      // 남아 데모 도중 화면이 잠긴다.
      setMerkleMessage(translatedError(error).message);
      setMerkleTone("error");
      runningSince.current = undefined;
      setRuns((prev) =>
        prev.map((run) => ({
          ...run,
          steps: run.steps.map((step) =>
            step.status === "running"
              ? {
                  ...step,
                  status: "failed" as const,
                  detail: assertReason(error),
                }
              : step,
          ),
        })),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 미등록 리뷰어 경로. Merkle: 트리에 없는 일회성 난수 비밀키라 Preprod 거래 차단.
  // unsafe: 자격을 익명으로 표현하지 못하므로, 게시하려면 새 작성자 신원을 온체인에 노출한다.
  const submitUnregistered = async () => {
    const review = body.trim();
    const session = sessionRef.current;
    if (!review || busy) return;
    if (!session) {
      setConnectionError("먼저 Preprod 지갑을 연결하세요");
      return;
    }

    setSubmitting(true);
    setUnsafeMessage(undefined);
    setUnsafeTone(undefined);
    setMerkleMessage(undefined);
    setMerkleTone(undefined);
    setTransaction(undefined);

    try {
      // 트리에 없는 일회성 난수 비밀키로 join한다. join마다 provider가 새로
      // 만들어져 활성 사용자 상태를 건드리지 않는다. join은 계약 조회라 제출 단계에
      // 섞지 않고 추적 밖에서 끝낸다.
      const throwawaySecret = crypto.getRandomValues(new Uint8Array(32));
      const outsiderApi = await session.join(throwawaySecret);
      const outcome = await runTraced(
        throwawaySecret,
        () => outsiderApi.submitReview(review),
        { confirmOnLedger: false, label: "미등록 키로 시도" },
      );
      if (outcome.ok) {
        setMerkleMessage(
          "예상과 달리 미등록 키가 통과했습니다 — 자격 트리를 확인하세요",
        );
      } else {
        setMerkleMessage(translatedError(outcome.error).message);
      }
      setMerkleTone("error");

      // ownPublicKey 기준선도 등록되지 않은 호출자를 막는다(assert ownPublicKey()==admin).
      // 즉 미등록 사용자는 두 계약 모두에서 게시되지 않는다. 다만 unsafe는 공개된
      // admin 키와 대조해 막고, Merkle은 아무 신원도 드러내지 않고 막는다.
      const unsafeStartedAt = performance.now();
      const unsafeError = unsafeSession.attemptOutsider(review);
      const unsafeMs = performance.now() - unsafeStartedAt;
      traceUnsafe(
        outcome.runId,
        unsafeError ? { kind: "blocked" } : { kind: "posted", ms: unsafeMs },
      );
      setUnsafeMessage(
        unsafeError
          ? "차단됨 · 공개 admin 키와 대조"
          : "예상과 달리 통과됨 — 기준선을 확인하세요",
      );
      setUnsafeTone("error");
    } catch (error) {
      setMerkleMessage(translatedError(error).message);
      setMerkleTone("error");
    }

    setSubmitting(false);
  };

  const resetLocalResult = () => {
    setUnsafeSession(new UnsafeComparisonSession());
    setUnsafeReviews([]);
    setRuns([]);
    setUnsafeMessage(undefined);
    setUnsafeTone(undefined);
    setMerkleMessage(undefined);
    setMerkleTone(undefined);
    setTransaction(undefined);
  };

  // 자격자를 전환한다. 각 사용자는 서로 다른 비밀키를 가지며, 전환하면 그 사용자로
  // 다시 연결해 리뷰를 작성한다. 세 사용자 모두 자격 트리에 등록돼 있어 각자 게시된다.
  const switchUser = async (id: number) => {
    if (id === activeUserId || busy || walletStatus === "connecting") {
      return;
    }
    const nextUser = demoUsers.find((user) => user.id === id) ?? demoUsers[0];
    setActiveUserId(id);
    setConnectionError(undefined);
    setRuns([]);
    setUnsafeMessage(undefined);
    setUnsafeTone(undefined);
    setMerkleMessage(undefined);
    setMerkleTone(undefined);
    setTransaction(undefined);

    const session = sessionRef.current;
    if (!session) {
      // 아직 지갑 연결 전 — 상태만 바꾼다. 연결 시 이 사용자로 join된다.
      return;
    }

    // 지갑 재연결(Lace) 없이 이 사용자의 비밀키로 다시 join한다.
    // walletStatus는 connected 그대로 둔다 — 연결은 유지되고 있기 때문이다.
    setSwitchingUser(true);
    setAuthorState(undefined);
    try {
      await bindReviewer(session, nextUser.secret);
    } catch (error) {
      setConnectionError(connectionMessage(error));
    } finally {
      setSwitchingUser(false);
    }
  };

  // 배포된 계약에 데모 자격키가 몇 개나 실제로 등록돼 있는지. 3 미만이면 이 브라우저의
  // VITE_DEMO_SECRET_* 또는 계약 주소가 어긋난 것이고, 그대로 녹화하면 데모가 죽는다.
  const registeredDemoKeys = demoKeysEligible?.filter(Boolean).length;
  const demoKeyWarning =
    registeredDemoKeys !== undefined && registeredDemoKeys < demoUsers.length
      ? `데모 자격키 ${registeredDemoKeys}/${demoUsers.length}만 이 계약에 등록됨 · 계약 주소와 VITE_DEMO_SECRET_1·2·3 확인`
      : undefined;

  const reviewerStatus =
    walletStatus !== "connected"
      ? "지갑 연결 전"
      : switchingUser
        ? "리뷰어 전환 중"
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
        <div
          className="compare-users"
          role="group"
          aria-label="데모 자격자 전환"
        >
          {demoUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              className={`compare-user${
                user.id === activeUserId ? " selected" : ""
              }`}
              aria-pressed={user.id === activeUserId}
              disabled={busy || walletStatus === "connecting"}
              onClick={() => switchUser(user.id)}
            >
              {user.label}
            </button>
          ))}
        </div>
        <dl className="compare-network-state" aria-live="polite">
          <div>
            <dt>현재 사용자</dt>
            <dd>
              {activeUser.label} · {reviewerStatus}
            </dd>
          </div>
          <div>
            <dt>활성 자격키</dt>
            <dd>{activeUser.reviewerKeyHex.slice(0, 16)}…</dd>
          </div>
          <div>
            <dt>계약 주소</dt>
            <dd>
              {appConfig.contractAddress ?? "배포된 계약 주소가 필요합니다"}
            </dd>
          </div>
        </dl>
        {demoKeyWarning && (
          <p className="form-error" role="status">
            {demoKeyWarning}
          </p>
        )}
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
            <>
              <button
                className="button primary"
                disabled={body.trim().length === 0 || busy}
                onClick={submitEligible}
                type="button"
              >
                {submitting
                  ? "증명 생성·거래 확인 중"
                  : switchingUser
                    ? "리뷰어 전환 중"
                    : "자격자로 제출"}
              </button>
              <button
                className="button outline"
                disabled={body.trim().length === 0 || busy}
                onClick={submitUnregistered}
                type="button"
              >
                미등록 키로 시도
              </button>
            </>
          )}
          <button
            className="compare-reset"
            disabled={busy}
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
          messageTone={unsafeTone}
          reviews={unsafeReviews}
          authorNote={{
            text: "작성자 공개 — 온체인 admin 키에 기록됨",
            exposed: true,
          }}
        />
        <BlindBoard
          label="Merkle 자격 증명 — Preprod 실제 거래"
          title="Merkle"
          message={merkleMessage}
          messageTone={merkleTone}
          reviews={merkleReviews.map((review) => ({ body: review }))}
          authorNote={{
            text: "작성자 미상 — 온체인에 없음",
            exposed: false,
          }}
          anonymitySet={`자격자 ${ELIGIBLE_COUNT}명 · 온체인에 작성자 없음 (k=${ELIGIBLE_COUNT})`}
          transaction={transaction}
        />
        <ProofTrace
          runs={runs}
          ledgerFields={ledgerFields}
          runningMs={runningMs}
        />
      </div>
    </main>
  );
};
