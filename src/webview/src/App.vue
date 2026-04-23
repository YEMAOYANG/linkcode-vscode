<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import ModelSelector from './components/ModelSelector.vue'
import SessionHistory from './components/SessionHistory.vue'
import { useChat } from './composables/useChat'
import { useVSCode } from './composables/useVSCode'
import { usePlatform } from './composables/usePlatform'

const { messages, sendMessage, isLoading, currentModel, models, modelsLoading, changeModel, clearMessages } = useChat()
const { postMessage } = useVSCode()
const { modKey } = usePlatform()

const messagesListRef = ref<HTMLElement | null>(null)
const showModelSelector = ref(false)
const showHistory = ref(false)

const isEmpty = computed(() => messages.value.length === 0)

function handleSend(text: string) {
  sendMessage(text)
  postMessage({ type: 'sendMessage', text })
}

function scrollToBottom() {
  if (messagesListRef.value) {
    messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
  }
}

watch(
  messages,
  () => {
    nextTick(scrollToBottom)
  },
  { deep: true }
)

const quickPrompts = [
  { icon: 'code', text: '写一个 useDebounce hook', prompt: '帮我写一个 React useDebounce hook，支持泛型' },
  { icon: 'chat', text: '解释这段代码的作用', prompt: '解释这段代码的作用，逐行分析' },
  { icon: 'bug', text: '找出代码 Bug 并修复', prompt: '帮我找出这段代码的 Bug 并修复' },
]

function handleQuickPrompt(prompt: string) {
  handleSend(prompt)
}

function handleNewChat() {
  clearMessages()
  postMessage({ type: 'newChat' })
}

function handleModelChange(modelId: string) {
  changeModel(modelId)
  postMessage({ type: 'changeModel', modelId })
  showModelSelector.value = false
}

function handleOpenSettings() {
  // We could open VS Code settings, but for now just log
  postMessage({ type: 'getApiKey' })
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="chat-header">
      <div class="header-left">
        <svg class="header-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.912 5.813a2 2 0 001.272 1.278L21 12l-5.816 1.91a2 2 0 00-1.272 1.277L12 21l-1.912-5.813a2 2 0 00-1.272-1.278L3 12l5.816-1.91a2 2 0 001.272-1.277z" />
        </svg>
        <span class="header-title">LinkCode</span>
      </div>
      <div class="header-right">
        <button
          v-if="!isEmpty"
          class="header-btn"
          title="新会话"
          @click="handleNewChat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          class="header-btn"
          title="会话历史"
          @click="showHistory = !showHistory"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
        <button
          class="header-btn"
          title="设置"
          @click="handleOpenSettings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Main content area -->
    <div
      ref="messagesListRef"
      class="chat-messages"
    >
      <!-- Empty state -->
      <div v-if="isEmpty" class="empty-state">
        <div class="empty-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l1.912 5.813a2 2 0 001.272 1.278L21 12l-5.816 1.91a2 2 0 00-1.272 1.277L12 21l-1.912-5.813a2 2 0 00-1.272-1.278L3 12l5.816-1.91a2 2 0 001.272-1.277z" />
          </svg>
        </div>
        <div class="empty-title">LinkCode AI</div>
        <div class="empty-subtitle">61+ 模型 · 智能路由 · 省钱 50%</div>

        <div class="prompt-cards">
          <button
            v-for="p in quickPrompts"
            :key="p.text"
            class="prompt-card"
            @click="handleQuickPrompt(p.prompt)"
          >
            <span class="prompt-icon">
              <svg v-if="p.icon === 'code'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              <svg v-else-if="p.icon === 'chat'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </span>
            <span class="prompt-label">{{ p.text }}</span>
          </button>
        </div>

        <div class="tips-area">
          <h4>💡 快捷提示</h4>
          <ul>
            <li>选中代码按 {{ modKey }}I 直接引用</li>
            <li>输入 @ 引用文件和项目上下文</li>
            <li>拖拽文件到输入框快速引用</li>
          </ul>
        </div>
      </div>

      <!-- Message list -->
      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :role="msg.role"
        :content="msg.content"
        :model="currentModel"
        :cost="msg.cost"
        :savings="msg.savings"
        :token-count="msg.tokenCount"
      />

      <!-- Thinking indicator -->
      <div v-if="isLoading" class="thinking-msg">
        <div class="msg-header">
          <div class="msg-avatar ai">✦</div>
          <span class="msg-name ai-name">LinkCode</span>
          <span class="msg-meta">思考中</span>
        </div>
        <div class="msg-body">
          <div class="thinking-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <ChatInput
      :disabled="isLoading"
      :current-model="currentModel"
      @send="handleSend"
      @open-model-selector="showModelSelector = true"
    />

    <!-- Model selector overlay -->
    <ModelSelector
      v-if="showModelSelector"
      :current-model="currentModel"
      :models="models"
      :loading="modelsLoading"
      @select="handleModelChange"
      @close="showModelSelector = false"
    />

    <!-- Session history overlay -->
    <SessionHistory
      v-if="showHistory"
      @close="showHistory = false"
      @new-chat="handleNewChat"
    />
  </div>
</template>
