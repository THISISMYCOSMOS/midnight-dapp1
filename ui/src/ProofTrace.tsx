// SPDX-License-Identifier: Apache-2.0
//
// 제출 한 번이 어떤 단계를 지나는지 보여주는 패널. 원칙은 하나다:
// **실제로 관측한 값만 찍는다.**
//
//   local   — 이 브라우저에서 그 함수를 실제로 실행하고 시간을 잰 값
//   ledger  — 마지막으로 수신한 계약 공개 상태를 조회한 값
//   network — 회로 실행·증명·서명·제출을 한 덩어리로 호출한 실측 시간
//
// 회로 내부(제약 평가 순서, 증명 생성만의 소요)는 클라이언트에서 관측할 수 없다.
// 그래서 쪼개지 않고 한 단계로 두며, 화면에도 그렇게 적는다. 관측하지 못한 것을
// 그럴듯한 로그 문자열로 지어내지 않는다.

export type TraceScope = "local" | "ledger" | "network";
export type TraceStatus = "running" | "done" | "failed" | "skipped";

export type TraceStep = {
  readonly id: string;
  readonly label: string;
  readonly scope: TraceScope;
  readonly status: TraceStatus;
  readonly detail?: string;
  readonly ms?: number;
};

const scopeText: Record<TraceScope, string> = {
  local: "로컬 · 비공개",
  ledger: "원장 읽기",
  network: "네트워크",
};

const statusText: Record<TraceStatus, string> = {
  running: "실행 중",
  done: "완료",
  failed: "실패",
  skipped: "실행 안 함",
};

const formatMs = (ms: number): string =>
  ms >= 1_000 ? `${(ms / 1_000).toFixed(1)}초` : `${ms.toFixed(1)}ms`;

type ProofTraceProps = {
  readonly steps: readonly TraceStep[];
  readonly ledgerFields?: readonly string[];
  readonly runningMs?: number;
};

export const ProofTrace = ({
  steps,
  ledgerFields,
  runningMs,
}: ProofTraceProps) => (
  <section className="compare-trace" aria-label="처리 단계">
    <header className="compare-board-header">
      <p>클라이언트에서 관측한 것</p>
      <h2>처리 단계</h2>
    </header>
    {steps.length === 0 ? (
      <p className="compare-empty">제출하면 단계가 기록됩니다</p>
    ) : (
      <ol className="trace-list">
        {steps.map((step) => (
          <li className={`trace-step ${step.status}`} key={step.id}>
            <div className="trace-row">
              <span className="trace-label">{step.label}</span>
              <span className="trace-status">{statusText[step.status]}</span>
            </div>
            <p className="trace-meta">
              {[
                scopeText[step.scope],
                step.detail,
                step.status === "running" && runningMs !== undefined
                  ? formatMs(runningMs)
                  : step.ms !== undefined
                    ? formatMs(step.ms)
                    : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ol>
    )}
    {ledgerFields && ledgerFields.length > 0 && (
      <dl className="trace-ledger">
        <dt>계약 원장 필드</dt>
        <dd>{ledgerFields.join(" · ")}</dd>
      </dl>
    )}
    <p className="trace-note">
      파생 단계는 같은 계산을 클라이언트에서 실행한 값입니다. 회로 내부는 관측할 수
      없어 증명·제출을 한 단계로 둡니다.
    </p>
  </section>
);
