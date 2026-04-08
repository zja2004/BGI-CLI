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
  const provider = (old['provider'] as string) ?? 'custom';
  const apiKeys  = (old['apiKeys']  as Record<string, string>) ?? {};
  const model    = (old['model']    as string) ?? '';

  const legacyUrls: Record<string, string> = {
    bailian:  'https://dashscope.aliyuncs.com/compatible-mode/v1',
    deepseek: 'https://api.deepseek.com/v1',
    kimi:     'https://api.moonshot.cn/v1',
    minimax:  'https://api.minimax.chat/v1',
    intranet: 'http://172.16.0.1:8080/v1',
  };

  const url    = provider === 'custom'
    ? ((old['customUrl'] as string) ?? '')
    : (legacyUrls[provider] ?? '');
  const name   = provider === 'custom'
    ? ((old['customUrl'] as string) ?? '自定义')
    : provider;
  const mdl    = provider === 'custom'
    ? ((old['customModel'] as string) ?? model)
    : model;
  const apiKey = provider === 'intranet' ? undefined : (apiKeys[provider] ?? apiKeys['custom']);

  const ep: Endpoint = {
    name, url, apiKey,
    models: mdl ? [mdl] : [],
    activeModel: mdl || undefined,
  };

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
