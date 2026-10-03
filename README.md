# ILQue V2

**오늘 뭘 공부해야 하지?**

Google Calendar의 고정 일정, 목표와 마감일, 학습 자료를 모아 오늘 실제로 수행할 퀘스트를 준비하는 개인 학습 플래너입니다. 완료한 시간과 미룬 작업을 다음 계획에 반영하고, 경험치·레벨·스트릭으로 꾸준한 배움을 돕습니다.

기준은 [Notion의 2026-09-11 고도화 방향](https://app.notion.com/p/3597cdef782d81a99db4d6cc7d548544)입니다. 승인된 Figma 링크를 찾지 못해, 사용자 지시에 따라 **Learning Dashboard × RPG Quest × Friendly Productivity** 방향으로 재설계했습니다.

## 실행

Node.js 22 이상을 권장합니다. 검증 환경은 Node.js 24입니다.

```bash
npm ci
npm run dev:local
```

[http://localhost:3000](http://localhost:3000)에서 실행합니다. Windows PowerShell 실행 정책이 npm을 차단하면 `npm.cmd`를 사용합니다.

- 로그인 없이 화면과 CRUD를 체험: [http://localhost:3000/demo](http://localhost:3000/demo)
- 실제 계정: Google OAuth 로그인 후 `/dashboard`
- `dev:local`: 계정별 데이터를 서버의 `.local-data/`에 저장합니다. 클라우드와 별도이며 화면에 표시합니다.
- `npm run dev`: `.env.local`의 저장 모드를 사용합니다. 기본값은 Supabase입니다.

체험 데이터는 예시이며 현재 브라우저에만 저장됩니다. 외부 연동은 로그인한 실제 계정에서만 동작합니다. 로그인 우회나 운영용 테스트 계정 기능은 없습니다.

## 매일 사용하는 흐름

1. **목표**에서 마감일, 완료 기준, 전체 예상 학습량을 정합니다.
2. **학습 자료**에 링크·노트를 추가하고 목표와 연결합니다. Notion 자료도 가져올 수 있습니다.
3. **AI 계획**에서 작업을 나누고 내용을 검토·수정한 뒤 적용합니다. 직접 퀘스트를 추가해도 됩니다.
4. **오늘**에서 가능한 시간에 배치된 퀘스트를 확인합니다.
5. 완료 시 실제 소요 시간을 입력합니다. 미루기·시간 변경·목표 변경은 다음 배치에 자동 반영됩니다.
6. **주간 미션**, **진행 기록**에서 꾸준함과 성장 과정을 확인합니다.

## 구현 기능

| 화면      | 기능                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| 오늘      | 다음 퀘스트, 오늘의 진행률, 일정 타임라인, 주간 미션, 경험치·레벨·스트릭       |
| 퀘스트    | 추가·수정·완료·완료 취소·미루기·제외·복구, 검색·상태 필터, 수동 시간 고정      |
| 목표      | 생성·수정·보관, 마감일·학습량·수준·진행률                                      |
| 주간 미션 | 이번 주 완료 목표, 달성률, 이번 주 완료 퀘스트                                 |
| 학습 자료 | 링크·요약 저장, 목표 연결, 자료 기반 퀘스트, Notion 가져오기/내보내기, 웹 검색 |
| 진행 기록 | 완료 시간, 경험치 변화, 수정·미루기 이력, 14일 학습 그래프                     |
| AI 계획   | Gemini 작업 분해, 적용 전 편집, 중복 작업 방지, 현재 계획 재배치               |
| 설정      | 가용 시간·휴식·시간대, 연동·저장 상태, 데이터 JSON 내보내기                    |

## Planning Engine

일정은 LLM이 아니라 결정론적 스케줄러가 정합니다. 목표·마감일·남은 학습량, Calendar 일정, 하루 가용 시간, 예상/실제 소요 시간, 최근 14일 완료율, 미완료·미루기, 직접 고정한 시간을 반영합니다.

- 향후 14일의 빈 시간에 배치하고, 마감일 이후로 자동 배치하지 않습니다.
- 연속된 시간이 부족하면 미배정으로 남기고 조정 이유를 보여줍니다.
- 직접 고정한 일정은 유지하고 충돌을 알립니다.
- 완료·취소·미루기·수정·Calendar 동기화는 AI 호출 없이 다시 배치합니다.
- AI는 사용자가 요청할 때만 작업을 분해합니다. 잘못된 JSON·빈 작업·비정상 시간·API 실패는 저장된 계획을 바꾸지 않습니다.

Calendar의 일반 일정은 고정 시간으로 취급합니다. `SQL`, `공부`, `학습`, `복습`, `코테`, `스터디`, `자격증`, `알고리즘`, `#study`, `#학습`이 포함된 시간 일정은 학습 퀘스트로 연결됩니다. 주간 미션은 기존 `W1`, `주간 미션`, `#weekly` 패턴을 지원합니다.

## 환경 변수

`.env.example`을 참고해 `.env.local`에 설정합니다. 비밀키를 Git이나 클라이언트 코드에 넣지 마세요.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_AI_API_KEY=
GOOGLE_AI_MODEL=gemini-2.5-flash-lite

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ILQUE_STORAGE=supabase

NOTION_TOKEN=
NOTION_DATABASE_ID=
ILQUE_NOTION_OWNER_EMAIL=
```

Google OAuth 허용 리디렉션 URI는 `http://localhost:3000/api/auth/callback/google`입니다. 배포 시 실제 HTTPS 도메인으로 바꿉니다. Calendar 권한은 읽기 전용입니다. Calendar access/refresh token은 암호화된 HttpOnly JWT에서 서버만 사용하며 브라우저 세션 응답에는 포함되지 않습니다.

Notion은 기존 단일 `ILQue` 데이터베이스와 `Type` 구분을 재사용합니다. 개인 integration 자료를 다른 로그인 계정에 노출하지 않도록 `ILQUE_NOTION_OWNER_EMAIL`에 실제 소유 계정의 Google 로그인 이메일을 입력합니다.

## 저장과 이전 데이터

- 기존 NextAuth Google subject와 Supabase `text` 사용자 ID를 유지합니다. Supabase Auth로 전환하지 않았습니다.
- Supabase는 기존 `user_goals.plan_json` JSONB 안에 비활성 V2 작업 공간 행을 저장합니다. 기존 스키마 사용자는 별도 DDL 변경 없이 사용할 수 있습니다.
- 최초 로딩 시 V1 목표·수동 퀘스트·완료 이력을 가져오며 원본 행은 보존합니다.
- `revision` 비교로 동시 수정 충돌을 409로 반환합니다. 완료·경험치·기록은 원자적으로 저장됩니다.
- 파일 저장은 지속 디스크가 있는 로컬 서버용입니다. Vercel 같은 임시 파일 시스템에서는 Supabase를 사용하세요.
- 파일과 Supabase 사이의 자동 데이터 병합은 없습니다. 저장 모드를 바꾸기 전 설정 화면에서 데이터를 내보내세요.

## 검증

```bash
npm test
npm run typecheck
npm run build
# 별도 터미널에서 dev:local 또는 파일 모드 production 서버 실행 후:
npm run test:api
```

빌드 결과를 파일 저장 모드로 실행하려면 PowerShell에서 `$env:ILQUE_STORAGE='file'; npm.cmd run start -- --hostname 127.0.0.1`을 실행합니다. 개발 서버와 프로덕션 서버를 같은 포트에서 동시에 실행하지 마세요.

단위 테스트는 일정 충돌, 마감, 미루기, 실제 시간, 완료율, 한국 시간·DST, 스트릭, Calendar 변경, 비정상 AI·API 오류를 검증합니다. HTTP 통합 테스트는 로컬 전용 가상 세션으로 계정 분리·완료 원자성·동시 수정·디스크 저장을 확인하고 생성한 테스트 파일만 정리합니다. 실제 OAuth 로그인 성공을 대신하는 테스트는 아닙니다.

검증 결과와 외부 연동 제한은 [V2 검증 기록](docs/V2-QA.md), 구현 결정은 [V2 구조](docs/V2-ARCHITECTURE.md)에 정리했습니다.

## 이번 작업에서 확인한 외부 설정

- Google OAuth: 로컬 콜백이 등록되지 않아 실제 브라우저에서 `redirect_uri_mismatch` 발생.
- Supabase: 현재 `.env.local`의 프로젝트 호스트 DNS 조회가 `ENOTFOUND`로 실패.
- 사용자가 외부 설정은 후속으로 남기고 구현·로컬 검증을 계속하도록 지시했습니다. 두 설정 복구 후 실제 Google 계정의 Calendar 읽기와 Supabase 이전 데이터 가져오기를 확인해야 합니다.

## 기술 스택과 구조

Next.js 15 / React 18 / TypeScript / NextAuth 4 / Supabase / Notion SDK / Gemini API / Tailwind + CSS.

- `components/v2/`: 한국어 대시보드, 폼과 공통 UI
- `lib/v2/`: 도메인 모델, 입력 검증, 명령 처리, 스케줄러, 저장, AI 분해
- `app/api/v2/`: 인증된 조회/명령 API
- `lib/auth.ts`, `lib/calendar.ts`, `lib/notion/`, `lib/ai/gemini.ts`: 재사용·보완한 외부 연동
- `supabase/schema.sql`: 기존 text subject 기반 스키마
- `tests/`: 엔진·외부 응답·HTTP 통합 테스트

## Vercel 운영 배포

2026-09-11 V2를 기존 Vercel 프로젝트에 배포했습니다.

- 운영: [ilquenonamad.vercel.app](https://ilquenonamad.vercel.app)
- 체험: [ilquenonamad.vercel.app/demo](https://ilquenonamad.vercel.app/demo)
- 운영 저장 모드: Supabase. 기존 보안 환경변수는 유지합니다.
- 배포 정보와 검증: [Vercel 배포 기록](docs/VERCEL-DEPLOYMENT.md)

실제 계정 연동의 후속 검증은 [후속 작업](TODO.md)을 참고하세요.
