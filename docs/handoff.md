# 인계 프롬프트 — Midnight 익명 리뷰 DApp

다른 채팅에 이 문서를 붙여넣고 시작한다. 작업 폴더가 연결돼 있으면 아래 파일들을 직접 읽어라.

---

## 프로젝트

Midnight Network 기술 발표(10분)용 블라인드 익명 리뷰 DApp + 코드 분석.
"누가 썼는지는 아무도 모르지만 아무나 쓸 수는 없는" 후기 게시판.
발표가 목적이고 프로덕션 제품이 아니다. 판단 기준은 "발표자가 10분 안에 확신 갖고 완주할 수 있는가".

작업 폴더: `C:\Users\parks\OneDrive\Desktop\midnight`
마감: 2026-07-22 기준 1주.

## 먼저 읽을 것

| 파일 | 내용 |
|---|---|
| `AGENTS.md` | 작업 규칙·설계 결정·환경·재발 금지 목록. **착수 전 전부 읽는다** |
| `docs/ux-flow.md` | 사용자 흐름·화면 3개·데모 시나리오 |
| `docs/mockup-prompt.md` | 목업 생성 프롬프트 + 검토 체크리스트 |
| 업로드된 `midnight-handoff.md` | 발표 구성·R2 근거·검증된 기술 사실의 원본 |

`CLAUDE.md`는 `@AGENTS.md` 한 줄 포인터다. 문서 원본은 `AGENTS.md` 하나이고 사본을 만들지 않는다.

## 확정 사항 (재논의 대상 아님)

- **발표 형태**: DApp 구현 + 코드 분석 통합. 리서치를 앞에 배경지식으로 붙이지 않는다
- **발표장에서는 녹화된 데모 영상을 튼다.** 라이브 시연 안 함
- **데모는 웹 UI.** 지갑 연동 실패 시 CLI 후퇴선 유지
- **자격 명단은 MerkleTree.** Set 화이트리스트는 익명성이 깨져서 폐기함 (`AGENTS.md` §3에 이유)
- **최종 `review.compact`에는 `ownPublicKey()` 사용 금지.** 의도적으로 취약한 비교 기준선은 `contract/comparison/unsafe-review.compact` 한 파일에만 둔다
- **운영자 등록은 CLI로.** 화면 예산 3개를 여기 쓰지 않음
- 디자인 시스템은 무채색 5개 + 유채색 1개(`#2F6F5E`, 증명 진행 표시 전용), 타이포 3단계, 간격 4단계

**작업 스타일**: 간결·직접. 여러 번 되물어도 억지로 맞추지 말고 소신껏 최선을 택한다.
근거는 파일 경로·함수명·공식 문서 링크로. 홍보성 표현 금지. 불확실하면 불확실하다고 말한다.

## 완료된 작업 (검증 여부 포함)

- `AGENTS.md` 작성 — 검토 완료. 설계 결정·재발 금지 반영됨
- `docs/ux-flow.md` — 스트레스 테스트 7건 반영해 재작성. 검토 완료
- `docs/mockup-prompt.md` — 검토 체크리스트 포함
- **목업 생성·확정 완료** — `docs/mockup.html` (화면 3개/상태 8개). 검토 체크리스트 8항목 통과, 사용자 확정 (2026-07-22).
  C-2 아웃라인 버튼·body 64px 패딩은 알고 남긴 사소한 편차
- bboard 컨트랙트 원문 대조 — 핸드오프 인용과 일치 확인함
- `contract/src/review.compact` — Compact 0.31.1 전체 컴파일 완료 (`Compiling 1 circuits:`, 종료 코드 0)
- `merkleTreePathRoot` — `MerkleTreePath`에는 `.value` 없이 `path` 직접 전달하는 형태로 실컴파일 확정
- 공개 ledger 3개와 순수 회로 2개를 export해 생성 TypeScript API에서 조회 가능하게 함
- `contract/src/witnesses.ts`와 `contract/src/index.ts` — 비밀 상태·Merkle 경로 witness 및 생성 컨트랙트 결합 완료
- 로컬 계약 시뮬레이터 — 정상·중복·미자격·다른 상품과 unsafe/Merkle 동일 입력·스트레스 비교를 포함해 8건 통과, TypeScript 검사와 배포용 빌드 통과
- `contract/comparison/unsafe-review.compact` — `ownPublicKey() == admin` 취약 기준선 Compact 0.31.1 컴파일 완료. 최종 계약 패키지에는 미포함
- `ui/src/ComparisonDemo.tsx` — `/compare`에서 같은 리뷰를 두 블라인드 게시판에 직접 제출. 미자격 1:0, 자격 제출 2:1, 중복 3:1 결과를 실제 브라우저에서 확인
- `docs/blind-review-comparison-demo.webm` — 같은 3단계 비교를 1280×720, 11.76초 무음 원본으로 녹화하고 세 장면 프레임 확인
- `ui/` — 공식 example-bboard 구조를 바탕으로 지갑 없이 ledger 읽기, Lace 지연 연결, 로컬 자격·중복 사전 판정, 리뷰 제출 UI 구현
- UI TypeScript 검사·Vite 프로덕션 번들·실제 브라우저 지갑 미연결 화면 검증 완료. 배포 의존성 audit 0건

## 다음 작업

- 공식 예제 compose 구성을 기준으로 로컬 노드·인덱서·proof server 기동
- 운영자 초기 자격자 3명 등록·배포 CLI 구현. 계약 주소와 계약별 데모 비밀키 링크 출력
- 배포된 계약에 `ui/`를 연결해 정상·중복·미자격 실거래 검증
- 실거래 검증 후 영상 녹화 → 슬라이드

## 미해결 (정직하게 열어둠)

- 실제 Midnight provider·지갑·인덱서·proof server 연결은 아직 검증하지 않음
- **Midnight.js가 증명 진행 이벤트를 주는지 미확인.** 없으면 가짜 진행바 만들지 말고 경과 시간만 표시
- 증명 생성 시간, 실제 실패 메시지, 인덱서 노출 형태는 실환경에서 측정하지 않음
- `reviews` ledger에 작성 시각이 없어 목업의 리뷰별 날짜는 UI에서 생략함. 임의 날짜는 만들지 않음
- UI 전체 audit에는 개발용 `vite-plugin-top-level-await`의 `uuid` 중간 위험 2건이 남음. 배포 의존성은 0건

## 환경 주의

- Windows Node v24.14.1과 WSL2 `midnight-ubuntu`(Ubuntu 24.04 LTS)에서 npm·Compact 0.31.1 실행을 확인함. Docker는 아직 실행하지 않음
- `contract/node_modules`는 OneDrive 밖
  `C:\Users\parks\AppData\Local\midnight-review\node_modules`로 분리하고 junction으로 연결함
- `ui/node_modules`도 OneDrive 밖
  `C:\Users\parks\AppData\Local\midnight-review-ui-compare\node_modules`로 분리하고 junction으로 연결함
- **OneDrive 경고**: 작업 폴더 안 `select ai 툴\` 폴더에 라벨링 데이터 22,322개 파일이 있다.
  디자인과 무관하고 OneDrive 동기화를 무겁게 한다. 프로젝트 밖으로 옮기는 걸 권함
- Codex는 이 폴더 루트에서 열어야 `AGENTS.md`를 자동으로 읽는다. 하위 폴더에서 열면 놓친다

## 실행 담당(Codex)에게 줄 것

웹 DApp 구현 단계에서:
> `AGENTS.md`를 먼저 읽어라. §2.2 수정 경계와 §5 검증 체크리스트를 따른다.
> `contract/src/review.compact`의 도메인 문자열·`disclose()` 위치·witness/circuit/ledger 경계는 건드리지 마라.
> 공식 example-bboard의 provider 구성을 기준으로 웹 UI를 연결하되, 실제 지갑·노드에서 검증하지 않은 동작은 검증됐다고 쓰지 마라.
