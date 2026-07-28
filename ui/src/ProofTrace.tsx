// SPDX-License-Identifier: Apache-2.0
//
// 제출 한 번이 어떤 단계를 지나는지 쌓아 보여주는 로그. 원칙은 하나다:
// **실제로 관측한 값만 찍는다.**
//
// 회로 내부(제약 평가 순서, 증명 생성만의 소요)는 클라이언트에서 관측할 수 없다.
// 그래서 회로 실행·증명·서명·제출을 한 단계로 두고 전체 소요 시간만 표시한다.
// 관측하지 못한 것을 그럴듯한 로그 문자열로 지어내지 않는다.
//
// 배치: 제출 회차는 최신이 위. 회차 안의 단계는 시간 순 — 인과가 거꾸로 읽히면
// "왜 막혔는지"를 보여준다는 목적이 사라지기 때문이다.

export type TraceStatus = "running" | "done" | "failed" | "skipped";

export type TraceStep = {
  readonly id: string;
  readonly label: string;
  readonly status: TraceStatus;
  readonly detail?: string;
  readonly ms?: number;
  // 어느 계약의 단계인가. 같은 회차 안에서 두 계약을 나눠 읽기 위한 것이다.
  readonly group?: string;
};

export type TraceRun = {
  readonly id: string;
  readonly startedAt: number;
  readonly label: string;
  readonly steps: readonly TraceStep[];
};

const statusText: Record<TraceStatus, string> = {
  running: "실행 중",
  done: "완료",
  failed: "실패",
  skipped: "실행 안 함",
};

const formatMs = (ms: number): string =>
  ms >= 1_000 ? `${(ms / 1_000).toFixed(1)}초` : `${ms.toFixed(1)}ms`;

const formatClock = (epochMs: number): string => {
  const at = new Date(epochMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
};

type ProofTraceProps = {
  readonly runs: readonly TraceRun[];
  readonly ledgerFields?: readonly string[];
  readonly runningMs?: number;
};

export const ProofTrace = ({
  runs,
  ledgerFields,
  runningMs,
}: ProofTraceProps) => (
  <section className="compare-trace" aria-label="terminal">
    <header className="compare-board-header">
      <h2>terminal</h2>
    </header>
    {runs.length === 0 ? (
      <p className="compare-empty">제출하면 단계가 기록됩니다</p>
    ) : (
      <div className="trace-runs">
        {[...runs].reverse().map((run) => (
          <section className="trace-run" key={run.id}>
            <p className="trace-run-header">
              {formatClock(run.startedAt)} · {run.label}
            </p>
            <ol className="trace-list">
              {run.steps.map((step, index) => (
                <li className={`trace-step ${step.status}`} key={step.id}>
                  {step.group && step.group !== run.steps[index - 1]?.group && (
                    <p className="trace-group">{step.group}</p>
                  )}
                  <div className="trace-row">
                    <span className="trace-label">{step.label}</span>
                    <span className="trace-status">
                      {statusText[step.status]}
                    </span>
                  </div>
                  <p className="trace-meta">
                    {[
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
          </section>
        ))}
      </div>
    )}
    {ledgerFields && ledgerFields.length > 0 && (
      <dl className="trace-ledger">
        <dt>계약이 저장하는 것</dt>
        <dd>{ledgerFields.join(" · ")}</dd>
      </dl>
    )}
  </section>
);
