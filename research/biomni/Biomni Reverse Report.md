# Biomni (biomni.phylo.bio) 解析

[TOC]

## 文件系统

| 目录                 | 权限  | 说明                                              |
| -------------------- | ----- | ------------------------------------------------- |
| `/workspace`         | 读/写 | 工作目录，所有代码执行默认在此运行                |
| `/mnt/user-uploads/` | 只读  | 通过 @ 上传的文件存放位置, 无结构                 |
| `/mnt/user-results/` | 只读  | 历史会话的结果文件                                |
| `/mnt/results/`      | 读/写 | 本次会话的输出目录，文件会实时同步到 UI           |
| `/mnt/datalake`      | 只读  | 挂载的科学数据库（GTEx、DepMap、GWAS Catalog 等） |
| `/mnt/knowhow`       | 只读  | 各工作流的Skill (已下载)                          |

### `/wrokspace` tree

```
/workspace/
├── .cache/
│   ├── fontconfig/          # 字体缓存（matplotlib 渲染用）
│   │   ├── *.cache-9        # 字体索引缓存文件
│   │   └── CACHEDIR.TAG
│   └── matplotlib/
│       └── fontlist-v390.json   # matplotlib 字体列表
├── .config/
│   └── matplotlib/          # matplotlib 配置目录（当前为空）
└── .local/
    ├── R/
    │   └── library/         # R 包安装目录（当前为空，按需安装）
    ├── bin/                 # 本地可执行文件（当前为空）
    └── lib/
        └── python3.11/
            └── site-packages/   # Python 包安装目录（当前为空，按需安装）
```

### `/mnt/user-results` tree

```
/mnt/user-results/
└── sessions/
    ├── sess_acd645ea6bff/          # 当前会话（本次）
    │   └── execution_trace.ipynb
    │
    ├── sess_c48f1ba11d54/          # 历史会话
    │   ├── execution_trace.ipynb
    │   ├── knowhow.tar.gz          (约 21 MB)
    │   └── mnt_tree.txt            (约 73 KB)
    │
    └── sess_f6e376ab6008/          # 历史会话（2026-02-04）
        ├── Genos_Deployment_Report.pdf   (约 227 KB)
        ├── execution_trace.ipynb         (约 80 KB)
        ├── genos_test_results.png        (约 142 KB)
        ├── genos_test_results.svg        (约 171 KB)
        └── genos_test_summary.json       (约 1.3 KB)
```

**当前状态**：仅有运行时缓存和配置目录，无用户数据文件。
**权限**：`drwxr-xr-x`（读写，root 所有） **用途**：

- 所有代码执行的**默认工作目录**
- 中间计算文件、临时数据的存放位置
- Python/R 包的动态安装位置
- ⚠️ **此目录的文件不会同步到 UI，用户无法直接下载**

### `/mnt/results` tree

```
/mnt/results/
└── execution_trace.ipynb    # Jupyter 执行记录（269 bytes，本次会话）
```

**当前状态**：仅有本次会话的空执行记录。
**权限**：`drwxr-xr-x`（读写，root 所有）
**用途**：所有需要交付给你的文件都必须保存到此处，**实时同步到 UI**。

### 完整的 `/mnt` tree

见`mnt_tree.md`文件.

### 限制

- **不能**访问系统敏感目录（如 `/etc`、`/root` 等）
- **不能**执行网络监听、反向 shell 等安全敏感操作
- **不能**访问你本地机器的文件系统（只能访问上传的文件）

---

## Tool 系统设计与定义

### Tool 协议

Tool 是指被 Agent 系统直接调用的工具, 注意不要与被定义在运行环境, 例如 Python/R 中的函数/方法混淆.

使用 XML-style tags 调用工具和返回工具结果:

> 注意! 使用的 XML-style tags 是 Anthropic 工具调用协议, 与 OpenAI Json
> Schema有区别.
>
> 但不确定是 Biomni 使用 Claude 模型导致, 或者是 Biomni 使用了相同的格式 (但使用正则解析).
>
> 但根据观察 "Agent 在显式思维链中提到XML的示例时, 意外触发了工具调用", 表明大概率是应用层协议

```
<function_calls>                    ← 发出的工具调用块（可含多个并行）
  <invoke name="工具名">             ← 单个工具调用
    <parameter name="参数名">值</parameter>
  </invoke>
</function_calls>

<function_results>                   ← 系统返回的结果块
  <result>                           ← 每个工具对应一个 result
    <name>工具名</name>              ← 标识是哪个工具的返回
    <output>实际输出内容</output>    ← stdout/stderr 原始文本
  </result>
</function_results>
```

### 工具分类概览 (共18个)

| 类别           | 工具示例                                | 用途                    |
| -------------- | --------------------------------------- | ----------------------- |
| **计算执行**   | `ExecuteCode`                           | 运行 Python/R           |
| **系统执行**   | `Bash`, `BashOutput`, `KillShell`       | 运行Bash代码            |
| **文件操作**   | `Read`, `Write`, `Edit`, `Glob`, `Grep` | 读写搜索文件            |
| **网络访问**   | `WebSearch`, `WebFetch`                 | 搜索/抓取网页内容       |
| **数据库查询** | `DatabaseQuery`                         | 查询 30+ 生物医学数据库 |
| **文献检索**   | `LiteratureSearch`                      | 搜索 PubMed 等科学文献  |
| **任务管理**   | `PlanWrite`, `AskUserQuestion`          | 规划任务、向用户提问    |
| **环境查询**   | `EnvDetail`                             | 查询可用工具/数据库详情 |
| **质量控制**   | `TraceReview`                           | 检测分析中的错误/幻觉   |

每个工具都有明确的 **输入参数类型约束** 和
**安全限制**（例如禁止反向 shell、禁止挖矿等）

### Tools 特性总结

| 工具    | 重要限制                                                           |
| ------- | ------------------------------------------------------------------ |
| `Read`  | 仅支持**绝对路径**；文本默认截断 10,000 字符；PDF 单次最多 20 页   |
| `Write` | 若文件已存在，**必须先 `Read`** 再写入；新文件 >40K 字符需分批写入 |
| `Edit`  | 依赖**精确字符串匹配**，无法模糊替换                               |
| `Glob`  | 用于按**文件名模式**查找文件，不读取内容                           |
| `Grep`  | 用于按**内容正则**搜索，禁止直接用 `grep` bash 命令                |

| 工具               | 适用场景                               | 关键限制                                    |
| ------------------ | -------------------------------------- | ------------------------------------------- |
| `WebSearch`        | 最新资讯、数据集链接、工具文档         | 仅限美国区域；禁止访问可疑域名              |
| `WebFetch`         | 抓取特定页面内容并提取信息             | 内容过大时会被截断；禁止 pastebin 等        |
| `DatabaseQuery`    | 复杂生物医学数据库查询，结果保存为文件 | 每次调用聚焦**单一问题**；SQL 库每次 ≤25 轮 |
| `LiteratureSearch` | 同行评审文献检索，支持多维过滤         | 最多返回 50 篇；依赖 Consensus API          |

### 计算执行

#### 1. `ExecuteCode`

```json
{
  "name": "ExecuteCode",
  "description": "Write and execute code in Jupyter notebook style. Code and output are automatically saved to a persistent notebook for inspection and re-running. Use this for data analysis, computations, running bioinformatics tools, etc.",
  "parameters": {
    "type": "object",
    "properties": {
      "code": {
        "type": "string",
        "description": "The code to execute. Common packages (pandas, numpy, etc.) are available."
      },
      "description": {
        "type": "string",
        "description": "Short description of what this code does (shown to user)."
      },
      "language": {
        "type": "string",
        "enum": ["python", "bash", "r"],
        "description": "Programming language"
      },
      "run_in_background": {
        "type": "boolean",
        "description": "Run code in background for long-running jobs."
      }
    },
    "required": ["code", "description"]
  }
}
```

### 系统执行

#### 1. `Bash` — 执行 Shell 命令

```json
{
  "name": "Bash",
  "description": "Executes a bash command in a persistent shell session with optional timeout. For terminal operations (git, npm, docker, etc.). NOT for file operations — use dedicated file tools instead.",
  "parameters": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "description": "The bash command to execute. Always quote paths with spaces using double quotes."
      },
      "description": {
        "type": "string",
        "description": "Clear, concise description of what this command does (5-10 words, active voice)."
      },
      "run_in_background": {
        "type": "boolean",
        "description": "Run in background (returns shell_id for monitoring). Do NOT append '&' when using this parameter."
      },
      "timeout": {
        "type": "number",
        "description": "Timeout in milliseconds (max 600,000ms / 10 minutes). Default: 120,000ms."
      }
    },
    "required": ["command", "description"]
  }
}
```

> ⚠️ **禁止使用 Bash 执行的命令**：`find`, `grep`, `cat`, `head`, `tail`, `sed`,
> `awk`, `echo` — 请使用对应的专用工具（Glob/Grep/Read/Write/Edit）替代。

> 🔒
> **安全禁区**：反向 Shell、挖矿程序、环境变量泄露、Fork 炸弹、网络扫描、下载并执行不可信脚本。

---

#### 2. `BashOutput` — 读取后台 Shell 输出

```json
{
  "name": "BashOutput",
  "description": "Retrieves output from a running or completed background bash shell. Always returns only NEW output since last check.",
  "parameters": {
    "type": "object",
    "properties": {
      "bash_id": {
        "type": "string",
        "description": "The ID of the background shell (returned by Bash with run_in_background=true)."
      },
      "description": {
        "type": "string",
        "description": "Short description of what output you're checking."
      },
      "filter": {
        "type": "string",
        "description": "Optional regex to filter output lines. Non-matching lines are permanently discarded."
      }
    },
    "required": ["bash_id", "description"]
  }
}
```

---

#### 3. `KillShell` — 终止后台 Shell

```json
{
  "name": "KillShell",
  "description": "Kills a running background bash shell by its ID.",
  "parameters": {
    "type": "object",
    "properties": {
      "shell_id": {
        "type": "string",
        "description": "The ID of the background shell to kill."
      },
      "description": {
        "type": "string",
        "description": "Short description of why you're killing the shell."
      }
    },
    "required": ["shell_id", "description"]
  }
}
```

#### Bash 三件套协作模式：

```
Bash(run_in_background=true)  →  获得 shell_id
        ↓ 任务运行中
BashOutput(bash_id)           →  实时读取输出（增量）
        ↓ 若需中止
KillShell(shell_id)           →  强制终止进程
```

### 文件操作

#### 1. `Read` — 读取文件

```json
{
  "name": "Read",
  "description": "Reads a file from the local filesystem. Supports text, image (PNG/JPG/WebP/GIF), PDF, and Jupyter notebooks.",
  "parameters": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Absolute path to the file to read."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're reading and why."
      },
      "offset": {
        "type": "integer",
        "description": "1-indexed line number to start reading from. Max 100,001."
      },
      "limit": {
        "type": "integer",
        "description": "Number of lines to read. Defaults to 100, max 2,000."
      },
      "mode": {
        "type": "string",
        "enum": ["low", "original", "media_output_check"],
        "description": "Read mode for images/PDFs. 'low'=downsized, 'original'=full-res, 'media_output_check'=one-shot check without attaching media."
      },
      "media_output_check_prompt": {
        "type": "string",
        "description": "Task-specific prompt used with mode='media_output_check'."
      },
      "pages": {
        "type": "string",
        "description": "Page range for PDF files only (e.g., '1-5', '3', '10-20'). Max 20 pages per request."
      }
    },
    "required": ["file_path", "description"]
  }
}
```

---

#### 2. `Write` — 写入文件

```json
{
  "name": "Write",
  "description": "Writes a file to the local filesystem. Overwrites existing file. MUST read the file first if it already exists.",
  "parameters": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Absolute path to the file to write (must be absolute)."
      },
      "content": {
        "type": "string",
        "description": "The content to write to the file."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're writing."
      }
    },
    "required": ["file_path", "content", "description"]
  }
}
```

---

#### 3. `Edit` — 编辑文件（字符串替换）

```json
{
  "name": "Edit",
  "description": "Edit an existing file by replacing an exact string match.",
  "parameters": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Path to the file to edit."
      },
      "old_string": {
        "type": "string",
        "description": "The exact string to find and replace."
      },
      "new_string": {
        "type": "string",
        "description": "The new string to replace with."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're editing."
      }
    },
    "required": ["file_path", "old_string", "new_string", "description"]
  }
}
```

---

#### 4. `Glob` — 文件模式匹配搜索

```json
{
  "name": "Glob",
  "description": "Fast file pattern matching. Returns matching file paths sorted by modification time.",
  "parameters": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "description": "Glob pattern to match files (e.g., '**/*.csv', 'data/*.txt')."
      },
      "path": {
        "type": "string",
        "description": "Directory to search in. Defaults to current working directory."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're searching for."
      }
    },
    "required": ["pattern", "description"]
  }
}
```

---

#### 5. `Grep` — 文件内容正则搜索

```json
{
  "name": "Grep",
  "description": "Search file contents using ripgrep. Supports full regex syntax.",
  "parameters": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "description": "Regular expression pattern to search for."
      },
      "path": {
        "type": "string",
        "description": "File or directory to search in. Defaults to current working directory."
      },
      "glob": {
        "type": "string",
        "description": "Glob pattern to filter files (e.g., '*.csv', '**/*.tsv')."
      },
      "type": {
        "type": "string",
        "description": "File type filter (e.g., 'py', 'r', 'js')."
      },
      "output_mode": {
        "type": "string",
        "enum": ["content", "files_with_matches", "count"],
        "description": "'content'=matching lines, 'files_with_matches'=file paths only (default), 'count'=match counts."
      },
      "-i": { "type": "boolean", "description": "Case insensitive search." },
      "-n": { "type": "boolean", "description": "Show line numbers." },
      "-C": {
        "type": "number",
        "description": "Lines of context before and after match."
      },
      "-A": { "type": "number", "description": "Lines after match." },
      "-B": { "type": "number", "description": "Lines before match." },
      "multiline": {
        "type": "boolean",
        "description": "Enable multiline matching across lines."
      },
      "head_limit": {
        "type": "number",
        "description": "Limit output to first N results."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're searching for."
      }
    },
    "required": ["pattern", "description"]
  }
}
```

### 网络访问

#### 1. `WebSearch` — 网络搜索

```json
{
  "name": "WebSearch",
  "description": "Searches the web and returns formatted search result blocks. Provides up-to-date information beyond training knowledge cutoff.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query to use."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're searching for."
      },
      "allowed_domains": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Only include results from these domains (e.g., ['ncbi.nlm.nih.gov', 'nature.com'])."
      },
      "blocked_domains": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Never include results from these domains."
      }
    },
    "required": ["query", "description"]
  }
}
```

---

#### 2. `WebFetch` — 网页内容抓取与分析

```json
{
  "name": "WebFetch",
  "description": "Fetches content from a URL, converts HTML to markdown, then processes it with an AI model using a given prompt.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "format": "uri",
        "description": "The fully-formed URL to fetch (HTTP auto-upgraded to HTTPS)."
      },
      "prompt": {
        "type": "string",
        "description": "What information to extract from the fetched page."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're fetching."
      }
    },
    "required": ["url", "prompt", "description"]
  }
}
```

> **注意**：有 15 分钟缓存机制；若 URL 发生重定向，会返回重定向地址，需重新请求。

---

### 数据库查询

#### 1. `DatabaseQuery` — 生物医学数据库查询（子智能体）

```json
{
  "name": "DatabaseQuery",
  "description": "Spawns a mini-agent that queries biological databases and saves results to CSV/JSON files in the working directory.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language query. Keep each call focused on ONE aspect. Examples: 'Find BRAF mutations in melanoma', 'Get protein structure for TP53'."
      },
      "databases": {
        "type": "array",
        "items": { "type": "string" },
        "description": "List of databases to query."
      },
      "description": {
        "type": "string",
        "description": "Short description of what data you're querying."
      },
      "max_iterations": {
        "type": "integer",
        "description": "Maximum iterations for the subagent ReAct loop (default: 100)."
      }
    },
    "required": ["query", "databases", "description"]
  }
}
```

#### 支持的数据库完整列表：

| 类别           | 数据库                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **SQL 数据库** | `genecards`, `cosmic`                                                                                                         |
| **结构**       | `pdb`, `alphafold`, `uniprot`, `interpro`, `emdb`                                                                             |
| **基因组**     | `ensembl`, `pubmed`, `ncbi_gene`, `ncbi_protein`, `ncbi_taxonomy`, `geo`, `dbsnp`, `sra`, `gnomad`, `ucsc`, `gtex`, `clinvar` |
| **癌症**       | `tcga`, `cbioportal`, `depmap`                                                                                                |
| **药物**       | `chembl`, `pubchem`, `openfda`, `clinicaltrials`, `dailymed`                                                                  |
| **通路**       | `kegg`, `reactome`, `quickgo`                                                                                                 |
| **疾病**       | `gwas_catalog`, `opentargets`, `disgenet`, `monarch`, `hpo`                                                                   |
| **互作**       | `string`, `biogrid`                                                                                                           |
| **单细胞**     | `cellxgene`, `human_cell_atlas`                                                                                               |
| **调控**       | `jaspar`, `remap`, `encode`                                                                                                   |
| **其他**       | `addgene`, `lincs`, `pride`, `unichem`                                                                                        |

---

### 文献检索

#### 1. `LiteratureSearch` — 科学文献搜索

```json
{
  "name": "LiteratureSearch",
  "description": "Searches peer-reviewed research papers via Consensus API. Returns title, authors, abstract, DOI, journal, citation counts, and direct links.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (e.g., 'CRISPR gene editing', 'EGFR inhibitor resistance')."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're searching for."
      },
      "max_papers": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50,
        "default": 10,
        "description": "Maximum number of papers to retrieve."
      },
      "year_min": {
        "type": "integer",
        "description": "Exclude papers before this year (e.g., 2020)."
      },
      "year_max": {
        "type": "integer",
        "description": "Exclude papers after this year."
      },
      "study_types": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Filter by study type: ['RCT', 'Meta-Analysis', 'Systematic Review', 'Cohort Study']."
      },
      "human": {
        "type": "boolean",
        "description": "Set true to exclude animal/in vitro studies."
      },
      "sample_size_min": {
        "type": "integer",
        "description": "Exclude studies with fewer participants than this value."
      },
      "sjr_max": {
        "type": "integer",
        "minimum": 1,
        "maximum": 4,
        "description": "Journal quality filter: 1=top quartile only, 2=top two quartiles, etc."
      }
    },
    "required": ["query", "description"]
  }
}
```

### 任务管理（共 3 个工具）

#### 1. `PlanWrite` — 任务规划与进度追踪

```json
{
  "name": "PlanWrite",
  "description": "Create or update a structured execution plan. Combines planning and progress tracking. Blocks execution until user approves when requires_confirmation=true.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Brief descriptive title (2-5 words, e.g., 'Gene Expression Analysis')."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're doing with the plan."
      },
      "requires_confirmation": {
        "type": "boolean",
        "description": "true=block until user approves (use for first plan or major changes). false=silent status update during execution."
      },
      "steps": {
        "type": "array",
        "description": "Ordered list of execution steps (typically 3-7).",
        "items": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "description": "Short step summary in imperative form (max 10 words)."
            },
            "content": {
              "type": "string",
              "description": "Detailed description of what this step will do and why."
            },
            "status": {
              "type": "string",
              "enum": ["pending", "in_progress", "completed", "failed"],
              "description": "Only ONE step should be 'in_progress' at a time."
            },
            "resources": {
              "type": "array",
              "items": { "type": "string" },
              "description": "User-friendly resource names (e.g., 'AlphaFold', 'UniProt', 'DESeq2')."
            },
            "result_file_paths": {
              "type": ["array", "null"],
              "items": { "type": "string" },
              "description": "Key output file paths (only when status=completed, must be under /mnt/results/)."
            },
            "result_summary": {
              "type": ["string", "null"],
              "description": "1-2 sentence summary of what was accomplished (only when status=completed)."
            }
          },
          "required": ["title", "content", "status"]
        }
      }
    },
    "required": ["title", "steps", "description"]
  }
}
```

#### 状态机流转规则：

```
pending → in_progress → completed
                      ↘ failed
```

> - 首次创建计划：`requires_confirmation=true`（等待用户批准）
> - 执行中更新状态：`requires_confirmation=false`（静默更新）
> - 用户请求重大变更：`requires_confirmation=true`（重新确认）

---

#### 2. `AskUserQuestion` — 向用户提问澄清

```json
{
  "name": "AskUserQuestion",
  "description": "Ask structured clarification questions. Pauses execution until user responds. Use when approach is ambiguous or multiple valid methods exist.",
  "parameters": {
    "type": "object",
    "properties": {
      "questions": {
        "type": "array",
        "maxItems": 4,
        "minItems": 1,
        "items": {
          "type": "object",
          "properties": {
            "question": {
              "type": "string",
              "description": "The complete question text."
            },
            "header": {
              "type": "string",
              "description": "Short label (max 12 chars, e.g., 'Auth method', 'Database')."
            },
            "options": {
              "type": "array",
              "minItems": 0,
              "maxItems": 4,
              "description": "0 options = free text input. 2-4 options = selection. NEVER exactly 1 option.",
              "items": {
                "type": "object",
                "properties": {
                  "label": {
                    "type": "string",
                    "description": "Option name (1-5 words)."
                  },
                  "description": {
                    "type": "string",
                    "description": "What this option means."
                  }
                },
                "required": ["label", "description"]
              }
            },
            "multiSelect": {
              "type": "boolean",
              "description": "true=checkbox multi-select. Use when user can pick multiple options."
            }
          },
          "required": ["question", "header", "options"]
        }
      }
    },
    "required": ["questions"]
  }
}
```

> ⚠️ **必须单独调用**，不能与其他工具同时使用。

---

#### 3. `MemoryWrite` — 持久化用户信息

```json
{
  "name": "MemoryWrite",
  "description": "Write important user information to persistent memory for future sessions. Stores identity, preferences, research domain, and methodology choices.",
  "parameters": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string",
        "description": "The fact to store. Clear, concise statement (e.g., 'User prefers DESeq2 for differential expression analysis')."
      },
      "reasoning": {
        "type": "string",
        "description": "Brief explanation of why this is worth remembering for future sessions."
      }
    },
    "required": ["content", "reasoning"]
  }
}
```

#### 触发存储的场景

| 触发条件              | 示例         |
| --------------------- | ------------ |
| 用户明确说"记住这个"  | 直接存储     |
| 用户提及研究背景/机构 | 存储身份信息 |
| 用户纠正方法偏好      | 存储工具偏好 |
| 用户描述活跃项目      | 存储研究方向 |

### 环境查询

#### 1. `EnvDetail` — 查询工具/数据库/知识库详情

```json
{
  "name": "EnvDetail",
  "description": "Get detailed information about a specific A2 function, know-how guide, database, or library. Returns parameters, returns, usage examples, and full documentation.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Name of: (1) specific function (e.g., 'find_open_reading_frames'), (2) module (e.g., 'molecular_biology'), (3) know-how guide (e.g., 'bulk_rnaseq_differential_expression'), (4) database (e.g., 'UniProt'), or (5) library (e.g., 'scanpy')."
      },
      "description": {
        "type": "string",
        "description": "Short description of what you're looking up."
      }
    },
    "required": ["name", "description"]
  }
}
```

#### 可查询的知识库

| ID                                       | 适用场景                     |
| ---------------------------------------- | ---------------------------- |
| `KH_bulk_rnaseq_differential_expression` | RNA-seq 差异表达分析最佳实践 |
| `KH_data_analysis_best_practices`        | 数据分析通用最佳实践         |
| `KH_gene_essentiality`                   | 基因必要性 / DepMap 分析     |
| `KH_pathway_enrichment`                  | 通路富集分析（ORA/GSEA）     |

---

### 质量控制

#### 1. `TraceReview` — 执行轨迹审查（幻觉检测）

```json
{
  "name": "TraceReview",
  "description": "Reviews the current execution trace for bugs, hallucinations, and scientific rigor issues. Returns a JSON report with issues and evidence anchored to the trace.",
  "parameters": {
    "type": "object",
    "properties": {
      "description": {
        "type": "string",
        "description": "Short description of why you are running TraceReview."
      },
      "focus": {
        "type": "string",
        "description": "Optional focus areas to prioritize (e.g., 'verify DEG counts match volcano plot', 'check gene names are real')."
      }
    }
  }
}
```

> **调用规则**：`TraceReview` 必须**单独调用**，不能与其他工具同时调用。

## 运行环境

Biomni 在 Python 环境中定义了一些私有函数, 并且预装了一些第三方库.

所有函数原始 API reference 见 `biomni_tool_api_reference.md`.

### 模块一：`molecular_biology`

**导入方式**: `from biomni.tool import molecular_biology`

共 **29 个函数**，分为以下几类：

#### 序列分析

| 函数名                            | 功能描述                               |
| --------------------------------- | -------------------------------------- |
| `find_open_reading_frames`        | 在 DNA 序列中查找所有 ORF（正链+反链） |
| `compare_sequences_for_mutations` | 比对查询序列与参考序列，识别突变位点   |
| `fetch_gene_coding_sequence`      | 从 NCBI Entrez 检索指定基因的编码序列  |

#### 引物设计

| 函数名                               | 功能描述                                          |
| ------------------------------------ | ------------------------------------------------- |
| `align_primers_to_sequence`          | 将引物比对到目标序列（允许1个错配，正反链均检查） |
| `design_simple_primer`               | 在指定窗口内设计单条引物                          |
| `design_pcr_primers_with_overhangs`  | 设计带 overhang 的 PCR 引物对                     |
| `design_sanger_verification_primers` | 设计用于 Sanger 测序验证的引物                    |
| `run_pcr_reaction`                   | 模拟 PCR 扩增                                     |
| `run_multi_primer_pcr`               | 多引物 PCR 模拟（考虑所有引物组合）               |

#### 限制酶

| 函数名                              | 功能描述                          |
| ----------------------------------- | --------------------------------- |
| `find_specific_restriction_sites`   | 在 DNA 中查找指定限制酶的切割位点 |
| `find_all_common_restriction_sites` | 查找常用限制酶的所有切割位点      |
| `digest_with_restriction_enzymes`   | 模拟限制酶消化，返回片段          |

#### 克隆组装

| 函数名                             | 功能描述                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| `design_golden_gate_insert_oligos` | 设计 Golden Gate 组装的 oligo                             |
| `get_golden_gate_protocol`         | 生成 Golden Gate 组装实验方案                             |
| `perform_golden_gate_assembly`     | 预测 Golden Gate 组装的最终构建体序列                     |
| `design_complete_gibson_assembly`  | 完整 Gibson Assembly 工作流（线性化骨架、设计引物、组装） |
| `perform_gateway_lr_reaction`      | 模拟 Gateway LR 克隆反应                                  |
| `get_gateway_lr_protocol`          | 生成 Gateway LR 克隆实验方案                              |
| `assemble_overlapping_oligos`      | 将两段 DNA 序列组装为带 overhang 的 oligo                 |
| `get_oligo_annealing_protocol`     | 返回标准 oligo 退火方案                                   |

#### CRISPR

| 函数名                          | 功能描述                                     |
| ------------------------------- | -------------------------------------------- |
| `compare_knockout_cas_systems`  | 比较不同 CRISPR/Cas 系统的敲除效率与特异性   |
| `compare_delivery_methods`      | 比较不同 CRISPR 递送方式（病毒/非病毒/体内） |
| `design_crispr_knockout_guides` | 从预计算 sgRNA 库中设计 CRISPR 敲除 sgRNA    |

#### 实验方案（Protocol）

| 函数名                                   | 功能描述                  |
| ---------------------------------------- | ------------------------- |
| `get_transformation_protocol`            | 细菌转化标准方案          |
| `get_transfection_protocol`              | 化学转染标准方案          |
| `get_lentivirus_production_protocol`     | HEK293T 慢病毒生产方案    |
| `get_facs_sorting_protocol`              | FACS 流式分选方案         |
| `get_gene_editing_amplicon_pcr_protocol` | 基因编辑扩增子 PCR 方案   |
| `get_western_blot_protocol`              | Western Blot 蛋白检测方案 |

---

### 模块二：`pharmacology`

**导入方式**: `from biomni.tool import pharmacology`

| 函数名                     | 功能描述                                              |
| -------------------------- | ----------------------------------------------------- |
| `predict_admet_properties` | 预测分子的 ADMET 属性（吸收、分布、代谢、排泄、毒性） |

---

### 模块三：`addgene`

**导入方式**: `from biomni.tool.integrations import addgene`

| 函数名                       | 功能描述                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `search_plasmids`            | 在 Addgene 目录中搜索质粒                                |
| `get_plasmid`                | 通过 Addgene ID 获取质粒详细信息                         |
| `get_plasmid_with_sequences` | 获取质粒信息及完整核苷酸序列                             |
| `get_addgene_sequence_files` | 获取可下载的序列文件 URL（GenBank .gbk / SnapGene .dna） |

---

### 模块四：`hpc`（高性能计算）

**导入方式**: `from biomni.tool import hpc`

| 函数名                 | 功能描述                                 |
| ---------------------- | ---------------------------------------- |
| `hpc_search_tools`     | 搜索可用的 HPC 工具（含详细使用说明）    |
| `hpc_run_tool`         | 提交 HPC 作业，立即返回 job_id（非阻塞） |
| `hpc_get_job_results`  | 检查作业状态或获取已完成作业的结果       |
| `hpc_cancel_job`       | 取消正在运行的 HPC 作业                  |
| `hpc_get_logs`         | 获取 HPC 作业日志（非阻塞，一次性检查）  |
| ~~`hpc_run_and_wait`~~ | ⚠️ **已废弃**，不要使用                  |

---

### 第三方 Python 库

除上述专用工具外，还可直接使用以下第三方科学计算库：

**数据分析**: `pandas`, `numpy`, `scipy`, `statsmodels` **机器学习**:
`scikit-learn`, `pymc3` **生物信息**: `biopython`, `scanpy`, `anndata`, `pysam`,
`pybedtools`, `gget`, `DESeq2`, `Seurat`, `clusterProfiler` **结构生物学**:
`rdkit`, `biopandas`, `pdbfixer`, `vina` **可视化**: `matplotlib`, `seaborn`,
`ggplot2`, `ComplexHeatmap` **单细胞**: `scvi-tools`, `scvelo`, `scrublet`,
`harmony-pytorch`, `cellxgene-census` **序列分析**: `biotite`, `mafft`,
`bowtie2`, `bwa`, `samtools` **代谢建模**: `cobra`, `python-libsbml`
**RNA结构**: `viennarna`

## System Prompt

完整 System Prompt 见 `biomni_system_prompt.md` .

### 系统提示词整体架构

```
System Prompt
├── 1. 身份定义
├── 2. 会话上下文
├── 3. 核心原则 (Core Principles)
│   ├── 3.1 科学严谨性
│   ├── 3.2 极简原则
│   ├── 3.3 专业客观性
│   ├── 3.4 数据完整性
│   ├── 3.5 沟通原则
│   ├── 3.6 TraceReview 强制规则
│   └── 3.7 Know-How 指南强制检查
├── 4. 决策框架 (Decision Making)
│   ├── Step 1: 检查 Know-How 指南（强制）
│   ├── Step 2: 澄清歧义
│   └── Step 3: 执行（简单任务 vs 多步骤任务）
├── 5. 用户输出与沟通规范
├── 6. 计算环境描述
│   ├── 6.1 挂载数据库列表
│   ├── 6.2 软件库清单
│   └── 6.3 科学工具清单
├── 7. Know-How 指南列表
├── 8. 工作环境描述
│   ├── 8.1 工作目录规则
│   ├── 8.2 用户上传文件路径
│   ├── 8.3 历史会话结果路径
│   └── 8.4 结果保存规范（文件组织结构）
├── 9. 执行指南 (Execution Guidelines)
│   ├── 9.1 任务规划规则
│   ├── 9.2 报告交付规则
│   ├── 9.3 PPT 交付规则
│   ├── 9.4 可视化规范
│   ├── 9.5 来源引用规范
│   └── 9.6 数据库 Badge 格式
├── 10. Follow-Up 问题格式（强制）
├── 11. 工具调用规范
└── 12. 全部 Tool 定义（JSON Schema）
```

---

### 各节内容摘要

#### 1. 身份定义

```
名称：Biomni
创建者：Phylo
定位：生物医学科学研究协作者，具备计算专业能力
底层：基于最优可用 AI 模型构建
```

#### 2. 会话上下文

```
今日日期：2026-03-05
当前用户：Sam Vlln
```

#### 3. 核心原则（6条强制规则）

| 原则          | 核心内容                                                |
| ------------- | ------------------------------------------------------- |
| 科学严谨性    | 提供完整、高质量的科学分析，应用深度生物/计算专业知识   |
| 极简原则      | 使用能解决问题的最简方法（奥卡姆剃刀）                  |
| 专业客观性    | 技术准确性优先于迎合用户，必要时反驳用户                |
| 数据完整性    | **禁止**捏造/模拟/发明数据，诚实报告局限性              |
| TraceReview   | **强制**：每 2-3 个分析步骤后必须调用，不得仅在最后调用 |
| Know-How 检查 | **强制**：任何任务开始前必须检查所有相关知识库指南      |

#### 4. 决策框架

```
Step 1: 扫描 Know-How 指南列表 → 调用 EnvDetail 加载全部相关指南
Step 2: 歧义时使用 AskUserQuestion（方法选择、预处理决策、输出格式）
Step 3a: 简单任务（<5步）→ 直接执行，最小化工具调用
Step 3b: 复杂任务（≥5步）→ 必须先 PlanWrite，requires_confirmation=true
         执行中遇到方法失败 → 停止，AskUserQuestion，不得静默切换方法
```

#### 5. 用户输出规范

```
- 直接消息：主聊天界面，用于解释和结果
- PlanWrite：独立进度面板
- 禁止在回复中使用 Emoji（除非用户要求）
- 禁止通过工具调用结果向用户传达信息（用户看不到）
```

#### 6. 计算环境

**挂载数据库**（`/mnt/datalake`，只读）：

```
CRISPick, GTEx, LINCS1000, McPAS-TCR, addgene, binding_db, biogrid,
broad_drug_repurposing_hub, cellmarker2, clinpgx, ddinter, depmap,
disgenet, enamine, encode_screen_ccre, evebio, gene_ontology, genebass,
ginkgo_gdp_data, gwas_catalog, human_phenotype_ontology, human_protein_atlas,
miRDB, miRTarBase, mousemine, msigdb, omim, p-hipster, primekg,
rummageo, txgnn
```

**软件库**（可直接在 ExecuteCode 中使用，共 70+ 个）：

```
Python: pandas, numpy, scipy, scikit-learn, scanpy, DESeq2(R), seaborn,
        matplotlib, biopython, rdkit, torch(harmony), scvi-tools 等
R:      DESeq2, Seurat, ggplot2, clusterProfiler, ComplexHeatmap 等
Bio工具: bowtie2, bwa, samtools, gatk, fastqc, trimmomatic 等
```

**科学工具模块**：

```
molecular_biology: 引物设计、PCR、限制酶、CRISPR、Gibson Assembly 等
pharmacology: ADMET 性质预测
addgene: 质粒搜索
hpc: AlphaFold、RFDiffusion、STAR、Salmon 等 49 个 HPC 工具
```

#### 7. Know-How 指南（4个，任务前强制检查）

```
KH_bulk_rnaseq_differential_expression  → RNA-seq DEG 分析最佳实践
KH_data_analysis_best_practices         → 数据分析通用最佳实践
KH_gene_essentiality                    → 基因必要性/DepMap 分析
KH_pathway_enrichment                   → 通路富集分析（ORA/GSEA）
```

#### 8. 工作环境

```
工作目录：/workspace（默认执行位置）
用户上传：/mnt/user-uploads/（只读）
历史结果：/mnt/user-results/（只读）
输出目录：/mnt/results/（读写，实时同步 UI）
Notebook：/mnt/results/execution_trace.ipynb（唯一持久化计算记录）
```

#### 9. 执行指南关键规则

```
可视化：
  - Python: seaborn + matplotlib（ticks 主题）
  - R: ggplot2 + ggprism
  - 每张图必须同时保存 .svg 和 .png
  - 每张图保存后必须调用 Read(mode="media_output_check") 验证

引用规范：
  - 所有外部数据必须用 [N] 格式内联引用
  - 禁止在回复末尾生成参考文献列表（前端自动渲染）
  - 数据库记录用 [[DATABASE:ID]] Badge 格式

报告：
  - 默认不创建报告文件，直接在聊天中回答
  - 仅当用户明确要求时创建 /mnt/results/report_<title>.md
```

#### 10. Follow-Up 问题（强制格式）

Agent 系统指令中**强制要求**的格式，每次最终回复末尾必须包含, 用于前端 UI 解析：

```
---FOLLOW_UP_QUESTIONS---
1. 问题一
2. 问题二
3. 问题三
4. 问题四
---END_FOLLOW_UP---
```

**设计目的**：每次回复结束时，前端 UI 会解析这对标记之间的内容，渲染成独立的"推荐后续问题"组件展示给用户。这是固定协议，**每次最终回复都必须包含，且恰好 4 个问题**。

#### 11. 工具调用规范

```
- 独立工具调用可并行（同一消息中多个调用）
- 有依赖关系的调用必须串行（用 && 链接或等待结果）
- 禁止在同一响应中同时调用 TraceReview 和其他工具
- 禁止在同一响应中同时调用 AskUserQuestion 和其他工具
- 文件路径含空格必须用双引号
- 禁止使用 Bash 执行 find/grep/cat/head/tail/sed/awk/echo
```
