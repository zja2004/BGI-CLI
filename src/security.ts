// ── Security Scanner ──────────────────────────────────────────────────────────
// Scans bash commands and SKILL.md files for dangerous/malicious patterns.

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ScanPattern {
  id: string;
  pattern: RegExp;
  level: RiskLevel;
  reason: string;
}

export interface ScanMatch {
  pattern: ScanPattern;
  matchedText: string;
}

export interface ScanResult {
  safe: boolean;           // false if any CRITICAL match found
  matches: ScanMatch[];
}

export interface SkillScanResult {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  matches: ScanMatch[];
}

// ── Pattern table ─────────────────────────────────────────────────────────────

const PATTERNS: ScanPattern[] = [
  // ── CRITICAL: always block ─────────────────────────────────────────────────
  {
    id: 'rm-root',
    pattern: /\brm\s+(-[rRf]{1,3}\s+)+\/\s*$/,
    level: 'CRITICAL',
    reason: '删除根目录 (rm -rf /)',
  },
  {
    id: 'rm-root-star',
    pattern: /\brm\s+(-[rRf]{1,3}\s+)+\/\*/,
    level: 'CRITICAL',
    reason: '删除根目录所有内容 (rm -rf /*)',
  },
  {
    id: 'rm-home',
    pattern: /\brm\s+(-[rRf]{1,3}\s+)+(~|\$HOME)\s*$/,
    level: 'CRITICAL',
    reason: '删除 home 目录 (rm -rf ~/)',
  },
  {
    id: 'fork-bomb',
    pattern: /:\(\)\s*\{[^}]*:\s*\|\s*:&[^}]*\}/,
    level: 'CRITICAL',
    reason: 'Fork bomb — 耗尽系统进程',
  },
  {
    id: 'dd-disk',
    pattern: /\bdd\s+.*if=\/dev\/(zero|random|urandom)\s+.*of=\/dev\/[a-z]/,
    level: 'CRITICAL',
    reason: '覆写磁盘设备 (dd if=/dev/zero of=/dev/sd*)',
  },
  {
    id: 'mkfs',
    pattern: /\bmkfs(\.[a-z0-9]+)?\s+\/dev\//,
    level: 'CRITICAL',
    reason: '格式化磁盘分区 (mkfs)',
  },
  {
    id: 'write-disk-raw',
    pattern: />\s*\/dev\/sd[a-z][0-9]?(?!\w)/,
    level: 'CRITICAL',
    reason: '直接写入裸磁盘设备',
  },
  {
    id: 'reverse-shell-bash',
    pattern: /bash\s+-i\s*>&?\s*\/dev\/tcp\//,
    level: 'CRITICAL',
    reason: 'bash 反弹 shell (bash -i >& /dev/tcp/)',
  },
  {
    id: 'reverse-shell-nc',
    pattern: /\bnc\s+.*-e\s+\/bin\/(ba)?sh/,
    level: 'CRITICAL',
    reason: 'netcat 反弹 shell (nc -e /bin/sh)',
  },

  // ── HIGH: warn user ────────────────────────────────────────────────────────
  {
    id: 'curl-pipe-exec',
    pattern: /curl\s+[^|]*\|\s*(ba)?sh/,
    level: 'HIGH',
    reason: 'curl 管道执行 — 远程代码注入风险',
  },
  {
    id: 'wget-pipe-exec',
    pattern: /wget\s+[^|]*\|\s*(ba)?sh/,
    level: 'HIGH',
    reason: 'wget 管道执行 — 远程代码注入风险',
  },
  {
    id: 'eval-base64',
    pattern: /\beval\s*[\(\$`].*base64/i,
    level: 'HIGH',
    reason: 'eval(base64) — 隐藏代码执行',
  },
  {
    id: 'python-exec-base64',
    pattern: /python[23]?\s+-c\s+["'].*exec\s*\(.*base64/i,
    level: 'HIGH',
    reason: 'Python exec(base64) — 隐藏代码执行',
  },
  {
    id: 'cred-aws',
    pattern: /\bAKID[A-Z0-9]{16,}\b|\bAKIA[0-9A-Z]{16}\b/,
    level: 'HIGH',
    reason: 'AWS/腾讯云 Access Key 疑似泄露',
  },
  {
    id: 'cred-private-key',
    pattern: /-----BEGIN\s+(RSA|EC|OPENSSH|DSA|ENCRYPTED)\s+PRIVATE KEY-----/,
    level: 'HIGH',
    reason: '私钥内容泄露',
  },
  {
    id: 'cred-gh-token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b|\bgho_[A-Za-z0-9]{36}\b/,
    level: 'HIGH',
    reason: 'GitHub Personal Access Token 泄露',
  },
  {
    id: 'env-exfil',
    pattern: /\benv\b[^|]*\|\s*(curl|wget|nc)\b/,
    level: 'HIGH',
    reason: '环境变量通过网络泄露',
  },
  {
    id: 'reverse-shell-python',
    pattern: /python[23]?\s+-c\s+["'].*socket.*connect.*subprocess/s,
    level: 'HIGH',
    reason: 'Python 反弹 shell',
  },

  // ── MEDIUM: warn, allow ────────────────────────────────────────────────────
  {
    id: 'chmod-777-r',
    pattern: /\bchmod\s+(-R\s+)?777\s+\//,
    level: 'MEDIUM',
    reason: '递归设置 777 权限（可能暴露系统文件）',
  },
  {
    id: 'setuid-bit',
    pattern: /\bchmod\s+[uo]\+s\b/,
    level: 'MEDIUM',
    reason: '设置 setuid/setgid 位',
  },
  {
    id: 'cron-modify',
    pattern: /\bcrontab\s+-[il]/,
    level: 'MEDIUM',
    reason: '修改 cron 定时任务',
  },
  {
    id: 'history-clear',
    pattern: /history\s+-[cw]|>\s*~\/\.bash_history/,
    level: 'MEDIUM',
    reason: '清除 shell 历史记录',
  },
  {
    id: 'iptables-flush',
    pattern: /\biptables\s+-F\b/,
    level: 'MEDIUM',
    reason: '清空防火墙规则 (iptables -F)',
  },

  // ── LOW: info only ─────────────────────────────────────────────────────────
  {
    id: 'curl-insecure',
    pattern: /\bcurl\s+.*(-k|--insecure)\b/,
    level: 'LOW',
    reason: 'curl 跳过 TLS 证书验证',
  },
  {
    id: 'wget-no-cert',
    pattern: /\bwget\s+.*--no-check-certificate\b/,
    level: 'LOW',
    reason: 'wget 跳过 TLS 证书验证',
  },
  {
    id: 'sudo-usage',
    pattern: /\bsudo\b/,
    level: 'LOW',
    reason: '使用 sudo 提权',
  },
  {
    id: 'nohup-background',
    pattern: /\bnohup\b.*&\s*$|\bdisown\b/,
    level: 'LOW',
    reason: '后台驻留进程',
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function scanCommand(command: string): ScanResult {
  const matches: ScanMatch[] = [];
  for (const pat of PATTERNS) {
    const m = command.match(pat.pattern);
    if (m) {
      matches.push({ pattern: pat, matchedText: m[0] });
    }
  }
  const safe = matches.every(m => m.pattern.level !== 'CRITICAL');
  return { safe, matches };
}

/** Extract bash code blocks from SKILL.md and scan each one. */
export function scanSkillMd(markdownContent: string): SkillScanResult {
  const bashBlocks = [...markdownContent.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)].map(m => m[1]);
  const allMatches: ScanMatch[] = [];
  for (const block of bashBlocks) {
    for (const line of block.split('\n')) {
      const r = scanCommand(line.trim());
      allMatches.push(...r.matches);
    }
  }
  return {
    criticalCount: allMatches.filter(m => m.pattern.level === 'CRITICAL').length,
    highCount: allMatches.filter(m => m.pattern.level === 'HIGH').length,
    mediumCount: allMatches.filter(m => m.pattern.level === 'MEDIUM').length,
    matches: allMatches,
  };
}
