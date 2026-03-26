# BGI CLI

[![npm version](https://img.shields.io/npm/v/@bgicli/bgicli.svg)](https://www.npmjs.com/package/@bgicli/bgicli)
[![npm downloads](https://img.shields.io/npm/dm/@bgicli/bgicli.svg)](https://www.npmjs.com/package/@bgicli/bgicli)

**BGI CLI** 是面向中国生物学研究者的 AI 终端工具，开箱即用，无需额外配置。

- ✅ **一行安装** — `npm install -g @bgicli/bgicli`，无需克隆仓库
- ✅ **内置 1001 个技能** — 涵盖生信分析、结构生物学、药物发现、临床等全领域，自动安装
- ✅ **智能技能路由** — 描述任务自动激活对应技能，无需手动搜索
- ✅ **中国 AI 服务商** — 百炼(DashScope)聚合：Qwen、DeepSeek、Kimi、MiniMax 等 20+ 模型
- ✅ **真实工具调用** — 执行 bash、读写文件、运行 R/Python 脚本
- ✅ **内网支持** — 可接入公司私有化部署的大模型

---

## 安装

**环境要求：** Node.js 18+

```bash
npm install -g @bgicli/bgicli
```

安装完成后直接运行：

```bash
bgi
```

首次运行自动初始化技能库（约 16MB），无需额外操作。

---

## 卸载

```bash
# 卸载命令行工具
npm uninstall -g @bgicli/bgicli

# 删除本地数据（配置、技能库）
# Linux / macOS
rm -rf ~/.bgicli

# Windows PowerShell
Remove-Item -Recurse -Force "$env:USERPROFILE\.bgicli"
```

---

## 快速开始

```bash
bgi                    # 启动
/connect               # 首次配置 API Key
/cat                   # 浏览技能分类目录
/sk deseq2             # 搜索并激活 DESeq2 技能
/help                  # 查看全部命令
```

首次运行提示配置百炼 (DashScope) API Key：
- 获取地址：[bailian.console.aliyun.com](https://bailian.console.aliyun.com/) → API Key 管理

---

## 支持的 AI 服务商

### 百炼 · 阿里云 (DashScope) — 默认
通过百炼统一接入多个国内主流模型：

| 模型 | 命令 |
|------|------|
| Qwen3.5-plus（默认） | `/model qwen3.5-plus` |
| Qwen3.5-397B（旗舰） | `/model qwen3.5-397b-a17b` |
| Qwen3-235B | `/model qwen3-235b-a22b` |
| Qwen3-Coder-Plus | `/model qwen3-coder-plus` |
| DeepSeek-R1（推理） | `/model deepseek-r1` |
| DeepSeek-V3 | `/model deepseek-v3` |
| DeepSeek-V3.2 | `/model deepseek-v3.2` |
| Kimi-K2.5 | `/model kimi-k2.5` |
| Kimi-K2-Thinking（推理） | `/model kimi-k2-thinking` |
| MiniMax-M2.5 | `/model MiniMax-M2.5` |
| GLM-5 | `/model glm-5` |
| QwQ-Plus（推理） | `/model qwq-plus` |

获取 API Key：[bailian.console.aliyun.com](https://bailian.console.aliyun.com/)

### 内网私有化部署
```bash
/provider intranet     # 切换到内网 Qwen3-235B（无需 Key）
```

### 自定义 OpenAI 兼容服务
```bash
/connect custom        # 配置任意 vLLM / Ollama / FastChat 地址
```

---

## 命令参考

### 服务商 / 模型
| 命令 | 说明 |
|------|------|
| `/provider <name>` | 切换服务商（`bailian` / `intranet` / `custom`） |
| `/model <name>` | 切换模型 |
| `/models` | 列出当前服务商所有可用模型 |
| `/providers` | 列出所有服务商 |
| `/connect [provider]` | 配置 API Key |
| `/status` | 显示当前配置 |

### 技能
| 命令 | 说明 |
|------|------|
| `/cat` | 按领域浏览技能分类目录（11个领域） |
| `/sk` | 列出全部技能 |
| `/sk <关键词>` | 搜索并激活技能（如 `/sk deseq2`、`/sk alphafold`） |
| `/wf` | 同 `/sk`，别名 |
| `/install <url\|slug>` | 从 GitHub 或 SkillHub 安装新技能 |
| `/uninstall <id>` | 卸载已安装的技能 |

> **智能路由**：直接描述任务，BGI CLI 自动识别并激活对应技能。

### 对话管理
| 命令 | 说明 |
|------|------|
| `/clear` | 清空对话历史（重置激活的技能） |
| `/history` | 查看对话统计（轮次 / Token 估算） |
| `/save [文件名]` | 保存对话为 Markdown 文件 |
| `/think [on\|off]` | 切换思考模式（Qwen3 `/think` 前缀） |

### 断点与恢复
| 命令 | 说明 |
|------|------|
| `/checkpoint` | 保存当前对话断点（含激活的技能） |
| `/checkpoint save [标签]` | 保存断点并指定标签 |
| `/checkpoint list` | 列出本次会话所有断点 |
| `/checkpoint restore <id>` | 恢复到指定断点 |

> 适合长时间分析任务中途保存进度，防止意外中断丢失上下文。

### 数据库管理
| 命令 | 说明 |
|------|------|
| `/db list` | 列出已注册的参考数据库 |
| `/db add <路径> [基因组] [类型] [说明]` | 手动注册数据库路径 |
| `/db scan [目录]` | 自动扫描文件系统查找已知数据库 |
| `/db rm <id>` | 删除数据库记录 |
| `/db download [名称]` | 显示标准数据库下载命令 |

> 注册后 AI 可自动引用正确路径，无需每次手动指定。支持 hg38/hg19/mm10 基因组、STAR/HISAT2 索引、GTF 注释等。

### 安全扫描
| 命令 | 说明 |
|------|------|
| `/scan <命令>` | 扫描命令安全风险，输出 CRITICAL / HIGH / MEDIUM / LOW 等级 |

> AI 执行每条 bash 命令前均自动扫描；CRITICAL 级别命令将被拦截。

### 文件与目录
| 命令 | 说明 |
|------|------|
| `/cd <路径>` | 更改工作目录 |
| `/cwd` | 显示当前工作目录 |
| `/tools` | 列出 AI 可调用的工具 |
| `@路径` | 消息中内嵌文件内容（如 `@data.csv 里有什么?`） |

### 会话报告与记忆
退出时（双击 Ctrl+C 或输入 `exit`）自动显示会话报告：
- 运行时长
- 消耗 Token（输入 / 输出）
- 执行命令成功 / 失败次数
- 可选保存会话记忆到 `~/.bgicli/memory/`

### 其他
| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `exit` / `quit` / `q` | 退出（显示会话报告） |

---

## 快捷键

| 快捷键 | 说明 |
|--------|------|
| `Ctrl+C`（单次） | 中断当前 AI 任务（保留对话历史） |
| `Ctrl+C`（连按两次） | 退出程序（显示会话报告） |

---

## 内置技能库（1001个）

使用 `/cat` 浏览分类目录，`/sk <关键词>` 搜索，`/install` 安装更多技能。

### 🧬 转录组学
| 技能 ID | 说明 |
|---------|------|
| `bulk-rnaseq-counts-to-de-deseq2` | DESeq2 差异表达分析 |
| `bulk-omics-clustering` | 样本/特征聚类（K-Means / HDBSCAN） |
| `scrnaseq-scanpy-core-analysis` | 单细胞 RNA-seq（Scanpy/Python） |
| `scrnaseq-seurat-core-analysis` | 单细胞 RNA-seq（Seurat/R） |
| `spatial-transcriptomics` | 空间转录组（Visium） |
| `coexpression-network` | 共表达网络（WGCNA） |
| `functional-enrichment-from-degs` | 功能富集（GO / KEGG / GSEA） |
| `grn-pyscenic` | 基因调控网络（pySCENIC） |

### 🧪 基因组学
| 技能 ID | 说明 |
|---------|------|
| `genetic-variant-annotation` | VCF 变异注释（VEP / ANNOVAR） |
| `gwas-to-function-twas` | GWAS → TWAS 因果基因 |
| `mendelian-randomization-twosamplemr` | 孟德尔随机化 |
| `polygenic-risk-score-prs-catalog` | 多基因风险评分（PRS） |
| `pooled-crispr-screens` | CRISPR 文库筛选（MAGeCK / BAGEL2） |

### 🔗 表观基因组
| 技能 ID | 说明 |
|---------|------|
| `chip-atlas-peak-enrichment` | ChIP-seq 峰值富集 |
| `chip-atlas-diff-analysis` | 差异结合分析 |
| `chip-atlas-target-genes` | 转录因子靶基因鉴定 |

### 🏥 临床与流行病学
| 技能 ID | 说明 |
|---------|------|
| `survival-analysis-clinical` | 临床生存分析（KM 曲线 / Cox 回归 / 竞争风险） |
| `clinicaltrials-landscape` | 临床试验格局分析 |
| `literature-preclinical` | 临床前文献系统提取 |
| `experimental-design-statistics` | 实验设计与统计检验 |
| `lasso-biomarker-panel` | LASSO 生物标志物筛选 |
| `pcr-primer-design` | PCR/qPCR 引物设计 |

### 📦 更多技能（979个）

结构生物学、单细胞、药物发现、抗体设计、文献检索、临床 AI 等，使用 `/cat` 或 `/sk <关键词>` 查找。

---

## 架构

```
bgi
├── src/index.ts        — CLI 主入口、命令处理、智能路由、会话管理
├── src/chat.ts         — 流式对话引擎（工具调用循环、进度渲染）
├── src/tools.ts        — 工具实现（bash / read_file / write_file 等）
├── src/security.ts     — 命令安全扫描（CRITICAL / HIGH / MEDIUM / LOW）
├── src/databases.ts    — 参考数据库注册与管理
├── src/skillRouter.ts  — 关键词路由表（35个核心技能自动匹配）
├── src/prompt.ts       — 生物信息学系统提示
├── src/providers.ts    — 中国 AI 服务商配置
├── src/config.ts       — 配置管理（~/.bgicli/config.json）
└── data/               — 内置数据（Skills + Python 工具）
```

---

## License

MIT
