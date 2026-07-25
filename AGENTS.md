# AGENTS.md — Midnight 익명 리뷰 DApp

> 이 문서는 "이 프로젝트에서 무엇을 조심하는가"다. "어떻게 일하는가"는 별도 마스터 작업 프롬프트가 담당한다.
> 작업자(Claude / Codex / 기타)는 착수 전 이 문서를 전부 읽는다.
> 최종 갱신: 2026-07-23

---

## 1. 정체성

**무엇을** — Midnight Network 기술 발표(10분)용 블라인드 익명 리뷰 DApp + 코드 분석.
"누가 썼는지는 아무도 모르지만 아무나 쓸 수는 없는" 후기 게시판.

**왜** — 발표가 목적이다. 프로덕션 제품이 아니다. 판단이 갈릴 때는 항상
"발표자가 10분 안에 확신 갖고 완주할 수 있는가"가 기준이다. "이론상 최강"은 기준이 아니다.

**어디서** — `C:\Users\parks\OneDrive\Desktop\midnight` (OneDrive 동기화 폴더)

**마감** — D-7 이내 (2026-07-22 기준 1주)

### 스코프 방어선

이 선을 넘는 제안은 **하기 전에 명시적으로 표시**한다.

| 항목 | 상한 |
|---|---|
| `.compact` 회로 수 | 3개 |
| `.compact` 줄 수 | 130줄 (2026-07-22 상향, 아래 범위 조정 참조. 참고: 공식 bboard는 55줄) |
| 신규 런타임 의존성 | 0개. 공식 예제가 쓰는 것만 |
| 데모 화면 | 3개 |
| 데모 동작 | 3개 (자격자 익명 작성 / 미등록자 차단 / 중복 차단. unsafe는 "작성자 신원 노출" 대비로 시연 — 아래 범위 조정 2026-07-24 참조) |

### 범위 밖 (합의된 포기)

- 임계 폭로 에스크로 — **구현하지 않는다.** 개념 슬라이드 1장만
- 구매 attestation 서명 검증 — Schnorr 폴리필 비용 과다
- DUST를 앱 기능·UI·컨트랙트로 구현하는 일체

**사용자 승인 인프라 예외 (2026-07-23)**:

- Preprod 계약 배포 지갑을 준비하기 위해 공식 `example-bboard`와 같은 tDUST 등록 절차만
  운영자 CLI 내부에서 사용한다
- 이 예외를 사용자 기능·발표 기능으로 확장하지 않는다
- 리뷰어 비밀키는 DUST 지갑·운영자 CLI와 완전히 분리한다

**사용자 승인 발표용 Preprod MVP 범위 (2026-07-23, 위 예외를 대체)**:

- 최종 Merkle 계약은 Midnight **Preprod**에 한 번 실제 배포하고 리뷰 거래를 검증한다
- `contract/comparison/unsafe-review.compact`는 로컬 비교 시뮬레이터로만 실행하며
  Preprod·Mainnet에 배포하지 않는다
- 공식 Faucet의 테스트용 tNIGHT와 Lace에서 준비한 테스트용 tDUST만 사용한다
- 지갑 승인과 테스트넷 트랜잭션은 실제로 발생하며 Preprod에 기록된다고 명시한다
- Mainnet, 실제 코인 구매, 신용카드 결제, 실제 금전 가치가 있는 토큰 사용은 금지한다
- ~~발표용 MVP에서는 실제 리뷰어 1명이 …난수 공개값으로 채운다…~~
  **폐기 (2026-07-24, 위 "범위 조정 2026-07-24" 참조).** 난수 2자리는 익명 집합을 k=1로
  붕괴시킨다. 대체: 실제 리뷰어(비밀키) **3명**이 각자 비밀키를 자기 환경에서 생성·보관하고
  운영자는 공개 파생키 3개만 받아 constructor의 세 자리를 전부 실제 파생키로 채운다.
  대응 비밀키 없는 난수 공개값은 자격 트리에 넣지 않는다. Lace 계정 공개키를 리뷰 자격
  키로 사용하지 않는다
- 발표 비교 화면은 `ownPublicKey 비교 기준 — 로컬 데모`와
  `Merkle 자격 증명 — Preprod 실제 거래`를 명확히 구분한다

> **범위 조정 (2026-07-22)**: Merkle 멤버십 증명은 원래 범위 밖이었으나 **범위 안으로 되돌렸다.**
> Set 기반 화이트리스트로는 익명성이 성립하지 않기 때문이다 (§3 설계 결정 기록 참조).
> 이 조정으로 `.compact` 줄 수 상한을 100 → **130줄**로 올린다.

> **범위 조정 (2026-07-24) — 익명성·비교 정직화**:
>
> - **리뷰어 수 1 → 3.** 위 "발표용 MVP … 실제 리뷰어 1명" 항목을 대체한다. 자격 트리를
>   `실키 1 + 난수 2`로 채우면 난수 2자리는 대응 비밀키가 없어 유효 리뷰가 반드시 그 1명이 되고
>   익명 집합이 k=1로 붕괴한다("누가 썼는지 모른다"가 추론으로 무너진다). 난수 2자리를 실제
>   파생키 2개로 교체해 **k=3**을 성립시킨다. 발표는 "데모 3, 설계 1024(깊이 10)"로 서술한다.
> - **비교 데모 동작 문구 교체.** "동일 미자격 제출의 unsafe 통과" → **"ownPublicKey 접근제어는
>   작동하지만 작성자 신원을 원장에 노출하고, 익명과 자격을 동시에 표현하지 못한다"** 프레이밍으로 바꾼다.
>   unsafe 시뮬레이터가 admin 키를 호출자에 복사해 억지 통과시키던 조작(도용 허수아비)을 폐기하고,
>   이미 공개된 원장 값(작성자 키 노출 vs 부재)만으로 대비를 시연한다. 코드·슬라이드에서
>   "위조/우회로 ownPublicKey를 뚫는다"는 서술을 전부 삭제한다.
> - **캐비엇.** 거래 수수료를 낸 지갑에 의한 온체인 역익명화는 범위 밖이다. 주장은
>   "계약 원장은 작성자를 기록하지 않는다"까지만 하고 "온체인 완전 불연결"은 주장하지 않는다.

---

## 2. 절대 원칙

사용자가 확정한 지시. **재논의 대상이 아니다.**

### 2.1 최종 계약의 `ownPublicKey()` 사용 금지 + 비교 전용 예외

최종 `contract/src/review.compact`에서 `ownPublicKey()`를 쓰면 **발표 전체가 자기모순**이 된다.
발표의 논지가 "그 접근제어가 왜 깨지는지와 무엇으로 교체했는가"이기 때문이다.

컴파일을 통과시키려고 최종 계약에 `ownPublicKey()`를 도입하지 않는다. 예외 없다.

**사용자 승인 비교 예외 (2026-07-22)**:

- `contract/comparison/unsafe-review.compact` 한 파일에만 의도적으로 취약한
  `ownPublicKey() == admin` 기준선을 둔다
- 이 기준선은 최종 계약 패키지에 import하지 않고 실제 서비스 계약으로 배포하지 않는다
- 같은 미자격 제출을 unsafe 기준선과 최종 Merkle 계약에 각각 실행해 결과를 직접 비교한다
- 비교는 원리 설명 전용 화면이 아니라 **블라인드 게시판 사용자 UI와 데모 영상의 실제 동작**으로 드러낸다
- §5의 `ownPublicKey()` 0건 검사는 최종 `contract/src/review.compact`에 계속 적용한다

### 2.2 `review.compact` 수정 경계

Codex(또는 컴파일 담당자)는 **문법·타입 에러만** 수정한다. 아래는 손대지 않는다:

- 도메인 분리 문자열 (`"review:pk:v1"`, `"review:null:v1"`)
- `disclose()` 호출 위치 (§3에 기록된 Merkle 루트·초기 설정 예외 포함)
- `witness` / `circuit` / `ledger` 경계
- `ownPublicKey()` 도입 (2.1)

위 4개를 건드려야만 컴파일이 통과한다면 → **고치지 말고 에러 원문을 그대로 보고**한다. 설계 담당이 재설계한다.
단, Compact 0.31.1 실컴파일 뒤 사용자가 승인한 Merkle 루트와 초기 설정 공개는
§3의 확정된 공개 경계이며 임의 수정 대상이 아니다 (2026-07-22).

### 2.3 발표 형태

- **3파트 구조 (확정 2026-07-22)**:
  ① 아이디어 설명 — 세 성질의 충돌
  ② 아이디어를 미드나잇으로 어떻게 풀었나 — 리서치를 설계 결정으로 흡수
  ③ DApp 코드 설명 + 적용된 미드나잇 기술 특징. 데모 영상은 ③에서 재생
- DApp 구현 + 코드 분석 **통합**. 리서치를 앞에 "배경 지식"으로 따로 붙이지 않는다 (두 개의 발표가 됨). ②가 그 흡수 지점
- **①·②를 먼저 완성한다.** 둘 다 컴파일과 독립이다. ③ 코드·데모가 죽어도 ①·②로 발표가 성립해야 한다
- **발표장에서는 녹화된 데모 영상을 튼다. 라이브 시연을 하지 않는다** (확정 2026-07-22)

### 2.4 데모는 웹 UI, 영상으로 재생

CLI에서 웹으로 변경 확정(2026-07-22). 근거: 증명 생성 대기는 CLI/웹 동일하므로
웹만의 추가 리스크는 지갑 연동 하나뿐. example-bboard에 React UI 선례 있음.

**영상 재생이 확정되면서 달라지는 것** (2026-07-22):

- 발표장 네트워크·지갑 확장프로그램·노드 상태에 대한 의존이 **전부 사라진다**
- 지갑 연동은 **단 한 번만 성공하면 된다.** 재촬영이 가능하므로 실패해도 치명적이지 않다
- 증명 대기 시간이 길어도 **편집으로 줄일 수 있다.** 단, 대기를 통째로 잘라내
  "즉시 처리되는 것처럼" 보이게 하지 않는다 — 그건 홍보성 왜곡이다 (§2.7).
  배속 처리하고 화면에 실제 소요 시간을 표기한다
- 따라서 CLI 후퇴선의 발동 가능성이 낮아졌다. 다만 **제거하지는 않는다** —
  D6(녹화일)까지 웹 UI가 촬영 가능한 상태가 아니면 CLI로 찍는다

**영상 요건**: 무편집 원본을 반드시 보관한다. 편집본만 남기지 않는다.

### 2.5 "두 겹의 실패"를 분리해서 말한다

`ownPublicKey()` 우회는 **두 원인의 합작**이다. 한쪽만 말하면 부정확하다.

1. `ownPublicKey()`가 트랜잭션 서명자와 암호학적으로 결합되지 않음 (prover가 채우는 값)
2. 비교 대상 admin 값이 ledger에 공개라 누구나 읽어 재현 가능

슬라이드·코드 주석·구두 설명 모두에서 이 구분을 유지한다.

### 2.6 UI 디자인 원칙

목표는 "AI가 만든 티가 안 나고, 사용자 흐름을 배려했다고 느껴지는" 화면이다.

**금지 — AI티의 실제 원인은 시각이 아니라 카피다**

- **제품이 자신을 해설하지 않는다.** "🔒 당신의 프라이버시는 안전하게 보호됩니다!" 같은
  자화자찬·안내형 문장 금지. UI 텍스트는 최소·행위 중심
- 이모지 아이콘 금지
- 보라-파랑 그라데이션 히어로 금지 (Web3 템플릿의 기본값)
- 모든 요소에 균등한 강조 금지 — 위계 없는 화면이 AI티의 핵심 신호다

**규칙**

- 타이포·간격은 **정해진 스케일만** 쓴다. 새 크기를 임의로 추가하지 않는다
- 위계는 크기 폭주가 아니라 **웨이트와 여백**으로 만든다
- 시각적 긴장(움직이는 숫자, 애니메이션)은 **의도된 한 곳에만**.
  의사결정 화면(입력, 확인)은 안정된 값만 보여준다
- 에러는 최종 사용자의 언어로 번역한다. 내부 에러 문자열을 그대로 노출하지 않는다.
  "Error: nullifier collision" ✗ / "이미 이 상품에 리뷰를 남기셨습니다" ✓

**"배려했다"는 인상이 나오는 지점 — 이 앱에서는 대기 시간이다**

증명 생성에 수 초~수십 초가 걸린다. 대부분의 ZK 앱이 이걸 스피너 하나로 때운다.
**여기가 이 앱의 디자인 중심이다.** 대기를 숨기지 말고 지금 무슨 일이 일어나는지
단계로 보여준다. 부수 효과로, 발표 중 그 대기가 죽은 시간이 아니라 설명 시간이 된다.

설계해야 할 상태는 성공 화면이 아니라 이것들이다:

- 대기 (진행 단계 표시)
- 실패 — 중복 / 미자격 / 지갑 미연결을 **각각 다른 문구**로
- 빈 상태 (리뷰 0건)
- 지갑 미연결 초기 상태

### 2.7 소통

- 결론 먼저, 근거 나중. 과정 서사는 요청 시에만
- 형용사 아닌 측정값. "빨라졌다" ✗ / "1.30s → 0.93s" ✓
- 근거는 **파일 경로·함수명·공식 문서 링크**로 제시
- 홍보성 표현 금지. 구현된 것과 계획을 명확히 구분
- 여러 번 되물어도 억지로 맞추지 말고 소신껏 최선을 택해 말한다
- 불확실하면 정직하게 불확실하다고 말한다

### 2.8 검증 없이 완료 선언 금지

- 실행 담당은 **출력 원문 그대로** 보고한다. 요약하지 않는다
- 판정 담당이 통과/실패를 판정한다
- **어느 쪽도 단독으로 "됐다"고 선언하지 않는다**
- 검증 불가 환경이면 "검증 못 했음"을 명시하고 무엇을 어떻게 확인해야 하는지 남긴다

### 2.9 발표용 Preprod 거래 경계

- 최종 Merkle 계약의 Preprod 배포와 리뷰 거래만 허용한다
- unsafe 비교 계약은 로컬에서만 실행하고 어떤 네트워크에도 배포하지 않는다
- Lace 연결은 Preprod 지갑·Proof Server·테스트용 tDUST 확인과 최종 Merkle 거래 승인에만 쓴다
- Lace 복구 문구·비밀번호·개인키를 읽거나 저장하거나 요청하지 않는다
- 실제 배포 직전에 Preprod·비 Mainnet·로컬 Proof Server·실제 금전 미사용을 다시 확인한다
- Lace 승인 화면은 사용자가 직접 확인하고 승인한다
- 계약 주소·배포 트랜잭션 ID·리뷰 거래 결과·소요 시간을 원문으로 보관한다
- 시뮬레이터 결과와 실제 Preprod 거래 결과를 같은 실행 환경인 것처럼 표현하지 않는다

---

## 3. 아키텍처 지도

> **현재 상태 (2026-07-25): 익명성·비교 정직화 반영. 계약 무변경(재컴파일 불필요).**
> Vitest는 정직화 재작성과 스트레스 시뮬레이션 추가로 **17건(4+7+6) 통과** — unsafe의 admin-키-복사 도용 시뮬을 제거하고,
> k=3 증거 테스트(세 파생키 findPath 성공 + 4번째 거부)를 추가했다. UI `/compare`는 정직한
> 대비로 재작성했다: 작성자 키 노출(unsafe) vs 부재(Merkle), `k=3` 배너, 미등록자는 양쪽 모두 차단
> (unsafe는 공개 admin 키 대조, Merkle은 ZK로 신원 비노출). 자격자 3명을 한 브라우저에서 전환하는
> **사용자 1·2·3 스위처**를 추가했다(지갑 1회 연결 후 리뷰어 비밀키만 교체 — Lace 재승인 없음).
> URL `#secret=` 자동 수입은 제거했다(§Task C). `/deploy`는 실제 리뷰어 공개키 3개 입력으로 바꿨다.
> **Preprod 배포**: 브라우저 `/deploy`+Lace로 3키 계약 `cf951445…`을 배포해 검증했다(옛 1키 계약 `c14e788…`은 폐기).
> 독립 운영자 **CLI 지갑은 2026-07-24에도 상태 스트림 0건(seen:0)으로 10분 타임아웃 재확인** —
> 배포 경로는 브라우저 `/deploy`+Lace로 확정하고 CLI는 폴백·진단으로만 남긴다(§6.9).
> **캐비엇**: 거래 수수료를 낸 지갑에 의한 온체인 역익명화는 범위 밖. 주장은 "계약 원장은 작성자를
> 기록하지 않는다"까지만 한다(§1 범위 조정 2026-07-24).
> 남은 것: 실제 3유저 라이브 거래·소요시간 원문 보관, 발표 영상 녹화.
> 파일이 실제로 생기면 이 표의 상태를 갱신한다. 낡은 지도는 다음 세션이 대가를 치른다.

| 경로 | 역할 | 소유 | 상태 |
|---|---|---|---|
| `AGENTS.md` | 이 문서 | 설계 | ✅ |
| `CLAUDE.md` | `@AGENTS.md` 포인터 한 줄 | 설계 | ✅ |
| `docs/ux-flow.md` | 사용자 흐름·화면 3개·데모 시나리오 | 설계 | ✅ |
| `docs/mockup-prompt.md` | 목업 프롬프트 + 검토 체크리스트 | 설계 | ✅ |
| `docs/mockup.html` | 화면 3개/상태 8개 목업. 체크리스트 8항목 통과, **사용자 확정 (2026-07-22)** | 설계 | ✅ |
| `docs/blind-review-comparison-demo.webm` | `/compare`의 미자격·자격·중복 직접 비교 무음 원본 | 비교 | ✅ 1280×720, 11.76초, 3장면 프레임 확인 |
| `contract/src/review.compact` | 컨트랙트 본체 | 설계 | ✅ Compact 0.31.1 전체 컴파일 |
| `contract/src/managed/` | 컴파일 산출물 (생성물, 손대지 않음) | 실행 | ✅ TS·ZKIR·prover/verifier 생성 |
| `contract/comparison/unsafe-review.compact` | `ownPublicKey() == admin` 취약 기준선. 최종 계약에 포함하지 않음 | 비교 | ✅ Compact 0.31.1 전체 컴파일 |
| `contract/comparison/managed/` | 비교용 계약 컴파일 산출물 | 비교 | ✅ TS·ZKIR·prover/verifier 생성 |
| `contract/src/witnesses.ts` | 비밀키와 자격 Merkle 경로 witness 구현 | 실행 | ✅ TypeScript 검사·시뮬레이터 검증 |
| `contract/src/index.ts` | 생성 컨트랙트와 witness 결합 | 실행 | ✅ TypeScript 빌드 |
| `contract/src/test/` | 정상·중복·미자격·다른 상품 + unsafe/Merkle 동일 입력·스트레스 비교 | 실행 | ✅ Vitest 17건 통과 (2026-07-25 재실행) |
| `ui/src/ComparisonDemo.tsx` | 정직한 대비: 작성자 키 노출(unsafe) vs 부재(Merkle), k=3 배너, 사용자 1·2·3 스위처, 미등록자 양쪽 차단 | 비교 | 🟨 빌드·타입 통과, 3키 계약 라이브 3유저 거래는 사용자 검증 중 |
| `ui/src/demo-users.ts` | 데모 자격자 3명 비밀키(VITE_DEMO_SECRET_* 또는 localStorage). 파생키 = 배포 3키와 일치 검증 | 비교 | 🟨 빌드 통과 |
| `ui/src/ReviewerEnrollment.tsx` | 실제 리뷰어 브라우저 공개키 등록 `/enroll`. 비밀키 접근은 이 파일에만 | 리뷰어 | 🟨 공개키 렌더·복사 확인, 실제 리뷰 거래 미검증 |
| `ui/src/OperatorDeployment.tsx` | 실제 리뷰어 공개키 3개 입력 운영자 Lace 배포 `/deploy`(데모 3키 프리필). 난수 슬롯 폐기 | 실행 | 🟨 입력 검증·사전 점검 확인, 3키 계약 `cf951445…` 브라우저+Lace 배포 성공 |
| `ui/` | React + DApp Connector + Lace | 실행 | 🟨 타입·번들·혼합 비교·설정 화면 완료, 실제 Lace 거래 미검증 |
| `reviewer-tools/` | 리뷰어 로컬 비밀키/공개키 CLI. 운영자는 실행하지 않음 | 리뷰어 | 🟨 저장소 내부 경로 거부 확인, 실제 리뷰어 실행 미검증 |
| `cli/` | 운영자 배포 폴백. 리뷰어 공개키만 입력 | 실행 | 🟨 타입·빌드 통과, Preprod 지갑 상태 스트림 0건 타임아웃 |
| `docker-compose.yml` | 로컬 proof server 8.1.0. 노드·인덱서는 공식 Preprod 원격 서비스 사용 | 실행 | ✅ TCP 6300·HTTP 200 |
| `slides/` | 발표 자료 | 설계 | ⬜ |
| `docs/research-r2.md` | 원문 인용·근거 보관 | 설계 | ⬜ |

### 코드만 봐서는 모르는 도메인 함정

**① ledger 연산의 인자와 읽기/쓰기는 전부 공개다.**
`disclose()`를 통과했다는 건 "공개해도 된다고 개발자가 선언했다"는 뜻이지 "안전하다"가 아니다.
`MerkleTree.insert`만 예외적으로 값 자체는 안 드러낸다 — 단 값을 맞히면 확인 가능하다.

**② 같은 트랜잭션 안의 두 공개값은 서로 연결된다.**
zkloan `changePin`이 이 함정에 걸렸다 (→ §6.2). 우리 컨트랙트에서도
`nullifier`와 `reviewerKey`가 같은 트랜잭션에 함께 공개되면 익명성이 깨진다. **nullifier만 공개한다.**

**③ 회로는 가변 길이 루프 불가.**
고정 크기 `Vector` + 오프체인 오케스트레이션으로 배치 처리해야 한다.

**④ 화이트리스트에 들어가는 건 파생키뿐이다.**
`eligible` MerkleTree에 저장되는 값은 `persistentHash("review:pk:v1", sk)`이지 신원이 아니다.
따라서 admin조차 누가 썼는지 모른다. 이게 발표의 핵심 시연 포인트다.

### 설계 결정 기록 — 왜 Set이 아니라 MerkleTree인가 (2026-07-22)

**폐기된 초안**: `eligible: Set<Bytes<32>>` + `eligible.member(reviewerKey)`

**폐기 이유**: **ledger 연산의 인자는 전부 공개다**(함정 ①).
따라서 `eligible.member(reviewerKey)` 호출은 `reviewerKey`를 온체인에 노출한다. 결과:

1. admin이 등록한 파생키 목록과 대조하면 **작성자 특정 가능** → 익명성 소멸
2. 같은 트랜잭션에서 nullifier도 공개되므로 **함정 ②에 정면으로 걸린다**
3. §1이 내건 "검열 저항 = 작성자 특정 불가"가 깨진다

Set 멤버십을 값 노출 없이 증명할 수단이 없다.
`MerkleTree`만이 값을 안 드러내는 경로를 제공한다(함정 ①의 예외).

**채택: A안 — MerkleTree 멤버십 증명** (확정 2026-07-22, 재논의 대상 아님)

이 결정이 §1의 범위를 되돌렸다. 대가를 알고 지불한 것이다.

### 설계 골자 (구현·Compact 0.31.1 컴파일 완료)

```compact
witness localSecretKey(): Bytes<32>;
witness findEligibilityPath(pk: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

ledger eligible:   MerkleTree<10, Bytes<32>>;   // 자격자 파생키. 경로는 오프체인
ledger nullifiers: Set<Bytes<32>>;              // 중복 방지. 작성자를 안 가리킴
ledger reviews:    List<Opaque<"string">>;      // 본문

constructor(initialEligible: Vector<3, Bytes<32>>); // 데모 자격자 3명. 별도 공개 설정 단계

circuit deriveReviewerKey(sk)        → persistentHash(["review:pk:v1", sk])
circuit deriveNullifier(sk, itemId)  → persistentHash(["review:null:v1", itemId, sk])
```

**공개 경계 — 이게 설계의 전부다**

| 값 | 공개? | 이유 |
|---|---|---|
| `nullifier` | ✅ 공개 | 중복 검사에 필요. 작성자를 가리키지 않음 |
| 리뷰 본문 | ✅ 공개 | 읽히라고 쓰는 글 |
| 자격 Merkle 루트 | ✅ 공개 | 성공 시 이미 공개된 현재 ledger 루트와 같은 digest만 노출 |
| 초기 자격자 파생키 3개 | ✅ 설정 때만 공개 | constructor의 별도 설정 거래. 리뷰 거래와 함께 공개하지 않음 |
| `reviewerKey` | ❌ **절대 비공개** | 공개되는 순간 화이트리스트와 대조돼 익명성 소멸 |
| Merkle 경로 | ❌ 비공개 | witness로만. 회로 안에서 루트만 대조 |

**리뷰 거래의 `disclose()`는 자격 Merkle 루트 digest, nullifier, 본문에만 붙는다.**
constructor에서는 초기 자격자 파생키 3개만 공개한다. `reviewerKey`와 Merkle 경로에는
절대 `disclose()`를 붙이지 않는다. 붙이면 그 순간 설계가 무너진다. 리뷰에서 가장 먼저 볼 것.

세 가지 성질(자격 / 중복 방지 / 검열 저항)이 **전부 위 두 파생 함수에서 나온다**는 것이
슬라이드 4의 논지다. 새 메커니즘을 추가해 이 대응 관계를 흐리지 않는다.

### A안 실컴파일 결정 — `path` 직접 전달 + 루트 digest만 공개 (2026-07-22)

Compact 0.31.1 최소 예제를 두 형태로 각각 컴파일했다.

- `merkleTreePathRoot<10, Bytes<32>>(path)` → 종료 코드 0, 출력 없음
- `merkleTreePathRoot<10, Bytes<32>>(path.value)` → 종료 코드 1:
  `structure MerkleTreePath has no field named value`

따라서 현재 witness 반환형 `MerkleTreePath<10, Bytes<32>>`에는 **`path`를 직접 전달**한다.
`.value`는 `Maybe<MerkleTreePath<...>>`를 먼저 꺼낼 때만 해당한다.

또한 witness 경로로 계산한 루트를 `eligible.checkRoot()`에 넘기면 컴파일러가 공개 선언을 요구한다.
대안 두 개를 실컴파일한 결과 모두 통과했지만, 성공 거래에서 공개되는 값은 동일했다.

- 채택: 계산한 루트 digest만 `disclose()` 후 `checkRoot()` — 48줄, 회로 3개
- 폐기: 루트를 별도 회로 인자로 전달 — 54줄, 회로 3개, UI 인자·stale-root 실패 경로 추가

성공한 거래에서 공개되는 digest는 이미 공개된 현재 ledger 루트와 같고,
`reviewerKey`·leaf·Merkle 경로는 공개하지 않는다. 사용자가 이 예외를 승인했다 (2026-07-22).

최종 `review.compact` 전체 컴파일 원문은 `Compiling 1 circuits:`이고 종료 코드는 0이었다.
소스는 48줄·회로 3개이며 `submitReview.prover`, `submitReview.verifier`, ZKIR, TypeScript가 생성됐다.

트리 깊이 10(=1024명)은 임의로 정한 값이다. 데모 규모에는 충분하지만 근거는 없다.

---

## 4. 환경

### 4.1 버전 매트릭스 (2026-07-13 기준)

| 구성요소 | 버전 |
|---|---|
| Compact devtools | 0.5.1 |
| Compact 컴파일러 | 0.31.1 |
| Compact runtime | 0.16.0 |
| Compact JS | 2.5.1 |
| on-chain runtime | 3.0.0 |
| Wallet SDK | 1.2.0 |
| Midnight.js | 4.1.1 |
| DApp Connector API | 4.0.1 |
| Indexer | 4.3.3 |
| Proof server | 8.1.0 |

**환경 3종: Preview / Preprod / Mainnet.** Mainnet 운영 중.
**과거 Devnet/Testnet 자료는 폐기 대상이다.** 검색으로 나온 옛 문서를 그대로 믿지 않는다.

### 4.2 버전 지뢰

- **Node 22 이상 필수.** Node 20은 지갑 sync 중 크래시
- Midnight.js 4.1.x의 DApp provider API는 `@midnight-ntwrk/midnight-js-protocol` 서브패스를 따른다.
- 단, 설치된 4.1.1 타입에서 `CompiledContract`와 `WitnessContext`는 protocol 서브패스로 재노출되지 않았다.
  계약 어댑터는 실제 소유 패키지인 `@midnight-ntwrk/compact-js` 2.5.1과
  `@midnight-ntwrk/compact-runtime` 0.16.0에서 직접 import해야 TypeScript 검사를 통과한다.
- pragma 0.22부터 `JubjubPoint`를 `==`로 비교 불가 → 좌표 비교 필요
- `jubjubSchnorrVerify`는 stdlib에 없다 → 폴리필 필요 (이 프로젝트는 Schnorr 미사용, §1 범위 밖)

### 4.3 실행 주체 분담

**현재 Codex 실행 환경**: Windows Node v24.14.1과 WSL2 `midnight-ubuntu`(Ubuntu 24.04 LTS)가 동작한다.
Compact 0.31.1 실컴파일과 npm 검증을 2026-07-23에 재확인했다.
설계 담당(Claude/Cowork)의 별도 Linux 샌드박스 기동 실패 기록은 과거 환경 이력으로만 남긴다.

| 작업 | 실행 주체 |
|---|---|
| 파일 작성·편집 | 설계 담당 가능 |
| GitHub 원문 읽기 (raw URL) | 설계 담당 가능 (검증됨) |
| `npm`, `compact compile`, `docker`, `git` | **로컬 셸 필요 — Codex 또는 사용자** |

### 4.4 재기동 절차

> 아래 환경·컴파일 명령은 2026-07-23 Windows + WSL2 Ubuntu에서 재실측했다.

```bash
# 환경 확인
node --version      # v24.14.1 실측
wsl.exe -d midnight-ubuntu --exec /root/.local/bin/compact --version
# compact manager 0.5.1, 설치된 compiler 0.31.1 실측
# Windows compact.exe는 OS 압축 도구이므로 사용 금지

# 컴파일
wsl.exe -d midnight-ubuntu --exec bash -lc \
  "cd /mnt/c/Users/parks/OneDrive/Desktop/midnight/contract && /root/.local/bin/compact compile src/review.compact src/managed/review"

# 로컬 proof server. 노드·인덱서는 공식 Preprod 원격 서비스 사용
docker compose up -d
docker compose ps
# 2026-07-23 실측: midnightntwrk/proof-server:8.1.0, 127.0.0.1:6300,
# TCP 연결 성공, GET / HTTP 200
```

### 4.5 OneDrive 주의

작업 폴더가 OneDrive 동기화 대상이다. `node_modules`와 Docker 볼륨이 동기화에 걸리면
빌드가 느려지거나 파일이 잠긴다. `contract/node_modules`는
`C:\Users\parks\AppData\Local\midnight-review\node_modules`를 가리키는 junction으로 분리했다.
Docker 볼륨의 OneDrive 외부 배치는 아직 검증하지 않았다.
`ui/node_modules`도 `C:\Users\parks\AppData\Local\midnight-review-ui-compare\node_modules`를
가리키는 junction으로 분리했다.

---

## 5. 검증 체크리스트

### 컨트랙트 변경 시

- [x] `compact compile` 통과 — **출력 원문 첨부** (2026-07-23 재확인: `Compiling 1 circuits:`, 종료 코드 0)
- [x] `ownPublicKey()` 미사용 확인 — **주석 제외 코드 라인에서 0건**.
      (금지 이유를 적은 주석은 있어도 된다. grep 건수만 보면 오판한다)
- [x] 도메인 분리 문자열이 §3 골자와 일치
- [x] **`reviewerKey`에 `disclose()`가 붙어 있지 않다** — 붙으면 설계 붕괴. 최우선 확인
- [x] 리뷰 거래의 `disclose()`는 자격 Merkle 루트 digest, nullifier, 리뷰 본문에만 붙어 있다
- [x] constructor 공개는 초기 자격자 파생키 3개뿐이며 리뷰 거래와 분리돼 있다
- [x] Merkle 경로가 witness로만 다뤄지고 ledger 인자로 새지 않는다
- [x] 같은 트랜잭션에서 공개되는 값들끼리 연결 가능성 점검 (§3 함정 ②)

### UI 변경 시

- [x] 실제로 띄워서 실측한다. "그렇게 보일 것"이 아니라 렌더된 텍스트·실제 동작을 읽는다
- [x] 지갑 미연결 상태 동작 확인
- [ ] `/compare`에서 동일 미자격 리뷰: 로컬 unsafe 게시, Preprod Merkle 차단 확인
- [ ] `/compare`에서 동일 자격 리뷰: 로컬 unsafe와 Preprod Merkle 익명 게시 확인
- [ ] `/compare`에서 같은 자격자의 재작성: 로컬 unsafe 재게시, Preprod Merkle 중복 차단 확인
- [x] `/enroll` 화면에 공개 `reviewerKey`만 표시되고 비밀키·비밀 URL이 없는지 확인
- [x] `/deploy`에서 중복 키·잘못된 형식을 Lace 호출 전에 차단하는지 확인
- [x] Lace가 없는 브라우저에서 명시적 미설치 오류가 나오는지 확인
- [ ] `/deploy`에서 실제 Lace 승인·계약 배포 성공 확인
- [ ] **증명 생성 대기 시간 실측** — 3분 데모에 동작 3개면 대기가 누적된다.
      1회 20초를 넘으면 데모 동작을 2개로 줄인다

### 데모 시연 전

- [ ] 정상 작성 성공
- [ ] 중복 차단 — **실패까지 재현**한다. 에러 메시지를 직접 확인
- [ ] 미자격자 차단 — 실패까지 재현
- [x] 비교 구간 무음 원본 녹화 — `docs/blind-review-comparison-demo.webm`
- [ ] 실제 Lace 거래를 포함한 최종 발표 영상 녹화 완료 (§2.3)

### 실제 Preprod 연동 시

- [ ] 실제 리뷰어 비밀키는 리뷰어 쪽에서만 생성·보관하고 운영자는 파생
      `reviewerKey` 1개만 받는다. 나머지 두 공개값에는 대응 비밀키가 없다
- [ ] 운영자 CLI 출력·저장 파일에 리뷰어 비밀키가 0건이다
- [ ] 공식 Faucet의 테스트용 tNIGHT와 Lace의 테스트용 tDUST만 사용한다
- [ ] 공식 Preprod `/api/v4/graphql`·`/api/v4/graphql/ws` 주소를 사용한다
- [ ] 시뮬레이터 결과와 실제 거래 결과를 분리해 표시한다
- [ ] 정상·미자격·중복 각각의 실제 거래 결과와 소요 시간을 원문으로 보관한다

### 슬라이드

- [ ] 타이머 실측. 슬라이드 1·2·3·5만으로 7분±30초
- [ ] 인용문이 원문과 일치하는지 대조 (요약·의역 금지)
- [ ] "두 겹의 실패" 구분 유지 (§2.5)
- [ ] **검증 상태 정확히 고지** — 컨트랙트 컴파일 완료, DApp 실행·데모는 아직 미검증

### 임시 스크립트

눈에 띄는 이름(`_*.tmp.*`)으로 만들고 실행 후 **즉시 삭제**한다.

---

## 6. 재발 금지 목록

같은 실수를 반복하지 않기 위한 기록. 항목이 늘어나는 건 정상이다.

### 6.1 `ownPublicKey()` 기반 접근제어 — 공식 예제도 틀렸던 것

**원인**: `ownPublicKey()`는 `circuitContext`를 인자로 받는다 = prover가 채워 넣는 값이다.
서명자와 암호학적 결합이 없다. 게다가 비교 대상(admin)이 ledger에 공개라 누구나 읽어 재현할 수 있다.
**두 원인이 합쳐져야 우회가 성립한다** (§2.5).

**공식 기록**: example-zkloan README가 자기 교정했다.
> "Earlier versions of this README documented an `ownPublicKey() == admin` check;
> that check was insecure and has been replaced."

**수정 패턴**: 도메인 분리 해시 + witness secret. 공식 예제 2개(zkloan, bboard)가 독립 수렴했다.

```compact
// zkloan
persistentHash<[Bytes<18>, UserSecretKey]>(["zkloan:admin:pk:v1", sk])
// bboard
persistentHash<Vector<3, Bytes<32>>>([pad(32, "bboard:pk:"), sequence, sk])
```

### 6.2 `changePin` 링커빌리티 갭 — 자체 발견, 미보고

zkloan 소스 주석은 이렇게 주장한다:
> "Changing the PIN yields a new derived public key, breaking linkability to the old identity."

그러나 `changePin` 본문에서 `disclose(oldUserPk)`와 `disclose(newUserPk)`가
**동일 트랜잭션 안에서 둘 다 ledger 연산 인자로** 쓰인다
(`loans.member(oldPk)`, `loans.insert(newPk, ...)`, `loans.lookup(newPk).insert(...)`).
ledger 연산 인자는 전부 공개다.

**결론**: 최종 상태만 보는 관찰자에겐 unlinkable, **트랜잭션 히스토리를 보는 관찰자에겐 linkable.**
소스 주석은 이 구분 없이 쓰여 있다.

**교훈**: "새 키를 파생하면 unlinkable"은 그 자체로 참이 아니다. 전이 트랜잭션이 두 키를 함께 공개하면 무의미하다.
우리 컨트랙트에도 그대로 적용된다 (§3 함정 ②).

**미확인**: 이 트랜잭션이 인덱서에서 실제로 어떤 형태로 노출되는지는 실측하지 않았다.

### 6.3 확인 안 된 채로 남은 것 — 발표 시 명시

- 최종/비교 계약의 Compact 0.31.1 재컴파일, TypeScript 빌드, 로컬 시뮬레이터
  17건, UI 타입·번들·`/compare` 초기 렌더는 확인했다. 실제 provider 연결 거래와
  실제 증명 생성 시간은 아직 검증하지 않음
- `changePin` 트랜잭션의 인덱서 노출 형태 실측 안 함
- `merkleTreePathRoot` 호출 시그니처 불일치는 실컴파일로 해결됨: 현재 반환형에는 `path` 직접 전달 (§3)
- example-bboard의 컨트랙트 어댑터·witness·provider·React UI 패키지 구조는 공식 저장소 원문 확인 완료. 실제 연결 실행은 안 함
- 현재 `reviews` ledger에는 본문만 있고 작성 시각은 없다. 목업의 리뷰별 날짜를 임의 생성하지 않고 UI에서 생략함
- Midnight.js 4.1.1 인덱서 패키지의 브라우저 기본 WebSocket 번들 경고가 있어 `window.WebSocket`을 명시적으로 전달함. 실제 인덱서 연결은 미검증
- Merkle 트리 깊이 10은 근거 없이 정한 값

### 6.4 내가 저지른 설계 오판 — Set 화이트리스트 (2026-07-22)

"화이트리스트가 제일 간단하다"고 추천했고 사용자가 그걸 채택했다.
간단한 건 맞았지만 **익명성을 포기해야 한다는 걸 놓쳤다.**

**원인**: 함정 ①("ledger 연산 인자는 전부 공개")을 문서에 적어놓고도,
자격 확인이 바로 그 ledger 연산이라는 걸 연결하지 못했다.

**교훈**: 프라이버시 설계에서 "간단한 안"을 고를 때는
**그 안이 어떤 값을 온체인에 노출하는지 먼저 나열**한다. 편의성을 먼저 재지 않는다.

### 6.5 운영자가 리뷰어 비밀키를 만드는 배포 초안 — 폐기 (2026-07-23)

운영자 CLI가 자격자 3명의 비밀키를 만들고 URL 조각까지 출력하는 초안을 작성하려 했다.
파일 생성 전에 중단되어 저장소에는 들어가지 않았다.

**문제**: 운영자가 비밀키를 알면 공개 nullifier를 다시 계산해 리뷰 작성자를 식별할 수 있다.
온체인 공개 경계가 안전해도 오프체인 키 배포가 익명성을 무너뜨린다.

**확정 경계**: 리뷰어가 자기 환경에서 비밀키를 만들고 보관한다. 운영자는
`deriveReviewerKey(secret)` 결과인 실제 공개 파생키 1개와 `/deploy`가 생성한 서로
다른 32바이트 난수 공개값 2개를 constructor에 전달한다. 난수 공개값에 대응하는
비밀키는 만들거나 저장하지 않는다.

### 6.6 실제 연동 환경을 로컬 풀스택으로 추측 — 폐기 (2026-07-23)

초기 계획은 로컬 노드·인덱서·proof server 3개를 Docker로 띄우는 것이었다.
현재 공식 `example-bboard`와 환경 문서를 다시 확인한 결과, 발표용 Preprod 경로는
원격 Preprod 노드·인덱서와 로컬 proof server 조합이다.

**확정 경로**:

- Indexer: `https://indexer.preprod.midnight.network/api/v4/graphql`
- Indexer WS: `wss://indexer.preprod.midnight.network/api/v4/graphql/ws`
- Node RPC: `https://rpc.preprod.midnight.network`
- Node WS: `wss://rpc.preprod.midnight.network`
- Proof server: `http://127.0.0.1:6300`

### 6.7 컴파일 출력 폴더 이름 추측 — 재발 금지 (2026-07-23)

비교 계약 재검증 중 기존 출력 폴더가 `managed/unsafe-review`인데
`managed/review`로 잘못 지정해 생성물 폴더를 만들었다. 즉시 올바른 경로로 다시 컴파일하고
잘못 만든 폴더만 절대 경로 검증 후 삭제했다.

**교훈**: 컴파일 전에 기존 managed 디렉터리와 package import 경로를 먼저 읽는다.
출력 경로는 계약 이름으로 추측하지 않는다.

### 6.8 Windows `compact.exe`를 Midnight 컴파일러로 오인 — 재발 금지 (2026-07-23)

PowerShell에서 사용자가 지정한 `compact compile src/review.compact src/managed/review`를
그대로 실행했더니 종료 코드가 0이었지만, 실행된 것은 Midnight가 아니라
`C:\Windows\System32\compact.exe` 파일 압축 도구였다. `Listing ...`과 압축률을 출력한
결과는 계약 컴파일 증거가 아니므로 폐기했다.

**확정 실행 경로**: Windows에서는 항상 WSL2 `midnight-ubuntu`의
`/root/.local/bin/compact`를 절대 경로로 실행한다. 실행 전
`compact --version`(devtools 0.5.1)과 `compact compile --version`(compiler 0.31.1)을
둘 다 확인한다.

2026-07-23 실제 0.31.1 재검증 결과:

- 최종 계약: 출력 `Compiling 1 circuits:`, 종료 코드 0
- 최소 예제 `path`: 출력 없음, 종료 코드 0
- 동일 최소 예제 `path.value`: 종료 코드 1,
  `structure MerkleTreePath has no field named value`

**교훈**: 종료 코드 0만으로 컴파일 성공을 판단하지 않는다. 실행 파일 경로·버전·출력 형식을
함께 확인하고, Windows의 `Listing ... compression ratio` 출력은 즉시 오인으로 판정한다.

### 6.9 독립 운영자 CLI 지갑 동기화 장기 대기 — 필수 경로에서 제외 (2026-07-23)

공식 `example-bboard`와 같은 `FluentWalletBuilder` 시작 순서로 운영자 Preprod 지갑을
두 번 실행했지만, 두 번 모두 `wallet.state()`가 10분 동안 한 번도 방출되지 않았다.
원문 핵심은 `Timeout has occurred`, `lastValue: null`, `seen: 0`이며
RPC는 시작 직후 코드 1000 `Normal Closure`로 끊겼다.

첫 실패 뒤 공식 예제처럼 시작 전에 shielded 초기 상태를 구독하도록 수정했지만 결과는 같았다.
두 실행 모두 상태 동기화 전에 끝났으므로 faucet 요청, tDUST 등록, 계약 배포는 0건이다.

**결정**: 발표에 독립 CLI 지갑은 필수가 아니다. 공식 `example-bboard`의 브라우저
DApp Connector 패턴을 따라 Lace가 거래를 balance/submit하는 `/deploy`를 기본 배포 경로로
사용한다. CLI는 폴백·진단 코드로 남기되 같은 10분 재시도를 반복하지 않는다.

**공개 경계 유지**:

- 실제 리뷰어 브라우저 `/enroll`은 비밀키를 브라우저에만 저장하고 공개
  `reviewerKey` 1개만 표시한다
- 운영자 `/deploy`는 실제 공개키 1개만 받고 나머지 두 자리는 난수 공개값으로
  자동 채우며 리뷰어 비밀키를 읽지 않는다
- 운영자 배포용 임시 private state는 메모리에서만 만들며 자격 Merkle 트리에 넣지 않는다
- 실제 Lace 승인·배포·거래는 아직 검증하지 않았으므로 완료로 표시하지 않는다

2026-07-23 Chrome에서 `/deploy` 렌더는 확인했지만 `window.midnight`가 없어 Lace 확장이
설치되지 않은 상태였다. 공식 Chrome Web Store의 Lace 페이지까지만 열었고,
확장 설치·지갑 생성/복구·Preprod 설정·승인은 사용자 조작이 필요하다.

### 6.10 사용자 전환을 "지갑 연결 중"으로 표시 — UI 상태 오표기 (2026-07-25)

사용자가 "지갑을 계속 연결하는 것 같다"고 두 번 보고했다. 지갑 연결 코드는 옳았다
(`connectReviewSession`은 1회, `switchUser`는 저장된 세션으로 `join`만 다시 한다).
문제는 **표시**였다. `switchUser`가 `walletStatus`를 `"connecting"`으로 바꿨고
`ComparisonDemo`의 렌더가 `walletStatus !== "connected"`로 분기하므로, 사용자 1→2→3
전환 때마다 제출 버튼이 사라지고 **`Preprod 지갑 연결 중` 버튼이 다시 나타났다.**
실제 Lace 호출은 0건이었지만 화면은 재연결처럼 보였다.

**수정**: 전환 상태를 `switchingUser` 플래그로 분리했다. `walletStatus`는 `connected`를
유지하고 전환 중에는 버튼 라벨만 `리뷰어 전환 중`으로 바뀐다. 입력 잠금은
`busy = submitting || switchingUser`로 통일했다.

**교훈**: "코드가 옳다"로 사용자 보고를 닫지 않는다. 사용자가 보는 것은 상태 변수가
아니라 **렌더된 문자열**이다. 상태 머신을 재사용해 서로 다른 두 사건(지갑 연결 /
리뷰어 전환)을 같은 값으로 표현하면 UI가 거짓말을 한다.

**여전히 정상인 것**: `제출`마다 뜨는 Lace 서명창은 모든 온체인 거래에 필수이며
없앨 수 없다. 이것을 "재연결"로 설명하지 않는다.

### 6.10b Lace Proof Server 설정이 local이 아니면 연결 거부 (2026-07-25)

`/compare`에서 지갑 연결이 실패했다. 원인은 코드가 아니라 **Lace 설정의 Proof Server가
로컬(`http://127.0.0.1:6300`)로 바뀌어 있지 않았던 것**이다. `assertPreprodWallet`이
의도대로 거부한 것이며(§2.9 증명은 로컬에서만), 도커 컨테이너·포트는 정상이었다.

**점검 순서**: ① `curl http://127.0.0.1:6300` HTTP 200 ② `docker ps`에 proof-server Up
③ **Lace 설정의 Proof Server가 로컬인지** — ③을 빼먹으면 ①②가 정상이라 코드를 의심하게 된다.
에러 메시지에 조치(로컬 주소로 변경)를 포함하도록 고쳤다.

### 6.11 로컬 회로 실패를 "Preprod가 차단했다"로 표기 (2026-07-25)

`/compare`의 미자격·중복 메시지가 "Preprod 거래가 차단됐습니다"였다. 실제 실행 순서는
`midnight-js-contracts/dist/index.mjs`에서 확인된다: `createUnprovenCallTx`(1448행)가
`contractExec.circuit(...)`로 **회로를 로컬 실행**한 뒤에야 `submitTxCore`(26행)가
`proveTx → balanceTx → submitTx`를 부른다. 따라서 `review.compact`의 assert 실패는
증명·잔고·제출 이전이며 **거래는 만들어지지도 Preprod에 도달하지도 않는다.**
§2.9("시뮬레이터와 실제 거래를 같은 실행 환경인 것처럼 표현하지 않는다") 위반이었다.

**수정**: "…· Preprod 거래는 만들어지지 않았습니다"로 교체.
**부수 확인 수단**: 미등록·중복 시도에서는 Lace 서명창이 뜨지 않고 tDUST도 소모되지
않는다. 뜬다면 위 분석이 틀린 것이므로 즉시 재조사한다.

### 6.12 화면의 k=3 주장에 캐비엇 누락 (2026-07-25)

`/compare` 배너가 조건 없이 "작성자 특정 불가 (k=3)"라고 썼다. 그러나 데모의 세 사용자는
**Lace 지갑 하나를 공유**한다(사용자 전환은 리뷰어 비밀키만 교체). 익명 리뷰 3건의 수수료를
같은 지갑이 내므로 온체인 관찰자는 셋을 묶을 수 있다. §1 범위 조정 2026-07-24의 캐비엇이
문서에만 있고 화면에는 없었다.

**수정**: 배너 문구를 "작성자 특정 불가" → **"자격자 3명 · 원장에 작성자 없음 (k=3)"**로
바꿨다. 이 문장은 §1이 허용한 범위("계약 원장은 작성자를 기록하지 않는다")와 정확히
같으므로 그 자체로 과잉 주장이 아니다.

별도 캐비엇 줄("수수료 지갑에 의한 연결은 별도")도 한 번 넣었으나 **사용자 지시로
삭제했다(2026-07-25)**. 따라서 온체인 역익명화 캐비엇은 **화면에 없고 문서와 구두
설명에만 있다.** 발표에서 익명성을 말할 때 이 한 줄을 반드시 입으로 붙인다 — 화면이
대신 말해주지 않는다.

### 6.13 검증 안 한 진단을 수정안으로 제출 (2026-07-25)

적대적 검토 중 "unsafe 기준선에서는 사용자 2·3이 차단되므로 지금 화면은 조작"이라고
보고하고 차단 로직 추가를 제안했다. **틀렸다.** unsafe 기준선은 리뷰어를 `ownPublicKey()`
= 지갑 공개키로 식별하는데, 데모의 세 사용자는 같은 Lace 지갑을 공유하므로 충실한 unsafe
배포에서는 셋 다 통과한다. 제안대로 고쳤다면 **일어나지 않을 거절을 화면에 만들어내는**
새 허수아비가 됐다(§1이 폐기한 것과 같은 부류, 방향만 반대).

**교훈**: 계약이 무엇을 식별자로 쓰는지(지갑 키 vs 파생키)를 먼저 확정하기 전에는
"이랬어야 한다"는 수정안을 내지 않는다. 검토에서 나온 주장도 코드·실행으로 검증한 뒤에만
수정 대상이 된다. 같은 세션에서 leaf 바인딩 assert는 주석을 믿지 않고 악의적 witness로
실제 공격해 확인했다(A1 `Invalid eligibility path`, A2 `Reviewer is not eligible`,
대조군 통과) — 이쪽이 기본 태도다.

---

## 7. 출처

- Developer Hub — https://midnight.network/developer-hub
- 공식 문서 — https://docs.midnight.network/
- Contributor Hub — https://github.com/midnightntwrk/contributor-hub
- `llms.txt` — https://docs.midnight.network/llms.txt (**API 레퍼런스만** 인덱싱, 가이드·튜토리얼 미포함)
- `ownPublicKey` API — https://docs.midnight.network/api-reference/compact-runtime/functions/ownPublicKey.md
- example-zkloan — https://github.com/midnightntwrk/example-zkloan
  - 컨트랙트 원문 — https://raw.githubusercontent.com/midnightntwrk/example-zkloan/main/contract/src/zkloan-credit-scorer.compact
- example-bboard — https://github.com/midnightntwrk/example-bboard
  - 컨트랙트 원문 — https://raw.githubusercontent.com/midnightntwrk/example-bboard/main/contract/src/bboard.compact
- example-counter — https://github.com/midnightntwrk/example-counter
- awesome-dapps — https://github.com/midnightntwrk/midnight-awesome-dapps
- Kachina 논문 — https://docs.midnight.network/learn/understanding-midnights-technology/kachina
- 지원 매트릭스 — https://docs.midnight.network/relnotes/support-matrix

---

## 8. 갱신 규칙

다음 순간마다 이 문서를 갱신한다:

1. 사용자에게 새 원칙을 지적받을 때 → §2 (재지적당한 항목은 그 사실까지 명시)
2. 함정을 새로 발견할 때 → §3
3. 버그를 고칠 때 → §6
4. 파일이 실제로 생겼을 때 → §3 상태 표
5. 명령을 실제로 실행해봤을 때 → §4.4를 실제 동작한 명령으로 교체

**문서가 낡으면 다음 세션이 같은 대가를 다시 치른다.**
