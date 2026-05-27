# news-cli

MBC, JTBC, DART RSS 피드를 취합해서 터미널에서 보는 간단한 뉴스 CLI입니다.

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

## 로컬 CLI로 등록

```sh
bun link
news-cli
```

## 사용법

```sh
news-cli
news-cli list --category politics --limit 20
news-cli list -c jtbc-economy
news-cli categories
news-cli detail <목록에서_본_ID>
```

`--category`에는 `all`, 카테고리 이름, 또는 개별 피드 키를 넣을 수 있습니다.

카테고리:

- `narrative`
- `flash`
- `issue`
- `politics`
- `economy`
- `society`
- `international`
- `disclosure`

개별 피드 키:

- `mbc`
- `jtbc-flash`
- `jtbc-issue`
- `jtbc-politics`
- `jtbc-economy`
- `jtbc-society`
- `jtbc-international`
- `dart`

`detail`은 마지막으로 `list`를 실행할 때 저장된 로컬 캐시에서 항목을 찾아 RSS에 포함된 상세 정보를 보여줍니다.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions CI가 테스트와 빌드를 수행합니다.

릴리스 배포는 `v*` 태그를 푸시하면 실행됩니다.

```sh
git tag v0.1.0
git push origin main --tags
```

릴리스 워크플로는 Linux/macOS x64/arm64 standalone 바이너리를 빌드하고 GitHub Release asset으로 업로드합니다.
