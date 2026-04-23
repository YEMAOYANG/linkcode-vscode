<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import ModelSelector from './components/ModelSelector.vue'
import SessionHistory from './components/SessionHistory.vue'
import Onboarding from './components/Onboarding.vue'
import CostDashboard from './components/CostDashboard.vue'
import Settings from './components/Settings.vue'
import { useChat } from './composables/useChat'
import { useVSCode } from './composables/useVSCode'
import { usePlatform } from './composables/usePlatform'

const { messages, sendMessage, isLoading, currentModel, models, modelsLoading, changeModel, clearMessages, sessionStats } = useChat()
const { postMessage, onMessage } = useVSCode()
const { modKey } = usePlatform()

const messagesListRef = ref<HTMLElement | null>(null)
const showModelSelector = ref(false)
const showHistory = ref(false)
const showOnboarding = ref(false)
const showCostDashboard = ref(false)
const showSettings = ref(false)

// Listen for onboarding trigger from extension host
let cleanupOnboarding: (() => void) | undefined
onMounted(() => {
  cleanupOnboarding = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string }
    if (msg.type === 'show_onboarding') {
      showOnboarding.value = true
    }
  })
})
onUnmounted(() => {
  cleanupOnboarding?.()
})

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
  showSettings.value = true
}

function handleOnboardingComplete() {
  showOnboarding.value = false
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="chat-header">
      <div class="header-left">
        <svg class="header-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-button-bg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          <path d="M20 3v4"/><path d="M22 5h-4"/>
          <path d="M4 17v2"/><path d="M5 18H3"/>
        </svg>
        <span class="header-title">LinkCode</span>
      </div>
      <div class="header-right">
        <button
          class="header-btn cost-btn"
          title="费用看板"
          @click="showCostDashboard = !showCostDashboard"
        >
          <span class="cost-btn-text">¥{{ sessionStats.estimatedCost.toFixed(2) }}</span>
        </button>
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
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-button-bg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/><path d="M22 5h-4"/>
            <path d="M4 17v2"/><path d="M5 18H3"/>
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
          <div class="msg-avatar ai">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-button-bg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              <path d="M20 3v4"/><path d="M22 5h-4"/>
              <path d="M4 17v2"/><path d="M5 18H3"/>
            </svg>
          </div>
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

    <!-- Onboarding overlay -->
    <Onboarding
      v-if="showOnboarding"
      :models="models"
      @complete="handleOnboardingComplete"
      @skip="showOnboarding = false"
    />

    <!-- Cost Dashboard overlay -->
    <CostDashboard
      v-if="showCostDashboard"
      :stats="sessionStats"
      @close="showCostDashboard = false"
    />

    <!-- Settings overlay -->
    <Settings
      v-if="showSettings"
      :current-model="currentModel"
      :models="models"
      @close="showSettings = false"
    />
  </div>
</template>
