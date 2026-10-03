# ILQue — 설계 문서

> **과거 설계 참고용 (V1).** 현재 구현과 제품 기준은 [V2 구조](docs/V2-ARCHITECTURE.md) 및 [README](README.md)를 따릅니다. 아래 Gemma/UUID/옛 화면 명세는 최신 Source of Truth가 아닙니다.

> 듀오링고 스타일 자격증 플래너 — 이름: ILQue (일퀘)
> Google Calendar 연동 + AI 퀘스트 생성 + XP·스트릭 시스템
> **멀티유저 — 각자 Google Calendar 연동, 데이터 완전 분리**

---

## 1. 기술 스택

| 구분 | 선택 |
|------|------|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Auth | NextAuth.js (Google OAuth) |
| AI | Google AI Studio API — Gemma 4 |
| DB | Supabase (PostgreSQL + RLS) |
| 배포 | Vercel |
| Calendar | Google Calendar API v3 |

---

## 2. 전체 흐름

```
[사용자 A]                         [사용자 B]
Google OAuth 로그인                Google OAuth 로그인
    ↓                                  ↓
본인 Google Calendar 연동          본인 Google Calendar 연동
    ↓                                  ↓
오늘 일정 읽기                     오늘 일정 읽기
    ↓                                  ↓
Gemma 4 퀘스트 생성                Gemma 4 퀘스트 생성
    ↓                                  ↓
완료 → Supabase에 저장             완료 → Supabase에 저장
   (user_id A 행만)                   (user_id B 행만)
```

---

## 3. 인증 구조

- Google OAuth로 로그인
- NextAuth가 Google Access Token 발급 (Calendar 읽기 권한 포함)
- Supabase는 NextAuth 세션의 user id로 본인 데이터만 접근
- Access Token은 서버사이드에서만 사용 (클라이언트 노출 금지)

### Google OAuth 필요 스코프
```
openid
email
profile
https://www.googleapis.com/auth/calendar.readonly
```

---

## 4. 데이터베이스 구조 (Supabase)

> 모든 테이블에 RLS(Row Level Security) 활성화 필수.
> 각 사용자는 본인 `user_id` 행만 읽기·쓰기 가능.

### users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | 기본키 (= auth.uid) |
| email | text | Google 이메일 |
| name | text | 표시 이름 |
| avatar_url | text | 프로필 이미지 |
| xp | int | 누적 XP |
| level | int | 현재 레벨 |
| streak | int | 연속 일수 |
| last_completed_date | date | 마지막 완료일 |
| created_at | timestamp | 가입일 |

### quest_completions
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | 기본키 |
| user_id | uuid | FK → users.id |
| quest_title | text | 완료한 퀘스트 이름 |
| category | text | sql / coding / study / review |
| xp_earned | int | 획득 XP |
| completed_at | timestamp | 완료 시각 |

### weekly_progress
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | 기본키 |
| user_id | uuid | FK → users.id |
| week_date | date | 해당 날짜 |
| completed | boolean | 완료 여부 |

### RLS 정책 (모든 테이블 동일하게 적용)
- SELECT / UPDATE / DELETE : `auth.uid() = user_id` 인 행만
- INSERT : `auth.uid() = user_id` 로만 삽입

---

## 5. API 구조

### 인증
- `GET/POST /api/auth/[...nextauth]` — Google OAuth 처리

### 캘린더 (본인 토큰으로만 호출)
- `GET /api/calendar/today` — 오늘 이벤트 조회
- `GET /api/calendar/week-mission` — 이번 주 미션 이벤트 읽기

### 퀘스트
- `POST /api/quests/generate` — Gemma 4로 오늘 퀘스트 생성
- `POST /api/quests/complete` — 퀘스트 완료 처리 + XP 적립
- `POST /api/quests/manual` — 수동 퀘스트 추가

### 유저
- `GET /api/user/stats` — 본인 XP·레벨·스트릭 조회
- `GET /api/user/history` — 본인 완료 이력 조회

> 모든 API는 세션 없으면 401 반환. 타인 데이터 접근 불가.

---

## 6. Gemma 4 퀘스트 생성 로직

### 입력값
- 오늘 날짜 + 요일
- Google Calendar 오늘 이벤트 목록 (본인 것)
- 이번 주 주간미션 이벤트 설명 텍스트

### 출력값 형식
```
[
  { title, description, category, startTime, endTime, xp },
  ...
]
```

### 카테고리별 XP
| 카테고리 | XP |
|---------|-----|
| sql | 10 |
| coding | 20 |
| study | 30 |
| review | 15 |

### 주의사항
Gemma 4가 JSON을 마크다운 코드블록으로 감싸서 줄 수 있음.
파싱 전 ` ```json ` 블록 제거 처리 필요.

---

## 7. Google Calendar 일정 구조

각 사용자가 본인 캘린더에 직접 등록하는 구조.
앱이 읽는 이벤트 패턴:

```
매일 반복 (저녁 루틴)
  🔥 SQL 공부         19:00 – 19:30
  💻 코테             19:30 – 20:30

날짜별 개별 이벤트 (메인 공부, 설명에 상세 내용)
  📖 ADsP: 빅데이터 개념 정독   20:30 – 22:00

주간 미션 (매주 월요일 종일 이벤트)
  📋 W1 미션: ...
  (이벤트 설명에 이번 주 할 일 목록)

시험 D-DAY (종일 이벤트)
  📝 ADsP 시험 D-DAY
```

---

## 8. 화면 구성

### 로그인 전
- 서비스 소개 랜딩 페이지
- "Google로 시작하기" 버튼

### 로그인 후 — 메인 대시보드
```
┌──────────────────────────────────┐
│ 로고  🔥스트릭  XP바  Lv.숫자   │  ← 상단 고정 헤더
├──────────────────────────────────┤
│ 이번 주 [월●][화●][수○]...       │  ← 주간 스트릭
├──────────────────────────────────┤
│ 📋 이번 주 미션 카드              │
├──────────────────────────────────┤
│ 오늘의 퀘스트                    │
│  [캘린더 동기화 버튼]            │
│  퀘스트 카드 × N                 │
│  [퀘스트 직접 추가]              │
└──────────────────────────────────┘
```

### 퀘스트 카드 상태
- 미완료: 기본 스타일, 탭하면 완료 처리
- 완료: 초록색 전환 + XP 획득 토스트


---

## 9. 온보딩 흐름

### 캘린더 상태 감지
로그인 직후 오늘 + 이번 주 캘린더 이벤트를 조회해서 상태를 판단.

```
오늘 이벤트 있음
  → 퀘스트 자동 생성 → 바로 대시보드

오늘 이벤트 없음 + 이번 주 이벤트도 없음
  → 온보딩 플로우 시작
```

---

### 온보딩 플로우 (캘린더 비어있는 경우)

**Step 1 — 목표 설정**
- 공부 목적 선택 (자격증 준비 / 코딩 / 어학 / 기타)
- 하루 공부 가능 시간 입력 (예: 1시간 / 2시간 / 3시간+)
- 공부 시작 시간 설정 (예: 19:00)

**Step 2 — 캘린더 등록 안내**
- "Google Calendar에 일정을 등록하면 매일 자동으로 퀘스트를 만들어드려요"
- 두 가지 선택지 제공:
  - A) 지금 캘린더에 직접 등록하러 가기 (calendar.google.com 링크)
  - B) 일단 수동으로 오늘 퀘스트만 만들기

**Step 3-A — 캘린더 등록 후 복귀**
- "캘린더 등록했어요" 버튼 클릭
- 다시 캘린더 조회 → 퀘스트 자동 생성

**Step 3-B — 수동 퀘스트 생성**
- 퀘스트 이름 / 카테고리 / 시간 직접 입력
- 최소 1개 이상 만들면 대시보드로 진입

---

### 캘린더 있지만 오늘만 비어있는 경우
- 온보딩 X
- 대시보드에서 "오늘 일정이 없어요" 안내 + 수동 추가 버튼만 표시

---

### 퀘스트 생성 우선순위
```
1순위: 캘린더 오늘 이벤트 → Gemma 4로 퀘스트 변환
2순위: 캘린더 없음 → 주간 미션 이벤트 기반으로 Gemma 4가 오늘치 추출
3순위: 둘 다 없음 → 수동 입력
```


---

## 9. 목표 설정 탭 (플랜 생성)

> 캘린더 유무와 무관하게 누구나 사용 가능한 탭.
> 목표를 입력하면 AI가 기간별 공부 계획을 자동으로 설계해줌.

---

### 화면 구성

**Step 1 — 목표 입력**

| 항목 | 입력 방식 | 예시 |
|------|---------|------|
| 목표 종류 | 자유 텍스트 또는 태그 선택 | 자격증 / 시험공부 / 공모전 / 어학 / 토이프로젝트 / 직접입력 |
| 목표 이름 | 자유 텍스트 | "ADsP 취득", "JLPT N2", "교내 공모전 제출" |
| 목표 기간 | 슬라이더 또는 자유 입력 | 3일 / 1주 / 2주 / 1개월 / 3개월 / 직접입력 |
| 하루 가용 시간 | 선택 | 1시간 미만 / 1~2시간 / 2~3시간 / 3시간 이상 |
| 현재 수준 | 선택 | 완전 처음 / 기초 있음 / 어느 정도 앎 |

**Step 2 — AI 플랜 생성**
- Gemma 4가 입력값 기반으로 주차별·일별 계획 생성
- "이렇게 진행하면 좋을 것 같아요" 형태로 제안
- 사용자가 수정 가능 (특정 날 빼기, 항목 추가 등)

**Step 3 — 플랜 확정**
- 확정하면 Supabase에 저장
- 선택: Google Calendar에 자동 등록 (권한 있을 때)
- 메인 대시보드에서 퀘스트로 매일 자동 변환

---

### AI 플랜 생성 입출력

**Gemma 4 입력값**
```
목표: ADsP 자격증 취득
기간: 3주
하루 가용 시간: 2시간
현재 수준: 완전 처음
```

**Gemma 4 출력 형식**
```
{
  "summary": "3주 ADsP 합격 플랜",
  "advice": "ADsP는 3과목 구성으로 처음이라면 3주가 적당합니다. ...",
  "weeks": [
    {
      "week": 1,
      "theme": "1과목 데이터의 이해",
      "daily": [
        { "day": "월", "tasks": ["빅데이터 개념 정독", "기출 10문제"] },
        { "day": "화", "tasks": ["데이터 유형 암기", "용어 카드 만들기"] },
        ...
      ]
    },
    ...
  ]
}
```

---

### DB 추가 테이블

#### user_goals (목표)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | 기본키 |
| user_id | uuid | FK → users.id |
| title | text | 목표 이름 |
| category | text | 자격증 / 어학 / 공모전 등 |
| start_date | date | 시작일 |
| end_date | date | 목표 완료일 |
| daily_hours | float | 하루 가용 시간 |
| level | text | 현재 수준 |
| plan_json | jsonb | AI가 생성한 전체 플랜 |
| is_active | boolean | 현재 진행 중 여부 |
| created_at | timestamp | |

---

### 탭 구조 (전체 앱)

```
[홈]  [목표]  [기록]  [프로필]

홈    → 오늘의 퀘스트 대시보드
목표  → 목표 설정 + AI 플랜 생성
기록  → 완료 이력 + XP 그래프
프로필 → 레벨·스트릭·설정
```

---

## 11. 환경 변수 목록

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_AI_API_KEY           ← Google AI Studio API
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## 12. 개발 순서 (권장)

1. Google OAuth + NextAuth 설정
2. Supabase 테이블 생성 + RLS 정책 적용
3. 로그인 시 users 테이블 upsert
4. Google Calendar API 연동 (본인 일정 읽기)
5. 온보딩 플로우 구현 (캘린더 상태 감지)
6. 목표 설정 탭 + AI 플랜 생성
7. Gemma 4 퀘스트 생성 API
8. 메인 대시보드 UI
9. 퀘스트 완료 → XP·스트릭 처리
8. Vercel 배포

---

*버전 3.3 — 2026-04-20 | 멀티유저 구조 반영*
