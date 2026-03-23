// ── Bioinformatics Database Registry ─────────────────────────────────────────
// Persistent storage of reference genome / annotation / index paths.
// Stored in ~/.bgicli/databases.json

import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, resolve, basename } from 'path';
import { homedir } from 'os';
import { DATABASES_FILE, BGI_DIR } from './config.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbType =
  | 'fasta' | 'gtf' | 'gff3' | 'vcf' | 'bed'
  | 'star_index' | 'hisat2_index' | 'bwa_index' | 'bowtie2_index' | 'salmon_index'
  | 'kraken2_db' | 'diamond_db' | 'blast_db'
  | 'other';

export type DbSource = 'manual' | 'scan';

export interface DatabaseEntry {
  id: string;          // unique slug, e.g. "hg38-fasta"
  label: string;       // human-readable name
  type: DbType;
  genome: string;      // "hg38" | "hg19" | "mm10" | "GRCh38" | "other" | ...
  path: string;        // absolute path
  sizeBytes?: number;
  addedAt: string;     // ISO timestamp
  source: DbSource;
  notes?: string;
}

export interface DatabaseRegistry {
  version: 1;
  lastScan: string | null;
  databases: Record<string, DatabaseEntry>;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function loadDbRegistry(): DatabaseRegistry {
  if (!existsSync(DATABASES_FILE)) {
    return { version: 1, lastScan: null, databases: {} };
  }
  try {
    return JSON.parse(readFileSync(DATABASES_FILE, 'utf8')) as DatabaseRegistry;
  } catch {
    return { version: 1, lastScan: null, databases: {} };
  }
}

export function saveDbRegistry(registry: DatabaseRegistry): void {
  writeFileSync(DATABASES_FILE, JSON.stringify(registry, null, 2), 'utf8');
}

export function addDbEntry(registry: DatabaseRegistry, entry: Omit<DatabaseEntry, 'addedAt' | 'id'> & { id?: string }): DatabaseEntry {
  const id = entry.id ?? slugify(`${entry.genome}-${entry.type}-${Date.now()}`);
  const full: DatabaseEntry = { ...entry, id, addedAt: new Date().toISOString() } as DatabaseEntry;
  registry.databases[id] = full;
  return full;
}

export function removeDbEntry(registry: DatabaseRegistry, id: string): boolean {
  if (!registry.databases[id]) return false;
  delete registry.databases[id];
  return true;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Auto-scan ─────────────────────────────────────────────────────────────────

// Known filename patterns → {type, genome}
interface FilePattern {
  regex: RegExp;
  type: DbType;
  genome?: string;
}

const FILE_PATTERNS: FilePattern[] = [
  // Reference FASTA
  { regex: /\bhg38\b.*\.f(ast)?a(\.gz)?$/i,       type: 'fasta', genome: 'hg38' },
  { regex: /\bGRCh38\b.*\.f(ast)?a(\.gz)?$/i,     type: 'fasta', genome: 'hg38' },
  { regex: /\bhg19\b.*\.f(ast)?a(\.gz)?$/i,        type: 'fasta', genome: 'hg19' },
  { regex: /\bGRCh37\b.*\.f(ast)?a(\.gz)?$/i,     type: 'fasta', genome: 'hg19' },
  { regex: /\bmm10\b.*\.f(ast)?a(\.gz)?$/i,        type: 'fasta', genome: 'mm10' },
  { regex: /\bGRCm38\b.*\.f(ast)?a(\.gz)?$/i,     type: 'fasta', genome: 'mm10' },
  { regex: /\bmm39\b.*\.f(ast)?a(\.gz)?$/i,        type: 'fasta', genome: 'mm39' },
  { regex: /\bGRCm39\b.*\.f(ast)?a(\.gz)?$/i,     type: 'fasta', genome: 'mm39' },
  { regex: /\.f(ast)?a(\.gz)?$/i,                  type: 'fasta', genome: 'other' },
  // GTF / GFF
  { regex: /\bhg38\b.*\.gtf(\.gz)?$/i,             type: 'gtf',   genome: 'hg38' },
  { regex: /\bGRCh38\b.*\.gtf(\.gz)?$/i,           type: 'gtf',   genome: 'hg38' },
  { regex: /\bhg19\b.*\.gtf(\.gz)?$/i,             type: 'gtf',   genome: 'hg19' },
  { regex: /\bmm10\b.*\.gtf(\.gz)?$/i,             type: 'gtf',   genome: 'mm10' },
  { regex: /\.gtf(\.gz)?$/i,                       type: 'gtf',   genome: 'other' },
  { regex: /\.gff3?(\.gz)?$/i,                     type: 'gff3',  genome: 'other' },
  // VCF databases
  { regex: /dbsnp.*\.vcf(\.gz)?$/i,                type: 'vcf',   genome: 'hg38' },
  { regex: /clinvar.*\.vcf(\.gz)?$/i,              type: 'vcf',   genome: 'hg38' },
  { regex: /gnomad.*\.vcf(\.gz)?$/i,               type: 'vcf',   genome: 'hg38' },
  { regex: /mills.*\.vcf(\.gz)?$/i,                type: 'vcf',   genome: 'hg38' },
  { regex: /1000G.*\.vcf(\.gz)?$/i,                type: 'vcf',   genome: 'hg38' },
  { regex: /hapmap.*\.vcf(\.gz)?$/i,               type: 'vcf',   genome: 'hg38' },
  // BED
  { regex: /\.(bed|bed\.gz)$/i,                    type: 'bed',   genome: 'other' },
];

// Directory patterns for index types
interface DirPattern { regex: RegExp; type: DbType; indicator?: string }
const DIR_PATTERNS: DirPattern[] = [
  { regex: /star.*index|star_genome/i,             type: 'star_index',     indicator: 'Genome.sjdbInfo.txt' },
  { regex: /hisat2.*index/i,                       type: 'hisat2_index',   indicator: '.ht2' },
  { regex: /salmon.*index/i,                       type: 'salmon_index',   indicator: 'info.json' },
  { regex: /kraken2?/i,                            type: 'kraken2_db',     indicator: 'hash.k2d' },
  { regex: /diamond/i,                             type: 'diamond_db',     indicator: '.dmnd' },
  { regex: /blast_db|blastdb/i,                    type: 'blast_db',       indicator: '.nsq' },
];

// Default search roots
function defaultSearchRoots(): string[] {
  const home = homedir();
  const roots = [
    '/data', '/ref', '/reference', '/genomes', '/databases', '/db',
    '/lustre', '/GPFS', '/scratch', '/work', '/shared',
    join(home, 'databases'), join(home, 'data'), join(home, 'reference'),
    join(home, 'ref'), process.cwd(),
  ];
  return roots.filter(r => existsSync(r));
}

function getFileSize(path: string): number | undefined {
  try { return statSync(path).size; } catch { return undefined; }
}

function detectGenomeFromPath(path: string): string {
  const p = path.toLowerCase();
  if (p.includes('hg38') || p.includes('grch38')) return 'hg38';
  if (p.includes('hg19') || p.includes('grch37') || p.includes('b37')) return 'hg19';
  if (p.includes('mm10') || p.includes('grcm38')) return 'mm10';
  if (p.includes('mm39') || p.includes('grcm39')) return 'mm39';
  if (p.includes('rn7')) return 'rn7';
  if (p.includes('dm6')) return 'dm6';
  if (p.includes('danrer')) return 'danRer11';
  return 'other';
}

function labelFor(type: DbType, genome: string, name: string): string {
  const typeLabels: Record<DbType, string> = {
    fasta: '参考基因组 FASTA', gtf: '基因注释 GTF', gff3: '基因注释 GFF3',
    vcf: 'VCF 变异数据库', bed: 'BED 区域文件',
    star_index: 'STAR 比对索引', hisat2_index: 'HISAT2 比对索引',
    bwa_index: 'BWA 比对索引', bowtie2_index: 'Bowtie2 比对索引',
    salmon_index: 'Salmon 定量索引', kraken2_db: 'Kraken2 宏基因组库',
    diamond_db: 'DIAMOND 蛋白库', blast_db: 'BLAST 数据库', other: '数据库',
  };
  const genomeLabel = genome !== 'other' ? ` (${genome})` : '';
  return `${typeLabels[type]}${genomeLabel} — ${name}`;
}

export interface ScanReport {
  found: DatabaseEntry[];
  skippedDirs: number;
}

export function scanForDatabases(extraRoots: string[] = []): ScanReport {
  const roots = [...defaultSearchRoots(), ...extraRoots.map(r => resolve(r))];
  const found: DatabaseEntry[] = [];
  const seen = new Set<string>();
  let skippedDirs = 0;

  function walk(dir: string, depth: number): void {
    if (depth > 4) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { skippedDirs++; return; }

    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const fullPath = join(dir, name);
      let stat;
      try { stat = statSync(fullPath); } catch { continue; }

      if (stat.isDirectory()) {
        // Check if this directory is an index
        for (const dp of DIR_PATTERNS) {
          if (dp.regex.test(name)) {
            // Verify by indicator file if specified
            if (!dp.indicator || readdirSync(fullPath).some(f => f.endsWith(dp.indicator!))) {
              const genome = detectGenomeFromPath(fullPath);
              const id = slugify(`${genome}-${dp.type}-${basename(fullPath)}`);
              if (!seen.has(fullPath)) {
                seen.add(fullPath);
                found.push({
                  id, genome, type: dp.type, path: fullPath,
                  label: labelFor(dp.type, genome, name),
                  addedAt: new Date().toISOString(), source: 'scan',
                });
              }
              break; // matched a dir pattern, don't recurse into it
            }
          }
        }
        // Also check for bwa index (files inside dir)
        if (!DIR_PATTERNS.some(dp => dp.regex.test(name))) {
          try {
            const sub = readdirSync(fullPath);
            if (sub.some(f => f.endsWith('.bwt')) && sub.some(f => f.endsWith('.ann'))) {
              const genome = detectGenomeFromPath(fullPath);
              const id = slugify(`${genome}-bwa_index-${basename(fullPath)}`);
              if (!seen.has(fullPath)) {
                seen.add(fullPath);
                found.push({ id, genome, type: 'bwa_index', path: fullPath, label: labelFor('bwa_index', genome, name), addedAt: new Date().toISOString(), source: 'scan' });
              }
            }
          } catch { /* ignore */ }
          walk(fullPath, depth + 1);
        }
      } else if (stat.isFile()) {
        for (const fp of FILE_PATTERNS) {
          if (fp.regex.test(name)) {
            const genome = fp.genome === 'other' ? detectGenomeFromPath(fullPath) : fp.genome!;
            const id = slugify(`${genome}-${fp.type}-${name.replace(/\.gz$/, '').replace(/\.[^.]+$/, '')}`);
            if (!seen.has(fullPath)) {
              seen.add(fullPath);
              found.push({
                id, genome, type: fp.type, path: fullPath,
                label: labelFor(fp.type, genome, name),
                sizeBytes: stat.size,
                addedAt: new Date().toISOString(), source: 'scan',
              });
            }
            break;
          }
        }
      }
    }
  }

  for (const root of new Set(roots)) {
    walk(root, 0);
  }

  return { found, skippedDirs };
}

// ── System prompt section ─────────────────────────────────────────────────────

export function buildDbPromptSection(registry: DatabaseRegistry): string {
  const entries = Object.values(registry.databases);
  if (entries.length === 0) {
    return '（暂未注册任何数据库。使用 /db scan 自动扫描，或 /db add <路径> 手动添加）';
  }

  // Group by genome
  const byGenome: Record<string, DatabaseEntry[]> = {};
  for (const e of entries) {
    (byGenome[e.genome] ??= []).push(e);
  }

  const lines: string[] = [];
  for (const [genome, dbs] of Object.entries(byGenome).sort()) {
    lines.push(`### ${genome}`);
    for (const db of dbs.sort((a, b) => a.type.localeCompare(b.type))) {
      const exists = existsSync(db.path) ? '' : ' ⚠(路径不存在)';
      const size = db.sizeBytes ? ` [${(db.sizeBytes / 1e9).toFixed(1)}GB]` : '';
      lines.push(`- **${db.label}** (\`${db.type}\`): \`${db.path}\`${size}${exists}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

// ── Download instructions ─────────────────────────────────────────────────────

export const DOWNLOAD_GUIDES: Record<string, { label: string; cmds: string[] }> = {
  'hg38-fasta': {
    label: 'GRCh38 参考基因组 (UCSC)',
    cmds: [
      'wget https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.fa.gz',
      'gunzip hg38.fa.gz && samtools faidx hg38.fa',
    ],
  },
  'hg19-fasta': {
    label: 'GRCh37/hg19 参考基因组 (UCSC)',
    cmds: [
      'wget https://hgdownload.soe.ucsc.edu/goldenPath/hg19/bigZips/hg19.fa.gz',
      'gunzip hg19.fa.gz && samtools faidx hg19.fa',
    ],
  },
  'mm10-fasta': {
    label: 'GRCm38/mm10 参考基因组 (UCSC)',
    cmds: ['wget https://hgdownload.soe.ucsc.edu/goldenPath/mm10/bigZips/mm10.fa.gz'],
  },
  'hg38-gtf': {
    label: 'Ensembl hg38 基因注释 GTF',
    cmds: ['wget https://ftp.ensembl.org/pub/release-110/gtf/homo_sapiens/Homo_sapiens.GRCh38.110.gtf.gz'],
  },
  'hg38-dbsnp': {
    label: 'dbSNP b156 VCF (hg38)',
    cmds: ['wget https://ftp.ncbi.nlm.nih.gov/snp/latest_release/VCF/GCF_000001405.40.gz'],
  },
  'hg38-clinvar': {
    label: 'ClinVar VCF (hg38)',
    cmds: ['wget https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz'],
  },
  'hg38-gnomad': {
    label: 'gnomAD v4 sites VCF (hg38)',
    cmds: ['# See https://gnomad.broadinstitute.org/downloads for latest URLs'],
  },
};
