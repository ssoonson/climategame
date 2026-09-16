# GitHub Pages + Supabase 배포 안내

학생·교사용 화면은 **GitHub Pages**, 데이터베이스와 API는 **Supabase**에서 실행됩니다.

```text
학생/교사 브라우저
        ↓
GitHub Pages (HTML/CSS/JavaScript)
        ↓
Supabase Edge Function (권한·점수 검증)
        ↓
Supabase Postgres (RLS 적용)
```

브라우저가 데이터베이스 테이블을 직접 읽지 않습니다. 공개 가능한 publishable key만 `config.js`에 넣고, 전체 데이터 접근 키와 교사용 PIN은 Supabase 서버의 비밀값으로 보관합니다.

## 1. 준비물

- GitHub 계정
- Supabase 계정
- Git과 Node.js가 설치된 컴퓨터

Supabase CLI는 프로젝트 개발 의존성으로 설치하는 방식을 권장합니다.

```bash
npm install --save-dev supabase
npx supabase --version
```

## 2. Supabase 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 **New project**를 누릅니다.
2. 프로젝트 이름과 안전한 데이터베이스 비밀번호를 정하고 가까운 Region을 선택합니다.
3. 프로젝트 생성이 끝나면 **Project Settings → API**에서 다음 두 값을 확인합니다.
   - Project URL: `https://프로젝트참조.supabase.co`
   - Publishable key

`secret` 또는 `service_role` key는 절대로 `config.js`, GitHub, 학생 기기에 넣지 마세요.

## 3. 데이터베이스 만들기

터미널에서 이 프로젝트 폴더로 이동한 뒤 실행합니다.

```bash
npx supabase login
npx supabase link --project-ref 프로젝트참조
npx supabase db push
```

`supabase/migrations/20260916000100_climate_game.sql`이 적용되면서 다음 테이블이 만들어집니다.

- `results`: 학생 완료 결과
- `responses`: 문제별 첫 선택과 오답 정보
- `settings`: 랭킹 및 수업 설정

세 테이블 모두 RLS가 켜지며 `anon`과 일반 사용자의 직접 권한은 제거됩니다.

CLI 사용이 어려우면 Supabase Dashboard의 **SQL Editor**에서 마이그레이션 SQL 전체를 한 번 실행할 수도 있습니다. 이후 스키마 변경은 마이그레이션 파일과 `db push`로 관리하는 편이 안전합니다.

## 4. 교사용 PIN과 토큰 비밀값 설정

아래 명령의 값을 직접 정해서 실행합니다.

```bash
npx supabase secrets set TEACHER_PIN="원하는-교사용-PIN"
npx supabase secrets set ADMIN_TOKEN_SECRET="32자-이상의-충분히-긴-무작위-문자열"
```

GitHub Pages 주소만 API 호출을 허용하려면 다음 값도 설정합니다. 처음 시험할 때는 생략할 수 있습니다.

```bash
npx supabase secrets set ALLOWED_ORIGINS="https://사용자명.github.io"
```

프로젝트 사이트가 `https://사용자명.github.io/저장소명/`이어도 Origin에는 경로 없이 `https://사용자명.github.io`만 입력합니다. 로컬과 GitHub Pages를 함께 허용할 때는 쉼표로 구분합니다.

```bash
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:5500,https://사용자명.github.io"
```

## 5. Edge Function 배포

```bash
npx supabase functions deploy climate-api
```

배포 주소는 다음 형태입니다.

```text
https://프로젝트참조.supabase.co/functions/v1/climate-api
```

`supabase/config.toml`에서 이 공개 API 함수의 게이트웨이 JWT 검증은 끄고, 함수 내부에서 학생용 공개 작업과 교사용 서명 토큰 작업을 구분합니다. 데이터베이스의 `service_role` 권한은 Edge Function 안에서만 사용됩니다.

## 6. 프런트엔드 연결

`config.js`를 열어 Supabase Dashboard에서 확인한 값을 입력합니다.

```javascript
window.CLIMATE_CONFIG = Object.freeze({
  SUPABASE_URL: "https://프로젝트참조.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
});
```

publishable key는 공개 웹 앱에서 사용하도록 만들어진 키입니다. 테이블은 RLS와 권한 회수로 잠겨 있으므로 이 키만으로 관리자 데이터를 직접 읽을 수 없습니다.

값을 비워 두면 학생 화면은 브라우저 한 대에서만 동작하는 체험 모드로 실행되며, 교사용 페이지는 사용할 수 없습니다.

## 7. GitHub 저장소에 올리기

새 GitHub 저장소를 만든 뒤 이 프로젝트를 push합니다.

```bash
git init
git add .
git commit -m "기후 탐험대 Supabase 버전"
git branch -M main
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

`.github/workflows/pages.yml`이 학생·교사용 정적 파일만 골라 GitHub Pages에 배포합니다. Supabase 마이그레이션과 Edge Function 소스는 Pages 결과물에 포함되지 않습니다.

## 8. GitHub Pages 켜기

1. GitHub 저장소의 **Settings → Pages**를 엽니다.
2. **Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
3. 저장소의 **Actions** 탭에서 `Deploy climate game to GitHub Pages` 작업이 성공할 때까지 기다립니다.
4. 표시된 Pages 주소를 학생에게 공유합니다.

주소 예시:

```text
학생용  https://사용자명.github.io/저장소명/
교사용  https://사용자명.github.io/저장소명/admin.html
```

## 9. 업데이트 방법

프런트엔드를 수정했을 때:

```bash
git add .
git commit -m "화면 업데이트"
git push
```

GitHub Actions가 자동으로 Pages를 다시 배포합니다.

Edge Function을 수정했을 때:

```bash
npx supabase functions deploy climate-api
```

데이터베이스 마이그레이션을 추가했을 때:

```bash
npx supabase db push
```

## 10. 보안 확인 목록

- `config.js`에는 Project URL과 publishable key만 있습니다.
- `service_role`, secret key, 데이터베이스 비밀번호는 GitHub에 커밋하지 않습니다.
- 교사용 PIN과 `ADMIN_TOKEN_SECRET`은 Supabase Secrets에만 저장합니다.
- `results`, `responses`, `settings` 테이블에서 RLS가 활성화되어 있습니다.
- 배포 후 `ALLOWED_ORIGINS`를 실제 GitHub Pages Origin으로 제한합니다.
- 실제 학생 이름 대신 학년·반·번호 또는 별명 사용을 권장합니다.

공식 참고 문서:

- [Supabase Edge Functions 시작하기](https://supabase.com/docs/guides/functions/quickstart)
- [Supabase Function 비밀값](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
