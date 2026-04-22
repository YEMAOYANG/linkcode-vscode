<script setup lang="ts">
import { ref } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import { useChat } from './composables/useChat'
import { useVSCode } from './composables/useVSCode'

const { messages, sendMessage, isLoading } = useChat()
const { postMessage } = useVSCode()

function handleSend(text: string) {
  sendMessage(text)
  postMessage({ type: 'sendMessage', payload: text })
}
</script>

<template>
  <div class="chat-container">
    <div class="messages-list">
      <ChatMessage
        v-for="(msg, idx) in messages"
        :key="idx"
        :role="msg.role"
        :content="msg.content"
      />
      <div v-if="isLoading" class="loading-indicator">
        <span class="dot" /><span class="dot" /><span class="dot" />
      </div>
    </div>
    <ChatInput :disabled="isLoading" @send="handleSend" />
  </div>
</template>

<style>
:root {
  --bg: var(--vscode-editor-background, #1e1e1e);
  --fg: var(--vscode-editor-foreground, #cccccc);
  --border: var(--vscode-panel-border, #333);
  --accent: var(--vscode-button-background, #007acc);
  --input-bg: var(--vscode-input-background, #3c3c3c);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
  font-size: var(--vscode-font-size, 13px);
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.loading-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fg);
  opacity: 0.4;
  animation: blink 1.4s infinite both;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 80%, 100% { opacity: 0.4; }
  40% { opacity: 1; }
}
</style>
