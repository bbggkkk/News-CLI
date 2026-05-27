import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const REPO = "bbggkkk/News-CLI";

export async function selfUpgrade({ version = "latest", installDir, skillDir } = {}) {
  const asset = getAssetName();
  const binaryUrl = buildReleaseAssetUrl(asset, version);
  const skillUrl = buildSkillUrl(version);
  const binaryPath = resolveBinaryPath(installDir);
  const resolvedSkillDir = skillDir || process.env.NEWS_CLI_SKILL_DIR || path.join(os.homedir(), ".codex", "skills", "news-cli");
  const binaryDir = path.dirname(binaryPath);
  const tmpBinary = path.join(binaryDir, `.news-cli-${process.pid}.tmp`);
  const tmpSkill = path.join(resolvedSkillDir, `.SKILL-${process.pid}.tmp`);

  try {
    await fs.mkdir(binaryDir, { recursive: true });
    await fs.mkdir(resolvedSkillDir, { recursive: true });

    await downloadFile(binaryUrl, tmpBinary);
    await fs.chmod(tmpBinary, 0o755);
    await fs.rename(tmpBinary, binaryPath);

    await downloadFile(skillUrl, tmpSkill);
    await fs.rename(tmpSkill, path.join(resolvedSkillDir, "SKILL.md"));

    return {
      version,
      binaryPath,
      skillPath: path.join(resolvedSkillDir, "SKILL.md")
    };
  } finally {
    await fs.rm(tmpBinary, { force: true });
    await fs.rm(tmpSkill, { force: true });
  }
}

export function buildReleaseAssetUrl(asset, version = "latest") {
  if (version === "latest") {
    return `https://github.com/${REPO}/releases/latest/download/${asset}`;
  }

  return `https://github.com/${REPO}/releases/download/${version}/${asset}`;
}

export function buildSkillUrl(version = "latest") {
  const ref = version === "latest" ? "main" : version;
  return `https://raw.githubusercontent.com/${REPO}/${ref}/skills/news-cli/SKILL.md`;
}

export function getAssetName(platform = process.platform, arch = process.arch) {
  const platformName = {
    linux: "linux",
    darwin: "darwin"
  }[platform];

  const archName = {
    x64: "x64",
    arm64: "arm64"
  }[arch];

  if (!platformName || !archName) {
    throw new Error(`Unsupported platform: ${platform}/${arch}`);
  }

  return `news-cli-${platformName}-${archName}`;
}

export function resolveBinaryPath(installDir) {
  if (process.env.NEWS_CLI_BIN) {
    return process.env.NEWS_CLI_BIN;
  }

  if (installDir) {
    return path.join(installDir, "news-cli");
  }

  if (path.basename(process.execPath) === "news-cli") {
    return process.execPath;
  }

  return path.join(process.env.NEWS_CLI_INSTALL_DIR || path.join(os.homedir(), ".local", "bin"), "news-cli");
}

async function downloadFile(url, destination) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "news-cli/0.2.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    await fs.writeFile(destination, bytes);
  } finally {
    clearTimeout(timer);
  }
}
