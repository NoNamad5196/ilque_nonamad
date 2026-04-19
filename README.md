# ILQue

Google Calendar 기반 학습 퀘스트 플래너 초안입니다. 설계 문서 기준으로 `Next.js 14 + Tailwind + NextAuth + Supabase + Google AI` 구조를 먼저 잡아두고, Google 로그인 이후 실제 데이터 흐름을 확인할 수 있도록 구성했습니다.

## 포함 범위

- 랜딩 페이지
- 대시보드 UI
- 온보딩 플로우
- 목표 설정 + AI 플랜 생성
- 기록 / 프로필
- Auth / Calendar / Quest / Goal API 골격
- Supabase 스키마 초안

## 실행

```bash
npm install
npm run dev
```

환경 변수는 `.env.example`를 기준으로 채우면 됩니다.

## 환경 변수

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_AI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 현재 구현 메모

- OAuth / Supabase / Google AI 키를 연결하면 실제 로그인, 저장, 퀘스트 생성 흐름으로 동작합니다.
- `app/api/quests/generate`와 `app/api/goals/generate`는 AI 연결에 실패하면 로컬 생성기로 안전하게 되돌아갑니다.
- Supabase 스키마는 현재 `NextAuth` 세션의 `sub` 값을 사용자 ID처럼 사용하는 전제를 두고 작성되어 있습니다.

## 구조 메모

- `app/`: App Router 페이지와 API 라우트
- `components/`: 대시보드, 목표, 온보딩 UI
- `lib/`: 인증, 캘린더, AI, 데이터 처리 로직
- `supabase/schema.sql`: 테이블과 RLS 초안

## 주의

설계 문서에는 `auth.uid()` 기반 UUID 예시가 있지만, 현재 빌드는 `NextAuth`를 중심으로 먼저 동작하도록 `text` 기반 사용자 ID를 사용하고 있습니다. 추후 Supabase Auth를 직접 연결하거나 Supabase 호환 JWT 브리지를 붙이면 `users.id`, `user_id` 컬럼을 `uuid`로 바꾸는 쪽이 더 자연스럽습니다.
