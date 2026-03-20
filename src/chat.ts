import OpenAI from 'openai';
import chalk from 'chalk';
import { TOOL_DEFINITIONS, executeTool, type StreamCallback } from './tools.js';
import type { BgiConfig } from './config.js';
import { PROVIDERS } from './providers.js';

export type Message = OpenAI.Chat.ChatCompletionMessageParam;

// ── Streaming response + tool-use loop ───────────────────────────────────────

export async function chat(
  messages: Message[],
  config: BgiConfig,
  systemPrompt: string,
): Promise<string> {
  const prov = PROVIDERS[config.provider];
  if (!prov) throw new Error(`Unknown provider: ${config.provider}`);

  // For custom provider, resolve URL and model from config
  if (config.provider === 'custom') {
    if (!config.customUrl) throw new Error('自定义服务商未配置 URL。运行: /connect custom');
    if (!config.customModel) throw new Error('自定义服务商未配置模型名称。运行: /connect custom');
    config = { ...config, model: config.customModel };
  }

  const baseURL = config.provider === 'custom' ? config.customUrl! : prov.baseURL;

  const apiKey = getApiKey(config);
  // Providers with empty envKey don't require auth (e.g. intranet deployments)
  const requiresKey = prov.envKey !== '';
  if (requiresKey && !apiKey) throw new Error(`未配置 API Key (${config.provider})。运行: /connect`);

  const client = new OpenAI({ apiKey: apiKey || 'none', baseURL });

  // Build full messages array with system prompt
  const fullMessages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  return await streamLoop(client, fullMessages, config.model);
}

async function streamLoop(
  client: OpenAI,
  messages: Message[],
  model: string,
): Promise<string> {
  // Accumulate the final assistant text across potential tool-call rounds
  let finalText = '';

  for (let round = 0; round < 20; round++) {
    // Before each LLM call: deduplicate skill injections + trim oversized tool outputs
    messages = deduplicateSkillInjections(trimToolOutputs(messages));

    const { text, toolCalls, finishReason } = await streamOnce(client, messages, model);

    if (text) finalText = text;

    if (finishReason === 'tool_calls' && toolCalls.length > 0) {
      // Add assistant message with tool_calls in OpenAI wire format
      messages.push({
        role: 'assistant',
        content: text || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })) as any,
      });

      // Execute each tool and add results
      const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      for (const tc of toolCalls) {
        const args = parseArgs(tc.args);
        const isBash = tc.name === 'bash';

        // Header line
        const label = chalk.dim(`[工具: ${tc.name}(${summarizeArgs(args)})]`);
        const t0 = Date.now();
        process.stdout.write(`\n${label}\n`);

        let streamedLines = 0;
        let lastLineWasEmpty = false;
        const MAX_STREAM_LINES = 200; // cap live output to avoid flooding terminal

        // For bash: stream output in real-time; for others: show spinner
        let spin: ReturnType<typeof setInterval> | null = null;
        let frame = 0;

        const onStream: StreamCallback | undefined = isBash
          ? (chunk: string) => {
              if (streamedLines >= MAX_STREAM_LINES) return;
              const lines = chunk.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Skip excessive blank lines
                if (line.trim() === '') {
                  if (lastLineWasEmpty) continue;
                  lastLineWasEmpty = true;
                } else {
                  lastLineWasEmpty = false;
                }
                if (i < lines.length - 1 || line.length > 0) {
                  process.stdout.write(chalk.dim('  │ ') + line + (i < lines.length - 1 ? '\n' : ''));
                  streamedLines++;
                  if (streamedLines >= MAX_STREAM_LINES) {
                    process.stdout.write(chalk.dim('\n  │ ... (输出过长，已截断)\n'));
                    break;
                  }
                }
              }
            }
          : undefined;

        if (!isBash) {
          // Non-bash tools: show spinner
          spin = setInterval(() => {
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            process.stdout.write(
              `\r  ${chalk.cyan(SPIN_FRAMES[frame++ % SPIN_FRAMES.length])} ${chalk.dim(secs + 's')}`,
            );
          }, 80);
        }

        const result = await executeTool(tc.name, args, onStream);

        if (spin) {
          clearInterval(spin);
          process.stdout.write('\r\x1b[2K');
        }

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const doneIcon = result.error ? chalk.yellow('✗') : chalk.green('✓');

        // For bash with streaming: just print summary footer
        if (isBash && streamedLines > 0) {
          process.stdout.write('\n');
        }
        process.stdout.write(`  ${doneIcon} ${chalk.dim('完成 ' + elapsed + 's')}\n`);

        if (result.error) {
          process.stdout.write(chalk.yellow(`  ⚠ ${result.error}\n`));
        }

        // For non-bash tools (or bash with no stream output): show brief preview
        if (!isBash && result.output) {
          const preview = result.output.split('\n').slice(0, 3).join('\n');
          const more = result.output.split('\n').length > 3;
          process.stdout.write(chalk.dim(`  ${preview}${more ? '\n  ...' : ''}\n`));
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.error
            ? `ERROR: ${result.error}\nOUTPUT: ${result.output}`
            : result.output,
        });
      }

      // Print separator before next LLM response
      process.stdout.write('\n');
      continue;
    }

    // Done
    break;
  }

  return finalText;
}

interface ToolCall {
  id: string;
  name: string;
  args: string;
  index: number;
}

async function streamOnce(
  client: OpenAI,
  messages: Message[],
  model: string,
): Promise<{ text: string; toolCalls: ToolCall[]; finishReason: string | null }> {
  const stream = await client.chat.completions.create({
    model,
    messages,
    tools: TOOL_DEFINITIONS,
    stream: true,
  });

  let text = '';
  const toolCallMap: Record<number, ToolCall> = {};
  let finishReason: string | null = null;

  process.stdout.write(chalk.green('BGI › '));

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta;
    finishReason = choice.finish_reason ?? finishReason;

    // Text content
    if (delta.content) {
      process.stdout.write(delta.content);
      text += delta.content;
    }

    // Tool calls (accumulate partial JSON)
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!toolCallMap[idx]) {
          toolCallMap[idx] = {
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            args: '',
            index: idx,
          };
        }
        if (tc.id && !toolCallMap[idx].id) toolCallMap[idx].id = tc.id;
        if (tc.function?.name && !toolCallMap[idx].name)
          toolCallMap[idx].name = tc.function.name;
        if (tc.function?.arguments) toolCallMap[idx].args += tc.function.arguments;
      }
    }
  }

  if (text) process.stdout.write('\n');

  return {
    text,
    toolCalls: Object.values(toolCallMap),
    finishReason,
  };
}

// ── Context window utilities ──────────────────────────────────────────────────

/**
 * Estimate token count for a message array.
 * Uses a 3.5 chars/token heuristic (reasonable for mixed Chinese/English).
 */
export function estimateTokens(messages: Message[]): number {
  const chars = messages.reduce((n, m) => {
    const content = m.content;
    if (typeof content === 'string') return n + content.length;
    if (Array.isArray(content)) {
      return n + content.reduce((s, c) => s + (typeof c === 'object' && 'text' in c ? (c as {text: string}).text.length : 0), 0);
    }
    return n;
  }, 0);
  return Math.round(chars / 3.5);
}

/**
 * Trim oversized tool outputs in-place to prevent a single bash result
 * from consuming the entire context window.
 * Tool messages with output > MAX_TOOL_CHARS are truncated with a notice.
 */
const MAX_TOOL_OUTPUT_CHARS = 8_000;

export function trimToolOutputs(messages: Message[]): Message[] {
  return messages.map((m) => {
    if (m.role !== 'tool') return m;
    const content = typeof m.content === 'string' ? m.content : '';
    if (content.length <= MAX_TOOL_OUTPUT_CHARS) return m;
    const head = content.slice(0, MAX_TOOL_OUTPUT_CHARS / 2);
    const tail = content.slice(-MAX_TOOL_OUTPUT_CHARS / 2);
    const trimmed = `${head}\n\n... [输出过长，已截断 ${content.length - MAX_TOOL_OUTPUT_CHARS} 字符] ...\n\n${tail}`;
    return { ...m, content: trimmed };
  });
}

/**
 * Remove duplicate SKILL.md injections — if the same skill was injected
 * multiple times (e.g. user ran /sk deseq2 twice), keep only the last copy.
 * This is the single biggest source of wasted tokens in long sessions.
 */
export function deduplicateSkillInjections(messages: Message[]): Message[] {
  const SKILL_MARKER = '[Skill 已加载:';
  const seenSkills = new Set<string>();
  const result: Message[] = [];

  // Process in reverse to keep the LAST injection of each skill
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const content = typeof m.content === 'string' ? m.content : '';
    if (m.role === 'user' && content.startsWith(SKILL_MARKER)) {
      const idMatch = content.match(/\[Skill 已加载: ([^\]]+)\]/);
      const skillId = idMatch?.[1];
      if (skillId) {
        if (seenSkills.has(skillId)) continue; // skip duplicate
        seenSkills.add(skillId);
      }
    }
    result.unshift(m);
  }
  return result;
}

// ── Compact (summarize old messages) ─────────────────────────────────────────

/**
 * Summarize `messages` into a single assistant message using the same LLM.
 * Returns the summary string, or throws on failure.
 */
export async function compactMessages(
  messages: Message[],
  config: BgiConfig,
): Promise<string> {
  const prov = PROVIDERS[config.provider];
  if (!prov) throw new Error(`Unknown provider: ${config.provider}`);

  const baseURL = config.provider === 'custom' ? config.customUrl! : prov.baseURL;
  const apiKey = getApiKey(config);
  const client = new OpenAI({ apiKey: apiKey || 'none', baseURL });

  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `[${m.role === 'user' ? '用户' : 'AI'}]: ${String(m.content ?? '').slice(0, 2000)}`)
    .join('\n\n');

  const resp = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content:
          '你是一个对话摘要助手。请将以下对话历史压缩为简洁的中文摘要，保留所有关键技术信息：文件路径、命令、分析结果、用户决策、已激活的工作流/技能。摘要应让对话能够无缝继续。',
      },
      {
        role: 'user',
        content: `请压缩以下对话历史：\n\n${transcript}\n\n输出格式：直接输出摘要文本，不需要任何前缀。`,
      },
    ],
    stream: false,
  });

  return resp.choices[0]?.message?.content ?? '（对话历史已压缩）';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey(cfg: BgiConfig): string | undefined {
  const prov = PROVIDERS[cfg.provider];
  if (prov?.envKey && process.env[prov.envKey]) return process.env[prov.envKey];
  return cfg.apiKeys[cfg.provider];
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

function summarizeArgs(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return '';
  // Show first key value, truncated
  const first = String(args[keys[0]] ?? '');
  const truncated = first.length > 60 ? first.slice(0, 60) + '…' : first;
  return JSON.stringify(truncated);
}
