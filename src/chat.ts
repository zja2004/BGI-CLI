import OpenAI from 'openai';
import chalk from 'chalk';
import { TOOL_DEFINITIONS, executeTool, type StreamCallback } from './tools.js';
import type { BgiConfig } from './config.js';
import { PROVIDERS } from './providers.js';

export type Message = OpenAI.Chat.ChatCompletionMessageParam;

export interface ChatStats {
  inputTokens: number;
  outputTokens: number;
  successCmds: number;
  failCmds: number;
}

// ── Streaming response + tool-use loop ───────────────────────────────────────

export async function chat(
  messages: Message[],
  config: BgiConfig,
  systemPrompt: string,
  stats?: ChatStats,
  signal?: AbortSignal,
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

  return await streamLoop(client, fullMessages, config.model, stats, signal);
}

async function streamLoop(
  client: OpenAI,
  messages: Message[],
  model: string,
  stats?: ChatStats,
  signal?: AbortSignal,
): Promise<string> {
  // Accumulate the final assistant text across potential tool-call rounds
  let finalText = '';

  for (let round = 0; round < 20; round++) {
    if (signal?.aborted) break;
    // Before each LLM call: deduplicate skill injections + trim oversized tool outputs
    messages = deduplicateSkillInjections(trimToolOutputs(messages));

    let streamResult: Awaited<ReturnType<typeof streamOnce>>;
    try {
      streamResult = await streamOnce(client, messages, model, signal);
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort')))) {
        process.stdout.write(chalk.yellow('\n  [任务已中断]\n'));
        break;
      }
      throw err;
    }
    const { text, toolCalls, finishReason, inputTokens, outputTokens } = streamResult;
    if (stats) {
      stats.inputTokens += inputTokens;
      stats.outputTokens += outputTokens;
    }

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
        process.stdout.write(`\n${label} `);

        let streamedLines = 0;
        let lastLineWasEmpty = false;
        let spinnerCleared = false;
        let partialLine = ''; // accumulated output not yet terminated by \r or \n
        let outputStarted = false; // true after first chunk — guards single heartbeat creation
        const MAX_STREAM_LINES = 200;

        // Spinner runs for ALL tools; bash clears it on first output chunk
        let frame = 0;
        const spin = setInterval(() => {
          if (spinnerCleared) return;
          const secs = ((Date.now() - t0) / 1000).toFixed(1);
          process.stdout.write(
            `\r${label} ${chalk.cyan(SPIN_FRAMES[frame++ % SPIN_FRAMES.length])} ${chalk.dim(secs + 's')}`,
          );
        }, 80);

        const clearSpinner = () => {
          if (spinnerCleared) return;
          spinnerCleared = true;
          clearInterval(spin);
          process.stdout.write('\r\x1b[2K'); // erase spinner line
        };

        // Heartbeat: when bash has started outputting but goes silent for ≥5s,
        // print an elapsed-time line so the user knows the command is still running.
        let lastChunkTime = t0;
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        // If aborted mid-tool, clear heartbeat immediately so it stops printing
        const clearHeartbeat = () => { if (heartbeat) { clearInterval(heartbeat); heartbeat = null; } };
        signal?.addEventListener('abort', clearHeartbeat, { once: true });

        const onStream: StreamCallback | undefined = isBash
          ? (chunk: string) => {
              lastChunkTime = Date.now();
              // First chunk ever: clear spinner, print header, start heartbeat ONCE
              if (!outputStarted) {
                outputStarted = true;
                clearSpinner();
                process.stdout.write(`${label}\n`);
                heartbeat = setInterval(() => {
                  if (Date.now() - lastChunkTime >= 5000) {
                    const totalSecs = ((Date.now() - t0) / 1000).toFixed(0);
                    process.stdout.write(chalk.dim(`\n  │ ⏱ 运行中... ${totalSecs}s`));
                  }
                }, 5000);
              }

              // Process each character group between \r and \n terminators.
              // \r lines are rendered in-place (progress bars) and do NOT count toward
              // the line limit. Only \n-terminated lines count.
              let i = 0;
              while (i < chunk.length) {
                const crPos = chunk.indexOf('\r', i);
                const nlPos = chunk.indexOf('\n', i);

                if (crPos === -1 && nlPos === -1) {
                  // No terminator in remainder — accumulate and show in-place
                  partialLine += chunk.slice(i);
                  process.stdout.write('\r' + chalk.dim('  │ ') + partialLine + '\x1b[K');
                  break;
                }

                const nextPos = crPos === -1 ? nlPos : nlPos === -1 ? crPos : Math.min(crPos, nlPos);
                const isCR = chunk[nextPos] === '\r';
                partialLine += chunk.slice(i, nextPos);

                if (isCR) {
                  // Carriage return: overwrite current line in-place, do not count
                  process.stdout.write('\r' + chalk.dim('  │ ') + partialLine + '\x1b[K');
                  partialLine = '';
                  i = nextPos + 1;
                  if (i < chunk.length && chunk[i] === '\n') i++; // consume \r\n as one
                } else {
                  // Newline: commit as a real output line, count toward limit
                  if (partialLine.trim() !== '' || !lastLineWasEmpty) {
                    if (streamedLines < MAX_STREAM_LINES) {
                      process.stdout.write('\r' + chalk.dim('  │ ') + partialLine + '\x1b[K\n');
                      lastLineWasEmpty = partialLine.trim() === '';
                      streamedLines++;
                      if (streamedLines >= MAX_STREAM_LINES) {
                        process.stdout.write(chalk.dim('  │ ... (输出过长，已截断)\n'));
                      }
                    }
                  }
                  partialLine = '';
                  i = nextPos + 1;
                }
              }
            }
          : undefined;

        const result = await executeTool(tc.name, args, onStream, signal);

        signal?.removeEventListener('abort', clearHeartbeat);
        clearHeartbeat();

        // Flush any partial line that wasn't terminated (e.g. final progress bar state)
        if (partialLine) {
          if (streamedLines < MAX_STREAM_LINES) {
            process.stdout.write('\r' + chalk.dim('  │ ') + partialLine + '\x1b[K\n');
          }
          partialLine = '';
        }

        if (stats) {
          if (result.error) stats.failCmds++;
          else stats.successCmds++;
        }

        clearSpinner(); // stop spinner if not already stopped

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const doneIcon = result.error ? chalk.yellow('✗') : chalk.green('✓');

        if (isBash && streamedLines > 0) {
          process.stdout.write('\n');
        }
        process.stdout.write(`  ${doneIcon} ${chalk.dim('完成 ' + elapsed + 's')}\n`);

        if (result.error) {
          process.stdout.write(chalk.yellow(`  ⚠ ${result.error}\n`));
        }

        // For non-bash tools: show brief output preview
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
  signal?: AbortSignal,
): Promise<{ text: string; toolCalls: ToolCall[]; finishReason: string | null; inputTokens: number; outputTokens: number }> {
  const stream = await client.chat.completions.create({
    model,
    messages,
    tools: TOOL_DEFINITIONS,
    stream: true,
    stream_options: { include_usage: true },
  }, { signal });

  let text = '';
  const toolCallMap: Record<number, ToolCall> = {};
  let finishReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  process.stdout.write(chalk.green('BGI › '));

  for await (const chunk of stream) {
    // Usage arrives in the final chunk (choices may be empty)
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? 0;
      outputTokens = chunk.usage.completion_tokens ?? 0;
    }

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
    inputTokens,
    outputTokens,
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
          '你是一个对话摘要助手。请将以下对话历史压缩为简洁的中文摘要，保留所有关键技术信息：文件路径、命令、分析结果、用户决策、已激活的技能。摘要应让对话能够无缝继续。',
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
