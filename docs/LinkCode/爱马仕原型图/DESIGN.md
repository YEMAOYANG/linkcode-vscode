# Design System: LinkCode

> **LinkCode — AI 多模型编程助手 VS Code 插件**
>
> 设计语言：Cursor 暗色主题 × Linear 精确感 × 蓝紫渐变品牌色
> 面向中国开发者，全中文界面
>
> **字体栈：**
> - **UI:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
> - **代码:** `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
> ```html
> <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
> ```

## 1. Visual Theme & Atmosphere（视觉主题）

LinkCode 的视觉体系构建于 VS Code Dark+ 的暗色基底之上，以 `#1e1e1e` 作为编辑器主背景，`#181818` 作为活动栏最深层，营造出沉浸式的编码环境。这不是简单的"暗色主题"——而是一个精心校准的亮度梯度系统，从 `#181818`（最深）到 `#3c3c3c`（输入框），形成清晰的空间层级。

品牌识别通过蓝紫渐变（`#7c3aed` → `#5ea2ef`，135° 方向）注入——这道渐变如同暗夜中的极光，出现在活动栏图标、状态栏品牌区、主要 CTA 按钮和 Logo 文字上。渐变的紫色端 `#7c3aed` 传递智能与创造力，蓝色端 `#5ea2ef` 传递信任与技术感。

与 Linear 类似，LinkCode 采用极简的色彩策略——暗色背景 + 灰度文字 + 单一品牌色系。装饰性色彩被严格控制，只有语义色（成功绿、错误红、警告黄）在功能性上下文中出现。边框使用低对比度的 `#3e3e42`，在暗色背景上提供结构而不产生视觉噪音。

与 Cursor 的代码编辑器优雅感一脉相承，代码区域使用 JetBrains Mono 字体，Ghost Text 补全建议以 `rgba(107,107,107,0.4)` 的半透明灰色呈现，既清晰可读又不干扰已有代码。macOS 窗口 chrome（红绿灯按钮 + 标题栏）作为统一的外框包裹所有页面，强化桌面应用的真实感。

**核心特征：**
- VS Code Dark+ 暗色基底（`#1e1e1e` 主背景）
- 蓝紫渐变品牌色 `#7c3aed` → `#5ea2ef`（135° 方向）
- JetBrains Mono 代码字体 + Inter UI 字体的双字体系统
- 4 级圆角系统（4/6/8/12px）对应不同组件层级
- macOS Window Chrome 统一外框
- 最小化装饰色，语义色仅用于功能性上下文
- 面向中国开发者的全中文界面

## 2. Color Palette & Roles（色板与角色）

### 品牌色
- **Brand Purple** (`#7c3aed`): 品牌主色，`--accent`。用于主要 CTA、活跃状态、品牌标识。偏红紫，传递智能创造力。
- **Brand Blue** (`#5ea2ef`): 品牌辅色，渐变终点。传递信任与技术感。
- **Brand Gradient** (`linear-gradient(135deg, #7c3aed, #5ea2ef)`): 品牌渐变，用于 Logo、主按钮、状态栏品牌区、Badge。
- **Brand Light** (`#9b7dff`): 品牌亮色变体，`--accent-light`。用于链接悬浮、辅助强调。

### 背景色阶
- **Background Deepest** (`#181818`): `--bg-activity`。活动栏、状态栏——最深的背景层。
- **Background Primary** (`#1e1e1e`): `--bg-primary`。编辑器主背景、标题栏——VS Code Dark+ 标准。
- **Background Sidebar** (`#1f1f1f`): `--bg-sidebar`。侧边栏——比编辑器略深，区分空间。
- **Background Secondary** (`#252526`): `--bg-secondary`。标签栏——面板层背景。
- **Background Tertiary** (`#2d2d2d`): `--bg-tertiary`。悬浮层、卡片——第三层背景。
- **Background Hover** (`#2a2d2e`): `--bg-hover`。悬浮态背景。
- **Background Selected** (`#37373d`): `--bg-selected`。选中态背景。
- **Background Input** (`#3c3c3c`): `--bg-input`。输入框背景——最亮的背景层。

### 文字色阶
- **Text Bright** (`#e1e1e1`): `--text-bright`。标题、强调文字——最亮。
- **Text Primary** (`#cccccc`): `--text-primary`。正文——VS Code 默认文字色。
- **Text Secondary** (`#858585`): `--text-secondary`。辅助文字、标签。
- **Text Muted** (`#6e6e6e`): `--text-muted`。占位符、行号——最暗的文字。

### 边框
- **Border Primary** (`#3e3e42`): `--border`。标准边框。
- **Border Light** (`#4e4e52`): `--border-light`。强调边框、悬浮态。

### 语义色
- **Success Green** (`#4ec9b0`): `--green`。成功、在线状态、正增长。来自 VS Code 的 interface color。
- **Success Light** (`#73c991`): `--success`。轻量成功提示。
- **Error Red** (`#f14c4c`): `--red` / `--error`。错误、删除、紧急。
- **Warning Yellow** (`#cca700`): `--warning`。警告、注意。
- **Info Blue** (`#75beff`): `--info`。信息提示。

### 语义色背景
- **Green BG** (`rgba(78, 201, 176, 0.12)`): Diff 新增行、成功卡片背景。
- **Red BG** (`rgba(241, 76, 76, 0.12)`): Diff 删除行、错误卡片背景。

### 代码语法高亮
- **Keyword/Control** (`#c586c0`): `--purple`。import, const, if, return 等。
- **Function** (`#dcdcaa`): `--yellow`。函数名、方法调用。
- **String** (`#ce9178`): `--orange`。字符串字面量。
- **Number/Type** (`#4ec9b0`): `--green`。数字、类型名。
- **Variable** (`#9cdcfe`): `--light-blue`。变量名。
- **Builtin** (`#569cd6`): `--blue`。内置关键字、布尔值。
- **Comment** (`#6a9955`): 注释——温和的绿色。

### Ghost Text
- **Ghost Text** (`rgba(107, 107, 107, 0.4)`): `--ghost`。AI 补全建议文字——低透明度确保不干扰已有代码。

## 3. Typography Rules（字体规范）

### 字体族
- **UI 字体**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **代码字体**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **中文降级**: Inter 支持基本拉丁字符，中文字符降级至系统字体（macOS: PingFang SC, Windows: Microsoft YaHei）

### 字体层级

| 角色 | 字体 | 字号 | 字重 | 行高 | 字间距 | 用途 |
|------|------|------|------|------|--------|------|
| 页面标题 | Inter | 22px | 700 | 1.3 | -0.2px | 仪表板标题、设置页标题 |
| 区域标题 | Inter | 16px | 600 | 1.4 | normal | 卡片标题、分组标题 |
| 正文 | Inter | 13px | 400 | 1.5 | normal | 主要 UI 文字（VS Code 标准） |
| 辅助文字 | Inter | 12px | 400 | 1.4 | normal | 状态栏、面包屑 |
| 标签/徽章 | Inter | 11px | 500-600 | 1.2 | 0.5px | 侧边栏标题（大写）、Badge |
| 代码正文 | JetBrains Mono | 13.5px | 400 | 20px | normal | 编辑器代码 |
| 代码小字 | JetBrains Mono | 12px | 400 | 1.6 | normal | Chat 代码块 |
| 快捷键 | Inter | 10px | 400 | 1.0 | normal | kbd 元素 |

### 排版规则
- 代码行高固定 20px（确保行号对齐）
- Chat 消息行高 1.6（舒适阅读）
- 段落间距 8px
- 中文正文不使用斜体（无衬线中文斜体可读性差）

## 4. Component Stylings（组件样式）

### 按钮系统

**主要按钮 `.btn-primary`**
```css
background: linear-gradient(135deg, #7c3aed, #5ea2ef);
color: white;
padding: 6px 14px;
border-radius: 6px;
font-size: 13px;
font-weight: 500;
/* States */
:hover  → opacity: 0.9; transform: translateY(-1px);
:active → opacity: 0.8; transform: translateY(0);
:disabled → opacity: 0.4; cursor: not-allowed; transform: none;
```

**次要按钮 `.btn-secondary`**
```css
background: #3c3c3c;
color: #cccccc;
border: 1px solid #3e3e42;
/* States */
:hover  → border-color: #4e4e52;
:active → background: #37373d;
:disabled → opacity: 0.4;
```

**幽灵按钮 `.btn-ghost`**
```css
background: transparent;
color: #858585;
/* States */
:hover  → color: #cccccc; background: #2a2d2e;
:active → background: #37373d;
```

**按钮尺寸**
- Small: `padding: 4px 10px; font-size: 12px;`
- Default: `padding: 6px 14px; font-size: 13px;`
- Large: `padding: 10px 24px; font-size: 14px;`

### 输入框 `.input`
```css
background: #3c3c3c;
border: 1px solid #3e3e42;
border-radius: 6px;
padding: 8px 12px;
font-size: 13px;
color: #cccccc;
/* States */
:focus → border-color: #7c3aed;
:disabled → opacity: 0.5;
::placeholder → color: #6e6e6e;
```

### 卡片
```css
background: #2d2d2d;
border: 1px solid #3e3e42;
border-radius: 8px;
padding: 18px;
/* Hover */
:hover → border-color: rgba(124, 58, 237, 0.3);
```

### 徽章 Badge
```css
/* Pro */
.badge-pro: background: brand-gradient; color: white;
/* Free */
.badge-free: background: #3c3c3c; color: #858585;
/* New */
.badge-new: background: rgba(78,201,176,0.15); color: #4ec9b0;
```

### 代码块（Chat 内）
```css
.code-block {
  background: #1a1a2e;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  overflow: hidden;
}
.code-block-header {
  background: rgba(0,0,0,0.2);
  padding: 6px 10px;
  font-size: 11px;
  /* 包含语言标签 + 复制/插入/Apply 按钮 */
}
.code-block-body {
  padding: 10px 12px;
  font-family: JetBrains Mono;
  font-size: 12px;
  line-height: 1.6;
}
```

### 开关 Toggle
```css
width: 36px; height: 20px;
border-radius: 10px;
background: #3c3c3c; /* off */
background: #7c3aed; /* on */
transition: background 0.2s;
/* 滑块：14px 圆形, white */
```

### 下拉菜单
```css
background: #2d2d2d;
border: 1px solid #3e3e42;
border-radius: 6px;
box-shadow: 0 8px 30px rgba(0,0,0,0.4);
/* 菜单项 */
padding: 6px 12px;
:hover → background: #2a2d2e;
```

### Toast 通知
```css
position: fixed; top: 20px; right: 20px;
background: #2d2d2d;
border: 1px solid #3e3e42;
border-radius: 8px;
padding: 12px 16px;
box-shadow: 0 8px 30px rgba(0,0,0,0.4);
/* 左侧色条标识类型 */
border-left: 3px solid [语义色];
```

## 5. Layout Principles（布局原则）

### VS Code 标准布局
```
┌─ Title Bar (38px) ──────────────────────────────┐
├─────┬───────────┬──────────────────────┬────────┤
│     │           │                      │        │
│ Act │ Sidebar   │ Editor Area          │ Chat   │
│ Bar │ (280px)   │ (flex: 1)            │ Panel  │
│(48px│           │                      │(380px) │
│     │           │                      │        │
├─────┴───────────┴──────────────────────┴────────┤
└─ Status Bar (24px) ─────────────────────────────┘
```

### 间距系统
- 基础单位: 4px
- 组件内边距: 8px, 12px, 16px, 18px, 24px
- 组件间距: 8px, 12px, 14px, 16px, 24px, 28px
- 页面边距: 36px-48px
- Chat 面板宽度: 380px
- 侧边栏宽度: 280px
- 活动栏宽度: 48px

### 全局窗口
```css
.macos-window {
  width: 1440px;
  height: 900px;
  border-radius: 10px;
  box-shadow: 0 25px 80px rgba(0,0,0,0.55),
              0 0 0 1px rgba(255,255,255,0.05);
}
```

## 6. Depth & Elevation（深度层级）

### 层级系统（从低到高）
| 层级 | 背景色 | 用途 | 阴影 |
|------|--------|------|------|
| Level 0 | `#181818` | 活动栏、状态栏 | 无 |
| Level 1 | `#1e1e1e` | 编辑器、标题栏 | 无 |
| Level 2 | `#1f1f1f` | 侧边栏 | 无 |
| Level 3 | `#252526` | 标签栏 | 无 |
| Level 4 | `#2d2d2d` | 卡片、悬浮面板 | `0 4px 12px rgba(0,0,0,0.3)` |
| Level 5 | `#2d2d2d` | 下拉菜单、Tooltip | `0 8px 30px rgba(0,0,0,0.4)` |
| Level 6 | `#2d2d2d` | 模态对话框 | `0 25px 80px rgba(0,0,0,0.55)` |

### 边框辅助层级
- Level 0-3: 使用 `1px solid #3e3e42` 边框分隔
- Level 4+: 额外使用 `box-shadow` 提升浮动感
- 品牌强调: `border-color: rgba(124, 58, 237, 0.3)` 聚焦边框

## 7. Interaction & Motion（交互动效）

### 动画库

```css
/* 淡入上移 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 从左滑入 */
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-16px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 从上滑入 */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 缩放进入 */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* 骨架屏微光 */
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}

/* 脉冲 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 闪烁光标 */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 打字展开 */
@keyframes typing {
  from { width: 0; }
  to { width: 100%; }
}

/* 数字跳动 */
@keyframes countUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 弹跳 */
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}
```

### 过渡时间规范
| 交互类型 | 持续时间 | 缓动函数 |
|---------|---------|---------|
| 悬浮颜色变化 | 150ms | ease |
| 按钮状态 | 150ms | ease |
| 展开/折叠 | 200ms | ease-out |
| 页面切换 | 300ms | ease-in-out |
| 淡入动画 | 300ms | ease |
| 模态弹出 | 200ms | ease-out |
| Toast 通知 | 300ms (进), 200ms (出) | ease |

### 关键交互模式
- **Ghost Text**: 打字机效果，逐字符显示，`animation-timing-function: steps(N)`
- **流式输出**: 逐字追加 + 末尾闪烁光标 `█`
- **悬浮浮起**: `transform: translateY(-2px)` + `box-shadow` 加深
- **三点跳动**: 思考中指示器，三个圆点交错 `pulse` 动画（delay 0, 0.2s, 0.4s）
- **数字增长**: 从 0 到目标值的 `countUp` 动画，搭配 `requestAnimationFrame`
- **代码逐行展开**: Diff 行依次 `fadeIn`，每行 delay 递增 50ms

## 8. VS Code Integration（VS Code 主题变量映射）

### CSS 变量对照表
| LinkCode 变量 | VS Code 主题变量 | 值 |
|--------------|-----------------|-----|
| `--bg-primary` | `--vscode-editor-background` | `#1e1e1e` |
| `--bg-secondary` | `--vscode-editorGroupHeader-tabsBackground` | `#252526` |
| `--bg-sidebar` | `--vscode-sideBar-background` | `#1f1f1f` |
| `--bg-activity` | `--vscode-activityBar-background` | `#181818` |
| `--bg-input` | `--vscode-input-background` | `#3c3c3c` |
| `--bg-hover` | `--vscode-list-hoverBackground` | `#2a2d2e` |
| `--bg-selected` | `--vscode-list-activeSelectionBackground` | `#37373d` |
| `--border` | `--vscode-panel-border` | `#3e3e42` |
| `--text-primary` | `--vscode-foreground` | `#cccccc` |
| `--text-secondary` | `--vscode-descriptionForeground` | `#858585` |
| `--text-muted` | `--vscode-disabledForeground` | `#6e6e6e` |
| `--accent` | `--vscode-focusBorder` | `#7c3aed` |
| `--green` | `--vscode-terminal-ansiGreen` | `#4ec9b0` |
| `--red` | `--vscode-errorForeground` | `#f14c4c` |
| `--warning` | `--vscode-editorWarning-foreground` | `#cca700` |

### Webview 适配
```css
/* 在 VS Code Webview 中，使用 vscode 主题变量实现主题跟随 */
body {
  background: var(--vscode-editor-background, #1e1e1e);
  color: var(--vscode-foreground, #cccccc);
  font-family: var(--vscode-font-family, 'Inter', sans-serif);
}
```

### Codicon 图标系统
- 使用 VS Code 内置 Codicon 图标体系
- 图标尺寸: 16px（标准）、24px（活动栏）
- 图标颜色跟随文字色

## 9. Agent Prompt Guide（AI Agent 使用指南）

### 给 AI 设计 Agent 的提示词

当你需要为 LinkCode 创建新的 UI 页面或组件时，请遵循以下规则：

**必须遵守：**
1. 品牌主色 `#7c3aed`，渐变终点 `#5ea2ef`，渐变方向 135°
2. 暗色主题基底 `#1e1e1e`，不使用白色/浅色背景
3. 所有文字使用中文（按钮、标签、提示、错误信息等）
4. 使用 `shared-styles.css` 中定义的 CSS 变量和基础组件
5. 每个页面包裹在 `.macos-window` 容器中，保持 1440×900 的窗口尺寸
6. 状态栏始终显示 LinkCode 品牌区 + 模型名 + 路由状态 + Token 余额

**组件构建顺序：**
1. macOS Window Chrome (标题栏 + 红绿灯)
2. VS Code Layout (活动栏 + 侧边栏/Chat面板 + 编辑器)
3. 状态栏
4. 浮动元素 (Tooltip, Dropdown, Modal)

**交互状态清单：**
- 每个可点击元素：default / hover / active / disabled 四态
- 每个数据页面：加载中 / 有数据 / 空数据 / 错误 四态
- Chat 面板：空态 / 对话中 / AI思考 / 错误 / Token耗尽
- 表单：默认 / 聚焦 / 验证中 / 成功 / 失败

**文件命名规范：**
```
01-editor-completion.html  — 主编辑器 + AI 补全
02-chat-panel.html         — 侧边栏 Chat 面板
03-inline-edit.html        — Inline Edit (⌘K)
04-model-settings.html     — 模型选择 & 路由设置
05-token-dashboard.html    — Token 使用仪表板
06-code-review.html        — AI 代码审查
07-welcome.html            — 欢迎/登录页
08-pricing.html            — 定价页
09-onboarding.html         — 新手引导流程
10-chat-states.html        — Chat 面板多状态
11-token-warnings.html     — Token 预警系统
12-chat-history.html       — 对话历史管理
13-settings-extended.html  — 扩展设置
```

**代码模板：**
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>LinkCode - [页面名称]</title>
<link rel="stylesheet" href="shared-styles.css">
<style>
body { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
/* 页面专属样式 */
</style>
</head>
<body>
<div class="macos-window">
  <div class="titlebar">
    <div class="traffic-lights">
      <span class="tl-close"></span>
      <span class="tl-minimize"></span>
      <span class="tl-maximize"></span>
    </div>
    <div class="titlebar-text">[页面标题] — LinkCode</div>
  </div>
  <div class="vscode-layout">
    <!-- 活动栏 -->
    <div class="activity-bar">...</div>
    <!-- 主内容区 -->
    ...
  </div>
  <div class="status-bar">
    <div class="status-accent">LinkCode</div>
    <div class="status-bar-left">...</div>
    <div class="status-bar-right">...</div>
  </div>
</div>
<script>
// 页面交互脚本
</script>
</body>
</html>
```

---

*LinkCode Design System v1.0 — 2026-04-22*
*基于 Cursor × Linear × VS Code Dark+ 设计语言*
