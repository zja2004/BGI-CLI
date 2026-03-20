import { execSync } from 'child_process';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import type OpenAI from 'openai';

// ── Tool Definitions (OpenAI function-call format) ────────────────────────────

export const TOOL_DEFINITIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description:
        'Execute a shell command and return stdout/stderr. Use for running R/Python scripts, bioinformatics tools (samtools, STAR, etc.), package installation, and data processing.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
          workdir: {
            type: 'string',
            description:
              'Working directory for the command (optional, defaults to current)',
          },
          timeout_ms: {
            type: 'number',
            description:
              'Timeout in milliseconds (default 30000, max 300000 for long jobs)',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the contents of a file. Use to inspect data files, SKILL.md workflow guides, R/Python scripts, results files, etc.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          max_lines: {
            type: 'number',
            description: 'Maximum number of lines to return (default: 200)',
          },
          offset: {
            type: 'number',
            description: 'Line number to start reading from (default: 0)',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create or overwrite a file with the given content. Use for saving scripts, results, or configuration files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write to' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and directories at a given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description:
        'Search for files matching a pattern using glob syntax. Use to find scripts, data files, or workflow references.',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Search pattern (e.g. "*.R", "SKILL.md", "*.csv")',
          },
          path: {
            type: 'string',
            description: 'Root directory to search in (default: current directory)',
          },
        },
        required: ['pattern'],
      },
    },
  },
];

// ── Tool Implementations ──────────────────────────────────────────────────────

export interface ToolResult {
  output: string;
  error?: string;
}

export function executeTool(name: string, args: Record<string, unknown>): ToolResult {
  try {
    switch (name) {
      case 'bash':
        return toolBash(
          args['command'] as string,
          args['workdir'] as string | undefined,
          (args['timeout_ms'] as number | undefined) ?? 30_000,
        );
      case 'read_file':
        return toolReadFile(
          args['path'] as string,
          (args['max_lines'] as number | undefined) ?? 200,
          (args['offset'] as number | undefined) ?? 0,
        );
      case 'write_file':
        return toolWriteFile(args['path'] as string, args['content'] as string);
      case 'list_dir':
        return toolListDir(args['path'] as string);
      case 'search_files':
        return toolSearchFiles(
          args['pattern'] as string,
          (args['path'] as string | undefined) ?? process.cwd(),
        );
      default:
        return { output: '', error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { output: '', error: String(err) };
  }
}

/** Decode a raw buffer: try UTF-8 first, fall back to GBK (Windows Chinese CP936). */
function decodeBuffer(buf: Buffer | string | null | undefined): string {
  if (!buf) return '';
  if (typeof buf === 'string') return buf;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch {
      return buf.toString('latin1');
    }
  }
}

function toolBash(command: string, workdir?: string, timeoutMs = 30_000): ToolResult {
  try {
    const buf = execSync(command, {
      cwd: workdir ?? process.cwd(),
      timeout: timeoutMs,
      encoding: 'buffer',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    return { output: decodeBuffer(buf).trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const out = (decodeBuffer(e.stdout) + '\n' + decodeBuffer(e.stderr)).trim();
    return { output: out, error: e.message ?? String(err) };
  }
}

function toolReadFile(path: string, maxLines: number, offset: number): ToolResult {
  const resolved = resolve(path.replace(/^~/, homedir()));
  if (!existsSync(resolved)) return { output: '', error: `File not found: ${resolved}` };
  const lines = readFileSync(resolved, 'utf8').split('\n');
  const slice = lines.slice(offset, offset + maxLines);
  const total = lines.length;
  const header = `[File: ${resolved} | Lines ${offset + 1}-${offset + slice.length} of ${total}]\n`;
  return { output: header + slice.join('\n') };
}

function toolWriteFile(path: string, content: string): ToolResult {
  const resolved = resolve(path.replace(/^~/, homedir()));
  const dir = dirname(resolved);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolved, content, 'utf8');
  return { output: `✓ Written ${resolved} (${content.length} bytes)` };
}

function toolListDir(path: string): ToolResult {
  const resolved = resolve(path.replace(/^~/, homedir()));
  if (!existsSync(resolved)) return { output: '', error: `Path not found: ${resolved}` };
  const entries = readdirSync(resolved).map((name) => {
    const full = join(resolved, name);
    const isDir = statSync(full).isDirectory();
    return isDir ? `${name}/` : name;
  });
  return { output: entries.join('\n') };
}

function toolSearchFiles(pattern: string, rootPath: string): ToolResult {
  const resolved = resolve(rootPath.replace(/^~/, homedir()));
  // Use find command on Unix, dir on Windows
  const isWin = process.platform === 'win32';
  let command: string;
  if (isWin) {
    command = `dir /s /b "${resolved}\\${pattern}" 2>nul`;
  } else {
    const name = pattern.includes('/') ? pattern : `"${pattern}"`;
    command = `find "${resolved}" -name ${name} 2>/dev/null | head -50`;
  }
  return toolBash(command, resolved, 10_000);
}
