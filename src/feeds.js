export const feeds = [
  {
    key: "mbc",
    category: "narrative",
    label: "MBC narrative news",
    url: "https://imnews.imbc.com/rss/google_news/narrativeNews.rss"
  },
  {
    key: "jtbc-flash",
    category: "flash",
    label: "JTBC news flash",
    url: "https://news-ex.jtbc.co.kr/v1/get/rss/newsflesh"
  },
  {
    key: "jtbc-issue",
    category: "issue",
    label: "JTBC issue",
    url: "https://news-ex.jtbc.co.kr/v1/get/rss/issue"
  },
  {
    key: "jtbc-politics",
    category: "politics",
    label: "JTBC politics",
    url: "https://news-ex.jtbc.co.kr/v1/get/rss/section/politics"
  },
  {
    key: "jtbc-economy",
    category: "economy",
    label: "JTBC economy",
    url: "https://news-ex.jtbc.co.kr/v1/get/rss/section/economy"
  },
  {
    key: "jtbc-society",
    category: "society",
    label: "JTBC society",
    url: "https://news-ex.jtbc.co.kr/v1/get/rss/section/society"
  },
  {
    key: "jtbc-international",
    category: "international",
    label: "JTBC international",
    url: "https://news-ex.jtbc.co.kr/v1/get/rss/section/international"
  },
  {
    key: "dart",
    category: "disclosure",
    label: "DART disclosure",
    url: "https://dart.fss.or.kr/api/todayRSS.xml"
  }
];

export function getCategories() {
  return [...new Set(feeds.map((feed) => feed.category))].sort();
}

export function selectFeeds(category) {
  if (!category || category === "all") {
    return feeds;
  }

  const selected = feeds.filter((feed) => feed.category === category || feed.key === category);
  if (selected.length === 0) {
    const valid = ["all", ...getCategories(), ...feeds.map((feed) => feed.key)].join(", ");
    throw new Error(`Unknown category/feed "${category}". Valid values: ${valid}`);
  }

  return selected;
}
