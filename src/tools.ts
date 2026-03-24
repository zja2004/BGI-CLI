import { spawn } from 'child_process';
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

import { get as httpsGet } from 'https';
import { get as httpGet } from 'http';
import { scanCommand } from './security.js';

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
              'Timeout in milliseconds (default 300000 / 5 min). For downloads (wget/curl/aria2c) or long computations (STAR, HISAT2, etc.) ALWAYS use at least 3600000 (60 min). Never set a short timeout for downloads — slow networks are normal, be patient.',
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
            description: 'Maximum number of lines to return (default: 500)',
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
  {
    type: 'function',
    function: {
      name: 'fetch_geo',
      description:
        'Query NCBI GEO database by accession number (GSE, GDS, GPL, GSM). Returns dataset metadata, sample info, organism, platform, and download links. Use this BEFORE asking the user to manually download data — always try fetch_geo first when a GEO accession is mentioned.',
      parameters: {
        type: 'object',
        properties: {
          accession: {
            type: 'string',
            description: 'GEO accession number, e.g. "GSE12345", "GDS1234", "GPL570"',
          },
          include_samples: {
            type: 'boolean',
            description: 'Whether to include individual sample (GSM) metadata (default: false, set true for small datasets)',
          },
        },
        required: ['accession'],
      },
    },
  },
];

// ── Tool Implementations ──────────────────────────────────────────────────────

export interface ToolResult {
  output: string;
  error?: string;
}

/** Callback invoked with each chunk of stdout during bash execution (streaming). */
export type StreamCallback = (chunk: string) => void;

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  onStream?: StreamCallback,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'bash': {
        const cmd = args['command'] as string;
        const requestedTimeout = (args['timeout_ms'] as number | undefined) ?? 300_000;
        const isDownload = /\b(wget|curl|aria2c|axel|rsync)\b/.test(cmd);
        if (isDownload) {
          // Use inactivity-based timeout: kill only if silent for 10 min (stalled connection).
          // Total download time is unlimited — large datasets can take hours.
          return await toolBash(cmd, args['workdir'] as string | undefined, 0, onStream, 600_000, signal);
        }
        return await toolBash(cmd, args['workdir'] as string | undefined, requestedTimeout, onStream, undefined, signal);
      }
      case 'read_file':
        return toolReadFile(
          args['path'] as string,
          (args['max_lines'] as number | undefined) ?? 500,
          (args['offset'] as number | undefined) ?? 0,
        );
      case 'write_file':
        return toolWriteFile(args['path'] as string, args['content'] as string);
      case 'list_dir':
        return toolListDir(args['path'] as string);
      case 'search_files':
        return await toolSearchFiles(
          args['pattern'] as string,
          (args['path'] as string | undefined) ?? process.cwd(),
        );
      case 'fetch_geo':
        return await toolFetchGeo(
          args['accession'] as string,
          (args['include_samples'] as boolean | undefined) ?? false,
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

/**
 * Inject progress/verbosity flags for common tools that suppress output when
 * stdout/stderr is piped (not a TTY). Only adds flags if not already present.
 */
function injectProgressFlags(cmd: string): string {
  // wget: add --show-progress so download progress appears even when piped
  if (/\bwget\b/.test(cmd) && !/-q\b|--quiet|--show-progress|--progress/.test(cmd)) {
    cmd = cmd.replace(/\bwget\b/, 'wget --show-progress');
  }
  // curl: add --progress-bar for a simple progress indicator when piped
  if (/\bcurl\b/.test(cmd) && !/-s\b|--silent|-S\b|-#|--progress-bar|--no-progress-meter/.test(cmd)) {
    cmd = cmd.replace(/\bcurl\b/, 'curl --progress-bar');
  }
  return cmd;
}

async function toolBash(
  command: string,
  workdir?: string,
  timeoutMs = 300_000,
  onStream?: StreamCallback,
  /** If set, resets the timer on every output chunk (for downloads).
   *  The process is only killed after this many ms of complete silence. */
  inactivityMs?: number,
  signal?: AbortSignal,
): Promise<ToolResult> {
  // ── Security scan ────────────────────────────────────────────────────────
  const scan = scanCommand(command);
  const criticals = scan.matches.filter(m => m.pattern.level === 'CRITICAL');
  if (criticals.length > 0) {
    const reasons = criticals.map(m => m.pattern.reason).join('、');
    return {
      output: '',
      error: `安全拦截 [CRITICAL]: ${reasons}\n命令已被阻止: ${command}`,
    };
  }
  // HIGH: emit warning but allow (user is informed via chat output)
  const highs = scan.matches.filter(m => m.pattern.level === 'HIGH');
  if (highs.length > 0) {
    const reasons = highs.map(m => m.pattern.reason).join('、');
    if (onStream) onStream(`⚠ 安全警告 [HIGH]: ${reasons}\n`);
  }

  // Force progress output for common download/progress tools that suppress it when piped
  const processedCommand = injectProgressFlags(command);

  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? 'cmd' : '/bin/sh', isWin ? ['/c', processedCommand] : ['-c', processedCommand], {
      cwd: workdir ?? process.cwd(),
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUNBUFFERED: '1',      // prevent Python stdout buffering
        FORCE_COLOR: '1',           // hint color support to tools that check
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const MAX = 10 * 1024 * 1024;
    let total = 0;

    child.stdout?.on('data', (c: Buffer) => {
      if ((total += c.length) <= MAX) {
        outChunks.push(c);
        // Stream each chunk to the caller in real-time
        if (onStream) onStream(decodeBuffer(c));
      }
    });
    child.stderr?.on('data', (c: Buffer) => {
      if ((total += c.length) <= MAX) {
        errChunks.push(c);
        // Also stream stderr (R/Python often write progress to stderr)
        if (onStream) onStream(decodeBuffer(c));
      }
    });

    let timedOut = false;
    let timedOutSecs = 0;
    let aborted = false;

    // AbortSignal: kill child immediately when the user presses Ctrl+C
    if (signal) {
      if (signal.aborted) {
        child.kill();
        return resolve({ output: '', error: '任务已中断' });
      }
      signal.addEventListener('abort', () => {
        aborted = true;
        child.kill();
      }, { once: true });
    }

    // Inactivity mode (downloads): reset timer on every output chunk.
    // Fixed-timeout mode (normal commands): never reset.
    const effectiveMs = inactivityMs ?? timeoutMs;
    let timer = setTimeout(() => { timedOut = true; timedOutSecs = effectiveMs / 1000; child.kill(); }, effectiveMs);

    const resetTimer = inactivityMs
      ? () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; timedOutSecs = inactivityMs / 1000; child.kill(); }, inactivityMs); }
      : null;

    if (resetTimer) {
      child.stdout?.on('data', resetTimer);
      child.stderr?.on('data', resetTimer);
    }

    child.on('close', (code) => {
      clearTimeout(timer);
      const out = (decodeBuffer(Buffer.concat(outChunks)) + '\n' + decodeBuffer(Buffer.concat(errChunks))).trim();
      if (aborted) {
        resolve({ output: out, error: '任务已中断' });
      } else if (timedOut) {
        const msg = inactivityMs
          ? `下载停滞 — 超过 ${timedOutSecs}s 无任何输出（连接可能已断开）`
          : `Command timed out after ${timedOutSecs}s`;
        resolve({ output: out, error: msg });
      } else if (code !== 0) {
        resolve({ output: out, error: `Command failed (exit ${code})` });
      } else {
        resolve({ output: out });
      }
    });

    child.on('error', (err) => { clearTimeout(timer); resolve({ output: '', error: err.message }); });
  });
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

async function toolSearchFiles(pattern: string, rootPath: string): Promise<ToolResult> {
  const resolved = resolve(rootPath.replace(/^~/, homedir()));
  const isWin = process.platform === 'win32';
  const command = isWin
    ? `dir /s /b "${resolved}\\${pattern}" 2>nul`
    : `find "${resolved}" -name ${pattern.includes('/') ? pattern : `"${pattern}"`} 2>/dev/null | head -50`;
  return toolBash(command, resolved, 10_000);
}

// ── GEO Database Tool ─────────────────────────────────────────────────────────

/** Simple HTTP/HTTPS GET that follows one redirect and returns body as string. */
function httpFetch(url: string, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? httpsGet : httpGet;
    const req = getter(url, { headers: { 'User-Agent': 'BGI-CLI/1.0' } }, (res) => {
      // Follow redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpFetch(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
  });
}

async function toolFetchGeo(accession: string, includeSamples: boolean): Promise<ToolResult> {
  const acc = accession.trim().toUpperCase();

  // Validate accession format
  if (!/^(GSE|GDS|GPL|GSM)\d+$/.test(acc)) {
    return {
      output: '',
      error: `无效的 GEO 编号: "${acc}"。支持格式: GSE12345, GDS1234, GPL570, GSM123456`,
    };
  }

  const accType = acc.slice(0, 3); // GSE / GDS / GPL / GSM

  try {
    // ── Step 1: NCBI eSearch to get internal UID ──────────────────────────────
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gds&term=${acc}[Accession]&retmode=json&retmax=1`;
    const searchRaw = await httpFetch(searchUrl);
    const searchJson = JSON.parse(searchRaw) as {
      esearchresult: { idlist: string[]; count: string };
    };

    const idList = searchJson.esearchresult?.idlist ?? [];
    if (idList.length === 0) {
      return { output: '', error: `未找到 GEO 记录: ${acc}。请确认编号是否正确。` };
    }
    const uid = idList[0];

    // ── Step 2: eSummary to get metadata ──────────────────────────────────────
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gds&id=${uid}&retmode=json`;
    const summaryRaw = await httpFetch(summaryUrl);
    const summaryJson = JSON.parse(summaryRaw) as {
      result: Record<string, {
        accession?: string; title?: string; summary?: string;
        gdstype?: string; ptechtype?: string; taxon?: string;
        n_samples?: number; samplestaxa?: string;
        suppfile?: string; ftp?: string;
        samples?: Array<{ accession: string; title: string }>;
        entrytype?: string; gpl?: string; organism?: string;
      }>;
    };

    const rec = summaryJson.result?.[uid];
    if (!rec) {
      return { output: '', error: `无法获取 ${acc} 的详细信息` };
    }

    // ── Step 3: Format output ─────────────────────────────────────────────────
    const lines: string[] = [];
    lines.push(`=== GEO 数据集: ${acc} ===`);
    lines.push('');

    if (rec.title)     lines.push(`标题:     ${rec.title}`);
    if (rec.taxon || rec.organism)
                       lines.push(`物种:     ${rec.taxon ?? rec.organism}`);
    if (rec.gdstype || rec.ptechtype)
                       lines.push(`类型:     ${rec.gdstype ?? rec.ptechtype}`);
    if (rec.gpl)       lines.push(`平台:     GPL${rec.gpl}`);
    if (rec.n_samples) lines.push(`样本数:   ${rec.n_samples}`);
    if (rec.summary) {
      const shortSummary = rec.summary.length > 500
        ? rec.summary.slice(0, 500) + '...'
        : rec.summary;
      lines.push('');
      lines.push(`摘要:\n${shortSummary}`);
    }

    // Download links
    lines.push('');
    lines.push('=== 下载链接 ===');
    lines.push(`GEO 页面:   https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${acc}`);

    if (accType === 'GSE') {
      lines.push(`矩阵文件:   https://ftp.ncbi.nlm.nih.gov/geo/series/${acc.slice(0, -3)}nnn/${acc}/matrix/`);
      lines.push(`原始数据:   https://ftp.ncbi.nlm.nih.gov/geo/series/${acc.slice(0, -3)}nnn/${acc}/suppl/`);
      lines.push('');
      lines.push('=== R 下载代码 ===');
      lines.push('```r');
      lines.push('# 方法1: GEOquery（推荐，自动解析）');
      lines.push('if (!require("GEOquery")) BiocManager::install("GEOquery")');
      lines.push(`gse <- getGEO("${acc}", GSEMatrix = TRUE, getGPL = FALSE)`);
      lines.push('expr_matrix <- exprs(gse[[1]])   # 表达矩阵');
      lines.push('pheno_data  <- pData(gse[[1]])   # 样本元数据');
      lines.push('');
      lines.push('# 方法2: 直接下载矩阵文件');
      lines.push(`url <- "https://ftp.ncbi.nlm.nih.gov/geo/series/${acc.slice(0, -3)}nnn/${acc}/matrix/${acc}_series_matrix.txt.gz"`);
      lines.push('download.file(url, destfile = "series_matrix.txt.gz")');
      lines.push('```');
      lines.push('');
      lines.push('=== Python 下载代码 ===');
      lines.push('```python');
      lines.push('import GEOparse');
      lines.push(`gse = GEOparse.get_GEO(geo="${acc}", destdir="./data")`);
      lines.push('# gse.gsms  — 样本字典');
      lines.push('# gse.gpls  — 平台信息');
      lines.push('```');
    }

    if (rec.suppfile) {
      lines.push('');
      lines.push(`补充文件:   ${rec.suppfile}`);
    }

    // Sample list (optional)
    if (includeSamples && rec.samples && rec.samples.length > 0) {
      lines.push('');
      lines.push(`=== 样本列表 (${rec.samples.length} 个) ===`);
      const showSamples = rec.samples.slice(0, 20);
      showSamples.forEach((s) => lines.push(`  ${s.accession}: ${s.title}`));
      if (rec.samples.length > 20) {
        lines.push(`  ... 还有 ${rec.samples.length - 20} 个样本`);
      }
    }

    return { output: lines.join('\n') };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Provide helpful fallback if network is unavailable
    return {
      output: `GEO 页面: https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${acc}`,
      error: `网络请求失败 (${msg})。请检查网络连接，或直接访问上方链接。`,
    };
  }
}
