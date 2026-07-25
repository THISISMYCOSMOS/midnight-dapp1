# 인계 프롬프트 — 익명성·비교 데모 정직화 (Claude Code용)

> 이 문서는 Claude Code가 그대로 실행하는 작업 지시다. 착수 전 `AGENTS.md`를 전부 읽어라.
> 목표: 발표 논지를 스스로 반증하던 두 결함(익명 집합 k=1, 허수아비 비교)을 제거하고,
> 부수 위생 이슈를 정리한다. 발표(10분)에서 발표자가 확신 갖고 완주하는 것이 유일한 기준이다.

---

## 0. 배경 (왜 하는가)

현재 코드는 "컴파일·테스트·Preprod 배포"까지 도달했지만, 산출물이 발표의 두 축을 스스로 깬다.

- **결함 #1 (치명):** 자격 트리 3자리를 `실키 1 + 난수 2`로 채운다(`cli/src/deploy-preprod.ts`,
  `ui/src/OperatorDeployment.tsx`의 `randomReviewerKey()`). 난수 2개는 대응 비밀키가 없어 아무도
  유효 증명을 못 만든다 → 유효한 리뷰는 반드시 그 1명. 익명 집합 k=1. "누가 썼는지 모른다"가
  추론으로 붕괴한다.
- **결함 #2 (치명):** unsafe 계약은 실제로 작동하는 `ownPublicKey()==admin` 접근제어인데,
  `ui/src/comparison-simulators.ts`의 `UnsafeComparisonSession`이 제출 직전 admin 키를 호출자에
  복사해 억지로 통과시킨다. 실제 Midnight에선 불가능한 도용을 흉내내는 **조작된 허수아비**다.
  게다가 이 "위조" 프레이밍은 슬라이드의 "익명성 파괴" 논지와 어긋난다.

부수 이슈: #5 URL `#secret=` 자동 수입, #6 낡은 배포 지도. (#4는 정정됨 — §Task D 참조.)

---

## 1. 불변 제약 (하드 가드레일 — 위반 금지)

1. **`contract/src/review.compact` 구조 수정 금지** (AGENTS.md §2.2). 도메인 문자열,
   `disclose()` 위치, witness/circuit/ledger 경계, `ownPublicKey()` 도입 금지. 문법·타입 에러만
   수정하되, 그마저 위 4개를 건드려야 한다면 **고치지 말고 원문 보고**하고 멈춰라.
2. **`contract/comparison/unsafe-review.compact` 구조 수정 금지.** 비교 기준선이다.
3. **계약을 수정하지 않으므로 재컴파일은 원칙적으로 불필요하다.** 만약 계약을 건드려야 하는
   상황이 오면 그 자체가 설계 재검토 신호다 — 멈추고 보고하라.
4. **신규 런타임 의존성 0개** (AGENTS.md 스코프 방어선). 공식 예제가 쓰는 것만.
5. 아래 두 작업은 **AGENTS.md §1 스코프 방어선(동작 문구·리뷰어 수)을 건드린다.**
   착수 전 §10의 스코프 변경 기록문을 `AGENTS.md`에 반영하라.
6. **작업 순서와 게이트를 지켜라.** Task A → B → **검증 게이트(사람 확인 대기, 정지)** → C → D → 부수정리.
   게이트를 사람이 승인하기 전에 Task C 이후로 넘어가지 마라.

경로: 프로젝트 루트 `C:\Users\parks\OneDrive\Desktop\midnight`.
컴파일 필요 시(원칙상 불필요) AGENTS.md §4.4의 WSL 명령을 쓴다. Windows `compact.exe` 사용 금지.

---

## 2. 작업 순서

```
Task A (Fix #2, UI만, 저위험)
Task B (Fix #1, 3키 재배포, 되돌리기 어려움)
── 검증 게이트: 증거 제출 후 사람 확인까지 정지 ──
Task C (#5 URL 비밀키 하드닝)
Task D (#4 주석 명시 — 제거 아님)
부수정리 (#6 배포 지도 동기화)
```

---

## Task A — 결함 #2 제거: 비교를 정직한 논지로 재프레이밍

**새 논지:** "ownPublicKey는 뚫린다"를 버린다. "ownPublicKey 접근제어는 **작동하지만 작성자
신원을 원장에 노출**하고, 익명과 자격을 동시에 표현할 수 없다"를 보인다. 모든 표시는 이미 공개된
원장 값만 읽어서 만든다. 위조/우회 서술은 전부 삭제한다.

### A-1. 작성자 신원 표시 (핵심)

- `ui/src/comparison-simulators.ts`: `UnsafeComparisonSession`에 admin 공개키를 노출하는
  getter 추가 (예: `adminKeyHex(): string` — `getUnsafeLedger().admin.bytes`를 hex로).
- `ui/src/ComparisonDemo.tsx`:
  - `BlindBoard`에 작성자 표시용 prop 추가(예: `author?: { text: string; exposed: boolean }`).
  - **unsafe 보드:** 각 리뷰 또는 보드 상단에 `작성자: {admin hex 앞 8자}… (공개 원장에서 읽힘)` 표시.
    `exposed: true` 스타일(경고색).
  - **Merkle 보드:** `작성자 미상 — 공개 원장에 없음` 뱃지. `exposed: false`.
    (근거: `contract/src/test/access-control-comparison.test.ts`가 원장에 `reviewerKey` 부재를 이미 증명)

### A-2. 익명 집합 표시

- Merkle 보드에 `자격자 N명 · 작성자 특정 불가 (k=N)` 배너. N은 배포된 계약의
  `ledger.eligible` 등록 수에서 읽거나(가능하면) 배포 설정 상수에서 가져온다. Task B 이후 N=3.

### A-3. 미등록자 시나리오를 위한 UI 추가 (승인됨 — "필요하면 UI 더 만들어도 좋다")

- localStorage를 손으로 지우지 않고도 **미등록 리뷰어** 경로를 시연할 컨트롤 추가.
  예: `미등록 키로 시도` 버튼 → 트리에 없는 **일회성 난수 비밀키**로 join/submit 시도.
  결과: Merkle는 `등록되지 않은 리뷰어라 Preprod 거래가 차단됐습니다`, unsafe는 신원 노출한 채 게시.
- 기존 `같은 리뷰 제출`(자격자) 버튼과 시각적으로 구분한다.

### A-4. 서술 정리

- `로컬 기준선에서는 게시되었습니다` 등 문구를 **신원 노출/중복 허용** 관점으로 교체.
  "위조", "우회", "통과 취약점" 류 표현 삭제. `translatedError`의 Preprod 차단 문구는 유지.

### A-5. 새 3동작이 화면에서 다 드러나는지 확인

1. **자격자 익명 작성** — Merkle: 게시 + "작성자 미상". unsafe: 게시 + "작성자 키 노출".
2. **미등록자 차단** — Merkle: "차단". unsafe: 신원 노출로 게시(자격을 익명으로 표현 불가 예시).
3. **중복 차단** — Merkle: nullifier 차단. unsafe: 중복 게시.

### Task A 수용 기준

- `cd ui && npm run typecheck` 통과, `npm run build` 통과.
- 코드베이스 어디에도 "위조/우회로 ownPublicKey를 뚫는다"는 서술이 남지 않는다.
- 세 동작이 UI 조작만으로 재현되고 각 보드의 작성자 노출 여부가 시각적으로 구분된다.

---

## Task B — 결함 #1 제거: 익명 집합을 진짜 k=3으로

**핵심:** 난수 2자리를 **실제 비밀키에서 나온 파생키 2개**로 교체한다. 계약은 안 바뀐다
(constructor가 이미 `Vector<3>`). 연단에서 3명이 클릭할 필요 없다 — 유효 비밀키 3개가 **존재**하면
관찰자는 "3 중 누구냐"에 답할 수 없다.

### B-1. 실제 리뷰어 키 3개 생성

- 기존 도구 사용: `node reviewer-tools/reviewer-key.mjs --name reviewerA` 를 이름만 바꿔 3회 실행.
  (비밀키는 저장소 밖 `%LOCALAPPDATA%\midnight-review\reviewers\<name>`에 저장, 공개 reviewerKey 출력.)
- **admin-blind 성질(§3 함정④) 유지 조건:** 비밀키 3개는 서로 다른 주체(또는 최소한 서로 다른
  브라우저 프로필)에서 생성하고, 운영자에겐 공개 파생키만 전달하는 것이 원칙. 데모 편의상 한 사람이
  3개를 만들었다면, 발표에서는 **"외부 관찰자 기준 k=3"** 로만 주장하고 "admin조차 모른다"는
  과잉 주장을 피하도록 슬라이드/멘트에 표시하라(§Task 부수정리에서 문서화).

### B-2. 배포 입력 교체 + 재배포

- `deployment/reviewer-keys.json` 에 위에서 얻은 **실제 파생키 3개**(64 hex)를 넣는다.
  (형식: `deployment/reviewer-keys.example.json` 참조 — 문자열 배열 3개.)
- 로컬 proof server 기동 확인(`docker compose ps`, AGENTS.md §4.4).
- `cd cli && npm run deploy:preprod` 실행 → 새 계약 배포.
- `deployment/preprod.json`을 새 `contractAddress / txId / blockHeight / reviewerKey(대표 1개)` 등으로 갱신.
- UI가 새 주소를 쓰도록 `VITE_CONTRACT_ADDRESS`(또는 `?contract=` 파라미터)를 갱신.
- `ui/src/OperatorDeployment.tsx`의 `randomReviewerKey()` 자동 채움은 "발표용 난수" 문구와 함께
  **실키 3개 입력 모드**로 조정하거나, 최소한 "난수 슬롯은 익명성을 무효화한다"는 경고를 노출하라.

### B-3. 라이브 리뷰어 브라우저에 실키 1개 로드

- 데모용 브라우저가 3개 비밀키 중 하나를 보유하게 한다. (게이트 검증 시점에는 기존 수입 경로를
  써도 되나, Task C에서 하드닝한다.) 나머지 2개 비밀키는 **존재만** 하면 k=3이 성립한다.

### Task B 수용 기준

- 배포된 계약의 `ledger.eligible`에 **실제 파생키 3개**가 등록되어 있고, 세 키 각각
  `findPathForLeaf`가 성공한다.
- 세 키와 무관한 난수키는 `submitReview`에서 `Reviewer is not eligible`로 거부된다.
- `deployment/preprod.json`, UI 계약 주소가 새 배포를 가리킨다.

---

## 검증 게이트 (여기서 정지 — 사람 확인 전 진행 금지)

Task A·B가 "제대로" 됐는지 아래 증거를 모아 보고하고 **멈춰라.** 사람이 승인하기 전에는
Task C 이후로 넘어가지 않는다.

1. **테스트:** `cd contract && npm test` → 기존 8건 통과(계약 무변경이라 초록 유지).
   추가 테스트 1건 작성: "자격키 3개 모두 통과 + 4번째(미등록) 거부"를
   `contract/src/test/access-control-comparison.test.ts`에 넣고 통과시킨다.
2. **빌드:** `cd ui && npm run build` 통과, `cd cli && npm run typecheck` 통과.
3. **라이브 3시나리오 캡처:** 새 Preprod 계약에 대해 브라우저에서 (1)자격자 (2)미등록 (3)중복을
   실행하고 각 보드 스크린샷 3장. 각 캡처에서 unsafe=작성자 노출 / Merkle=작성자 미상이 보여야 한다.
4. **k=3 증거:** `ledger.eligible` 등록 수 3, 세 파생키 findPath 성공 로그/출력.
5. **새 배포 메타:** 갱신된 `deployment/preprod.json` diff.

이 5개를 요약해 보고 → **정지.** 사람이 "게이트 통과" 확인하면 Task C로 진행.

---

## Task C — #5: URL `#secret=` 자동 수입 하드닝 (게이트 통과 후)

- 문제: `ui/src/main.tsx:17`이 로드 시 `consumeImportedBrowserSecret`로 URL 조각의 비밀키를
  자동 저장한다. 보안 모델 전체가 32바이트 비밀에 걸려 있는데 이를 URL에 담는다. 등록 화면은
  "비밀키는 URL에 표시하지 않습니다"라고 약속하는데 앱 동작과 모순이다.
- 조치: 로드 시 **자동 소비를 제거**한다. 비밀키 수입이 데모에 필요하면, 리뷰어 등록/설정 화면에
  **명시적 붙여넣기 입력**(사용자가 의도적으로 붙여넣고 버튼 클릭)으로 대체하고, 저장 전 경고
  문구를 노출한다. URL 수입을 유지해야 한다면 localhost 개발 한정 + 화면 경고 + 히스토리 즉시
  제거를 명시하라. 등록 화면의 "URL에 표시하지 않습니다" 약속과 실제 동작을 일치시킨다.

### Task C 수용 기준

- 공개 페이지 로드만으로 URL 조각의 비밀키가 저장되지 않는다.
- 수입은 사용자의 명시적 행동을 요구하고, 등록 화면 문구와 실제 동작이 모순되지 않는다.

---

## Task D — #4: 정정됨 (제거 금지, 주석만)

- `contract/src/review.compact`의 `assert(reviewerKey == path.leaf, "Invalid eligibility path")`는
  **죽은 코드가 아니다.** 컴파일된 회로에서, 신뢰할 수 없는 witness가 *다른* 자격 leaf의 유효 경로를
  제시해 우회하는 것을 막는 **load-bearing 제약**이다(caller의 in-circuit 파생키에 leaf를 묶음).
- **절대 제거하지 마라.** 제거하면 실제 우회 구멍이 생기고 §2.2도 위반한다.
- 조치는 오직 하나: `contract/src/witnesses.ts`의 `ineligiblePath` 근처에 **주석**을 달아,
  "honest witness는 항상 leaf=reviewerKey를 반환하지만 회로의 leaf-바인딩 assert는 악의적 witness
  방어용이며 제거 금지"임을 다음 독자가 오해하지 않게 남긴다. `review.compact`는 손대지 않는다.

---

## 부수정리 — #6: 배포 지도 동기화

- `AGENTS.md §3` 상태표가 배포를 "0건 타임아웃/대기"로 적어 두었으나 실제 Preprod 배포는 성공했다
  (`deployment/preprod.json` status SUCCESS). Task B 재배포 결과로 이 표와 상단 "현재 상태" 노트를
  갱신하라. UI 상태(🟨→검증 반영), 새 계약 주소, 3키 배포 사실을 반영한다.
- 발표 캐비엇 1줄을 슬라이드/노트에 남긴다: **거래 수수료를 낸 지갑으로 온체인 역익명화가 여전히
  가능하다. "계약 원장은 작성자를 안 남긴다"까지만 주장하고 "온체인 완전 불연결"은 주장하지 말 것.**

---

## 최종 수용 기준 (전체)

- `contract`: `npm test` 통과(8 + 신규 1). `review.compact`·`unsafe-review.compact` 구조 무변경.
- `ui`: `npm run build` 통과. 위조 서술 0. 작성자 노출/미상 대비 시각화. 미등록 시나리오 UI 동작.
  URL 비밀키 자동 수입 제거.
- `cli`: `npm run typecheck` 통과. 새 3키 배포 반영.
- 배포: `deployment/preprod.json`·UI 주소가 실키 3개 신규 계약을 가리킴. k=3 검증됨.
- 문서: `AGENTS.md` §1 스코프 변경 기록(아래 §10) + §3 지도 갱신 반영.
- 신규 런타임 의존성 0.

## 착수 전 확인·정지 규칙 요약

- 계약(`.compact`) 구조를 건드려야만 진행되는 상황 → **정지·보고.**
- 검증 게이트 5개 증거 미충족 → Task C로 진행 금지.
- 스코프 방어선(리뷰어 수·동작 문구) 변경은 §10을 AGENTS.md에 먼저 반영.

---

## §10. AGENTS.md에 반영할 스코프 변경 기록문 (착수 전 추가)

> **범위 조정 (2026-07-24) — 익명성·비교 정직화**
> - §1 "발표용 MVP는 실제 리뷰어 1명" → **실제 리뷰어(비밀키) 3명**으로 상향. 사유: 자격 트리를
>   실키 1 + 난수 2로 채우면 익명 집합 k=1이 되어 "누가 썼는지 모른다"가 추론으로 붕괴한다.
>   난수 2자리를 실제 파생키 2개로 교체해 k=3을 성립시킨다. 발표는 "데모 3, 설계 1024(깊이 10)"로 서술.
> - §1 비교 데모 동작 문구 "동일 미자격 제출의 unsafe 통과" → **"ownPublicKey는 작동하지만 작성자
>   신원을 노출하고 익명·자격을 동시에 표현 못 함"** 프레이밍으로 교체. unsafe의 admin-키-복사 도용
>   서술을 폐기하고, 이미 공개된 원장 값(작성자 키 노출 vs 부재)만으로 대비를 시연한다.
> - 캐비엇: 거래 수수료 지갑에 의한 온체인 역익명화는 범위 밖. "계약 원장은 작성자 미기록"까지만 주장.
