# Vercel V2 배포 기록

- 일시: 2026-09-11
- 프로젝트: `nonamad5196s-projects/ilque_nonamad`
- 운영 주소: https://ilquenonamad.vercel.app
- 체험 주소: https://ilquenonamad.vercel.app/demo
- 배포 ID: `dpl_7sgnPLMTdMLn4LmZHxBbivLSpVmN`
- 고유 배포 주소: https://ilquenonamad-gl76rsrrc-nonamad5196s-projects.vercel.app
- 소스: 로컬 `redesign-v2` 작업 폴더를 CLI로 업로드. Git push나 main 병합은 수행하지 않음.

## 운영 설정

기존 Google, Gemini, Supabase, Notion 보안 환경변수는 유지했다. 민감한 환경변수는 Vercel에서 읽기 제한되므로 로컬 설정으로 덮어쓰지 않았다.

- `NEXTAUTH_URL=https://ilquenonamad.vercel.app`
- `ILQUE_STORAGE=supabase`
- `ILQUE_NOTION_OWNER_EMAIL`: 개인 Notion 연동 소유 계정으로 제한

`.vercelignore`로 `.env*`, 로컬 저장 데이터, QA 파일, 빌드 산출물, 의존성 폴더와 로그를 업로드에서 제외했다. `.vercel` 프로젝트 연결 정보는 Git에서 제외한다.

## 실행과 확인

1. 기존 Vercel 프로젝트에 연결했다.
2. `vercel deploy --prod --skip-domain --yes --logs`로 운영 환경 빌드를 생성했다.
3. Vercel에서 의존성 설치, Next.js 컴파일, 타입 검사, 페이지 생성 및 서버 함수 빌드가 성공했다. 알려진 의존성 취약점은 0개였다.
4. 새 배포의 `/`와 `/demo` HTTP 200, 미인증 `/api/v2` HTTP 401을 확인했다.
5. Google 인증 공급자의 callback 주소가 `https://ilquenonamad.vercel.app/api/auth/callback/google`임을 확인했다.
6. `vercel promote`로 기존 운영 주소를 V2에 연결했다.
7. Chrome에서 운영 주소의 랜딩 페이지 → 체험 화면 이동, V2 화면 렌더링, 브라우저 콘솔 오류 없음을 확인했다.

## 남은 검증

이 배포 확인은 실제 Google 계정 로그인, Calendar·Supabase·Gemini·Notion 연동 성공을 뜻하지 않는다. 해당 검증은 이전 사용자 지시에 따라 후속에 남겨 두었다. 로컬에서 발견한 OAuth/Supabase 설정 문제와 전체 테스트 결과는 [V2 QA](V2-QA.md)를 참고한다.

후속 배포도 프로젝트 루트에서 `vercel deploy --prod`로 실행할 수 있다. 새 코드 변경이 있으면 먼저 테스트와 빌드를 확인한다.
