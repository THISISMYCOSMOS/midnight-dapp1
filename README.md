# 블라인드 익명 리뷰 DApp

Midnight Network 기술 발표용 데모. **"누가 썼는지는 아무도 모르지만, 아무나 쓸 수는 없는"** 후기 게시판을
Midnight의 ZK 회로로 구현하고, 흔히 쓰이는 `ownPublicKey()` 접근제어와 나란히 놓고 비교한다.

프로덕션 제품이 아니다.

---

## 무엇을 보여주는가

세 성질을 **동시에** 만족시키는 것이 주제다.

| 성질 | 구현 |
|---|---|
| 자격 | 자격자 파생키를 담은 `MerkleTree<10>` 멤버십 증명 |
| 중복 방지 | `nullifier = hash("review:null:v1", itemId, sk)` |
| 검열 저항 | 작성자를 특정할 값이 온체인에 남지 않음 |

비교 대상인 `ownPublicKey() == admin` 기준선은 **작동한다.** 다만 인가 슬롯이 지갑 하나뿐이라
작성자 신원을 공개하고, 자격과 익명을 동시에 표현하지 못한다.

> 주장의 범위: **"계약이 작성자를 저장하지 않는다"까지만** 주장한다.
> 거래 수수료를 낸 지갑을 통한 온체인 역익명화는 범위 밖이다.

---

# 1단계 · 지갑 없이 확인 (약 5분)

지갑도 토큰도 없이 여기까지 확인할 수 있다. **핵심 주장은 이 단계에서 전부 검증된다.**

## 요구사항

- **Node 22 이상** (`node --version`). Node 20은 지갑 sync 중 크래시한다
- Compact 컴파일러는 **필요 없다.** 컴파일 산출물(`contract/src/managed/`)이 저장소에 포함돼 있다

## 설치와 빌드

`ui`는 `file:../contract`로 계약 패키지를 참조한다. **계약을 먼저 빌드해야 한다.**

```bash
cd contract && npm install && npm run build
cd ../ui && npm install && cp .env.example .env.local
```

`.env.example`에는 **공개 Preprod 데모 계약 주소가 채워져 있다.** 이 값이 없으면 앱이 읽을 계약을
모르므로 게시판이 비어 있고 지갑 연결 버튼도 비활성 상태가 된다. 비밀키 칸은 비워 둔 채로 둔다.

## 회로 동작 확인

컴파일된 실제 회로를 로컬 시뮬레이터로 돌린다. 네트워크도 지갑도 쓰지 않는다.

```bash
cd contract && npm test
```

기대 출력: `Tests 17 passed (17)`. 확인되는 것:

| 테스트 | 확인 내용 |
|---|---|
| `review.test.ts` (4) | 정상 게시 · 중복 차단 · 미자격 차단 · 다른 상품은 별개 |
| `access-control-comparison.test.ts` (7) | `ownPublicKey` 원장에는 작성자 키가 남고, Merkle 원장에는 작성자 슬롯 자체가 없음. 자격자 3명 전원 게시, 4번째 거부 |
| `stress-simulation.test.ts` (6) | 100라운드 3유저 플로우, 500후보 중 정확히 3명만 자격, 3000키·nullifier 무충돌, 미등록자 300명 전원 차단 |

## 화면 확인

```bash
cd ui && npm run dev     # http://localhost:5173/compare
```

`npm run dev`는 실행 전에 zk 자산을 `contract/src/managed/`에서 `ui/public/`으로 자동 복사한다.

지갑을 연결하지 않아도 **Merkle 보드가 Preprod 계약의 실제 리뷰로 채워진다**(읽기는 공개 데이터라 지갑이
필요 없다). `.env.local`을 만들지 않았다면 주소를 URL로 직접 줘도 된다 —
`http://localhost:5173/compare?contract=d9643b895605a579f188ae0596c32580f60e6644d1089e713915870f2f6d1ba1`
(URL 파라미터가 환경변수보다 우선한다).

세 열이 보이면 정상이다:

```
ownPublicKey (로컬 시뮬레이터)   Merkle (Preprod 실거래)   terminal
```

`terminal`에는 `계약이 저장하는 것: eligible · nullifiers · reviews`가 표시된다.
**작성자 필드가 없다는 사실을 주장이 아니라 계약 상태 조회 결과로 보여주는 자리다.**

기본 계약(아래 "현재 배포")에는 이 저장소 관리자의 자격키가 등록돼 있으므로,
본인 키로 제출하려면 2단계가 필요하다. 화면 상단에 `데모 자격키 0/3` 경고가 뜨는 것이 정상이다.

## 정적 검사

```bash
cd ui && npm run build          # 타입체크 + 번들
cd ui && npm run check:design   # 색·타이포·간격·이모지 규칙
cd cli && npm install && npm run typecheck
```

`check:design`의 기준은 취향이 아니라 **사용자 확정 목업(`docs/mockup.html`)에서 실측한 값**이다:
색 6개(무채색 5 + `#2f6f5e`), 타이포 3단계(32·15·13), 간격 4단계(8·16·32·64). 기대 출력은 `위반 0건`.

---

# 2단계 · 실제 거래까지 확인 (Lace 필요)

본인 계약을 배포하고 본인 키로 리뷰를 남기는 단계다.

## 추가 요구사항

- **Docker** — 로컬 proof server. 노드·인덱서는 공식 Preprod 원격 서비스를 쓴다
- **Lace 지갑** (Preprod 네트워크)
- 테스트용 tNIGHT / tDUST — 공식 Faucet

```bash
docker compose up -d
curl http://127.0.0.1:6300      # HTTP 200이면 정상
```

**Lace 설정의 Proof Server를 `http://127.0.0.1:6300`으로 바꿔야 한다.** 원격 프루프 서버로 두면
앱이 연결을 거부한다(증명은 로컬에서만 만든다는 경계).

## 리뷰어 키 3개 만들기

리뷰어 비밀키는 **각 리뷰어 본인 환경에서** 만든다. 운영자는 공개 파생키만 받는다.

이 도구는 `contract/dist/`를 import하므로 1단계의 `cd contract && npm run build`가 선행돼야 한다.
저장소 루트에서 실행한다.

```bash
node reviewer-tools/reviewer-key.mjs --name reviewer-1
node reviewer-tools/reviewer-key.mjs --name reviewer-2
node reviewer-tools/reviewer-key.mjs --name reviewer-3
```

비밀키는 저장소 밖에 저장된다 — Windows는 `%LOCALAPPDATA%\midnight-review\reviewers\<name>\`,
그 외는 `~/.local/share/midnight-review/reviewers/<name>/`.
출력의 `reviewerKey`(공개 파생키) 3개만 다음 단계에 쓴다.

혼자 데모를 돌린다면 세 비밀키를 모두 본인이 갖게 된다. 그 경우 익명 집합 주장은
"외부 관찰자 기준 k=3"까지만 해야 한다.

## 계약 배포

`http://localhost:5173/deploy`

1. 리뷰어 공개키 3개 입력 (서로 달라야 한다. 대응 비밀키 없는 난수 키를 넣으면 익명 집합이 무너진다)
2. `Preprod 지갑 점검` — 네트워크·Proof Server·tDUST 잔액을 Lace에서 읽어 확인한다
3. 테스트 토큰만 쓴다는 체크
4. `최종 Merkle 계약 Preprod 배포` → Lace 승인

배포되면 계약 주소와 `이 계약으로 비교 게시판 열기` 링크가 나온다.

## 앱을 내 계약에 연결

1단계에서 만든 `ui/.env.local`(gitignore 대상)에서 네 줄을 바꾼다:

```
VITE_CONTRACT_ADDRESS=<방금 배포한 계약 주소>
VITE_DEMO_SECRET_1=<리뷰어 1 비밀키 64자리 hex>
VITE_DEMO_SECRET_2=<리뷰어 2 비밀키>
VITE_DEMO_SECRET_3=<리뷰어 3 비밀키>
```

**Vite는 서버 시작 시에만 `.env`를 읽는다.** 저장한 뒤 dev 서버를 재시작한다.

`/compare` 상단 경고가 사라지고 `데모 자격키 3/3`이 되면 연결된 것이다.

## 세 가지 동작 확인

| 동작 | 조작 | 기대 결과 |
|---|---|---|
| 자격자 익명 게시 | `사용자 1` → `자격자로 제출` → Lace 서명 | Merkle 보드에 리뷰 게시, 거래 ID·블록·소요시간 표시. 작성자 정보 없음 |
| 3명 모두 게시 | `사용자 2`·`사용자 3`으로 전환 후 각각 제출 | **지갑 재연결 없이** 전환된다. 세 리뷰 모두 작성자 미상 |
| 중복 차단 | 같은 사용자로 다시 제출 | Merkle 차단, `ownPublicKey` 쪽은 재게시 — 대비가 한 화면에 보인다 |
| 미등록자 차단 | `미등록 키로 시도` | 양쪽 다 차단. Merkle은 신원 없이, `ownPublicKey`는 공개 admin 키 대조로 |

제출할 때마다 `terminal`에 단계가 기록된다. **실제로 관측한 값만 찍는다** — 로컬 파생 함수의 실측 시간,
계약 상태 조회 결과, 회로 assert 사유, 확정 블록. 회로 내부는 클라이언트에서 관측할 수 없으므로
증명·서명·제출은 한 단계로 둔다.

미등록·중복 시도에서는 **Lace 서명창이 뜨지 않고 tDUST도 소모되지 않는다.** 회로 assert가 증명 생성
이전에 걸려 거래가 만들어지지 않기 때문이다. 서명창이 뜬다면 이 문서의 설명이 틀린 것이다.

## 테스트를 반복하려면

**온체인 리뷰는 삭제할 수 없다.** 계약에 삭제 회로가 없고 `reviews`는 append-only다.

| 목적 | 방법 |
|---|---|
| 중복 차단만 풀기 | `/compare?item=test2` — nullifier가 `(비밀키, itemId)`라 상품을 바꾸면 세 사용자가 다시 제출할 수 있다. 게시판 목록은 남는다 |
| 게시판까지 비우기 | `/deploy`로 계약을 새로 배포 |

---

## 문제 해결

| 증상 | 원인·조치 |
|---|---|
| `Lace의 Proof Server가 로컬이 아닙니다` | Lace 설정에서 `http://127.0.0.1:6300`으로 변경 |
| `Midnight 지갑 확장을 찾지 못했습니다` | Lace 미설치·잠금 상태. 설치·잠금 해제 후 새로고침 |
| `호환되는 Midnight 지갑이 없습니다 — 발견: …` | DApp Connector 4.x가 아님. 메시지에 실제 버전이 찍힌다 |
| 리뷰가 한참 뒤에 뜬다 | 계약 상태 구독 첫 emit이 실측 10초다. HTTP 조회로 즉시 채우도록 했으니 2초 안에 보여야 한다 |
| 게시판이 비고 `배포된 계약 주소가 필요합니다`가 뜬다 | `.env.local`이 없거나 `VITE_CONTRACT_ADDRESS`가 비었다. `cp .env.example .env.local` 후 dev 서버 재시작 |
| `.env.local`을 고쳤는데 반영이 안 된다 | dev 서버 재시작. Vite는 시작 시에만 읽는다 |
| 5173에 옛 화면이 뜬다 | 좀비 프로세스. Windows `netstat -ano \| findstr :5173` → `taskkill /PID <PID> /F`, mac·linux `lsof -ti :5173 \| xargs kill` |
| `데모 자격키 0/3` 경고 | `.env.local`의 비밀키가 그 계약의 자격 트리에 없다. 계약 주소 또는 키를 확인 |

---

## 저장소 구조

```
contract/src/review.compact                 최종 계약 (48줄, 회로 3개)
contract/comparison/unsafe-review.compact   ownPublicKey 비교 기준선 — 어떤 네트워크에도 배포하지 않음
contract/src/witnesses.ts                   비밀키·Merkle 경로 witness
contract/src/managed/                       컴파일 산출물 (커밋됨 — 컴파일러 없이 실행 가능)
contract/src/test/                          Vitest 17건
ui/src/ComparisonDemo.tsx                   /compare 본체
ui/src/ProofTrace.tsx                       terminal 패널
ui/src/midnight/                            provider·계약 API
ui/scripts/check-design.mjs                 디자인 규칙 검사
reviewer-tools/reviewer-key.mjs             리뷰어 로컬 키 생성 (운영자는 실행하지 않음)
cli/                                        운영자 배포 폴백
AGENTS.md                                   설계 원칙·경계·재발 금지 기록
```

## 현재 배포 (Preprod)

```
계약  d9643b895605a579f188ae0596c32580f60e6644d1089e713915870f2f6d1ba1
확인  2026-07-25 — 자격키 3/3 등록, 계약이 저장하는 것: eligible · nullifiers · reviews
```

`deployment/preprod.json`은 **폐기된 첫 배포(`c14e788…`)의 기록**이다. 현재 주소가 아니다.

배포 경로는 브라우저 `/deploy` + Lace다. `cli/`의 독립 지갑 배포는 Preprod 상태 스트림이
10분 동안 한 건도 오지 않아(`seen: 0`) 필수 경로에서 제외했다. 폴백·진단용으로만 남긴다.

## 버전

| 구성요소 | 버전 |
|---|---|
| Compact 컴파일러 | 0.31.1 |
| Compact runtime | 0.16.0 |
| on-chain runtime | 3.0.0 |
| Midnight.js | 4.1.1 |
| DApp Connector API | 4.0.1 |
| Proof server | 8.1.0 |

## 측정값 (2026-07-25, Preprod)

| 항목 | 실측 |
|---|---|
| `queryContractState` (HTTP) | 864 ~ 1372 ms |
| 계약 상태 구독 첫 emit (WS) | 10110 ~ 11426 ms |
| `findDeployedContract` | 2271 ms |
| 사용자 전환 (2~5회차) | 848 ~ 1135 ms |

## 경계

- **Preprod 전용.** Mainnet, 실제 코인 구매, 금전 가치가 있는 토큰은 쓰지 않는다
- **리뷰어 비밀키는 리뷰어 환경에서만 생성·보관한다.** 운영자는 공개 파생키만 받는다
- `unsafe-review.compact`는 로컬 시뮬레이터로만 실행하고 어떤 네트워크에도 배포하지 않는다

## 아직 검증하지 않은 것

- **실제 Lace 승인을 포함한 3유저 라이브 거래**와 증명 생성 소요 시간
- 발표 영상 녹화
- 3열 레이아웃·타이포 축소의 시각 확인 일부 — 렌더 출력으로만 확인했다

## 문서

- `AGENTS.md` — 설계 원칙, 스코프 방어선, 재발 금지 기록
- `docs/ux-flow.md` — 사용자 흐름
- `docs/mockup.html` — 확정 목업 (디자인 기준)
