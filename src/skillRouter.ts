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
      // tool names
      'deseq2', 'edger', 'limma-voom', 'limma', 'voom',
      // explicit analysis terms
      'rna-seq差异', 'rnaseq差异', '差异表达分析', '差异表达基因',
      'count矩阵', 'count matrix', '原始counts', 'raw counts',
      'featurecounts', 'htseq-count', 'htseq', 'rsem', 'salmon定量', 'kallisto',
      // data inputs
      'tpm矩阵分析', 'fpkm矩阵', '表达矩阵', 'star比对结果', 'hisat2结果',
      // result types
      '火山图', 'volcano plot', 'ma图', 'ma plot', '差异基因热图',
      // natural-language: what changed
      '哪些基因表达量高', '哪些基因上调', '哪些基因下调',
      '基因表达差异', '转录组差异', '表达量差异',
      '上调基因', '下调基因', 'deg分析', 'differentially expressed',
      '差异分析', '比较两组基因表达',
      // comparison contexts
      '肿瘤vs正常', '肿瘤癌旁', '癌旁对照', '肿瘤对照比较',
      '处理vs对照', '药物处理差异', '敲除vs野生型', '过表达vs对照',
      '耐药vs敏感', '耐药差异表达', '分化前后', '时间点差异',
      // cancer-specific
      '肺癌差异基因', '乳腺癌差异表达', '肝癌转录组差异',
      '结直肠癌基因表达', '胃癌差异分析', '前列腺癌差异',
      '白血病转录组', '淋巴瘤基因表达', '胶质瘤差异基因',
      // immune/inflammation context
      '免疫细胞差异表达', '巨噬细胞激活差异', '炎症相关差异基因',
      // natural query style
      '哪些基因有差异', '找到差异基因', 'rna-seq数据分析',
    ],
  },
  {
    id: 'bulk-omics-clustering', name: '样本 / 特征聚类',
    category: '转录组', tag: 'builtin',
    keywords: [
      // method names
      'wgcna聚类', '层次聚类', 'hierarchical clustering', 'kmeans聚类', 'k-means',
      'hdbscan', '样本聚类', '特征聚类', 'omics clustering',
      'consensus clustering', '共识聚类', 'nmf分解', 'non-negative matrix',
      // dimensionality reduction
      'pca分析', '主成分分析', 'umap降维', 't-sne', 'tsne', 'umap',
      'pca图', 'umap图', '降维可视化',
      // subtyping
      '分子亚型', '分子亚型鉴定', '癌症分子分型', '患者分层',
      '样本分型', '亚型鉴定', '内在亚型', 'intrinsic subtype',
      // multi-omics
      '蛋白质组聚类', '代谢组聚类', '多组学聚类', '多组学整合',
      // natural-language
      '样本分组', '样本分类', '聚类分析', '无监督聚类',
      '热图聚类', '样本相似性', '样本间关系',
      '这些样本如何分组', '找到样本的亚群',
    ],
  },
  {
    id: 'scrnaseq-scanpy-core-analysis', name: 'scRNA-seq (Scanpy / Python)',
    category: '单细胞', tag: 'builtin',
    keywords: [
      // tools
      'scanpy', 'scrna-seq', 'single cell rna', '单细胞rna测序',
      '10x chromium', 'leiden聚类', 'python单细胞', 'anndata分析',
      'louvain聚类', 'umap单细胞',
      // core analysis
      '单细胞测序', '单细胞分析', '单细胞数据', '10x数据',
      '细胞聚类', '细胞类型鉴定', 'scrna', 'sc-rna',
      // quality control
      '单细胞qc', '单细胞质控', '线粒体比例', 'doublet检测', 'doubletfinder',
      // cell types
      'T细胞亚群', 'B细胞分析', 'NK细胞', '巨噬细胞亚群',
      '树突状细胞', '成纤维细胞', '内皮细胞', '上皮细胞',
      '髓系细胞', '浆细胞', '自然杀伤细胞',
      // TME / cancer context
      '肿瘤微环境', 'tme分析', '肿瘤浸润淋巴细胞', 'til分析',
      '肿瘤单细胞图谱', '免疫细胞浸润单细胞', '癌症单细胞',
      // trajectory / pseudotime
      '拟时序分析', 'pseudotime', 'trajectory analysis', '轨迹分析',
      '细胞分化轨迹', '发育轨迹', 'monocle', 'diffusion pseudotime',
      // cell communication
      '细胞通讯', 'cellchat', 'nichenet', '配体受体', 'ligand receptor',
      '细胞间通讯', '信号传导网络',
      // integration
      '多样本整合', 'harmony批次矫正', '批次矫正单细胞', 'scanorama',
      // natural query
      '单细胞图谱', '细胞类型有哪些', '细胞亚群分析', '单细胞转录组',
    ],
  },
  {
    id: 'scrnaseq-seurat-core-analysis', name: 'scRNA-seq (Seurat / R)',
    category: '单细胞', tag: 'builtin',
    keywords: [
      // tools
      'seurat', 'r语言单细胞', 'findclusters', 'findneighbors',
      'sctransform', 'r单细胞分析', 'findmarkers', 'findallmarkers',
      'doubletfinder r', 'harmony r整合', 'cca整合',
      // core workflow
      'r做单细胞', 'seurat分析', '用r分析单细胞',
      'seurat对象', 'seurat pipeline',
      // marker genes
      '标记基因', 'marker gene', '细胞marker', '细胞特征基因',
      // T/B/NK cells in R
      'r语言t细胞', 'r语言肿瘤微环境', '用seurat做免疫分析',
      // integration
      'rpca整合', 'seurat整合', '多样本seurat',
    ],
  },
  {
    id: 'spatial-transcriptomics', name: '空间转录组',
    category: '单细胞', tag: 'builtin',
    keywords: [
      // platforms
      '空间转录组', 'spatial transcriptomics', 'visium', '10x visium',
      'stereo-seq', 'merfish', 'seqfish', 'slide-seq', 'cosmx',
      'xenium', 'dbit-seq', 'resolve biosciences',
      // analysis
      '空间解卷积', 'spatial deconvolution', '配体受体分析', '空间基因表达',
      '空间聚类', '空间变异基因', 'spatially variable genes',
      '空间自相关', 'moran指数',
      // deconvolution tools
      'rctd', 'spotlight', 'cell2location', 'stereoscope',
      // cell communication spatial
      '空间配体受体', '空间细胞通讯', '空间互作',
      // natural-language
      '空间组学', '组织切片测序', '空间分辨率转录组',
      '细胞空间分布', '空间单细胞', '组织空间图谱',
      '细胞在组织中的位置', '空间表达模式',
    ],
  },
  {
    id: 'coexpression-network', name: 'WGCNA 共表达网络',
    category: '转录组', tag: 'builtin',
    keywords: [
      // tool/method
      'wgcna', '共表达网络', 'coexpression network', '基因共表达模块',
      'weighted gene coexpression', '与表型相关的基因模块',
      'blockwisemoduless', '软阈值', '模块颜色', '枢纽基因', 'hub gene',
      // module-trait
      '模块性状关联', '模块与临床特征', '特征基因相关性',
      '模块特征值', 'module eigengene',
      // applications
      '免疫浸润与模块', '免疫相关模块', '预后相关基因模块',
      '代谢相关共表达', '共表达与药物',
      // natural-language
      '基因模块', '共表达', '基因网络', '基因相关性网络',
      '哪些基因一起变化', '基因调控模块', '核心基因网络',
    ],
  },
  {
    id: 'functional-enrichment-from-degs', name: 'GO / KEGG / GSEA 富集分析',
    category: '转录组', tag: 'builtin',
    keywords: [
      // databases
      '富集分析', 'go分析', 'kegg分析', 'gsea', '通路分析',
      'reactome', 'wikipathways', 'disgenet', 'msigdb',
      'pathway enrichment', '基因本体', 'gene ontology', 'functional enrichment',
      '功能富集', 'deg富集', '差异基因通路',
      // analysis types
      'go富集', '通路富集', '基因集分析', 'ora分析', 'gsea分析',
      'ssgsea', 'gsva', '基因集变异分析',
      // specific pathways
      'wnt通路', 'notch通路', 'hedgehog通路', 'mtor通路',
      'jak-stat通路', 'nf-kb通路', 'tgf-beta通路', 'erk通路',
      'mapk通路', 'pi3k通路', 'akt信号', 'p53通路',
      'hippo通路', 'vegf通路', 'egfr信号通路',
      // mutation → pathway
      '突变通路', '突变影响通路', '突变下游通路', '桑基图通路',
      'kras通路', 'ras-raf-mek通路', '驱动基因通路',
      // cancer pathway contexts
      '肺癌通路', '乳腺癌信号通路', '肝癌通路分析',
      '免疫通路', '炎症通路', '细胞周期通路', '凋亡通路',
      '代谢通路', '糖酵解通路', '氧化磷酸化',
      // natural-language
      '这些基因参与什么通路', '基因功能注释', '信号通路',
      '生物学过程', '分子功能', '细胞组分',
      '信号通路富集', '基因功能是什么', '哪些通路被激活',
    ],
  },
  {
    id: 'grn-pyscenic', name: 'pySCENIC 基因调控网络',
    category: '单细胞', tag: 'builtin',
    keywords: [
      // tools
      'pyscenic', 'scenic', '基因调控网络', 'gene regulatory network',
      '转录因子调控子', 'tf regulon', 'grn推断',
      'aucell', 'aucell评分', '调控子活性',
      // TF analysis
      '转录因子分析', '转录因子靶基因', 'tf活性', '调控网络推断',
      '单细胞转录因子', '细胞类型转录因子',
      // applications
      '肿瘤转录因子', '发育轨迹tf', '免疫细胞转录因子',
      '干细胞转录因子调控', '分化相关转录因子',
    ],
  },

  // ── Genomics ──────────────────────────────────────────────────────────────────
  {
    id: 'genetic-variant-annotation', name: '遗传变异注释',
    category: '基因组', tag: 'builtin',
    keywords: [
      // tools
      '变异注释', 'variant annotation', 'vcf注释', 'snv注释', 'indel注释',
      'vep注释', 'annovar', '变异致病性预测', '变异功能预测', 'clinvar注释',
      'snpeff', 'oncokb注释', 'civic数据库',
      // variant types
      '体细胞突变', '胚系变异', 'germline variant', 'somatic mutation',
      '拷贝数变异', 'cnv分析', '基因融合', 'fusion gene', '基因重排',
      '剪接变异', 'splicing variant', '移码突变', 'frameshift',
      '无义突变', 'nonsense mutation', '错义突变', 'missense',
      '同义突变', 'synonymous', '启动子变异',
      // clinical classification
      '致病性分类', 'acmg分类', '变异临床意义', '变异解读',
      '良性变异', '致病变异', '意义不明变异', 'vus',
      // population genetics
      '人群频率', 'gnomad', '千人基因组', '等位基因频率', 'maf',
      'hapmap', '连锁不平衡', 'ld', 'linkage disequilibrium',
      // natural-language synonyms
      '突变注释', '变异解读', 'vcf文件分析', '遗传变异解析',
      '致病性评估', '变异影响预测',
      // standalone gene/cancer keywords (no space dependency)
      'kras', 'egfr', 'alk', 'braf', 'ros1', 'ret', 'met', 'ntrk', 'erbb2', 'her2',
      'tp53', 'brca', 'brca1', 'brca2', 'pik3ca', 'pten', 'cdkn2a',
      'nsclc', 'luad', 'lusc', '非小细胞肺癌', '肺腺癌', '肺鳞癌',
      '驱动基因', '变异报告', '突变报告',
      // oncology mutations (compound keywords — bonus score for specificity)
      'kras突变', 'kras g12c', 'kras g12d', 'kras g12v', 'kras mutation',
      'egfr突变', 'egfr l858r', 'egfr外显子19', 'egfr t790m',
      'alk融合', 'alk重排', 'braf v600e', 'braf突变',
      'tp53突变', 'pik3ca突变', 'pten缺失',
      'brca1突变', 'brca2突变', 'her2扩增', 'her2突变',
      'cdkn2a缺失', 'met扩增', 'met外显子14', 'ret融合',
      'ros1融合', 'ntrk融合', 'pd-l1',
      // cancer contexts
      'nsclc突变', '肺癌突变', '非小细胞肺癌突变', '肺腺癌突变',
      '肿瘤体细胞突变', '驱动基因突变', '癌症驱动突变',
      '乳腺癌突变', '结直肠癌突变', '黑色素瘤突变', '胃癌突变',
      '肝癌突变', '卵巢癌突变', '前列腺癌突变', '胰腺癌突变',
      // mutation landscape
      '突变频率', '跨癌种突变', '突变热图', '突变景观图', '瀑布图突变',
      'mutation landscape', 'oncoprint', '肿瘤突变负荷', 'tmb',
      '微卫星不稳定', 'msi', '同源重组缺陷', 'hrd',
    ],
  },
  {
    id: 'gwas-to-function-twas', name: 'GWAS → TWAS 功能解析',
    category: '基因组', tag: 'builtin',
    keywords: [
      // methods
      'gwas分析', 'twas', 'predixcan', 'fusion分析', '全基因组关联分析',
      'genome-wide association', '因果基因鉴定', 'qtl整合',
      'eqtl', 'sqtl', '表达数量性状位点', 'coloc', 'colocalization',
      'ld score regression', 'ldsc', '遗传力分析', 'heritability',
      'fine mapping', '精细定位', 'credible set', 'susie',
      // application areas
      '自身免疫gwas', '类风湿关节炎gwas', '系统性红斑狼疮gwas',
      '糖尿病gwas', '2型糖尿病遗传位点', '肥胖gwas', 'bmi遗传',
      '心血管疾病gwas', '冠心病遗传变异', '血压gwas',
      '神经系统gwas', '阿尔茨海默病gwas', '精神分裂症gwas',
      '炎症性肠病gwas', '克罗恩病遗传', '溃疡性结肠炎gwas',
      '肿瘤易感性gwas', '乳腺癌易感位点', '前列腺癌gwas',
      // natural-language
      'gwas结果解读', 'gwas功能注释', '关联位点基因',
      'snp功能', 'gwas信号', '遗传关联分析',
      'snp与疾病', '遗传变异与表型', '功能性snp鉴定',
    ],
  },
  {
    id: 'mendelian-randomization-twosamplemr', name: '孟德尔随机化 (MR)',
    category: '统计', tag: 'builtin',
    keywords: [
      // methods
      '孟德尔随机化', 'mendelian randomization', 'twosamplemr',
      'mr因果推断', 'ivw方法', 'mr-egger', '双样本mr', '工具变量iv',
      'weighted median', 'mr-presso', 'steiger过滤',
      '双向孟德尔随机化', 'bidirectional mr', '多变量mr',
      // exposures
      'bmi与疾病', '血脂与疾病', '炎症因子因果', '代谢物mr',
      '肠道菌群mr', '吸烟与疾病', '酒精与疾病',
      '教育程度因果', '睡眠时长mr', '体力活动mr',
      'il-6因果', 'crp与疾病', '胆固醇因果',
      // outcomes
      '冠心病因果', '心血管疾病mr', '2型糖尿病mr',
      '癌症风险因果', '乳腺癌风险mr', '前列腺癌mr',
      '阿尔茨海默病因果', '帕金森病mr', '抑郁症因果',
      '中风mr', '高血压因果', '慢性肾病mr',
      // natural-language
      '因果推断', '暴露与结局', '遗传工具变量', 'mr分析',
      '某因素是否导致某疾病', '因果关系验证', 'iv分析',
    ],
  },
  {
    id: 'polygenic-risk-score-prs-catalog', name: 'PRS 多基因风险评分',
    category: '基因组', tag: 'builtin',
    keywords: [
      // methods
      'prs评分', 'polygenic risk score', '多基因风险评分',
      'prs-cs', '遗传风险预测', 'prs计算',
      'prsice', 'ldpred', 'prscsx', 'clumping and thresholding',
      // applications
      '疾病风险预测', '高风险个体识别', '人群遗传分层',
      '乳腺癌prs', '前列腺癌prs', '结直肠癌prs',
      '心血管prs', '冠心病遗传风险', '血压prs',
      '2型糖尿病prs', '阿尔茨海默病遗传风险',
      '精神疾病prs', '精神分裂症prs', '双相情感障碍prs',
      // natural-language
      '遗传风险评分', '多基因评分', '疾病遗传风险',
      '个体遗传风险', '基因组风险预测', '遗传易感性评分',
    ],
  },
  {
    id: 'pooled-crispr-screens', name: 'CRISPR 文库筛选 (MAGeCK/BAGEL2)',
    category: '基因组', tag: 'builtin',
    keywords: [
      // tools
      'crispr文库筛选', 'crispr screen', 'mageck', 'bagel2',
      'sgrna筛选', 'pooled crispr', 'crispr hit识别',
      // library types
      'crispr全基因组文库', 'crispri文库', 'crispra文库',
      'genome-wide crispr', 'crispr敲除文库',
      // analysis types
      '必需基因筛选', '致死基因', '合成致死', 'synthetic lethal',
      'crispr筛选', '功能基因组筛选',
      // applications
      '肿瘤耐药crispr', '免疫治疗crispr筛选', '耐药机制crispr',
      '癌症必需基因', '肿瘤脆弱性基因', 'crispr功能基因组',
      // natural-language
      'crispr敲除筛选', 'crispr文库', '高通量crispr', '基因必需性',
    ],
  },

  // ── Epigenomics ───────────────────────────────────────────────────────────────
  {
    id: 'chip-atlas-peak-enrichment', name: 'ChIP-seq 峰值富集 (ChIP-Atlas)',
    category: '表观基因组', tag: 'builtin',
    keywords: [
      // tools/databases
      'chip-atlas', 'chip-seq峰值富集', 'peak enrichment chip',
      'chip atlas数据库', 'histone chip分析',
      // histone marks
      'h3k27ac', 'h3k4me3', 'h3k4me1', 'h3k27me3', 'h3k9me3', 'h3k36me3',
      'h3k9ac', 'h4k16ac', '组蛋白修饰', '活性增强子标记',
      // regulatory elements
      '增强子分析', '启动子活性', '超级增强子', 'super enhancer',
      '开放染色质', 'atac-seq', 'atac分析', 'dnase-seq',
      'ctcf结合', 'cohesin', '拓扑域', 'tad',
      // TF binding
      '转录因子结合chip', 'tf结合位点', 'chip-seq分析',
      // cancer epigenome
      '肿瘤表观基因组', '癌症组蛋白修饰', '肿瘤增强子',
      '表观遗传修饰', '表观基因组改变',
      // natural-language
      'chip-seq分析', 'chip数据', '组蛋白修饰谱',
      '哪些区域有h3k27ac', '增强子激活', 'chip-seq峰',
    ],
  },
  {
    id: 'chip-atlas-diff-analysis', name: 'ChIP-seq 差异结合分析',
    category: '表观基因组', tag: 'builtin',
    keywords: [
      // tools
      'chip差异分析', 'differential binding', '差异chip-seq',
      'differential peak', 'chip-seq条件比较',
      'diffbind', 'chipseeker差异',
      // comparison contexts
      '药物处理chip差异', '处理前后chip-seq', '细胞分化chip',
      '疾病vs正常chip', '肿瘤vs正常chip-seq',
      // natural-language
      '差异峰', '差异结合位点', 'chip-seq差异',
      '哪些位点结合发生变化', '差异组蛋白修饰',
      '激活vs抑制的增强子',
    ],
  },
  {
    id: 'chip-atlas-target-genes', name: 'ChIP-seq 靶基因鉴定',
    category: '表观基因组', tag: 'builtin',
    keywords: [
      // tools
      'chip靶基因', 'chip target gene', '转录因子靶基因chip',
      'tf靶基因', 'peak annotation靶基因', 'chip-seq peak注释',
      'great分析', 'chipseeker', 'annotatepeak',
      // applications
      '转录因子调控靶基因', '增强子靶基因', '超级增强子靶基因',
      '调控元件靶基因', '启动子注释',
      // specific TFs
      'myc靶基因', 'p53靶基因', 'nrf2靶基因', 'stat3靶基因',
      // natural-language
      'peak注释', '峰值注释', '转录因子结合位点',
      '哪些基因被转录因子调控', 'chip结果注释到基因',
      '峰值注释到最近基因', 'chip靶点',
    ],
  },

  // ── Clinical ──────────────────────────────────────────────────────────────────
  {
    id: 'clinicaltrials-landscape', name: '临床试验格局分析',
    category: '临床', tag: 'builtin',
    keywords: [
      // core terms
      'clinicaltrials分析', 'clinical trial landscape', 'ct.gov数据分析',
      '临床试验格局', '临床研究分析',
      // trial phases
      '一期临床', '二期临床', '三期临床', '临床试验分期',
      'phase 1', 'phase 2', 'phase 3', 'phase i', 'phase ii', 'phase iii',
      // study types
      '随机对照试验', 'rct', '开放标签试验', '单臂研究',
      // drug types
      '靶向药临床试验', '免疫治疗临床试验', '细胞治疗临床试验',
      'car-t临床', 'pd-1临床试验', '抗体药临床',
      '小分子抑制剂临床', 'adc临床试验',
      // disease areas
      '肿瘤临床试验', '肺癌临床试验', '乳腺癌临床', '肝癌临床',
      '自身免疫临床试验', '心血管临床试验', '神经疾病临床',
      '稀有病临床', '罕见病临床试验',
      // natural-language
      '临床试验', '在研药物', '临床管线', '临床研究现状',
      '某药物有哪些临床试验', '该适应症的临床格局',
      '竞争格局分析', '研发管线',
    ],
  },
  {
    id: 'literature-preclinical', name: '临床前文献系统提取',
    category: '文献', tag: 'builtin',
    keywords: [
      // methods
      '临床前文献', 'preclinical literature', '系统文献提取',
      'literature extraction', '文献系统综合',
      '系统评价', '系统综述', 'systematic review',
      'meta分析', 'meta-analysis', '文献计量', 'bibliometric',
      // data extraction
      '动物实验数据提取', '体外实验数据提取', '细胞实验文献',
      '小鼠模型文献', '临床前动物数据',
      // application
      '文献证据综合', '证据质量评估', 'prisma', 'cochrane',
      // natural-language
      '文献综述', '文献整理', '文献挖掘',
      '查阅相关文献', '提取文献数据', '系统搜集文献',
      '综合分析现有研究', '研究现状总结',
    ],
  },
  {
    id: 'experimental-design-statistics', name: '实验设计与统计检验',
    category: '统计', tag: 'builtin',
    keywords: [
      // sample size
      '样本量计算', '统计检验选择', 'sample size calculation', 'power analysis功效',
      '随机化设计', '实验设计统计', '假设检验选择',
      // parametric tests
      't检验', 'student t test', '独立样本t', '配对t检验',
      'anova方差分析', '单因素anova', '双因素anova', '重复测量anova',
      // non-parametric tests
      'mann-whitney', 'wilcoxon检验', 'kruskal-wallis',
      'friedman检验', '秩和检验', '非参数检验',
      // categorical
      'fisher检验', 'fisher exact', '卡方检验', 'chi-square',
      // correlation
      'pearson相关', 'spearman相关', '相关系数', '相关分析',
      // multiple testing
      '多重检验校正', 'bonferroni', 'fdr校正', 'holm校正',
      // regression
      '线性回归', '多元回归', 'logistic回归', '多变量分析',
      // diagnostic
      'roc曲线', 'auc计算', '诊断准确性', '灵敏度特异性',
      '约登指数', '最佳截断值',
      // propensity score
      '倾向评分匹配', 'psm', '倾向评分', '混杂因素控制',
      // study design
      '随机对照设计', '交叉设计', '析因设计', '区组设计',
      // natural-language
      '用什么统计方法', '统计显著性', '检验方法', '需要多少样本',
      '功效分析', '统计功效', '显著性检验', '两组怎么比较',
      '该用什么检验', '统计方法选择',
    ],
  },
  {
    id: 'lasso-biomarker-panel', name: 'LASSO 生物标志物面板筛选',
    category: '统计', tag: 'builtin',
    keywords: [
      // methods
      'lasso回归筛选', 'lasso生物标志物', 'biomarker panel筛选',
      '最小标志物面板', 'feature selection lasso', '诊断标志物筛选',
      'elastic net', 'ridge回归', '正则化回归',
      '随机森林特征筛选', 'random forest特征重要性',
      // biomarker types
      '蛋白质标志物', '代谢标志物', 'mrna标志物', 'mirna标志物',
      '多组学标志物', '血清标志物', '血浆标志物',
      '尿液生物标志物', '循环标志物',
      // applications
      '诊断标志物', '预后标志物', '预测性标志物', '响应预测标志物',
      '早期诊断模型', '诊断panel', '预后模型构建',
      '癌症早筛标志物', '液体活检标志物', 'ctdna标志物',
      // performance
      'auc评估', 'roc曲线验证', '诊断效能', '预测准确性',
      '交叉验证模型', '外部验证',
      // natural-language
      '生物标志物筛选', '标志物组合', '诊断模型', '预测模型特征筛选',
      '找最小有效标志物', '哪些标志物组合最好',
      '筛选关键特征', '特征选择',
    ],
  },
  {
    id: 'pcr-primer-design', name: 'PCR / qPCR 引物设计',
    category: '分子生物学', tag: 'builtin',
    keywords: [
      // tools/methods
      '引物设计', 'primer design', 'qpcr引物', 'pcr引物', 'primer3',
      'qrt-pcr设计', '扩增子设计', '引物特异性验证',
      // qPCR specifics
      '内参基因', 'gapdh', 'beta-actin', '定量pcr', '相对定量',
      'ct值', '扩增效率', '熔解曲线',
      // applications
      '基因表达验证引物', '基因克隆引物', '测序引物', 'sanger测序引物',
      'crispr验证引物', '敲除验证pcr', '过表达验证',
      '甲基化特异性pcr', 'chip验证引物', 'chip-pcr',
      // types
      '简并引物', '简并引物设计', '全长扩增', '嵌套pcr引物',
      '多重pcr', '实时荧光pcr',
      // natural-language
      '设计引物', '扩增引物', 'rt-pcr引物',
      '帮我设计引物', '设计qpcr引物', '验证基因表达的引物',
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
      '无事件生存', 'event-free survival', 'efs',
      // statistical terms
      '删失数据', '右删失', 'censored data',
      '风险比', 'hazard ratio', 'hr值',
      '竞争风险', 'competing risk', 'fine-gray', '累积发生率',
      '中位生存时间', '5年生存率', '3年生存率', '1年生存率',
      // Cox covariates
      '多变量cox', '单因素cox', '独立预后因素', '预后独立变量',
      'ecog评分', '肿瘤分期', 'tnm分期', '淋巴结转移',
      // expression-based
      '高表达预后差', '基因表达与预后', '突变与预后',
      '蛋白表达与生存', '甲基化与预后',
      // cancer types
      '肺癌预后', '乳腺癌生存分析', '肝癌预后', '胃癌生存',
      '结直肠癌预后', '卵巢癌生存', '胰腺癌预后',
      '白血病生存', '淋巴瘤预后', '胶质瘤生存分析',
      '前列腺癌预后', '肾癌生存', '黑色素瘤预后',
      // clinical contexts
      '辅助化疗预后', '免疫治疗疗效预测', '靶向治疗生存',
      'tcga生存数据', '临床队列生存',
      // natural-language
      '患者预后', '预后分析', '生存预后', '临床预后',
      '画生存曲线', '患者能活多久', '哪些因素影响预后',
    ],
  },

  // ── Extended Skills (key routable entries) ───────────────────────────────────
  {
    id: 'pubmed-search', name: 'PubMed 文献检索',
    category: '文献', tag: 'builtin',
    keywords: [
      'pubmed检索', 'pubmed搜索', '文献检索', '论文搜索', '查找文献',
      '检索pubmed', 'pubmed文献', 'medline检索',
      'ncbi检索', '医学文献', '临床文献检索',
      '查最新文献', '找相关论文', '近期发表文章',
      '数据库文献检索', '生物医学文献',
    ],
  },
  {
    id: 'arxiv-search', name: 'arXiv 预印本检索',
    category: '文献', tag: 'builtin',
    keywords: [
      'arxiv检索', 'arxiv搜索', '预印本检索', '预印本论文', 'arxiv文献',
      '最新预印本', 'biorxiv', 'medrxiv', '未发表论文',
      'ai相关预印本', '深度学习生物信息', '大模型生物医学',
    ],
  },
  {
    id: 'alphafold', name: 'AlphaFold 蛋白质结构预测',
    category: '结构生物学', tag: 'builtin',
    keywords: [
      // tools
      'alphafold结构预测', 'alphafold运行', 'af2', 'af3',
      '蛋白质结构预测任务', '用alphafold预测',
      'colabfold', 'esmfold', 'rosettafold',
      // applications
      '蛋白质结构预测', '三维结构预测', '蛋白折叠预测',
      '突变对结构的影响', '结构功能分析',
      '配体结合口袋预测', '药物靶点结构',
      // protein interaction
      '蛋白蛋白相互作用结构', 'ppi结构', '复合物结构预测',
      'multimer预测', '蛋白复合物',
      // structural biology
      '同源建模', 'homology modeling', '序列结构关系',
      '蛋白质结构比较', '结构对齐', '结构叠合',
      // natural-language
      '预测蛋白结构', '蛋白3d结构', '蛋白质三维构象',
      '这个蛋白的结构是什么', '用ai预测结构',
    ],
  },
  {
    id: 'alphafold-database', name: 'AlphaFold 数据库查询',
    category: '结构生物学', tag: 'builtin',
    keywords: [
      'alphafold数据库', 'alphafold db', 'uniprot结构查询',
      '蛋白质结构数据库', 'af数据库',
      '已知蛋白结构查询', '蛋白结构下载', 'rcsb pdb',
      'pdb结构', '蛋白数据库', 'pdb查询',
      '蛋白id查结构', 'uniprot蛋白结构',
    ],
  },
  {
    id: 'bindcraft', name: 'BindCraft 蛋白质结合体设计',
    category: '结构生物学', tag: 'builtin',
    keywords: [
      'bindcraft', '结合体设计', 'binder design', 'protein binder',
      '蛋白质结合物设计', 'de novo binder',
      // therapeutic protein design
      '治疗性蛋白设计', '蛋白质工程', '蛋白质改造',
      '结合亲和力设计', '蛋白质设计',
      // applications
      '抑制剂蛋白设计', '靶点结合蛋白', '受体结合设计',
    ],
  },
  {
    id: 'anndata', name: 'AnnData 单细胞数据操作',
    category: '单细胞', tag: 'builtin',
    keywords: [
      'anndata操作', 'h5ad文件处理', 'adata子集', 'anndata格式',
      '单细胞h5ad', 'obs var layers',
      'h5ad读取', '单细胞数据格式转换', 'loom格式',
      'seurat转anndata', 'anndata合并', 'adata拼接',
      'obs筛选', 'var筛选', 'uns字段',
    ],
  },
  {
    id: 'cellagent-annotation', name: 'CellAgent 细胞类型自动注释',
    category: '单细胞', tag: 'builtin',
    keywords: [
      '细胞类型注释', 'cell type annotation', 'cellagent', '自动细胞注释',
      '细胞注释自动化', '单细胞注释',
      // reference-based
      '参考集注释', 'sctype', 'celltypist', 'singler注释',
      'scmap注释', '迁移学习细胞注释',
      // specific cell types
      't细胞注释', '免疫细胞注释', '肿瘤细胞注释',
      '上皮细胞注释', '成纤维细胞鉴定', '内皮细胞识别',
      // marker-based
      '标志物驱动注释', '细胞特征基因注释',
    ],
  },
  {
    id: 'scvi-tools', name: 'scVI 单细胞深度学习',
    category: '单细胞', tag: 'builtin',
    keywords: [
      'scvi-tools', 'scvi模型', '单细胞变分推断', 'batch correction scvi',
      'totalvi', 'scvi批次矫正',
      // related models
      'scarches', 'scarchess', 'peakvi', 'multivi',
      '深度学习单细胞', '变分自编码器单细胞', 'vae单细胞',
      // applications
      '批次效应去除深度学习', '多模态单细胞整合',
      '单细胞imputation', '基因表达插补',
    ],
  },
  {
    id: 'agentd-drug-discovery', name: '药物发现 Agent',
    category: '药物', tag: 'builtin',
    keywords: [
      // core drug discovery
      '药物发现流程', 'drug discovery', '候选药物筛选', '先导化合物',
      'hit化合物', '药物靶点发现',
      // target analysis
      '靶点评估', '靶点可视化', '靶点报告', '靶点分析', '靶点可成药性',
      'druggability', '可成药性评估', '靶点综合评分',
      'target visualization', 'drug target report', 'target assessment',
      '靶点验证', '靶点确认', '靶点优先级排序',
      // cancer + target keywords (standalone — no space dependency)
      'nsclc靶点', 'nsclc靶向', 'nsclc治疗靶点', '肺癌靶点', '非小细胞肺癌靶点',
      '肿瘤靶点', '癌症靶点', '靶向治疗', '精准治疗',
      // specific target contexts
      'kras靶点', 'kras可成药性', 'kras抑制剂', 'kras突变靶点',
      'egfr靶点', 'alk靶点', 'braf靶点', 'her2靶点', 'met靶点',
      'pd-1靶点', 'pd-l1靶点', 'ctla4靶点',
      'vegfr靶点', 'fgfr靶点', 'idh1靶点', 'idh2靶点',
      // virtual screening
      '虚拟筛选', '分子对接', 'molecular docking', '对接打分',
      'glide docking', 'autodock', 'vina', '高通量虚拟筛选',
      // ADMET
      'admet预测', '药代动力学预测', 'pk预测', 'adme预测',
      '口服生物利用度', '血脑屏障', 'bbb预测', '毒性预测',
      '代谢稳定性', 'herg毒性',
      // drug repurposing
      '药物重定位', '老药新用', 'drug repurposing', '药物再利用',
      // network pharmacology
      '网络药理学', '靶点网络', '中药网络药理学', '中药活性成分',
      '天然产物活性', '中草药有效成分', '中药靶点',
      // visualization
      '雷达图评分', '气泡图靶点', '桑基图突变通路', '靶点热图',
      // natural-language
      '哪些靶点值得开发', '靶点优先级', '靶点成药性分析',
      '靶向治疗靶点', '精准医学靶点',
      '开发什么药物', '针对某靶点的药', '靶点可行性评估',
    ],
  },
  {
    id: 'chembl-database', name: 'ChEMBL 化合物活性数据库',
    category: '药物', tag: 'builtin',
    keywords: [
      'chembl查询', 'chembl数据库', '化合物活性数据', 'bioactivity数据',
      'chembl化合物', '靶点活性化合物',
      // activity data
      'ic50查询', 'ki值', 'kd值', 'ec50', '活性化合物查询',
      '化合物靶点活性', '多靶点活性谱',
      // drug data
      '批准药物数据', '临床化合物', 'fda批准药物',
    ],
  },
  {
    id: 'rdkit', name: 'RDKit 化学信息学',
    category: '药物', tag: 'builtin',
    keywords: [
      'rdkit', '化学信息学', 'cheminformatics', '分子描述符计算',
      '分子相似度', 'smiles分子操作', '化学结构处理',
      // fingerprints
      '分子指纹', 'morgan指纹', 'ecfp', 'maccs指纹', 'topological fingerprint',
      // scaffold
      '骨架分析', 'scaffold hopping', '骨架跳跃', '药效团',
      'pharmacophore',
      // properties
      '分子量计算', 'logp计算', '氢键受体供体', '旋转键',
      'lipinski五规则', '类药性', 'drug-likeness',
      // QSAR/ML
      'qsar建模', '构效关系', '分子机器学习', '化学空间',
      // reactions
      '反应预测', '逆合成分析', 'retrosynthesis',
    ],
  },
  {
    id: 'bio-variant-calling', name: '变异检测流程 (GATK/Mutect2)',
    category: '基因组', tag: 'builtin',
    keywords: [
      // tools
      '变异检测流程', 'variant calling流程', 'somatic变异检测',
      '体细胞突变检测', 'mutect2', 'gatk变异检测', '肿瘤变异检测',
      'haplotypecaller', 'deepvariant', 'strelka2', 'varscan',
      // sequencing types
      'wes分析', '全外显子测序分析', 'wgs分析', '全基因组测序',
      'panel测序', '靶向测序', 'ngs变异检测',
      'tumor-normal配对', '肿瘤正常配对测序',
      // variant types
      '点突变检测', 'snp calling', 'indel检测', 'cnv检测',
      '结构变异检测', 'sv calling', '基因融合检测',
      // quality
      '变异过滤', 'vqsr', '变异质控', '测序质控',
      // natural-language
      '从bam文件找突变', '从fastq到突变', '测序数据找变异',
      '肿瘤基因组测序分析', 'ngs数据分析流程',
    ],
  },
  {
    id: 'antibody-design-agent', name: '抗体设计 Agent',
    category: '抗体', tag: 'builtin',
    keywords: [
      // core
      '抗体设计', 'antibody design', '抗体优化', 'cdr设计',
      '单克隆抗体设计', '抗体工程改造',
      // types
      '治疗性抗体', '中和抗体', '双特异性抗体', 'bispecific antibody',
      '纳米抗体', 'nanobody', '单域抗体', 'sdab',
      '全人源抗体', '人源化抗体', 'humanization',
      // optimization
      '抗体亲和力成熟', 'affinity maturation', 'cdr优化',
      '抗体稳定性改造', '抗体可溶性提高',
      // antibody-drug conjugate
      'adc设计', '抗体偶联药物', '偶联位点设计',
      // function
      'fc工程改造', 'effector function优化', 'adcc', 'cdc',
      // immune checkpoint
      '免疫检查点抗体', 'pd-1抗体', 'pd-l1抗体', 'ctla4抗体',
      // natural-language
      '设计新抗体', '改造抗体', '抗体如何优化', '开发抗体药物',
    ],
  },
  {
    id: 'armored-cart-design-agent', name: 'Armored CAR-T 设计',
    category: '抗体', tag: 'builtin',
    keywords: [
      // core
      'car-t设计', 'cart细胞设计', '嵌合抗原受体设计',
      'chimeric antigen receptor', 'armored cart', '免疫细胞治疗设计',
      // CAR structure
      '共刺激域设计', 'costimulatory domain', 'cd28共刺激', '4-1bb设计',
      '铰链区设计', '跨膜区优化', '胞内信号域',
      // applications
      '血液肿瘤car-t', 'b细胞淋巴瘤car-t', '多发性骨髓瘤cart',
      '实体瘤car-t', '实体肿瘤细胞治疗',
      // targets
      'cd19 cart', 'cd22 cart', 'bcma cart', 'cd33 cart',
      'her2 cart', 'gd2 cart', 'egfr cart',
      // engineering
      '通用car-t', '异体cart', 'allogeneic cart',
      'tcrαβ敲除', '持久性改造', 'persistence',
      // related therapies
      'car-nk设计', 'tcr-t细胞', 'til治疗', '肿瘤浸润淋巴细胞',
      // natural-language
      '设计car-t', '开发细胞治疗', '免疫细胞疗法设计',
      'cart治疗什么癌症', 'cart持久性',
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
