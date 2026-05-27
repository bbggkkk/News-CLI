# news-cli Hermes plugin

Enable the plugin after installation:

```sh
hermes plugins enable news-cli
hermes tools enable news --platform cli
hermes gateway restart
```

The plugin exposes these tools:

- `news_latest`
- `news_search`
- `news_dart`
- `news_detail`
- `news_search_url`

It uses `NEWS_CLI_BIN` when set, otherwise a `news-cli` binary on `PATH`, then `dist/news-cli`, then `bun run bin/news-cli.js` from this plugin checkout.
