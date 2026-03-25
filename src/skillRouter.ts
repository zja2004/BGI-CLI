export interface SkillRoute {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  tag: 'builtin' | 'user';
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
// Scoring: each matched keyword contributes (1 + keyword.length * 0.1) points,
// so longer/more-specific keywords score higher, but multiple short matches
// can still beat a single long match. Top-5 results are returned to support
// multi-skill tasks (e.g. "先做差异表达，再做富集分析").
export const SKILL_ROUTES: SkillRoute[] = [
  // ── Transcriptomics ──────────────────────────────────────────────────────────
  {
    id: 'bulk-rnaseq-counts-to-de-deseq2', name: 'DESeq2 差异表达分析',
    category: '转录组', tag: 'builtin',
    keywords: [
      // exact tool names
      'deseq2', 'edger', 'limma-voom',
      // explicit analysis terms
      'rna-seq差异', 'rnaseq差异', '差异表达分析', '差异表达基因',
      'count矩阵', 'count matrix', '原始counts', 'raw counts',
      // natural-language synonyms (the main gap in the original)
      '哪些基因表达量高', '哪些基因上调', '哪些基因下调',
      '基因表达差异', '转录组差异', '表达量差异',
      '上调基因', '下调基因', 'deg分析', 'differentially expressed',
      '差异分析', '比较两组基因表达', '肿瘤vs正常',
    ],
  },
  {
    id: 'bulk-omics-clustering', name: '样本 / 特征聚类',
    category: '转录组', tag: 'builtin',
    keywords: [
      'wgcna聚类', '层次聚类', 'hierarchical clustering', 'kmeans聚类',
      'hdbscan', '样本聚类', '特征聚类', 'omics clustering',
      // natural-language synonyms
      '样本分组', '样本分类', '聚类分析', '无监督聚类',
      '热图聚类', 'pca分析', '主成分分析', 'umap降维',
    ],
  },
  {
    id: 'scrnaseq-scanpy-core-analysis', name: 'scRNA-seq (Scanpy / Python)',
    category: '单细胞', tag: 'builtin',
    keywords: [
      'scanpy', 'scrna-seq', 'single cell rna', '单细胞rna测序',
      '10x chromium', 'leiden聚类', 'python单细胞', 'anndata分析',
      // natural-language synonyms
      '单细胞测序', '单细胞分析', '单细胞数据', '10x数据',
      '细胞聚类', '细胞类型鉴定', 'scrna', 'sc-rna',
    ],
  },
  {
    id: 'scrnaseq-seurat-core-analysis', name: 'scRNA-seq (Seurat / R)',
    category: '单细胞', tag: 'builtin',
    keywords: [
      'seurat', 'r语言单细胞', 'findclusters', 'findneighbors',
      'sctransform', 'r单细胞分析',
      // natural-language synonyms
      'r做单细胞', 'seurat分析', '用r分析单细胞',
    ],
  },
  {
    id: 'spatial-transcriptomics', name: '空间转录组',
    category: '单细胞', tag: 'builtin',
    keywords: [
      '空间转录组', 'spatial transcriptomics', 'visium', '空间解卷积',
      'spatial deconvolution', '配体受体分析', '空间基因表达', 'stereo-seq',
      // natural-language synonyms
      '空间组学', '组织切片测序', '空间分辨率转录组',
      '细胞空间分布', '空间单细胞',
    ],
  },
  {
    id: 'coexpression-network', name: 'WGCNA 共表达网络',
    category: '转录组', tag: 'builtin',
    keywords: [
      'wgcna', '共表达网络', 'coexpression network', '基因共表达模块',
      'weighted gene coexpression', '与表型相关的基因模块',
      // natural-language synonyms
      '基因模块', '共表达', '基因网络', '基因相关性网络',
    ],
  },
  {
    id: 'functional-enrichment-from-degs', name: 'GO / KEGG / GSEA 富集分析',
    category: '转录组', tag: 'builtin',
    keywords: [
      '富集分析', 'go分析', 'kegg分析', 'gsea', '通路分析',
      'pathway enrichment', '基因本体', 'gene ontology', 'functional enrichment',
      '功能富集', 'deg富集', '差异基因通路',
      // natural-language synonyms
      '这些基因参与什么通路', '基因功能注释', '信号通路',
      '生物学过程', '分子功能', '细胞组分', 'go富集',
      '通路富集', '基因集分析', 'ora分析', 'gsea分析',
      // mutation → pathway → phenotype
      '突变通路', '突变影响通路', '突变下游通路', '桑基图通路',
      'kras通路', 'ras-raf-mek通路', 'mapk通路', 'pi3k通路',
      '肺癌通路', '驱动基因通路', '信号通路富集',
    ],
  },
  {
    id: 'grn-pyscenic', name: 'pySCENIC 基因调控网络',
    category: '单细胞', tag: 'builtin',
    keywords: [
      'pyscenic', 'scenic', '基因调控网络', 'gene regulatory network',
      '转录因子调控子', 'tf regulon', 'grn推断',
      // natural-language synonyms
      '转录因子分析', '转录因子靶基因', 'tf活性', '调控网络推断',
    ],
  },

  // ── Genomics ──────────────────────────────────────────────────────────────────
  {
    id: 'genetic-variant-annotation', name: '遗传变异注释',
    category: '基因组', tag: 'builtin',
    keywords: [
      '变异注释', 'variant annotation', 'vcf注释', 'snv注释', 'indel注释',
      'vep注释', 'annovar', '变异致病性预测', '变异功能预测', 'clinvar注释',
      // natural-language synonyms
      '突变注释', '变异解读', 'vcf文件分析', '遗传变异解析',
      '致病性评估', '变异影响预测',
      // specific oncology mutations (KRAS/EGFR/ALK etc.)
      'kras突变', 'kras g12c', 'kras g12d', 'kras g12v', 'kras mutation',
      'egfr突变', 'egfr l858r', 'egfr外显子19缺失',
      'alk融合', 'braf v600e', 'tp53突变', 'pik3ca突变',
      // cancer contexts
      'nsclc突变', '肺癌突变', '非小细胞肺癌突变', '肺腺癌突变',
      '肿瘤体细胞突变', '驱动基因突变', '癌症驱动突变',
      // mutation landscape
      '突变频率', '跨癌种突变', '突变热图', '突变景观图', '瀑布图突变',
      'mutation landscape', 'oncoprint',
    ],
  },
  {
    id: 'gwas-to-function-twas', name: 'GWAS → TWAS 功能解析',
    category: '基因组', tag: 'builtin',
    keywords: [
      'gwas分析', 'twas', 'predixcan', 'fusion分析', '全基因组关联分析',
      'genome-wide association', '因果基因鉴定', 'qtl整合',
      // natural-language synonyms
      'gwas结果解读', 'gwas功能注释', '关联位点基因',
      'snp功能', 'gwas信号', '遗传关联分析',
    ],
  },
  {
    id: 'mendelian-randomization-twosamplemr', name: '孟德尔随机化 (MR)',
    category: '统计', tag: 'builtin',
    keywords: [
      '孟德尔随机化', 'mendelian randomization', 'twosamplemr',
      'mr因果推断', 'ivw方法', 'mr-egger', '双样本mr', '工具变量iv',
      // natural-language synonyms
      '因果推断', '暴露与结局', '遗传工具变量', 'mr分析',
    ],
  },
  {
    id: 'polygenic-risk-score-prs-catalog', name: 'PRS 多基因风险评分',
    category: '基因组', tag: 'builtin',
    keywords: [
      'prs评分', 'polygenic risk score', '多基因风险评分',
      'prs-cs', '遗传风险预测', 'prs计算',
      // natural-language synonyms
      '遗传风险评分', '多基因评分', '疾病遗传风险',
    ],
  },
  {
    id: 'pooled-crispr-screens', name: 'CRISPR 文库筛选 (MAGeCK/BAGEL2)',
    category: '基因组', tag: 'builtin',
    keywords: [
      'crispr文库筛选', 'crispr screen', 'mageck', 'bagel2',
      'sgrna筛选', 'pooled crispr', 'crispr hit识别',
      // natural-language synonyms
      'crispr筛选', '功能基因组筛选', '必需基因筛选',
      'crispr敲除筛选', 'crispr文库',
    ],
  },

  // ── Epigenomics ───────────────────────────────────────────────────────────────
  {
    id: 'chip-atlas-peak-enrichment', name: 'ChIP-seq 峰值富集 (ChIP-Atlas)',
    category: '表观基因组', tag: 'builtin',
    keywords: [
      'chip-atlas', 'chip-seq峰值富集', 'peak enrichment chip',
      'chip atlas数据库', 'histone chip分析',
      // natural-language synonyms
      'chip-seq分析', 'chip数据', '组蛋白修饰', 'h3k27ac', 'h3k4me3',
    ],
  },
  {
    id: 'chip-atlas-diff-analysis', name: 'ChIP-seq 差异结合分析',
    category: '表观基因组', tag: 'builtin',
    keywords: [
      'chip差异分析', 'differential binding', '差异chip-seq',
      'differential peak', 'chip-seq条件比较',
      // natural-language synonyms
      '差异峰', '差异结合位点', 'chip-seq差异',
    ],
  },
  {
    id: 'chip-atlas-target-genes', name: 'ChIP-seq 靶基因鉴定',
    category: '表观基因组', tag: 'builtin',
    keywords: [
      'chip靶基因', 'chip target gene', '转录因子靶基因chip',
      'tf靶基因', 'peak annotation靶基因', 'chip-seq peak注释',
      // natural-language synonyms
      'peak注释', '峰值注释', '转录因子结合位点', 'chip靶点',
    ],
  },

  // ── Clinical ──────────────────────────────────────────────────────────────────
  {
    id: 'clinicaltrials-landscape', name: '临床试验格局分析',
    category: '临床', tag: 'builtin',
    keywords: [
      'clinicaltrials分析', 'clinical trial landscape', 'ct.gov数据分析',
      '临床试验格局', '临床研究分析',
      // natural-language synonyms
      '临床试验', '在研药物', '临床管线', '临床研究现状',
    ],
  },
  {
    id: 'literature-preclinical', name: '临床前文献系统提取',
    category: '文献', tag: 'builtin',
    keywords: [
      '临床前文献', 'preclinical literature', '系统文献提取',
      'literature extraction', '文献系统综合',
      // natural-language synonyms
      '文献综述', '系统综述', '文献整理', '文献挖掘',
    ],
  },
  {
    id: 'experimental-design-statistics', name: '实验设计与统计检验',
    category: '统计', tag: 'builtin',
    keywords: [
      '样本量计算', '统计检验选择', 'sample size calculation', 'power analysis功效',
      '随机化设计', '实验设计统计', '假设检验选择', 't检验还是', 'anova方差分析',
      // natural-language synonyms
      '用什么统计方法', '统计显著性', '检验方法', '需要多少样本',
      '功效分析', '统计功效', 'p值', '显著性检验',
    ],
  },
  {
    id: 'lasso-biomarker-panel', name: 'LASSO 生物标志物面板筛选',
    category: '统计', tag: 'builtin',
    keywords: [
      'lasso回归筛选', 'lasso生物标志物', 'biomarker panel筛选',
      '最小标志物面板', 'feature selection lasso', '诊断标志物筛选',
      // natural-language synonyms
      '生物标志物筛选', '标志物组合', '诊断模型', '预测模型特征筛选',
      'biomarker', '特征选择',
    ],
  },
  {
    id: 'pcr-primer-design', name: 'PCR / qPCR 引物设计',
    category: '分子生物学', tag: 'builtin',
    keywords: [
      '引物设计', 'primer design', 'qpcr引物', 'pcr引物', 'primer3',
      'qrt-pcr设计', '扩增子设计', '引物特异性验证',
      // natural-language synonyms
      '设计引物', '扩增引物', 'rt-pcr引物', '定量pcr',
    ],
  },

  // ── Survival Analysis ─────────────────────────────────────────────────────────
  {
    id: 'survival-analysis-clinical', name: '临床生存分析 (KM + Cox)',
    category: '临床', tag: 'builtin',
    keywords: [
      // exact method names
      'kaplan-meier', 'kaplan meier', 'km曲线', 'cox回归', 'cox regression',
      '生存分析', 'survival analysis', '生存曲线', 'log-rank',
      // outcome types
      '总生存期', 'overall survival', 'os分析',
      '无进展生存', 'progression-free survival', 'pfs分析',
      '无病生存', 'disease-free survival', 'dfs分析',
      '复发生存', 'relapse-free survival', 'rfs分析',
      // natural-language synonyms
      '患者预后', '预后分析', '生存预后', '临床预后',
      '删失数据', '右删失', 'censored data',
      '风险比', 'hazard ratio', 'hr值',
      '竞争风险', 'competing risk', 'fine-gray',
      '中位生存时间', '5年生存率', '3年生存率',
      '高表达预后差', '基因表达与预后', '突变与预后',
    ],
  },

  // ── Extended Skills (key routable entries) ───────────────────────────────────
  {
    id: 'pubmed-search', name: 'PubMed 文献检索',
    category: '文献', tag: 'builtin',
    keywords: [
      'pubmed检索', 'pubmed搜索', '文献检索', '论文搜索', '查找文献',
      '检索pubmed', 'pubmed文献',
    ],
  },
  {
    id: 'arxiv-search', name: 'arXiv 预印本检索',
    category: '文献', tag: 'builtin',
    keywords: ['arxiv检索', 'arxiv搜索', '预印本检索', '预印本论文', 'arxiv文献'],
  },
  {
    id: 'alphafold', name: 'AlphaFold 蛋白质结构预测',
    category: '结构生物学', tag: 'builtin',
    keywords: [
      'alphafold结构预测', 'alphafold运行', 'af2', 'af3',
      '蛋白质结构预测任务', '用alphafold预测',
    ],
  },
  {
    id: 'alphafold-database', name: 'AlphaFold 数据库查询',
    category: '结构生物学', tag: 'builtin',
    keywords: [
      'alphafold数据库', 'alphafold db', 'uniprot结构查询',
      '蛋白质结构数据库', 'af数据库',
    ],
  },
  {
    id: 'bindcraft', name: 'BindCraft 蛋白质结合体设计',
    category: '结构生物学', tag: 'builtin',
    keywords: [
      'bindcraft', '结合体设计', 'binder design', 'protein binder',
      '蛋白质结合物设计', 'de novo binder',
    ],
  },
  {
    id: 'anndata', name: 'AnnData 单细胞数据操作',
    category: '单细胞', tag: 'builtin',
    keywords: [
      'anndata操作', 'h5ad文件处理', 'adata子集', 'anndata格式',
      '单细胞h5ad', 'obs var layers',
    ],
  },
  {
    id: 'cellagent-annotation', name: 'CellAgent 细胞类型自动注释',
    category: '单细胞', tag: 'builtin',
    keywords: [
      '细胞类型注释', 'cell type annotation', 'cellagent', '自动细胞注释',
      '细胞注释自动化', '单细胞注释',
    ],
  },
  {
    id: 'scvi-tools', name: 'scVI 单细胞深度学习',
    category: '单细胞', tag: 'builtin',
    keywords: [
      'scvi-tools', 'scvi模型', '单细胞变分推断', 'batch correction scvi',
      'totalvi', 'scvi批次矫正',
    ],
  },
  {
    id: 'agentd-drug-discovery', name: '药物发现 Agent',
    category: '药物', tag: 'builtin',
    keywords: [
      '药物发现流程', 'drug discovery', '候选药物筛选', '先导化合物',
      'hit化合物', '药物靶点发现',
      // drug target analysis
      '靶点评估', '靶点可视化', '靶点报告', '靶点分析', '靶点可成药性',
      'druggability', '可成药性评估', '靶点综合评分',
      'target visualization', 'drug target report', 'target assessment',
      // specific target contexts
      'kras靶点', 'kras可成药性', 'kras抑制剂', 'kras突变靶点',
      'egfr靶点', 'alk靶点', 'braf靶点', 'her2靶点', 'met靶点',
      // visualization types for target reports
      '雷达图评分', '气泡图靶点', '桑基图突变通路', '靶点热图',
      // natural-language synonyms
      '哪些靶点值得开发', '靶点优先级', '靶点成药性分析',
      '靶向治疗靶点', '精准医学靶点',
    ],
  },
  {
    id: 'chembl-database', name: 'ChEMBL 化合物活性数据库',
    category: '药物', tag: 'builtin',
    keywords: [
      'chembl查询', 'chembl数据库', '化合物活性数据', 'bioactivity数据',
      'chembl化合物', '靶点活性化合物',
    ],
  },
  {
    id: 'rdkit', name: 'RDKit 化学信息学',
    category: '药物', tag: 'builtin',
    keywords: [
      'rdkit', '化学信息学', 'cheminformatics', '分子描述符计算',
      '分子相似度', 'smiles分子操作', '化学结构处理',
    ],
  },
  {
    id: 'bio-variant-calling', name: '变异检测流程 (GATK/Mutect2)',
    category: '基因组', tag: 'builtin',
    keywords: [
      '变异检测流程', 'variant calling流程', 'somatic变异检测',
      '体细胞突变检测', 'mutect2', 'gatk变异检测', '肿瘤变异检测',
    ],
  },
  {
    id: 'antibody-design-agent', name: '抗体设计 Agent',
    category: '抗体', tag: 'builtin',
    keywords: [
      '抗体设计', 'antibody design', '抗体优化', 'cdr设计',
      '单克隆抗体设计', '抗体工程改造',
    ],
  },
  {
    id: 'armored-cart-design-agent', name: 'Armored CAR-T 设计',
    category: '抗体', tag: 'builtin',
    keywords: [
      'car-t设计', 'cart细胞设计', '嵌合抗原受体设计',
      'chimeric antigen receptor', 'armored cart', '免疫细胞治疗设计',
    ],
  },
];

/**
 * Score-based skill routing. Returns top-5 matches sorted by relevance score.
 *
 * Scoring formula: each matched keyword contributes (1 + keyword.length * 0.1).
 * This means:
 *   - A 3-char keyword  scores 1.3 per match
 *   - A 10-char keyword scores 2.0 per match
 *   - Multiple short matches can beat a single long match
 *
 * Returning top-5 (instead of top-3) supports multi-workflow tasks where the
 * user describes two analyses in one message (e.g. "先做差异表达再做富集分析").
 */
export function routeSkill(
  message: string,
): { routes: SkillRoute[]; topScore: number } {
  const lower = message.toLowerCase();
  const scores = new Map<string, { route: SkillRoute; score: number }>();

  for (const route of SKILL_ROUTES) {
    let score = 0;
    for (const kw of route.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        // Weight: 1 base point + 0.1 per character (specificity bonus)
        score += 1 + kw.length * 0.1;
      }
    }
    if (score > 0) scores.set(route.id, { route, score });
  }

  const sorted = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);  // top-5 to support multi-skill tasks

  return {
    routes: sorted.map((v) => v.route),
    topScore: sorted[0]?.score ?? 0,
  };
}
