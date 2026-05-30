import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getEnv } from "./env";
import { validateUrl } from "./url";
import { VERSION } from "./version";

const REPO = "bbggkkk/News-CLI";

type UpgradeOptions = {
	version?: string;
	installDir?: string;
	skillDir?: string;
	codexSkillDir?: string;
	hermesSkillDir?: string;
	onProgress?: (message: string) => void;
};

type UpgradeResult = {
	version: string;
	binaryPath: string;
	skillPaths: string[];
	skillPath: string;
};

type ResolveSkillDirsOptions = {
	skillDir?: string;
	codexSkillDir?: string;
	hermesSkillDir?: string;
};

export async function selfUpgrade({
	version = "latest",
	installDir,
	skillDir,
	codexSkillDir,
	hermesSkillDir,
	onProgress = () => {},
}: UpgradeOptions = {}): Promise<UpgradeResult> {
	const asset = getAssetName();
	const binaryUrl = buildReleaseAssetUrl(asset, version);
	const skillUrl = buildSkillUrl(version);
	const binaryPath = resolveBinaryPath(installDir);
	const resolveOpts: ResolveSkillDirsOptions = {};
	if (skillDir !== undefined) resolveOpts.skillDir = skillDir;
	if (codexSkillDir !== undefined) resolveOpts.codexSkillDir = codexSkillDir;
	if (hermesSkillDir !== undefined) resolveOpts.hermesSkillDir = hermesSkillDir;
	const skillDirs = resolveSkillDirs(resolveOpts);
	const binaryDir = path.dirname(binaryPath);
	const tmpBinary = path.join(binaryDir, `.news-cli-${process.pid}.tmp`);
	const tmpSkills = skillDirs.map((dir, index) =>
		path.join(dir, `.SKILL-${process.pid}-${index}.tmp`),
	);

	try {
		onProgress(`Target release: ${version}`);
		onProgress(`Platform asset: ${asset}`);
		onProgress(`Binary install path: ${binaryPath}`);
		for (const dir of skillDirs) {
			onProgress(`Skill install path: ${path.join(dir, "SKILL.md")}`);
		}

		await fs.mkdir(binaryDir, { recursive: true });
		for (const dir of skillDirs) {
			await fs.mkdir(dir, { recursive: true });
		}

		onProgress(`Downloading binary: ${binaryUrl}`);
		await downloadFile(binaryUrl, tmpBinary, {
			label: "binary",
			onProgress,
		});
		onProgress("Installing binary.");
		await fs.chmod(tmpBinary, 0o755);
		await fs.rename(tmpBinary, binaryPath);

		for (let index = 0; index < skillDirs.length; index++) {
			const dir = skillDirs[index];
			const tmpSkill = tmpSkills[index];
			if (dir === undefined || tmpSkill === undefined) continue;

			onProgress(`Downloading skill: ${skillUrl}`);
			await downloadFile(skillUrl, tmpSkill, {
				label: `skill ${index + 1}/${skillDirs.length}`,
				onProgress,
			});
			onProgress(`Installing skill to ${path.join(dir, "SKILL.md")}.`);
			await fs.rename(tmpSkill, path.join(dir, "SKILL.md"));
		}

		return {
			version,
			binaryPath,
			skillPaths: skillDirs.map((dir) => path.join(dir, "SKILL.md")),
			skillPath: path.join(skillDirs[0] ?? "", "SKILL.md"),
		};
	} finally {
		await fs.rm(tmpBinary, { force: true });
		await Promise.all(
			tmpSkills.map((tmpSkill) => fs.rm(tmpSkill, { force: true })),
		);
	}
}

export function buildReleaseAssetUrl(
	asset: string,
	version = "latest",
): string {
	if (version === "latest") {
		return `https://github.com/${REPO}/releases/latest/download/${asset}`;
	}

	return `https://github.com/${REPO}/releases/download/${version}/${asset}`;
}

export function buildSkillUrl(version = "latest"): string {
	const ref = version === "latest" ? "main" : version;
	return `https://raw.githubusercontent.com/${REPO}/${ref}/skills/news-cli/SKILL.md`;
}

export function getAssetName(
	platform = process.platform,
	arch = process.arch,
): string {
	const platformName = (
		{
			linux: "linux",
			darwin: "darwin",
		} as Record<string, string>
	)[platform];

	const archName = (
		{
			x64: "x64",
			arm64: "arm64",
		} as Record<string, string>
	)[arch];

	if (!platformName || !archName) {
		throw new Error(`Unsupported platform: ${platform}/${arch}`);
	}

	return `news-cli-${platformName}-${archName}`;
}

export function resolveBinaryPath(installDir?: string): string {
	const envBin = getEnv("NEWS_CLI_BIN");
	if (envBin) {
		return envBin;
	}

	if (installDir) {
		return path.join(installDir, "news-cli");
	}

	if (path.basename(process.execPath) === "news-cli") {
		return process.execPath;
	}

	const envInstallDir = getEnv("NEWS_CLI_INSTALL_DIR");
	return path.join(
		envInstallDir || path.join(os.homedir(), ".local", "bin"),
		"news-cli",
	);
}

export function resolveSkillDirs({
	skillDir,
	codexSkillDir,
	hermesSkillDir,
}: ResolveSkillDirsOptions = {}): string[] {
	const codexHome = getEnv("CODEX_HOME") || path.join(os.homedir(), ".codex");
	const hermesHome =
		getEnv("HERMES_HOME") || path.join(os.homedir(), ".hermes");
	const codexDir =
		codexSkillDir ||
		skillDir ||
		getEnv("NEWS_CLI_CODEX_SKILL_DIR") ||
		getEnv("NEWS_CLI_SKILL_DIR") ||
		path.join(codexHome, "skills", "news-cli");
	const hermesDir =
		hermesSkillDir ||
		getEnv("NEWS_CLI_HERMES_SKILL_DIR") ||
		path.join(hermesHome, "skills", "news-cli");

	const setDirs = new Set(
		[codexDir, hermesDir].filter(Boolean).map((dir) => path.resolve(dir)),
	);
	return Array.from(setDirs);
}

async function downloadFile(
	url: string,
	destination: string,
	{
		label,
		onProgress,
	}: { label: string; onProgress: (message: string) => void },
): Promise<void> {
	validateUrl(url, ["github.com", "raw.githubusercontent.com"]);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 120_000);
	const file = await fs.open(destination, "w");

	try {
		const response = await fetch(url, {
			headers: {
				"user-agent": `news-cli/${VERSION}`,
			},
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(
				`Failed to download ${url}: ${response.status} ${response.statusText}`,
			);
		}

		const total = Number.parseInt(
			response.headers.get("content-length") || "0",
			10,
		);
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error(`Failed to read response body for ${url}`);
		}

		let received = 0;
		let lastReport = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			await file.write(value);
			received += value.byteLength;

			if (received - lastReport >= 5 * 1024 * 1024 || received === total) {
				onProgress(formatDownloadProgress(label, received, total));
				lastReport = received;
			}
		}

		if (received > 0 && received !== lastReport) {
			onProgress(formatDownloadProgress(label, received, total));
		}
	} finally {
		await file.close();
		clearTimeout(timer);
	}
}

function formatDownloadProgress(
	label: string,
	received: number,
	total: number,
): string {
	if (total > 0 && received <= total) {
		const percent = ((received / total) * 100).toFixed(1);
		return `Downloaded ${label}: ${formatBytes(received)} / ${formatBytes(total)} (${percent}%)`;
	}

	return `Downloaded ${label}: ${formatBytes(received)}`;
}

function formatBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
