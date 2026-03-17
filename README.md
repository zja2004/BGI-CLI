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

**专为中国大陆用户设计的 AI 命令行工具**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)](https://nodejs.org)
[![Based on](https://img.shields.io/badge/based%20on-Gemini%20CLI-orange.svg)](https://github.com/google-gemini/gemini-cli)

[English](#english) · [中文](#中文使用说明)

</div>

---

## 中文使用说明

BGI CLI 是基于 [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)
二次开发的命令行 AI 工具，针对中国大陆网络环境做了适配，**无需 Google 账号**，原生支持 MiniMax、Kimi、通义千问、DeepSeek 等国内主流 AI 服务商，同时支持任意 OpenAI 兼容接口。

### 功能特性

- 🇨🇳 **国内服务商原生支持** — MiniMax · Kimi · Qwen ·
  DeepSeek，预置 API 地址，开箱即用
- 🔌 **自定义 API 接口** — 支持任意 OpenAI 兼容的 API 地址 + Key
- 🎨 **彩色 BGI 大字 Logo** — 启动界面美观，主题渐变色
- 🛠️ **强大的 AI 编程助手**
  — 读写文件、执行命令、代码搜索、网页获取，一键完成复杂任务
- 💬 **多轮对话** — 完整的上下文记忆，支持会话保存与恢复
- 🔧 **MCP 扩展** — 支持 Model Context Protocol，可接入自定义工具
- 📦 **跨平台** — Windows · macOS · Linux 均可使用

---

### 安装

#### 方式一：从源码安装（推荐）

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

#### 方式二：直接运行（无需安装）

```bash
git clone https://github.com/zja2004/BGI-CLI.git
cd BGI-CLI
npm install
npm run bundle
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

### 各服务商 API Key 获取方式

| 服务商              | 官网注册地址                                           | API 地址                                            |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| **DeepSeek**        | [platform.deepseek.com](https://platform.deepseek.com) | `https://api.deepseek.com/v1`                       |
| **Kimi (Moonshot)** | [platform.moonshot.cn](https://platform.moonshot.cn)   | `https://api.moonshot.cn/v1`                        |
| **通义千问 (Qwen)** | [dashscope.aliyun.com](https://dashscope.aliyun.com)   | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **MiniMax**         | [platform.minimax.chat](https://platform.minimax.chat) | `https://api.minimax.chat/v1`                       |
| **自定义**          | 任意 OpenAI 兼容接口                                   | 自行填写                                            |

---

### 使用示例

#### 对话模式

```bash
bgi
```

```
BGI CLI v0.35.0

> 帮我用 Python 写一个快速排序算法

✓ 当然，下面是 Python 快速排序实现：

def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    ...
```

#### 非交互式模式（单次执行）

```bash
# 直接传入提示词
bgi -p "解释一下 Docker 和虚拟机的区别"

# 分析当前目录代码
bgi -p "分析这个项目的架构，列出主要模块"

# 输出 JSON 格式（适合脚本集成）
bgi -p "列出5个设计模式" --output-format json
```

#### 常用快捷键

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
/model         # 切换模型
/settings      # 打开设置界面
/clear         # 清空对话历史
/memory show   # 查看当前上下文
/help          # 查看全部命令
/quit          # 退出程序
```

---

### 切换服务商

已认证后如需切换服务商：

```bash
# 方式1：在对话界面输入
/auth

# 方式2：启动时指定
bgi --auth
```

---

### 自定义 API 接口

如果你有自己的 API 服务（例如本地部署的模型，或 API 中转站），选择
**"自定义 API"** 选项：

```
自定义 API — 输入 API Key
自定义 API 地址 (Base URL)：
┌────────────────────────────────────┐
│ https://your-api-endpoint/v1       │
└────────────────────────────────────┘

API Key：
┌────────────────────────────────────┐
│ 粘贴您的 API Key                    │
└────────────────────────────────────┘
```

支持任意符合 OpenAI API 格式的接口。

---

### 高级配置

#### 通过环境变量配置

```bash
# 直接使用 API Key（跳过对话界面）
export GEMINI_API_KEY="your-api-key"
export GOOGLE_GEMINI_BASE_URL="https://api.deepseek.com/v1"

bgi
```

#### 配置文件

BGI CLI 配置文件位于 `~/.gemini/settings.json`（与 Gemini CLI 共用配置目录）：

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

### 常见问题

**Q: 启动后提示 "No authentication method selected"？**

A: 运行 `bgi` 后选择一个服务商并输入对应的 API Key 即可。

**Q: API Key 保存在哪里？**

A: API Key 使用系统 Keychain（Windows 凭据管理器 / macOS Keychain / Linux Secret
Service）安全存储，不会明文写入磁盘。

**Q: 能用 DeepSeek R1 等推理模型吗？**

A: 可以，使用 `/model` 命令切换具体模型名称即可。

**Q: 是否支持代理？**

A: 支持。在设置中配置 `proxy` 字段，或设置环境变量 `HTTPS_PROXY`。

**Q: API 响应格式和 Gemini 不兼容怎么办？**

A: 国内服务商一般支持 OpenAI 兼容模式。如遇格式问题，推荐使用支持 Gemini 格式转换的 API 中转服务（如
[one-api](https://github.com/songquanpeng/one-api)）。

---

### 项目结构

```
BGI-CLI/
├── packages/
│   ├── core/          # 核心逻辑：认证、模型、工具
│   └── cli/           # CLI 界面：React/Ink 渲染
├── bundle/            # 打包后的可执行文件
├── schemas/           # 配置 JSON Schema
└── docs/              # 文档
```

---

### 参与贡献

欢迎提交 Issue 和 Pull Request！

```bash
# Fork 并克隆
git clone https://github.com/your-username/BGI-CLI.git
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
[Google Gemini CLI](https://github.com/google-gemini/gemini-cli), adapted for
users in mainland China. It removes Google authentication and adds native
support for Chinese AI providers.

### Supported Providers

| Provider        | Base URL                                            |
| --------------- | --------------------------------------------------- |
| DeepSeek        | `https://api.deepseek.com/v1`                       |
| Kimi (Moonshot) | `https://api.moonshot.cn/v1`                        |
| Qwen (Alibaba)  | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| MiniMax         | `https://api.minimax.chat/v1`                       |
| Custom API      | Any OpenAI-compatible endpoint                      |

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
bgi -p "Explain the CAP theorem"

# With environment variables
GEMINI_API_KEY=your-key GOOGLE_GEMINI_BASE_URL=https://api.deepseek.com/v1 bgi
```

### License

Apache 2.0 — see [LICENSE](LICENSE)
