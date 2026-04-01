import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ── Endpoint ───────────────────────────────────────────────────────────────────

export interface Endpoint {
  name: string;
  url: string;
  apiKey?: string;
  models?: string[];       // cached from GET /v1/models
  activeModel?: string;    // last-selected model for this endpoint
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface BgiConfig {
  endpoints: Endpoint[];
  activeIndex: number;
  permanentSkills?: string[];
}

// ── Paths ─────────────────────────────────────────────────────────────────────

export const BGI_DIR         = join(homedir(), '.bgicli');
export const TOOLS_DIR       = join(BGI_DIR, 'tools');
export const BIO_SKILLS_DIR  = join(BGI_DIR, 'bio-skills');
/** @deprecated Use BIO_SKILLS_DIR. */
export const SKILLS_DIR      = BIO_SKILLS_DIR;
export const USER_SKILLS_DIR = join(BGI_DIR, 'user-skills');
export const DATABASES_FILE  = join(BGI_DIR, 'databases.json');
export const DATA_VERSION_FILE = join(BGI_DIR, '.data-version');
const CONFIG_FILE = join(BGI_DIR, 'config.json');

export function ensureDirs(): void {
  for (const dir of [BGI_DIR, TOOLS_DIR, BIO_SKILLS_DIR, USER_SKILLS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

// ── Preset endpoints (shown during first-run setup) ───────────────────────────

export const PRESET_ENDPOINTS: Omit<Endpoint, 'apiKey'>[] = [
  {
    name: '百炼 · 阿里云 (DashScope)',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      'qwen3.5-plus', 'qwen3.5-flash', 'qwen3-235b-a22b', 'qwen3-max', 'qwen3-32b',
      'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long',
      'deepseek-v3', 'deepseek-r1', 'qwq-plus', 'MiniMax-M2.5',
    ],
    activeModel: 'qwen3.5-plus',
  },
  {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    activeModel: 'deepseek-chat',
  },
  {
    name: 'Moonshot (Kimi)',
    url: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2.5'],
    activeModel: 'moonshot-v1-8k',
  },
  {
    name: 'MiniMax',
    url: 'https://api.minimax.chat/v1',
    models: ['MiniMax-M2.5', 'MiniMax-Text-01'],
    activeModel: 'MiniMax-M2.5',
  },
  {
    name: '内网 Qwen3-235B',
    url: 'http://172.16.224.137:1024/v1',
    models: ['Qwen3-235B-A22B'],
    activeModel: 'Qwen3-235B-A22B',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getActiveEndpoint(cfg: BgiConfig): Endpoint {
  return cfg.endpoints[cfg.activeIndex] ?? cfg.endpoints[0] ?? {
    name: '未配置', url: '', models: [], activeModel: '',
  };
}

export function getCurrentModel(cfg: BgiConfig): string {
  const ep = getActiveEndpoint(cfg);
  return ep.activeModel ?? ep.models?.[0] ?? '';
}

/** Scan available models from a remote endpoint via GET /models. */
export async function scanModels(ep: Endpoint): Promise<string[]> {
  try {
    // Dynamic import to avoid top-level OpenAI dep in config module
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: ep.apiKey || 'none', baseURL: ep.url, timeout: 8000 });
    const list = await (client.models.list as () => Promise<{ data: { id: string }[] }>)();
    return list.data.map((m) => m.id).sort();
  } catch {
    return [];
  }
}

// ── Migration from old provider-based config ──────────────────────────────────

function isOldFormat(raw: Record<string, unknown>): boolean {
  return typeof raw['provider'] === 'string' && !Array.isArray(raw['endpoints']);
}

function migrateOldConfig(old: Record<string, unknown>): BgiConfig {
  const provider = (old['provider'] as string) ?? 'bailian';
  const apiKeys  = (old['apiKeys']  as Record<string, string>) ?? {};
  const model    = (old['model']    as string) ?? '';

  let ep: Endpoint;
  if (provider === 'custom') {
    ep = {
      name:        '自定义',
      url:         (old['customUrl']   as string) ?? '',
      apiKey:      apiKeys['custom'],
      models:      (old['customModel'] as string) ? [(old['customModel'] as string)] : [],
      activeModel: (old['customModel'] as string) ?? model,
    };
  } else if (provider === 'intranet') {
    ep = { ...PRESET_ENDPOINTS[4]!, apiKey: undefined };
  } else {
    // bailian / deepseek / kimi / minimax → find matching preset by URL
    const presetMap: Record<string, number> = {
      bailian: 0, deepseek: 1, kimi: 2, minimax: 3,
    };
    const preset = PRESET_ENDPOINTS[presetMap[provider] ?? 0]!;
    ep = { ...preset, apiKey: apiKeys[provider], activeModel: model || preset.activeModel };
  }

  return {
    endpoints: [ep],
    activeIndex: 0,
    permanentSkills: (old['permanentSkills'] as string[]) ?? ['web-search'],
  };
}

// ── Load / Save ───────────────────────────────────────────────────────────────

export function loadConfig(): BgiConfig {
  ensureDirs();
  if (!existsSync(CONFIG_FILE)) {
    const def: BgiConfig = { endpoints: [], activeIndex: 0, permanentSkills: ['web-search'] };
    saveConfig(def);
    return def;
  }
  const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Record<string, unknown>;

  if (isOldFormat(raw)) {
    const migrated = migrateOldConfig(raw);
    saveConfig(migrated);
    return migrated;
  }

  const cfg = raw as unknown as BgiConfig;
  if (!cfg.permanentSkills) { cfg.permanentSkills = ['web-search']; saveConfig(cfg); }
  return cfg;
}

export function saveConfig(cfg: BgiConfig): void {
  ensureDirs();
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

/** @deprecated Use getActiveEndpoint(cfg).apiKey */
export function getApiKey(cfg: BgiConfig): string | undefined {
  return getActiveEndpoint(cfg).apiKey;
}
