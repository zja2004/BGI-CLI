import readline from 'readline';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync, cpSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { loadConfig, saveConfig, ensureDirs, WORKFLOWS_DIR, SKILLS_DIR, TOOLS_DIR } from './config.js';
import { PROVIDERS } from './providers.js';
import { chat, compactMessages, type Message } from './chat.js';
import { buildSystemPrompt } from './prompt.js';
import { routeSkill, SKILL_ROUTES, SKILL_CATEGORIES } from './skillRouter.js';

const VERSION = '2.2.0';

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
  console.log(`  ${chalk.cyan('/save')} [文件名]      保存对话为 Markdown 文件`);
  console.log(`  ${chalk.cyan('/think')} [on|off]     切换思考模式 (Qwen3 /think 前缀)`);
  console.log();
  console.log(chalk.bold.cyan('─── Skills ───────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/cat')}                按领域浏览 Skills 分类目录`);
  console.log(`  ${chalk.cyan('/sk')}                 列出全部 Skills`);
  console.log(`  ${chalk.cyan('/sk')} <关键词>        模糊搜索，匹配则注入，否则列出候选`);
  console.log(`  ${chalk.cyan('/wf')}                 同 /sk，别名`);
  console.log(chalk.dim('  示例: /cat  /sk deseq2  /sk pubmed  /sk alphafold  /sk crispr'));
  console.log(chalk.dim('  提示: 直接描述任务，AI 会自动识别并激活对应技能'));
  console.log();
  console.log(chalk.bold.cyan('─── 文件 & 目录 ──────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/cd')} <路径>          更改工作目录`);
  console.log(`  ${chalk.cyan('/cwd')}                显示当前工作目录`);
  console.log(`  ${chalk.cyan('/tools')}              列出 AI 可调用的工具`);
  console.log(`  ${chalk.cyan('@路径')}               消息中内嵌文件内容 (例: @data.csv 里有什么?)`);
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

function injectSkill(id: string, history: Message[]): boolean {
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
  history.push({
    role: 'user',
    content: `[Skill 已加载: ${match.id}]\n\n以下是该技能的操作指南，请严格按照说明执行：\n\n${content}`,
  });
  history.push({
    role: 'assistant',
    content: `✓ Skill **${match.id}** 已加载。我已阅读指南，随时可以开始。请告诉我您的具体数据和需求。`,
  });
  console.log(chalk.green(`✓ Skill ${match.id} 已注入到当前对话上下文`));
  return true;
}

// ── @file expansion ───────────────────────────────────────────────────────────

function expandFileRefs(input: string): string {
  // Match @path or @"path with spaces"
  return input.replace(/@"([^"]+)"|@'([^']+)'|@([\w./\\~:-]+)/g, (_, q1, q2, q3) => {
    const rawPath = q1 ?? q2 ?? q3;
    try {
      const resolved = resolve(rawPath.replace(/^~/, homedir()));
      if (!existsSync(resolved)) return _;
      const content = readFileSync(resolved, 'utf8');
      const lines = content.split('\n');
      const preview = lines.length > 100
        ? lines.slice(0, 100).join('\n') + `\n... (共 ${lines.length} 行，已截断显示前 100 行)`
        : content;
      return `\n\`\`\`\n[文件: ${resolved}]\n${preview}\n\`\`\`\n`;
    } catch {
      return _;
    }
  });
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

const COMPACT_TOKEN_THRESHOLD = 60_000; // ~210k chars; trigger compaction
const COMPACT_KEEP_RECENT = 8;          // keep last N messages intact

function estimateTokens(messages: Message[]): number {
  const chars = messages.reduce((n, m) => n + String(m.content ?? '').length, 0);
  return Math.round(chars / 3.5);
}

async function maybeCompact(history: Message[], cfg: ReturnType<typeof loadConfig>): Promise<Message[]> {
  const tokens = estimateTokens(history);
  if (tokens < COMPACT_TOKEN_THRESHOLD) return history;

  // Keep the most recent messages untouched; summarize everything older
  const recent = history.slice(-COMPACT_KEEP_RECENT);
  const old = history.slice(0, -COMPACT_KEEP_RECENT);
  if (old.length === 0) return history;

  process.stdout.write(chalk.dim(`\n[上下文已达 ~${Math.round(tokens / 1000)}k tokens，正在自动压缩...]\n`));
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
    const saved = estimateTokens(history) - estimateTokens(compacted);
    process.stdout.write(chalk.dim(`[压缩完成，释放约 ~${Math.round(saved / 1000)}k tokens]\n\n`));
    return compacted;
  } catch {
    // Compaction failed — fall back to simple truncation
    return history.slice(-COMPACT_KEEP_RECENT * 2);
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

interface CommandResult {
  exit?: boolean;
  clearHistory?: boolean;
  thinkMode?: boolean;
  injectHistory?: Message[];
}

async function handleCommand(
  input: string,
  rl: readline.Interface,
  history: Message[],
  thinkMode: boolean,
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
      const turns = Math.floor(history.length / 2);
      const chars = history.reduce((n, m) => n + String(m.content ?? '').length, 0);
      const estTokens = Math.round(chars / 3.5);
      console.log(chalk.bold('对话统计:'));
      console.log(`  轮次:        ${turns}`);
      console.log(`  消息总数:    ${history.length}`);
      console.log(`  估算 Token:  ~${estTokens.toLocaleString()}`);
      break;
    }

    case 'save': {
      saveConversation(history, arg || undefined);
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
      } else {
        const all = collectAllSkills();
        const hasMatch = all.find((e) => e.id === arg || e.id.startsWith(arg) || e.id.includes(arg));
        if (hasMatch) {
          injectSkill(arg, history);
        } else {
          listSkills(arg);
        }
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
      console.log(`  ${chalk.cyan('bash')}          执行 Shell 命令 (R/Python/bash 脚本、生信工具)`);
      console.log(`  ${chalk.cyan('read_file')}     读取文件内容 (支持 ~/ 路径)`);
      console.log(`  ${chalk.cyan('write_file')}    创建或覆写文件`);
      console.log(`  ${chalk.cyan('list_dir')}      列出目录内容`);
      console.log(`  ${chalk.cyan('search_files')}  glob 搜索文件 (如 *.R, *.csv)`);
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
  console.log(chalk.bold.cyan('─────────────────────────────────────────────────────────'));
  console.log(chalk.dim('  输入问题开始对话   /help 查看命令   /cat 技能分类   @文件路径 内嵌文件'));
  console.log();

  const systemPrompt = buildSystemPrompt();
  let history: Message[] = [];
  let thinkMode = false;
  const injectedSkills = new Set<string>(); // track auto-injected skills

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
      const result = await handleCommand(trimmed, rl, history, thinkMode);
      if (result.exit) break;
      if (result.clearHistory) { history = []; injectedSkills.clear(); }
      if (result.injectHistory) history = result.injectHistory;
      if (result.thinkMode !== undefined) thinkMode = result.thinkMode;
      continue;
    }

    // ── Auto skill routing ─────────────────────────────────────────────────────
    const { routes: suggestedRoutes, topScore } = routeSkill(trimmed);
    const newRoutes = suggestedRoutes.filter((r) => !injectedSkills.has(r.id));
    if (newRoutes.length === 1 && topScore >= 8) {
      // High-confidence single match → auto-inject silently
      const r = newRoutes[0];
      const ok = injectSkill(r.id, history);
      if (ok) {
        injectedSkills.add(r.id);
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
