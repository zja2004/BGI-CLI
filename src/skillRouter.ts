export interface SkillRoute {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  tag: 'workflow' | 'skill';
}

export const SKILL_CATEGORIES: Record<string, { label: string; icon: string }> = {
  '转录组':    { label: '转录组学 (Transcriptomics)',         icon: '🧬' },
  '单细胞':    { label: '单细胞组学 (Single Cell)',            icon: '🔬' },
  '基因组':    { label: '基因组学 (Genomics)',                  icon: '🧪' },
  '表观基因组': { label: '表观基因组 (Epigenomics)',             icon: '🔗' },
  '临床':      { label: '临床 / 流行病学 (Clinical)',            icon: '🏥' },
  '统计':      { label: '统计 / 生物统计 (Biostatistics)',       icon: '📊' },
  '分子生物学': { label: '分子生物学 (Molecular Biology)',       icon: '🧫' },
  '结构生物学': { label: '结构生物学 (Structural Biology)',      icon: '🏗' },
  '文献':      { label: '文献检索 (Literature)',                icon: '📚' },
  '药物':      { label: '药物发现 (Drug Discovery)',            icon: '💊' },
  '抗体':      { label: '抗体 / 免疫治疗 (Antibody & Cell Therapy)', icon: '🛡' },
};

// Routing table: maps skills to trigger keywords.
// Keywords should be specific enough to avoid false positives.
// Longer keywords score higher (score = keyword.length per match).
export const SKILL_ROUTES: SkillRoute[] = [
  // ── Transcriptomics ──────────────────────────────────────────────────────────
  {
    id: 'bulk-rnaseq-counts-to-de-deseq2', name: 'DESeq2 差异表达分析',
    category: '转录组', tag: 'workflow',
    keywords: [
      'deseq2', 'edger', 'rna-seq差异', 'rnaseq差异', '差异表达分析',
      '差异表达基因', 'count矩阵', 'count matrix', '原始counts', 'raw counts',
    ],
  },
  {
    id: 'bulk-omics-clustering', name: '样本 / 特征聚类',
    category: '转录组', tag: 'workflow',
    keywords: [
      'wgcna聚类', '层次聚类', 'hierarchical clustering', 'kmeans聚类',
      'hdbscan', '样本聚类', '特征聚类', 'omics clustering',
    ],
  },
  {
    id: 'scrnaseq-scanpy-core-analysis', name: 'scRNA-seq (Scanpy / Python)',
    category: '单细胞', tag: 'workflow',
    keywords: [
      'scanpy', 'scrna-seq', 'single cell rna', '单细胞rna测序',
      '10x chromium', 'leiden聚类', 'python单细胞', 'anndata分析',
    ],
  },
  {
    id: 'scrnaseq-seurat-core-analysis', name: 'scRNA-seq (Seurat / R)',
    category: '单细胞', tag: 'workflow',
    keywords: [
      'seurat', 'r语言单细胞', 'findclusters', 'findneighbors',
      'sctransform', 'r单细胞分析',
    ],
  },
  {
    id: 'spatial-transcriptomics', name: '空间转录组',
    category: '单细胞', tag: 'workflow',
    keywords: [
      '空间转录组', 'spatial transcriptomics', 'visium', '空间解卷积',
      'spatial deconvolution', '配体受体分析', '空间基因表达', 'stereo-seq',
    ],
  },
  {
    id: 'coexpression-network', name: 'WGCNA 共表达网络',
    category: '转录组', tag: 'workflow',
    keywords: [
      'wgcna', '共表达网络', 'coexpression network', '基因共表达模块',
      'weighted gene coexpression', '与表型相关的基因模块',
    ],
  },
  {
    id: 'functional-enrichment-from-degs', name: 'GO / KEGG / GSEA 富集分析',
    category: '转录组', tag: 'workflow',
    keywords: [
      '富集分析', 'go分析', 'kegg分析', 'gsea', '通路分析',
      'pathway enrichment', '基因本体', 'gene ontology', 'functional enrichment',
      '功能富集', 'deg富集', '差异基因通路',
    ],
  },
  {
    id: 'grn-pyscenic', name: 'pySCENIC 基因调控网络',
    category: '单细胞', tag: 'workflow',
    keywords: [
      'pyscenic', 'scenic', '基因调控网络', 'gene regulatory network',
      '转录因子调控子', 'tf regulon', 'grn推断',
    ],
  },

  // ── Genomics ──────────────────────────────────────────────────────────────────
  {
    id: 'genetic-variant-annotation', name: '遗传变异注释',
    category: '基因组', tag: 'workflow',
    keywords: [
      '变异注释', 'variant annotation', 'vcf注释', 'snv注释', 'indel注释',
      'vep注释', 'annovar', '变异致病性预测', '变异功能预测', 'clinvar注释',
    ],
  },
  {
    id: 'gwas-to-function-twas', name: 'GWAS → TWAS 功能解析',
    category: '基因组', tag: 'workflow',
    keywords: [
      'gwas分析', 'twas', 'predixcan', 'fusion分析', '全基因组关联分析',
      'genome-wide association', '因果基因鉴定', 'qtl整合',
    ],
  },
  {
    id: 'mendelian-randomization-twosamplemr', name: '孟德尔随机化 (MR)',
    category: '统计', tag: 'workflow',
    keywords: [
      '孟德尔随机化', 'mendelian randomization', 'twosamplemr',
      'mr因果推断', 'ivw方法', 'mr-egger', '双样本mr', '工具变量iv',
    ],
  },
  {
    id: 'polygenic-risk-score-prs-catalog', name: 'PRS 多基因风险评分',
    category: '基因组', tag: 'workflow',
    keywords: [
      'prs评分', 'polygenic risk score', '多基因风险评分',
      'prs-cs', '遗传风险预测', 'prs计算',
    ],
  },
  {
    id: 'pooled-crispr-screens', name: 'CRISPR 文库筛选 (MAGeCK/BAGEL2)',
    category: '基因组', tag: 'workflow',
    keywords: [
      'crispr文库筛选', 'crispr screen', 'mageck', 'bagel2',
      'sgrna筛选', 'pooled crispr', 'crispr hit识别',
    ],
  },

  // ── Epigenomics ───────────────────────────────────────────────────────────────
  {
    id: 'chip-atlas-peak-enrichment', name: 'ChIP-seq 峰值富集 (ChIP-Atlas)',
    category: '表观基因组', tag: 'workflow',
    keywords: [
      'chip-atlas', 'chip-seq峰值富集', 'peak enrichment chip',
      'chip atlas数据库', 'histone chip分析',
    ],
  },
  {
    id: 'chip-atlas-diff-analysis', name: 'ChIP-seq 差异结合分析',
    category: '表观基因组', tag: 'workflow',
    keywords: [
      'chip差异分析', 'differential binding', '差异chip-seq',
      'differential peak', 'chip-seq条件比较',
    ],
  },
  {
    id: 'chip-atlas-target-genes', name: 'ChIP-seq 靶基因鉴定',
    category: '表观基因组', tag: 'workflow',
    keywords: [
      'chip靶基因', 'chip target gene', '转录因子靶基因chip',
      'tf靶基因', 'peak annotation靶基因', 'chip-seq peak注释',
    ],
  },

  // ── Clinical ──────────────────────────────────────────────────────────────────
  {
    id: 'clinicaltrials-landscape', name: '临床试验格局分析',
    category: '临床', tag: 'workflow',
    keywords: [
      'clinicaltrials分析', 'clinical trial landscape', 'ct.gov数据分析',
      '临床试验格局', '临床研究分析',
    ],
  },
  {
    id: 'literature-preclinical', name: '临床前文献系统提取',
    category: '文献', tag: 'workflow',
    keywords: [
      '临床前文献', 'preclinical literature', '系统文献提取',
      'literature extraction', '文献系统综合',
    ],
  },
  {
    id: 'experimental-design-statistics', name: '实验设计与统计检验',
    category: '统计', tag: 'workflow',
    keywords: [
      '样本量计算', '统计检验选择', 'sample size calculation', 'power analysis功效',
      '随机化设计', '实验设计统计', '假设检验选择', 't检验还是', 'anova方差分析',
    ],
  },
  {
    id: 'lasso-biomarker-panel', name: 'LASSO 生物标志物面板筛选',
    category: '统计', tag: 'workflow',
    keywords: [
      'lasso回归筛选', 'lasso生物标志物', 'biomarker panel筛选',
      '最小标志物面板', 'feature selection lasso', '诊断标志物筛选',
    ],
  },
  {
    id: 'pcr-primer-design', name: 'PCR / qPCR 引物设计',
    category: '分子生物学', tag: 'workflow',
    keywords: [
      '引物设计', 'primer design', 'qpcr引物', 'pcr引物', 'primer3',
      'qrt-pcr设计', '扩增子设计', '引物特异性验证',
    ],
  },

  // ── OpenClaw Key Skills ────────────────────────────────────────────────────────
  {
    id: 'pubmed-search', name: 'PubMed 文献检索',
    category: '文献', tag: 'skill',
    keywords: [
      'pubmed检索', 'pubmed搜索', '文献检索', '论文搜索', '查找文献',
      '检索pubmed', 'pubmed文献',
    ],
  },
  {
    id: 'arxiv-search', name: 'arXiv 预印本检索',
    category: '文献', tag: 'skill',
    keywords: ['arxiv检索', 'arxiv搜索', '预印本检索', '预印本论文', 'arxiv文献'],
  },
  {
    id: 'alphafold', name: 'AlphaFold 蛋白质结构预测',
    category: '结构生物学', tag: 'skill',
    keywords: [
      'alphafold结构预测', 'alphafold运行', 'af2', 'af3',
      '蛋白质结构预测任务', '用alphafold预测',
    ],
  },
  {
    id: 'alphafold-database', name: 'AlphaFold 数据库查询',
    category: '结构生物学', tag: 'skill',
    keywords: [
      'alphafold数据库', 'alphafold db', 'uniprot结构查询',
      '蛋白质结构数据库', 'af数据库',
    ],
  },
  {
    id: 'bindcraft', name: 'BindCraft 蛋白质结合体设计',
    category: '结构生物学', tag: 'skill',
    keywords: [
      'bindcraft', '结合体设计', 'binder design', 'protein binder',
      '蛋白质结合物设计', 'de novo binder',
    ],
  },
  {
    id: 'anndata', name: 'AnnData 单细胞数据操作',
    category: '单细胞', tag: 'skill',
    keywords: [
      'anndata操作', 'h5ad文件处理', 'adata子集', 'anndata格式',
      '单细胞h5ad', 'obs var layers',
    ],
  },
  {
    id: 'cellagent-annotation', name: 'CellAgent 细胞类型自动注释',
    category: '单细胞', tag: 'skill',
    keywords: [
      '细胞类型注释', 'cell type annotation', 'cellagent', '自动细胞注释',
      '细胞注释自动化', '单细胞注释',
    ],
  },
  {
    id: 'scvi-tools', name: 'scVI 单细胞深度学习',
    category: '单细胞', tag: 'skill',
    keywords: [
      'scvi-tools', 'scvi模型', '单细胞变分推断', 'batch correction scvi',
      'totalvi', 'scvi批次矫正',
    ],
  },
  {
    id: 'agentd-drug-discovery', name: '药物发现 Agent',
    category: '药物', tag: 'skill',
    keywords: [
      '药物发现流程', 'drug discovery', '候选药物筛选', '先导化合物',
      'hit化合物', '药物靶点发现',
    ],
  },
  {
    id: 'chembl-database', name: 'ChEMBL 化合物活性数据库',
    category: '药物', tag: 'skill',
    keywords: [
      'chembl查询', 'chembl数据库', '化合物活性数据', 'bioactivity数据',
      'chembl化合物', '靶点活性化合物',
    ],
  },
  {
    id: 'rdkit', name: 'RDKit 化学信息学',
    category: '药物', tag: 'skill',
    keywords: [
      'rdkit', '化学信息学', 'cheminformatics', '分子描述符计算',
      '分子相似度', 'smiles分子操作', '化学结构处理',
    ],
  },
  {
    id: 'bio-variant-calling', name: '变异检测流程 (GATK/Mutect2)',
    category: '基因组', tag: 'skill',
    keywords: [
      '变异检测流程', 'variant calling流程', 'somatic变异检测',
      '体细胞突变检测', 'mutect2', 'gatk变异检测', '肿瘤变异检测',
    ],
  },
  {
    id: 'antibody-design-agent', name: '抗体设计 Agent',
    category: '抗体', tag: 'skill',
    keywords: [
      '抗体设计', 'antibody design', '抗体优化', 'cdr设计',
      '单克隆抗体设计', '抗体工程改造',
    ],
  },
  {
    id: 'armored-cart-design-agent', name: 'Armored CAR-T 设计',
    category: '抗体', tag: 'skill',
    keywords: [
      'car-t设计', 'cart细胞设计', '嵌合抗原受体设计',
      'chimeric antigen receptor', 'armored cart', '免疫细胞治疗设计',
    ],
  },
];

/** Score-based skill routing. Returns top matches sorted by relevance score. */
export function routeSkill(
  message: string,
): { routes: SkillRoute[]; topScore: number } {
  const lower = message.toLowerCase();
  const scores = new Map<string, { route: SkillRoute; score: number }>();

  for (const route of SKILL_ROUTES) {
    let score = 0;
    for (const kw of route.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > 0) scores.set(route.id, { route, score });
  }

  const sorted = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    routes: sorted.map((v) => v.route),
    topScore: sorted[0]?.score ?? 0,
  };
}
