<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import ModelSelector from './components/ModelSelector.vue'
import SessionHistory from './components/SessionHistory.vue'
import Onboarding from './components/Onboarding.vue'
import CostDashboard from './components/CostDashboard.vue'
import Settings from './components/Settings.vue'
import ErrorState from './components/ErrorState.vue'
import LoadingState from './components/LoadingState.vue'
import TokenWarning from './components/TokenWarning.vue'
import CodeReview from './components/CodeReview.vue'
import InlineEditPanel from './components/InlineEditPanel.vue'
import Login from './components/Login.vue'
import UpgradePrompt from './components/UpgradePrompt.vue'
import type { ErrorType } from './components/ErrorState.vue'
import { useChat } from './composables/useChat'
import { useVSCode } from './composables/useVSCode'
import { usePlatform } from './composables/usePlatform'

const { messages, sendMessage, isLoading, currentModel, models, modelsLoading, changeModel, clearMessages, sessionStats } = useChat()
const { postMessage, onMessage } = useVSCode()
const { modKey } = usePlatform()

const messagesListRef = ref<HTMLElement | null>(null)
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)
const showModelSelector = ref(false)
const showHistory = ref(false)
const showOnboarding = ref(false)
const showCostDashboard = ref(false)
const showSettings = ref(false)
const showCodeReview = ref(false)
const showInlineEdit = ref(false)
const showLogin = ref(false)
const showUpgrade = ref(false)

// Error state
const errorState = ref<{ type: ErrorType; message?: string } | null>(null)

// Token missing state
const tokenMissingInfo = ref<{ group: string; model: string } | null>(null)

// Token invalid state (Feature 4)
const tokenInvalidGroup = ref<string | null>(null)

// Settings params (Feature 2)
const settingsTab = ref<string | undefined>(undefined)
const settingsHighlightGroup = ref<string | undefined>(undefined)

// Filter unlocked for model selector (Feature 6)
const filterUnlockedModels = ref(false)

// Token warning level
const tokenWarningLevel = computed<'warning' | 'critical' | null>(() => {
  const cost = sessionStats.value.estimatedCost
  // Simulate: > ¥8 = critical, > ¥5 = warning (for demo purposes)
  if (cost > 8) return 'critical'
  if (cost > 5) return 'warning'
  return null
})

const tokenPercentage = computed(() => {
  const cost = sessionStats.value.estimatedCost
  // Simulate remaining percentage based on a ¥10 budget
  const budget = 10
  const remaining = Math.max(0, ((budget - cost) / budget) * 100)
  return Math.round(remaining)
})

// Listen for messages from extension host
let cleanupListeners: (() => void) | undefined
onMounted(() => {
  cleanupListeners = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string; errorType?: string; message?: string }
    switch (msg.type) {
      case 'show_onboarding':
        showOnboarding.value = true
        break
      case 'show_error':
        errorState.value = {
          type: (msg.errorType as ErrorType) || 'network',
          message: msg.message,
        }
        break
      case 'clear_error':
        errorState.value = null
        break
      case 'show_code_review':
        showCodeReview.value = true
        break
      case 'show_inline_edit':
        showInlineEdit.value = true
        break
      case 'show_login':
        showLogin.value = true
        break
      case 'tokenMissing': {
        const tmMsg = msg as { type: string; group: string; model: string }
        tokenMissingInfo.value = { group: tmMsg.group, model: tmMsg.model }
        break
      }
      case 'tokenInvalid': {
        const tiMsg = msg as { type: string; group: string }
        tokenInvalidGroup.value = tiMsg.group
        break
      }
      case 'open_settings': {
        const osMsg = msg as { type: string; tab?: string; highlightGroup?: string }
        settingsTab.value = osMsg.tab
        settingsHighlightGroup.value = osMsg.highlightGroup
        showSettings.value = true
        break
      }
    }
  })
})
onUnmounted(() => {
  cleanupListeners?.()
})

const isEmpty = computed(() => messages.value.length === 0)

function handleSend(text: string) {
  // Clear any error on new message
  errorState.value = null
  tokenMissingInfo.value = null
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
  errorState.value = null
  postMessage({ type: 'newChat' })
}

function handleModelChange(modelId: string) {
  changeModel(modelId)
  postMessage({ type: 'changeModel', modelId })
  showModelSelector.value = false
}

function handleOpenSettings() {
  settingsTab.value = undefined
  settingsHighlightGroup.value = undefined
  showSettings.value = true
}

function handleOnboardingComplete() {
  showOnboarding.value = false
}

// Error state handlers
function handleErrorRetry() {
  errorState.value = null
  // Retry last message
  const lastUserMsg = [...messages.value].reverse().find((m) => m.role === 'user')
  if (lastUserMsg) {
    postMessage({ type: 'sendMessage', text: lastUserMsg.content })
  }
}

function handleErrorReconfigure() {
  errorState.value = null
  showSettings.value = true
}

function handleErrorSwitchModel() {
  errorState.value = null
  showModelSelector.value = true
}

// Code quote handler (from CodeBlock)
function handleCodeQuote(code: string, language: string) {
  chatInputRef.value?.setQuotedCode(code, language)
}
</script>

<template>
  <div class="app-container">
    <!-- Token Warning Banner -->
    <TokenWarning
      v-if="tokenWarningLevel"
      :level="tokenWarningLevel"
      :percentage="tokenPercentage"
      @upgrade="showUpgrade = true"
    />

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
      <div v-if="isEmpty && !errorState" class="empty-state">
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

      <!-- Token Missing Banner -->
      <div v-if="tokenMissingInfo" class="token-missing-banner">
        <div class="token-missing-icon">🔑</div>
        <div class="token-missing-text">
          模型 <strong>{{ tokenMissingInfo.model }}</strong> 需要配置 <strong>{{ tokenMissingInfo.group }}</strong> 分组的 Token
        </div>
        <button class="token-missing-btn" @click="settingsTab = 'tokens'; settingsHighlightGroup = tokenMissingInfo?.group; showSettings = true; tokenMissingInfo = null">
          去配置
        </button>
        <button class="token-missing-btn" style="background: var(--lc-elevated); color: var(--lc-text-primary); border: 1px solid var(--lc-border);" @click="filterUnlockedModels = true; showModelSelector = true; tokenMissingInfo = null">
          换个模型
        </button>
      </div>

      <!-- Token Invalid Banner (Feature 4) -->
      <div v-if="tokenInvalidGroup" class="token-invalid-banner">
        <span>⚠️ {{ tokenInvalidGroup }} 令牌已失效，请重新配置</span>
        <button class="token-invalid-btn" @click="settingsTab = 'tokens'; settingsHighlightGroup = tokenInvalidGroup ?? undefined; showSettings = true; tokenInvalidGroup = null">
          更新令牌
        </button>
      </div>

      <!-- Error State -->
      <ErrorState
        v-if="errorState"
        :error-type="errorState.type"
        :message="errorState.message"
        @retry="handleErrorRetry"
        @reconfigure="handleErrorReconfigure"
        @switch-model="handleErrorSwitchModel"
      />

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
        :message-id="msg.id"
      />

      <!-- Thinking indicator (upgraded with LoadingState) -->
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
          <LoadingState type="chat" />
        </div>
      </div>
    </div>

    <!-- Input area -->
    <ChatInput
      ref="chatInputRef"
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
      :filter-unlocked="filterUnlockedModels"
      @select="handleModelChange"
      @close="showModelSelector = false; filterUnlockedModels = false"
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
      :initial-tab="settingsTab"
      :highlight-group="settingsHighlightGroup"
      @close="showSettings = false"
    />

    <!-- Code Review overlay -->
    <CodeReview
      v-if="showCodeReview"
      @close="showCodeReview = false"
    />

    <!-- Inline Edit overlay -->
    <InlineEditPanel
      v-if="showInlineEdit"
      @close="showInlineEdit = false"
    />

    <!-- Login overlay -->
    <Login
      v-if="showLogin"
      @complete="showLogin = false"
      @skip="showLogin = false"
    />

    <!-- Upgrade Prompt overlay -->
    <UpgradePrompt
      v-if="showUpgrade"
      @close="showUpgrade = false"
      @select-plan="showUpgrade = false"
    />
  </div>
</template>
