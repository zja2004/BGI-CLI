import OpenAI from 'openai';
import chalk from 'chalk';
import { TOOL_DEFINITIONS, executeTool } from './tools.js';
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
      for (const tc of toolCalls) {
        const args = parseArgs(tc.args);
        process.stdout.write(chalk.dim(`\n[工具: ${tc.name}(${summarizeArgs(args)})]\n`));

        const result = executeTool(tc.name, args);

        if (result.error) {
          process.stdout.write(chalk.yellow(`  ⚠ ${result.error}\n`));
        }
        if (result.output) {
          // Show first 3 lines of output as a preview
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
