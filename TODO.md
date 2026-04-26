# ILQue To-Do List

## 현재 기준

- 로컬 MVP는 개인 사용 흐름 기준으로 대부분 연결되었습니다.
- Google OAuth 로그인, Calendar 읽기, Supabase 저장, Notion 기록, Gemini AI 호출이 동작합니다.
- Gemini API 키는 `.env.local`의 `GOOGLE_AI_API_KEY` 하나를 사용합니다.
- Google Search Grounding도 같은 Gemini API 키로 호출하며, 별도 Google Search API 키는 사용하지 않습니다.
- 검색과 AI 생성은 자동 실행하지 않고, 사용자가 버튼을 누를 때만 실행합니다.
- Notion은 DB 4개가 아니라 `ILQue` 데이터베이스 1개를 쓰고, `Type` 속성으로 `Mission`, `Quest`, `Goal`, `Source`를 구분합니다.
- Notion Sources 기반 퀘스트 생성은 비용과 속도 보호를 위해 최근 Sources 최대 8개만 읽습니다.
- 웹 검색 결과는 최대 5개만 보여주고, 사용자가 선택한 결과만 Notion Sources에 저장합니다.

## 완료

- 데모 모드 제거
- Google OAuth 로그인
- Google Calendar 읽기와 권한 갱신 로직
- Calendar 이벤트 기반 오늘의 퀘스트 생성
- 주간 미션 이벤트를 일일 퀘스트와 분리 표시
- Supabase 기본 연결과 `manual_quests`, `user_goals` 흐름 적용
- 수동 퀘스트 추가, 삭제, 완료, 실행 취소
- 완료 기록 저장과 XP, 레벨, 스트릭 반영
- 대시보드 완료 버튼 UX 개선
- Gemini 기본 모델을 `gemini-2.5-flash-lite`로 정리
- 목표 입력 기반 AI 플랜 생성
- 저장한 목표 보기, 수정, 삭제
- 현재 플랜을 기준으로 수정 요청을 보내 AI가 다시 다듬는 기능
- Notion SDK 추가
- Notion `ILQue` 데이터베이스 접근 확인
- 퀘스트 완료 기록을 Notion `Type=Quest`로 저장
- 목표 플랜을 Notion `Type=Goal`로 저장
- 목표 삭제 시 Notion 항목도 보관 처리
- Notion Sources 목록 요약 페이지 추가
- Google Search Grounding으로 웹 자료 검색
- 검색 결과를 Notion `Type=Source`로 저장
- Notion Sources를 기반으로 퀘스트 후보 생성
- 생성된 Sources 기반 퀘스트를 오늘의 수동 퀘스트로 저장
- NotebookLM 상단 바로가기 추가
- ILQue 헤더 아이콘 추가
- `README.md` 최신 구조로 정리

## P1. 배포 준비

- Vercel 배포 프로젝트 생성
- Vercel 환경 변수에 Google, Supabase, Notion, Gemini 키 입력
- `NEXTAUTH_URL`을 배포 도메인으로 변경
- Google OAuth Authorized JavaScript origins에 배포 도메인 추가
- Google OAuth Authorized redirect URIs에 `https://배포도메인/api/auth/callback/google` 추가
- Supabase URL, anon key, service role key가 배포 환경에서 정상 동작하는지 확인
- Notion integration이 배포 환경에서도 `ILQue` 데이터베이스에 접근 가능한지 확인
- 배포 후 로그인, Calendar 읽기, 수동 퀘스트, 목표 생성, Sources 검색, Notion 저장까지 스모크 테스트

## P2. 운영 안정화

- Gemini 할당량 초과, API 키 오류, JSON 파싱 실패 메시지 정리
- Notion 저장 실패 시 사용자에게 복구 가능한 안내 표시
- Calendar 토큰 만료 또는 권한 부족 시 재로그인 안내 강화
- Sources 검색 호출이 너무 잦아지지 않도록 사용 안내 또는 간단한 제한 추가
- Notion Sources 저장 후 목록 카운트와 최근 항목을 즉시 새로고침
- 로그인 전 화면과 빈 데이터 화면의 안내 문구 정리
- 빌드 후 dev 서버 캐시가 깨지지 않도록 재시작 루틴 문서화

## P3. 데이터와 UX 개선

- 목표 상세 화면에서 저장된 플랜을 더 읽기 좋게 표시
- 목표별 연결 퀘스트를 볼 수 있는 흐름 추가
- 수동 퀘스트 수정 기능 추가
- Sources 기반 퀘스트 생성 시 사용할 Source를 사용자가 직접 선택
- Source 카테고리, 상태, URL 유무 필터 추가
- 기록 화면에서 날짜, 카테고리, Source 기준 필터 추가
- 주간 진행률을 실제 완료 기록 기준으로 계산
- 모바일에서 대시보드 카드와 액션 버튼 간격 추가 점검

## P4. 문서와 관리

- 배포 후 실제 URL 기준으로 `README.md` 배포 섹션 업데이트
- Notion 데이터베이스 속성 변경 시 `README.md`와 이 문서 동시 갱신
- Supabase 스키마 변경 시 `supabase/schema.sql`과 실제 DB 반영 여부 체크
- GitHub 원격 저장소 연결 여부 결정
- 첫 공개 공유 전에 비밀키가 Git에 들어가지 않았는지 확인

## 보류 / 아이디어

- NotebookLM 직접 API 연동은 현재 우선순위에서 제외하고 링크 이동으로 유지
- Sources 전체 본문을 앱에서 대량으로 읽어 분석하는 기능은 비용과 속도 이슈 때문에 보류
- 공개 사용자 20~30명 이상으로 늘릴 경우 Google OAuth 앱 게시 상태, 할당량, Supabase 정책을 다시 점검
- 장기적으로는 개인 자료 검색을 위해 벡터 검색 또는 요약 인덱스를 붙일 수 있음
