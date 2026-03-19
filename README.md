# BGI CLI

**BGI CLI** 是一个独立的生物信息学 AI 终端工具，专为中国研究者设计。

- ✅ **独立工具** — 无需安装 OpenCode 或其他 AI 工具
- ✅ **中国 AI 服务商** — DeepSeek、Kimi、通义千问、MiniMax
- ✅ **21 个预装工作流** — 覆盖转录组、基因组、表观基因组、临床分析
- ✅ **真正的工具调用** — 执行 bash 命令、读写文件、运行 R/Python 脚本
- ✅ **单一命令** — 直接运行 `bgi`

---

## 安装

```bash
# 需要 Node.js 18+
npm install -g @bgicli/bgicli

# 或从源码安装
git clone https://github.com/zja2004/BGI-CLI.git
cd BGI-CLI
npm install
npm run build
npm link
```

## 快速开始

```bash
bgi
```

首次运行会提示选择 AI 服务商并输入 API Key。

---

## 支持的 AI 服务商

| 服务商 | 命令 | 获取 API Key |
|--------|------|-------------|
| **DeepSeek** (默认) | `/provider deepseek` | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| **Kimi** | `/provider kimi` | [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys) |
| **通义千问** | `/provider qwen` | [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com) |
| **MiniMax** | `/provider minimax` | [platform.minimax.chat](https://platform.minimax.chat) |

---

## 命令参考

| 命令 | 说明 |
|------|------|
| `/provider <name>` | 切换 AI 服务商 |
| `/model <name>` | 切换模型 |
| `/models` | 列出当前服务商的可用模型 |
| `/providers` | 列出所有服务商 |
| `/connect [provider]` | 配置 API Key |
| `/status` | 显示当前配置 |
| `/clear` | 清空对话历史 |
| `/help` | 显示帮助 |
| `exit` / `quit` | 退出 |

---

## 预装工作流 (21个)

运行分析时，BGI CLI 自动读取对应的 SKILL.md 工作流指南：

### 转录组学
- `bulk-rnaseq-counts-to-de-deseq2` — DESeq2 差异表达分析
- `bulk-omics-clustering` — 样本/特征聚类
- `scrnaseq-scanpy-core-analysis` — 单细胞分析 (Scanpy/Python)
- `scrnaseq-seurat-core-analysis` — 单细胞分析 (Seurat/R)
- `spatial-transcriptomics` — 空间转录组
- `coexpression-network` — 共表达网络 (WGCNA)
- `functional-enrichment-from-degs` — 功能富集 (GO/KEGG/GSEA)
- `grn-pyscenic` — 基因调控网络 (pySCENIC)

### 基因组学
- `genetic-variant-annotation` — 变异注释
- `gwas-to-function-twas` — GWAS → TWAS
- `mendelian-randomization-twosamplemr` — 孟德尔随机化
- `polygenic-risk-score-prs-catalog` — 多基因风险评分
- `pooled-crispr-screens` — CRISPR 文库筛选

### 表观基因组
- `chip-atlas-peak-enrichment / diff-analysis / target-genes` — ChIP-Atlas 分析

### 临床与流行病学
- `clinicaltrials-landscape`, `literature-preclinical`
- `experimental-design-statistics`, `lasso-biomarker-panel`, `pcr-primer-design`

---

## 工作流安装

将 21 个分析工作流部署到 `~/.bgicli/workflows/`：

```bash
# 从 bgicli-opencode 目录复制（如果已克隆旧仓库）
cp -r /path/to/old/workflows ~/.bgicli/workflows/
```

或运行安装脚本（Linux/macOS）：

```bash
bash install.sh
```

---

## 架构

```
bgi (单一二进制)
├── src/index.ts     — CLI 主入口、命令处理、交互循环
├── src/chat.ts      — 流式对话引擎（支持工具调用）
├── src/tools.ts     — 工具实现 (bash, read_file, write_file, list_dir, search_files)
├── src/prompt.ts    — 嵌入式生物信息学系统提示 + 工作流索引
├── src/providers.ts — 中国 AI 服务商配置
└── src/config.ts    — 配置管理 (~/.bgicli/config.json)
```

**工具调用流程**：
1. 用户提问 → 发给 LLM（带工具定义）
2. LLM 决定调用工具（bash/read_file 等）
3. BGI CLI 执行工具，将结果返回给 LLM
4. LLM 基于执行结果继续回答
5. 循环直到 LLM 完成回答

---

## License

MIT
