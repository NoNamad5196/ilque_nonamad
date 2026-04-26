# ILQue

Google Calendar, Notion, Gemini를 연결해서 공부 자료와 일정을 오늘 실행할 퀘스트로 바꾸는 개인 학습 플래너입니다. 현재는 개인 사용 MVP를 실제 데이터 흐름으로 검증하는 단계입니다.

## 현재 기능

- Google OAuth 로그인과 Calendar 읽기
- 오늘 Calendar 이벤트 기반 퀘스트 생성
- 주간 미션 이벤트 분리 표시
- 수동 퀘스트 추가, 삭제, 완료, 실행 취소
- XP, 레벨, 스트릭, 완료 기록 저장
- 목표 입력 기반 Gemini AI 플랜 생성
- AI 플랜 수정 요청으로 재생성
- 저장한 목표 보기, 수정, 삭제
- Notion `ILQue` 데이터베이스 연동
- 퀘스트 완료 기록과 목표 플랜을 Notion에 저장
- Notion Sources 기반 퀘스트 후보 생성
- Gemini Google Search Grounding으로 웹 자료 검색
- 검색 결과를 사용자가 선택해서 Notion Sources에 저장
- NotebookLM 바로가기 제공

## 실행

```bash
npm install
npm run dev
```

PowerShell 실행 정책 때문에 `npm run dev`가 막히면 아래처럼 실행합니다.

```powershell
npm.cmd run dev
```

검증 명령:

```bash
npm run typecheck
npm run build
```

## 환경 변수

실제 값은 `.env.local`에 넣고, `.env.example`은 템플릿으로만 사용합니다. 비밀키는 Git에 올리지 않습니다.

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

NOTION_TOKEN=
NOTION_DATABASE_ID=
```

## Notion 구조

Notion은 DB 4개가 아니라 `ILQue` 데이터베이스 1개를 사용합니다. 항목은 `Type` 속성으로 구분합니다.

- `Mission`: 주간 미션과 공부 방향
- `Quest`: 완료한 퀘스트 기록
- `Goal`: AI 목표 플랜
- `Source`: 공부 자료, 링크, NotebookLM에 넣을 자료 목록

앱이 사용하는 주요 속성:

- `이름`: title
- `상태`: status
- `Type`: Mission / Quest / Goal / Source
- `Category`: sql / coding / study / review
- `Source`: calendar / weekly-mission / manual / notion-source
- `XP`: 경험치
- `Completed At`: 완료 시각
- `Supabase ID`: 앱 내부 기록 ID 또는 웹 자료 식별값
- `Summary`: 요약
- `Plan`: 목표 플랜 본문
- `URL`: 자료 링크

## AI와 검색

기본 모델은 `gemini-2.5-flash-lite`입니다. `.env.local`에 `GOOGLE_AI_API_KEY`를 넣으면 Gemini API를 호출합니다.

- 목표 플랜 생성과 수정 요청 반영에 Gemini를 사용합니다.
- Calendar와 Notion Sources를 퀘스트로 변환할 때 Gemini를 사용합니다.
- 웹 자료 검색은 Gemini API의 Google Search Grounding을 사용합니다.
- 검색은 자동으로 실행하지 않고, 사용자가 `/sources`에서 `웹에서 자료 찾기` 버튼을 누를 때만 실행합니다.
- 검색 결과는 최대 5개만 보여주고, 사용자가 `Sources에 저장`을 누른 결과만 Notion에 저장합니다.

## 배포 체크

Vercel 기준으로 배포할 때 필요한 작업:

- `NEXTAUTH_URL`을 배포 주소로 변경
- Google OAuth Authorized JavaScript origins에 배포 도메인 추가
- Google OAuth Authorized redirect URIs에 `https://배포도메인/api/auth/callback/google` 추가
- Vercel 환경 변수에 Google, Supabase, Notion, Gemini 키 입력
- Supabase URL, anon key, service role key 확인
- Notion integration이 `ILQue` 데이터베이스에 접근 가능한지 확인
- 배포 후 로그인, Calendar 읽기, Sources 검색, Notion 저장 흐름 테스트

## 구조

- `app/`: App Router 페이지와 API 라우트
- `components/`: 대시보드, 목표, 온보딩, Sources UI
- `lib/`: 인증, 캘린더, Gemini, Notion, Supabase 데이터 처리
- `supabase/schema.sql`: 테이블과 RLS 초안
- `TODO.md`: 진행 현황과 다음 작업 목록

## 주의

현재 빌드는 `NextAuth` 세션의 `sub` 값을 사용자 ID처럼 사용하는 전제를 둡니다. Supabase Auth의 `auth.uid()` 기반 구조로 바꾸려면 `users.id`, `user_id` 계열 컬럼을 `uuid` 중심으로 재정리해야 합니다.
