# news-cli

Google News RSS를 터미널에서 조회하는 Bun 기반 CLI입니다. 최신뉴스, 키워드 검색,
사이트 제한, 정확한 문구, 제외어 조합 검색을 지원합니다.

참고한 Google News RSS 형식:

- 최신뉴스: `https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko`
- 검색: `https://news.google.com/rss/search?q=(검색어)&hl=ko&gl=KR&ceid=KR%3Ako`
- 고급 검색: `q=(검색어) site:(사이트 주소) "(정확한 문구)" -(제외할 단어)`

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

최신 GitHub Release 바이너리와 Codex Skill을 함께 설치합니다.

```sh
curl -fsSL https://raw.githubusercontent.com/bbggkkk/News-CLI/main/install.sh | bash
```

기본 설치 위치:

- 바이너리: `~/.local/bin/news-cli`
- Skill: `~/.codex/skills/news-cli/SKILL.md`

## 사용법

```sh
news-cli
news-cli latest --limit 20
news-cli search 삼성전자 --limit 10
news-cli search 선거 --site example.com --phrase "여론조사" --exclude 광고
news-cli url search 반도체 --site mk.co.kr --phrase "실적 전망" --exclude 루머
news-cli detail <목록에서_본_ID>
```

`search` 옵션:

- `--site <domain>`: 특정 사이트 기사만 검색합니다. 예: `example.com`
- `--phrase <text>`: 정확한 문구를 따옴표 검색으로 추가합니다.
- `--exclude <word>`: 제외어를 추가합니다. 여러 번 사용할 수 있습니다.
- `--limit <n>`: 출력 개수를 제한합니다.

`detail`은 마지막으로 `latest` 또는 `search`를 실행할 때 저장된 로컬 캐시에서 항목을 찾아 RSS에 포함된 상세 정보를 보여줍니다.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions CI가 테스트와 빌드를 수행합니다.

릴리스 배포는 `v*` 태그를 푸시하면 실행됩니다.

```sh
git tag v0.2.0
git push origin main --tags
```

릴리스 워크플로는 Linux/macOS x64/arm64 standalone 바이너리를 빌드하고 GitHub Release asset으로 업로드합니다.
