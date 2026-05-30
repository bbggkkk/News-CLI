import type { Feed } from "../../core/feed";
import type { NewsItem } from "../../core/news-item";
import type { HistoryEntry } from "../../providers/cache";

function formatDate(value?: string): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("ko-KR", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Asia/Seoul",
	}).format(date);
}

function truncate(value: string, maxLength: number): string {
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length <= maxLength) return compact;
	return `${compact.slice(0, maxLength - 3)}...`;
}

export function formatListItem(item: NewsItem): string {
	const date = formatDate(item.date || item.rawDate);
	const meta = [item.id, item.category, item.source, date]
		.filter(Boolean)
		.join(" | ");
	const summary = item.description
		? `\n  ${truncate(item.description, 160)}`
		: "";
	return `[${meta}]\n${item.title}${summary}\n${item.link ?? ""}\n`;
}

export function formatDetail(item: NewsItem): string {
	return [
		item.title,
		"",
		`ID: ${item.id}`,
		`Source: ${item.sourceLabel} (${item.source})`,
		`Category: ${item.category}`,
		item.date || item.rawDate
			? `Date: ${formatDate(item.date || item.rawDate)}`
			: "",
		item.author ? `Author: ${item.author}` : "",
		item.itemCategory ? `Item category: ${item.itemCategory}` : "",
		item.feedUrl ? `Feed: ${item.feedUrl}` : "",
		item.link ? `Link: ${item.link}` : "",
		"",
		item.description || "(No description in feed.)",
	]
		.filter(Boolean)
		.join("\n");
}

export function formatHistory(entries: HistoryEntry[]): string {
	return entries
		.map((entry) => {
			const statusStr =
				entry.status === "success"
					? `success (${entry.itemCount} items)`
					: "failure (0 items)";
			return [
				`[${entry.timestamp}] ${entry.feedKey} (${entry.feedLabel}) - ${statusStr}`,
				`  URL: ${entry.url}`,
				entry.errorMessage ? `  Error: ${entry.errorMessage}` : "",
			]
				.filter(Boolean)
				.join("\n");
		})
		.join("\n\n");
}

export function formatCategories(feeds: Feed[], categories: string[]): string {
	const feedLines = feeds.map(
		(f) => `  ${f.key} (${f.category}) - ${f.label}\n    ${f.url}`,
	);
	const catLines = categories.map((c) => `  ${c}`);
	return `Feeds:\n${feedLines.join("\n")}\n\nModes:\n${catLines.join("\n")}`;
}

export type JsonOutputMeta = { total: number; showing: number };

export function formatJson(
	items: NewsItem[],
	errors: string[],
	meta: JsonOutputMeta,
): string {
	return JSON.stringify(
		{
			ok: errors.length === 0,
			total: meta.total,
			showing: meta.showing,
			errors: errors.length > 0 ? errors : undefined,
			items,
		},
		null,
		2,
	);
}
