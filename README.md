# news-cli

Google News RSS와 DART 공시 RSS를 터미널에서 조회하는 Bun 기반 CLI입니다. 최신뉴스,
키워드 검색, 사이트 제한, 정확한 문구, 제외어 조합 검색, 오늘의 DART 공시 조회를 지원합니다.

참고한 Google News RSS 형식:

- 최신뉴스: `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko`
- 검색: `https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako`
- 고급 검색: `q=(검색어) site:(사이트 주소) "(정확한 문구)" -(제외할 단어)`
- DART 공시: `https://dart.fss.or.kr/api/todayRSS.xml`

## 설치 없이 실행

```sh
bun run bin/news-cli.js
```

## 빌드

```sh
bun run build
./dist/news-cli
```

## 원라인 설치

최신 GitHub Release 바이너리와 Codex/Hermes Skill을 함께 설치합니다.

```sh
curl -fsSL https://raw.githubusercontent.com/bbggkkk/News-CLI/main/install.sh | bash
```

기본 설치 위치:

- 바이너리: `~/.local/bin/news-cli`
- Codex Skill: `~/.codex/skills/news-cli/SKILL.md`
- Hermes Skill: `~/.hermes/skills/news-cli/SKILL.md`

## Hermes 플러그인

Hermes agent tool로 사용하려면 플러그인을 설치하고 활성화합니다.

```sh
hermes plugins install bbggkkk/News-CLI
hermes plugins enable news-cli
hermes tools enable news --platform cli
hermes gateway restart
```

제공 tool:

- `news_latest`: 한국 Google News 최신뉴스 RSS 조회
- `news_search`: Google News RSS 키워드/사이트/정확한 문구/제외어 검색
- `news_dart`: 오늘의 DART 공시 RSS 조회
- `news_detail`: 이전 조회 결과의 ID 또는 URL 상세 조회
- `news_search_url`: Google News RSS 검색 URL 생성

## 사용법

```sh
news-cli
news-cli latest --limit 20
news-cli dart --limit 20
news-cli search 삼성전자 --limit 10
news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
news-cli detail <목록에서_본_ID>
news-cli upgrade
news-cli help search
```

`help`:

- `news-cli help`: 전체 명령 요약을 출력합니다.
- `news-cli help latest`: 최신뉴스 조회 도움말을 출력합니다.
- `news-cli help dart`: DART 공시 조회 도움말을 출력합니다.
- `news-cli help search`: 검색과 고급 검색 옵션 도움말을 출력합니다.
- `news-cli help url`: Google News RSS URL 생성 도움말을 출력합니다.
- `news-cli help detail`: 캐시 기반 상세 조회 도움말을 출력합니다.
- `news-cli help upgrade`: 업그레이드 도움말을 출력합니다.

`search` 옵션:

- `--site <domain>`: 특정 사이트 기사만 검색합니다. 예: `example.com`
- `--phrase <text>`: 정확한 문구를 따옴표 검색으로 추가합니다.
- `--exclude <word>`: 제외어를 추가합니다. 여러 번 사용할 수 있습니다.
- `--limit <n>`: 출력 개수를 제한합니다.

`detail`은 마지막으로 `latest` 또는 `search`를 실행할 때 저장된 로컬 캐시에서 항목을 찾아 RSS에 포함된 상세 정보를 보여줍니다.

`upgrade`는 최신 GitHub Release 바이너리와 Codex/Hermes Skill을 다시 설치합니다.

```sh
news-cli upgrade
news-cli upgrade --version v0.2.4
```

업그레이드 중에는 현재 OS/아키텍처용 asset 선택, 바이너리 다운로드, 바이너리 교체,
Codex/Hermes SKILL 다운로드 및 설치 진행 상황이 출력됩니다.

환경 변수:

- `NEWS_CLI_BIN`: 교체할 바이너리의 정확한 경로
- `NEWS_CLI_INSTALL_DIR`: 기본 설치 디렉터리
- `NEWS_CLI_SKILL_DIR`: 이전 호환용 Codex Skill 설치 디렉터리
- `NEWS_CLI_CODEX_SKILL_DIR`: Codex Skill 설치 디렉터리
- `NEWS_CLI_HERMES_SKILL_DIR`: Hermes Skill 설치 디렉터리

## 배포

`main` 브랜치에 푸시하면 GitHub Actions CI가 테스트와 빌드를 수행합니다.

릴리스 배포는 `v*` 태그를 푸시하면 실행됩니다.

```sh
git tag v0.2.4
git push origin main --tags
```

릴리스 워크플로는 Linux/macOS x64/arm64 standalone 바이너리를 빌드하고 GitHub Release asset으로 업로드합니다.
