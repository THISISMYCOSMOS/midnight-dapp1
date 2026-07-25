# 인계 프롬프트 — 3유저 데모·정직화·버그수정 (Claude Code용)

이 문서는 다음 세션이 그대로 이어서 작업할 지시다. **착수 전 `AGENTS.md`를 전부 읽어라.**
프로젝트 루트: `C:\Users\parks\OneDrive\Desktop\midnight` (WSL에선 `/mnt/c/Users/parks/OneDrive/Desktop/midnight`).
발표(10분)에서 발표자가 확신 갖고 완주하는 것이 유일한 기준이다.

---

## 0. 이번 세션이 한 일 (요약)

직전 인계문(`docs/handoff-anonymity-comparison-fix.md`)의 Task A·B·C·D·부수정리를 **전부 코드 반영**했고,
사용자 요청으로 **3유저 전환 데모**와 **지갑 1회 연결**까지 추가했다. 계약(`.compact`)은 무변경.

### 완료·검증됨

- **§10 스코프 기록** — `AGENTS.md §1`에 "범위 조정 2026-07-24"(리뷰어 1→3, 비교 정직화, 온체인 역익명화 캐비엇) 반영. MVP "리뷰어 1명" 항목 폐기 처리.
- **Task A (허수아비 제거)** — `ui/src/comparison-simulators.ts`, `ui/src/ComparisonDemo.tsx`, `contract/src/test/unsafe-review-simulator.ts`, `contract/src/test/access-control-comparison.test.ts`. admin-키-복사 도용을 삭제. unsafe=작성자 키 노출 / Merkle=작성자 미상 대비. `미등록 키로 시도`는 **양쪽 다 차단**(unsafe는 `attemptOutsider`가 실제 회로로 `ownPublicKey()==admin` 검사에 막힘). "위조/우회" 서술 0.
- **Task B 코드** — `ui/src/OperatorDeployment.tsx`를 실키 3개 입력으로 교체(난수 자동채움 제거), 데모 3키로 프리필. `deployment/reviewer-keys.json`에 실제 파생키 3개.
- **3유저 스위처** — `ui/src/demo-users.ts` 신규. `/compare` 최상단 `사용자 1·2·3` 버튼. `VITE_DEMO_SECRET_1/2/3`(`.env.local`, gitignore) 또는 localStorage에서 비밀키. **브라우저 파생 = 배포 3키 일치(네트워크 독립) 검증 완료.**
- **지갑 1회 연결** — `ui/src/midnight/browser-providers.ts`에 `connectReviewWallet`/`buildReviewProviders`/`connectReviewSession` 분리·추가. `ComparisonDemo`는 `bindReviewer`로 세션 재사용 → 사용자 전환 시 Lace **재연결 없이** 리뷰어 비밀키만 교체. join마다 provider를 새로 만들어 사용자별 private state를 격리(미등록 시도가 활성 사용자 오염 안 함).
- **Task C** — `ui/src/main.tsx`·`ui/src/browser-secret.ts`에서 URL `#secret=` 자동 수입 제거. 등록 화면 "URL에 표시 안 함" 약속과 동작 일치.
- **Task D** — `contract/src/witnesses.ts`의 `ineligiblePath` 옆 주석: `review.compact`의 leaf-바인딩 `assert`는 악의적 witness 방어용, **제거 금지**. `review.compact`는 손대지 않음.
- **부수정리** — `AGENTS.md §3` 지도·현재상태 노트 갱신(11→17 테스트, 3키 계약, CLI 타임아웃 재확인, 캐비엇).
- **버그수정** — (a) `config.ts`: URL `?contract=`가 env보다 **우선**(원래 env-first라 `?contract=`가 무시됐음). (b) `ComparisonDemo` `submitEligible`: 미자격 에러가 unsafe에 "중복"으로 잘못 게시되던 것 → 미자격이면 unsafe 미게시 + 안내.
- **스트레스 시뮬레이션** — `contract/src/test/stress-simulation.test.ts` 신규, **6건 통과**(100라운드 3유저 플로우, 500후보 중 정확히 3명만 자격, 3000키·nullifier 무충돌, outsider 300명 전원 차단, unsafe 중복 방지 없음).

### 검증 결과 (원문 기준)

- `cd contract && npm test` → **17건 통과** (`review` 4 + `access-control-comparison` 7 + `stress-simulation` 6).
- `cd ui && npm run build` → 통과(타입체크 포함). `cd cli && npm run typecheck` → 통과.
- 계약 `.compact` 무변경 → 재컴파일 불필요.

---

## 1. 배포 상태 (실제)

- **새 3키 계약**: `cf951445c4061db58b53d13582f7e9be8c7437806f874aed04a01ebbe2a48c5e`
  — 사용자가 이번 세션에 브라우저 `/deploy`+Lace로 배포. `.env.local`·기본값이 이 주소를 가리킨다.
- **옛 계약(폐기)**: `c14e788f9919636bee5d8cfe8febd671540858adfac4a66ec9f1ac8e29748855` (1 실키 `2d3becf3…` + 난수 2). 데모 3키가 없어 못 씀.
- **리뷰어 3키**: `5b2c88c4…5f77e4dc` / `fe484a9a…f925ffac` / `bc27a7b1…32328fca`.
  비밀키는 저장소 밖 `%LOCALAPPDATA%\midnight-review\reviewers\reviewer{A,B,C}\`. 파생키 = 이 3개.

---

## 2. 지금 열려 있는 문제 (다음 세션 최우선)

**사용자 마지막 보고: "지갑 계속 연결하는 거 수정 안 된 것 같다."**
**→ 2026-07-25 원인 확정·수정 완료. 옛 번들 가설은 틀렸다.**

- **연결 코드는 옳았다**: `connectReviewSession`은 1회, `switchUser`는 저장된 세션으로 `join`만 다시 한다. 실제 Lace `connect()` 호출은 전환 시 0건.
- **진짜 원인은 표시였다**: `switchUser`가 `walletStatus`를 `"connecting"`으로 바꿨고, `ComparisonDemo`의 렌더가 `walletStatus !== "connected"`로 분기한다. 그래서 **사용자 1→2→3 전환마다 제출 버튼이 사라지고 `Preprod 지갑 연결 중` 버튼이 다시 나타났다.** 사용자가 본 것은 정확했고, "코드가 맞다"는 판정이 렌더된 화면을 확인하지 않은 오판이었다.
- **수정** (`ui/src/ComparisonDemo.tsx`): 전환 상태를 `switchingUser` 플래그로 분리. `walletStatus`는 `connected` 유지 → **연결 버튼은 첫 1회 이후 다시 나타나지 않는다.** 전환 중 버튼 라벨은 `리뷰어 전환 중`, 상태줄은 `현재 사용자 · 리뷰어 전환 중`. 입력 잠금은 `busy = submitting || switchingUser`로 통일. 기록: `AGENTS.md §6.10`.
- **여전히 정상(수정 대상 아님)**: `제출`마다 뜨는 Lace **서명창**은 모든 온체인 거래에 필수다. 없앨 수 없고, 이것을 "재연결"로 설명하지 않는다.
- **남은 확인(사용자 조작 필요)**: 하드 새로고침(Ctrl+Shift+R) 후 사용자 1 연결 → 2·3 전환에서 연결 버튼이 다시 뜨지 않는지 육안 확인. 여기서도 다시 뜬다면 그때 `findDeployedContract`/DApp connector 재연결을 조사한다.

---

## 3. 환경 함정 (반드시 숙지 — 이번 세션에 실제로 데인 것들)

1. **Node 경로**: 셸에 `node`가 PATH에 없다. `npm`은 Windows npm(`/mnt/c/Program Files/nodejs/npm`). 스크립트 직접 실행은 `"/mnt/c/Program Files/nodejs/node.exe"`. WSL `midnight-ubuntu`에는 node가 없다(컴파일용 `compact`만).
2. **dev 서버 좀비**: `TaskStop`은 vite 자식 프로세스를 안 죽인다 → 5173에 좀비가 남아 **사용자가 옛 서버(옛 계약)를 계속 봄**. 반드시 PID로 죽여라:
   ```bash
   cmd.exe /c "netstat -ano | findstr LISTENING | findstr :5173"   # PID 확인
   cmd.exe /c "taskkill /PID <PID> /F"
   ```
3. **`config.ts` 우선순위**: URL `?contract=`가 `VITE_CONTRACT_ADDRESS`보다 우선하도록 이미 고침. (원래 반대라 `?contract=`가 무시됐다 — 사용자를 한참 헷갈리게 한 버그.)
4. **Vite `.env`는 서버 시작 시에만 읽음**: `.env.local` 바꾸면 dev 서버 재시작 필요(HMR 안 됨).
5. **CLI 배포 죽어 있음**: 운영자 지갑 sync가 `seen:0`로 10분 타임아웃(2026-07-24 재확인, `AGENTS.md §6.9`). 배포는 **브라우저 `/deploy`+Lace(사람)** 뿐. proof server는 `http://127.0.0.1:6300` HTTP 200(윈도우 Docker Desktop).
6. **node에서 인덱서 계약상태 조회 불가**: `ledger(state.data)`가 `expected instance of ChargedState`로 실패(junction된 node_modules에 onchain-runtime wasm 사본 2개). 계약 자격 등록을 헤드리스로 못 캔다 → 브라우저 `/compare`의 `현재 사용자 · 등록된 리뷰어` 상태줄로 확인.
7. **Windows node의 `/tmp`는 `C:\tmp`로 매핑**: 임시 스크립트는 저장소 안에 두고(상대 import), 의존성 필요하면 `contract/`에서 실행. 다 쓰면 `_*.tmp.mjs` 즉시 삭제.
8. **데모 비밀키**: `ui/.env.local`의 `VITE_DEMO_SECRET_1/2/3` = AppData의 reviewerA/B/C 비밀키. 발표에선 "외부 관찰자 기준 k=3"까지만 주장(3키가 한 브라우저에 모여 있음, `AGENTS.md §1` 캐비엇).

---

## 4. 재기동 절차

```bash
# dev 서버 (Windows npm 사용). 5173 좀비 있으면 §3-2로 먼저 죽여라.
cd /mnt/c/Users/parks/OneDrive/Desktop/midnight/ui && npm run dev
# → http://localhost:5173/  (/compare, /deploy, /enroll)

# 검증
cd contract && npm test        # 17건
cd ui && npm run build         # 타입+번들
cd cli && npm run typecheck
```

데모 흐름: `/compare` 하드새로고침 → `사용자 1` 연결(Lace 1회) → `자격자로 제출`(Lace 서명) → `사용자 2`/`3` 전환 → 각자 제출. `미등록 키로 시도` = 양쪽 차단.

---

## 5. 남은 작업 (게이트/발표)

- **[수정됨 2026-07-25] §2의 지갑 재연결** — 원인은 `walletStatus` 오표기, `switchingUser` 분리로 수정. 브라우저 육안 확인만 남음(사용자 조작).
- **라이브 3유저 거래 캡처** — 새 계약에서 (1)자격자 3명 게시 (2)미등록 차단 (3)중복 차단 스크린샷 + 소요시간 원문 보관. Lace 필요(사람).
- **발표 영상 녹화**(`AGENTS.md §2.3`, 무편집 원본 보관).
- **불변 제약 유지**: `contract/src/review.compact`·`contract/comparison/unsafe-review.compact` 구조 무수정, `ownPublicKey()` 도입 금지, `reviewerKey`에 `disclose()` 금지, 신규 런타임 의존성 0. 계약을 건드려야 하면 **멈추고 보고**.

---

## 6. 정직성 원칙 (재확인)

- "위조/우회로 ownPublicKey를 뚫는다" 서술 절대 부활 금지. 논지는 **"ownPublicKey는 작동하지만 작성자 신원을 원장에 노출하고, 익명·자격을 동시에 표현 못 함."**
- 미등록자는 **양쪽 계약 모두에서 차단**(unsafe는 공개 admin 키 대조로, Merkle은 ZK로 신원 비노출). 이게 정확한 대비다.
- 온체인 역익명화(수수료 지갑) 캐비엇 유지: "계약 원장은 작성자 미기록"까지만 주장.
