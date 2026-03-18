# BGI CLI

<div align="center">

```
██████╗  ██████╗ ██╗
██╔══██╗██╔════╝ ██║
██████╔╝██║  ███╗██║
██╔══██╗██║   ██║██║
██████╔╝╚██████╔╝██║
╚═════╝  ╚═════╝ ╚═╝
```

**专为生物信息学研究与中国大陆用户设计的 AI 命令行工具**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)](https://nodejs.org)
[![Based on](https://img.shields.io/badge/based%20on-Gemini%20CLI-orange.svg)](https://github.com/google-gemini/gemini-cli)

[English](#english) · [中文](#中文使用说明)

</div>

---

## 中文使用说明

BGI CLI 是基于 [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)
二次开发的命令行 AI 工具，专为**生物信息学研究**设计，内置 Biomni 生信技能库，并针对中国大陆网络环境做了适配。

### 核心特性

- 🧬 **内置生物信息学技能** — 预装 Biomni 生信技能库，覆盖 scRNA-seq、bulk
  RNA-seq、ChIP-seq、GWAS、蛋白结构预测等 21 种标准工作流
- 🔬 **计算生物学工具** —
  AlphaFold/Chai-1 结构预测、CRISPR 设计、ADMET 药学性质预测、Addgene 质粒搜索
- 🇨🇳 **国内服务商原生支持** — MiniMax · Kimi · Qwen ·
  DeepSeek，预置 API 地址，开箱即用，无需 VPN
- 🔌 **自定义 API 接口** — 支持任意 OpenAI 兼容的 API 地址 + Key
- 🛠️ **强大的 AI 编程助手** — 读写文件、执行命令、代码搜索、网页获取
- 💬 **多轮对话** — 完整的上下文记忆，支持会话保存与恢复
- 🔧 **MCP 扩展** — 支持 Model Context Protocol，可接入自定义工具

---

### 安装

**前置要求：** Node.js ≥ 20.0.0

```bash
# 1. 克隆仓库
git clone https://github.com/zja2004/BGI-CLI.git
cd BGI-CLI

# 2. 安装依赖
npm install

# 3. 打包构建
npm run bundle

# 4. 全局链接（注册 bgi 命令）
npm link
```

安装完成后，在任意终端输入 `bgi` 即可启动。

#### 直接运行（无需全局安装）

```bash
node bundle/gemini.js
```

---

### 快速开始

#### 第一步：启动

```bash
bgi
```

启动后会看到彩色 BGI Logo 和服务商选择界面。

#### 第二步：选择 AI 服务商

使用 **↑ ↓ 方向键** 选择服务商，按 **Enter** 确认：

```
? 欢迎使用 BGI CLI
  请选择您的 AI 服务提供商：

  ○ MiniMax (海螺 AI)
  ○ Kimi (月之暗面 Moonshot)
  ○ Qwen (通义千问 Alibaba)
  ● DeepSeek (深度求索)          ← 默认选中
  ○ Gemini API Key
  ○ 自定义 API (Custom URL + API Key)
```

#### 第三步：输入 API Key

选择服务商后，系统会显示对应的 API 地址，并提示输入 API Key：

```
DeepSeek (深度求索) — 输入 API Key
API 端点： https://api.deepseek.com/v1

API Key：
┌────────────────────────────────────┐
│ 粘贴您的 API Key                    │
└────────────────────────────────────┘
```

粘贴 API Key 后按 **Enter** 即可开始对话。

---

### 支持的 AI 服务商

| 服务商              | 官网注册地址                                           | API 地址                                            |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| **DeepSeek**        | [platform.deepseek.com](https://platform.deepseek.com) | `https://api.deepseek.com/v1`                       |
| **Kimi (Moonshot)** | [platform.moonshot.cn](https://platform.moonshot.cn)   | `https://api.moonshot.cn/v1`                        |
| **通义千问 (Qwen)** | [dashscope.aliyun.com](https://dashscope.aliyun.com)   | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **MiniMax**         | [platform.minimax.chat](https://platform.minimax.chat) | `https://api.minimax.chat/v1`                       |
| **Gemini**          | [aistudio.google.com](https://aistudio.google.com)     | Google AI Studio                                    |
| **自定义**          | 任意 OpenAI 兼容接口                                   | 自行填写                                            |

---

### 生物信息学技能 (Biomni Skills)

BGI CLI 内置了 **Biomni** 生信技能库，可自动调用以下能力：

#### 分析工作流（21 种）

| 工作流                                | 描述                           |
| ------------------------------------- | ------------------------------ |
| `scrnaseq-scanpy-core-analysis`       | scRNA-seq Scanpy 核心分析流程  |
| `scrnaseq-seurat-core-analysis`       | scRNA-seq Seurat 核心分析流程  |
| `bulk-rnaseq-counts-to-de-deseq2`     | Bulk RNA-seq 差异表达 (DESeq2) |
| `bulk-omics-clustering`               | 批量组学聚类分析               |
| `functional-enrichment-from-degs`     | 差异基因功能富集分析           |
| `coexpression-network`                | 共表达网络分析 (WGCNA)         |
| `grn-pyscenic`                        | 基因调控网络 (pySCENIC)        |
| `chip-atlas-diff-analysis`            | ChIP-Atlas 差异分析            |
| `chip-atlas-peak-enrichment`          | ChIP-Atlas Peak 富集           |
| `chip-atlas-target-genes`             | ChIP-Atlas 靶基因分析          |
| `genetic-variant-annotation`          | 遗传变异注释                   |
| `gwas-to-function-twas`               | GWAS → 功能/TWAS               |
| `mendelian-randomization-twosamplemr` | 孟德尔随机化 (TwoSampleMR)     |
| `polygenic-risk-score-prs-catalog`    | 多基因风险评分 (PRS-Catalog)   |
| `pooled-crispr-screens`               | Pooled CRISPR 筛选             |
| `lasso-biomarker-panel`               | LASSO 生物标志物筛选           |
| `experimental-design-statistics`      | 实验设计与统计                 |
| `clinicaltrials-landscape`            | 临床试验格局分析               |
| `literature-preclinical`              | 临床前文献分析                 |
| `pcr-primer-design`                   | PCR 引物设计                   |
| `spatial-transcriptomics`             | 空间转录组学分析               |

#### 计算工具

- **结构预测** — AlphaFold2/3、Chai-1、Boltz、ProteinMPNN（通过 HPC 提交任务）
- **分子生物学协议** — PCR 引物设计、CRISPR 敲除指导、FACS 分选、Western
  blot 等标准操作流程
- **药学分析** — ADMET 性质预测（输入 SMILES）
- **Addgene 数据库** — 质粒搜索、序列获取

#### 使用示例

```bash
bgi
> 帮我做一个 scRNA-seq 分析，数据是 10X Genomics 格式
> 预测这个蛋白序列的结构：MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPVLEDAFELSSMGIRVDADTLKHQLALTGDEDRLELEWHQALLRGEMPQTIGGGIGQSRLTMLLLQLPHIGQVQAGVWPAAVRESVPSLL

> 设计 TP53 基因的 CRISPR 敲除指导 RNA，靶向人类细胞

> 这些化合物的 ADMET 性质如何？
> CC1=CC=CC=C1  (甲苯)
> CC(=O)OC1=CC=CC=C1C(=O)O  (阿司匹林)
```

---

### 使用示例

#### 对话模式

```bash
bgi
```

```
BGI CLI v0.35.0

> 帮我分析这组单细胞测序数据的质控步骤

✓ 我会帮您进行 scRNA-seq 数据的质控分析...
```

#### 非交互式模式

```bash
# 直接传入提示词
bgi -p "解释一下 DESeq2 和 edgeR 的差异分析方法对比"

# 分析当前目录
bgi -p "分析这个项目的架构，列出主要模块"

# JSON 格式输出
bgi -p "列出5种常用的单细胞聚类算法" --output-format json
```

---

### 常用快捷键

| 快捷键   | 功能                        |
| -------- | --------------------------- |
| `Enter`  | 发送消息                    |
| `Ctrl+C` | 取消当前请求 / 两次退出程序 |
| `Ctrl+D` | 退出（空行时）              |
| `Ctrl+L` | 清屏                        |
| `↑ / ↓`  | 浏览历史输入                |
| `Ctrl+R` | 搜索历史输入                |
| `Esc`    | 关闭对话框 / 取消           |
| `F12`    | 切换调试控制台              |
| `Alt+M`  | 切换 Markdown 渲染          |

---

### 常用命令

在对话界面中输入以 `/` 开头的命令：

```bash
/auth          # 切换 AI 服务商
/model         # 切换模型（如 deepseek-chat、moonshot-v1-8k 等）
/settings      # 打开设置界面
/clear         # 清空对话历史
/memory show   # 查看当前上下文
/help          # 查看全部命令
/quit          # 退出程序
```

---

### 高级配置

#### 通过环境变量配置

```bash
# 跳过交互界面，直接使用指定服务商
export GEMINI_API_KEY="your-api-key"
export GOOGLE_GEMINI_BASE_URL="https://api.deepseek.com/v1"

bgi
```

#### 配置文件

BGI CLI 配置文件位于 `~/.gemini/settings.json`：

```json
{
  "security": {
    "auth": {
      "selectedType": "deepseek-api-key"
    }
  },
  "model": "deepseek-chat"
}
```

---

### 项目结构

```
BGI-CLI/
├── packages/
│   ├── core/          # 核心逻辑：认证、模型、工具、技能
│   │   └── src/
│   │       └── skills/
│   │           └── builtin/
│   │               └── biomni/       # 生物信息学技能库
│   │                   ├── SKILL.md  # 技能描述
│   │                   ├── scripts/  # Python 工具脚本
│   │                   └── references/  # 工作流知识库
│   └── cli/           # CLI 界面：React/Ink 渲染
├── bundle/            # 打包后的可执行文件（构建后生成）
├── research/          # 研究资料
│   ├── biomni/        # Biomni 逆向分析资料
│   │   ├── Biomni Reverse Report.md   # 完整分析报告
│   │   ├── system_prompt.md           # 原始系统提示词
│   │   ├── python_api_reference.md    # Python API 参考
│   │   ├── biomni_py/                 # Python 源码
│   │   ├── biomni_pyc/                # Python 字节码
│   │   └── knowhow/                   # Skills 知识库原始文件
│   └── biomni_reverse_analysis.tar.gz # 完整逆向分析存档
└── schemas/           # 配置 JSON Schema
```

---

### 常见问题

**Q: 启动后提示 "No authentication method selected"？**

A: 运行 `bgi` 后选择一个服务商并输入对应的 API Key 即可。

**Q: API Key 保存在哪里？**

A: API Key 使用系统 Keychain（Windows 凭据管理器 / macOS Keychain / Linux Secret
Service）安全存储，不会明文写入磁盘。

**Q: 能使用 DeepSeek R1 等推理模型吗？**

A: 可以，使用 `/model` 命令切换具体模型名称，例如 `deepseek-reasoner`。

**Q: 是否支持代理？**

A: 支持。在设置中配置 `proxy` 字段，或设置环境变量 `HTTPS_PROXY`。

**Q: Biomni 生信技能需要额外安装什么吗？**

A: 部分 Python 脚本（如结构预测 HPC 工具）需要对应的 Python 环境和外部服务。数据分析工作流只需 R 或 Python 环境即可。

---

### 参与贡献

欢迎提交 Issue 和 Pull Request！

```bash
# Fork 并克隆
git clone https://github.com/zja2004/BGI-CLI.git
cd BGI-CLI

# 安装依赖
npm install

# 开发模式运行（无需打包）
npm run start

# 构建
npm run bundle
```

---

### 许可证

本项目基于 [Apache 2.0](LICENSE) 许可证开源。

原始项目：[google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
© Google LLC

---

## English

BGI CLI is a fork of
[Google Gemini CLI](https://github.com/google-gemini/gemini-cli), designed for
bioinformatics research and adapted for users in mainland China. It comes
pre-loaded with the **Biomni bioinformatics skill library** and supports Chinese
AI providers natively.

### Key Features

- **Built-in bioinformatics skills** — 21 standardized workflows covering
  scRNA-seq, bulk RNA-seq, ChIP-seq, GWAS, CRISPR screens, and more
- **Computational biology tools** — Structural prediction (AlphaFold/Chai-1),
  molecular biology protocols, pharmacology (ADMET), Addgene plasmid search
- **Chinese AI providers** — MiniMax, Kimi (Moonshot), Qwen (Alibaba), DeepSeek,
  plus any OpenAI-compatible API
- **No Google account required** — Works entirely with Chinese providers

### Supported Providers

| Provider        | Base URL                                            |
| --------------- | --------------------------------------------------- |
| DeepSeek        | `https://api.deepseek.com/v1`                       |
| Kimi (Moonshot) | `https://api.moonshot.cn/v1`                        |
| Qwen (Alibaba)  | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| MiniMax         | `https://api.minimax.chat/v1`                       |
| Gemini          | Google AI Studio                                    |
| Custom API      | Any OpenAI-compatible endpoint                      |

### Bioinformatics Workflows

21 standard workflows in
`packages/core/src/skills/builtin/biomni/references/knowhow/workflows/`:

- scRNA-seq (Scanpy, Seurat)
- Bulk RNA-seq DESeq2
- Functional enrichment
- Co-expression networks (WGCNA)
- Gene regulatory networks (pySCENIC)
- ChIP-Atlas analysis
- GWAS / TWAS
- Mendelian randomization
- Polygenic risk scores
- Pooled CRISPR screens
- Spatial transcriptomics
- Clinical trials landscape
- And more...

### Installation

```bash
git clone https://github.com/zja2004/BGI-CLI.git
cd BGI-CLI
npm install
npm run bundle
npm link
```

Then run `bgi` in any terminal.

### Usage

```bash
# Interactive mode
bgi

# One-shot mode
bgi -p "Analyze my scRNA-seq data and suggest QC thresholds"

# With environment variables
GEMINI_API_KEY=your-key GOOGLE_GEMINI_BASE_URL=https://api.deepseek.com/v1 bgi
```

### Research Materials

The `research/biomni/` directory contains reverse engineering analysis of
[Biomni](https://biomni.phylo.bio), including:

- Full system prompt (`system_prompt.md`)
- Python API reference (`python_api_reference.md`)
- Decompiled Python source code (`biomni_py/`)
- Complete skill knowledge base (`knowhow/`)
- Full analysis report (`Biomni Reverse Report.md`)

### License

Apache 2.0 — see [LICENSE](LICENSE)

Original project:
[google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) ©
Google LLC
