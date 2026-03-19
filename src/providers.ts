export interface ProviderDef {
  name: string;
  baseURL: string;
  models: string[];
  defaultModel: string;
  envKey: string;
}

export const PROVIDERS: Record<string, ProviderDef> = {
  bailian: {
    name: '百炼 · 阿里云 (DashScope)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envKey: 'DASHSCOPE_API_KEY',
    models: [
      // ── Qwen3.5 (最新旗舰) ────────────────────────────────
      'qwen3.5-397b-a17b',
      'qwen3.5-122b-a10b',
      'qwen3.5-plus',
      'qwen3.5-flash',
      // ── Qwen3 ─────────────────────────────────────────────
      'qwen3-235b-a22b',
      'qwen3-max',
      'qwen3-32b',
      'qwen3-14b',
      'qwen3-8b',
      // ── Qwen3 代码模型 ────────────────────────────────────
      'qwen3-coder-plus',
      'qwen3-coder-flash',
      'qwen3-coder-480b-a35b-instruct',
      // ── 经典 Qwen ─────────────────────────────────────────
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
      'qwen-long',
      'qwen-flash',
      // ── 推理模型 ──────────────────────────────────────────
      'qwq-plus',
      'deepseek-r1',
      'deepseek-v3',
      'deepseek-v3.2',
      // ── 第三方 (DashScope 聚合) ───────────────────────────
      'kimi-k2.5',
      'kimi-k2-thinking',
      'MiniMax-M2.5',
      'glm-5',
    ],
    defaultModel: 'qwen3.5-plus',
  },
  intranet: {
    name: '内网 Qwen3-235B (172.16.224.137)',
    baseURL: 'http://172.16.224.137:1024/v1',
    models: ['Qwen3-235B-A22B'],
    defaultModel: 'Qwen3-235B-A22B',
    envKey: '', // no auth required
  },
  custom: {
    name: '自定义 (Custom URL)',
    baseURL: '', // filled from config.customUrl at runtime
    models: [], // filled from config.customModel at runtime
    defaultModel: '',
    envKey: 'CUSTOM_API_KEY',
  },
};

export const DEFAULT_PROVIDER = 'bailian';
