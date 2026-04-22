# LinkCode — AI Coding Assistant for VS Code

> Inline completion, Chat panel, Code review — powered by AI.

## Features

- **Ghost Text (Inline Completion)** — AI-powered code suggestions as you type
- **Chat Panel** — Conversational AI assistant in the sidebar
- **CodeLens** — Explain and Refactor actions on functions/classes
- **Streaming** — Real-time SSE-based response streaming

## Getting Started

### Prerequisites

- VS Code >= 1.85.0
- Node.js >= 18
- pnpm

### Installation

```bash
# Clone the repo
git clone https://github.com/YEMAOYANG/linkcode-vscode.git
cd linkcode-vscode

# Install dependencies
pnpm install

# Build the extension
pnpm run build

# Build the WebView (optional for dev)
cd src/webview && pnpm install && pnpm run build
```

### Development

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. The extension activates on supported languages (JS/TS/Python/Java/Go/Rust/C/C++)

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `linkcode.apiEndpoint` | `https://api.linkcode.ai` | API endpoint |
| `linkcode.apiKey` | `""` | API key |
| `linkcode.enableInlineCompletion` | `true` | Enable Ghost Text |
| `linkcode.completionDebounceMs` | `300` | Debounce delay (ms) |

### Keybindings

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+L` / `Ctrl+Shift+L` | Open Chat Panel |
| `Tab` | Accept inline suggestion |

## Architecture

```
src/
├── extension.ts              # Entry point
├── providers/
│   ├── InlineCompletionProvider.ts   # Ghost Text
│   ├── ChatViewProvider.ts           # Chat WebView
│   └── CodeLensProvider.ts           # CodeLens
├── commands/                 # Command handlers
├── api/                      # HTTP client, SSE stream, types
├── webview/                  # Vue 3 WebView UI
└── utils/                    # Debounce, logger, context extraction
```

## License

MIT
