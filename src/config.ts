import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { PROVIDERS, DEFAULT_PROVIDER } from './providers.js';

export interface BgiConfig {
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  // Custom provider settings (company intranet / self-hosted)
  customUrl?: string;
  customModel?: string;
}

export const BGI_DIR = join(homedir(), '.bgicli');
export const WORKFLOWS_DIR = join(BGI_DIR, 'workflows');
export const TOOLS_DIR = join(BGI_DIR, 'tools');
export const SKILLS_DIR = join(BGI_DIR, 'skills');
export const DATABASES_FILE = join(BGI_DIR, 'databases.json');
const CONFIG_FILE = join(BGI_DIR, 'config.json');

export function ensureDirs(): void {
  for (const dir of [BGI_DIR, WORKFLOWS_DIR, TOOLS_DIR, SKILLS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): BgiConfig {
  ensureDirs();
  if (!existsSync(CONFIG_FILE)) {
    const def: BgiConfig = {
      provider: DEFAULT_PROVIDER,
      model: PROVIDERS[DEFAULT_PROVIDER].defaultModel,
      apiKeys: {},
    };
    saveConfig(def);
    return def;
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as BgiConfig;
}

export function saveConfig(cfg: BgiConfig): void {
  ensureDirs();
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

export function getApiKey(cfg: BgiConfig): string | undefined {
  const prov = PROVIDERS[cfg.provider];
  // Env var takes precedence
  if (prov?.envKey && process.env[prov.envKey]) return process.env[prov.envKey];
  return cfg.apiKeys[cfg.provider];
}
