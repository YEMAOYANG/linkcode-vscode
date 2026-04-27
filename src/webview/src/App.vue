<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { registerLucideIcons } from './icons/iconRegistry'
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
import type { ImageAttachment } from './components/ImageUpload.vue'
import type { AttachedFile } from './components/FileDragDrop.vue'
import type { QuotedCode } from './components/ChatInput.vue'
import type { ChatMode } from './composables/useChat'
import { useChat } from './composables/useChat'
import { useVSCode } from './composables/useVSCode'
import { usePlatform } from './composables/usePlatform'
import { useDragDrop } from './composables/useDragDrop'
import { Button, Tooltip } from './ui'

registerLucideIcons()

const { messages, sendMessage, isLoading, currentModel, currentMode, models, modelsLoading, changeModel, setMode, clearMessages, sessionStats, pricingData, pricingGroupRatio } = useChat()
const { postMessage, onMessage } = useVSCode()
const { modKey } = usePlatform()

interface ChatInputExposed {
  setQuotedCode: (qc: QuotedCode) => void
  addAttachedFile: (file: AttachedFile) => void
}

const messagesListRef = ref<HTMLElement | null>(null)
const chatInputRef = ref<(InstanceType<typeof ChatInput> & ChatInputExposed) | null>(null)
const showModelSelector = ref(false)
const showHistory = ref(false)
const showOnboarding = ref(false)
const showCostDashboard = ref(false)
const showSettings = ref(false)
const showCodeReview = ref(false)
const showInlineEdit = ref(false)
const showLogin = ref(false)
const showUpgrade = ref(false)

const { isDragging } = useDragDrop({
  onAttach: (file) => {
    chatInputRef.value?.addAttachedFile(file)
  },
})

const errorState = ref<{ type: ErrorType; message?: string } | null>(null)
const tokenMissingInfo = ref<{ group: string; model: string } | null>(null)
const tokenInvalidGroup = ref<string | null>(null)
const settingsTab = ref<string | undefined>(undefined)
const settingsHighlightGroup = ref<string | undefined>(undefined)
const tokenWarningLevel = computed<'warning' | 'critical' | null>(() => {
  const cost = sessionStats.value.estimatedCost
  if (cost > 8) return 'critical'
  if (cost > 5) return 'warning'
  return null
})

const tokenPercentage = computed(() => {
  const cost = sessionStats.value.estimatedCost
  const budget = 10
  const remaining = Math.max(0, ((budget - cost) / budget) * 100)
  return Math.round(remaining)
})

let cleanupListeners: (() => void) | undefined
onMounted(() => {
  cleanupListeners = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string; errorType?: string; message?: string }
    switch (msg.type) {
      case 'show_onboarding':
        showOnboarding.value = true
        break
      case 'show_error':
        errorState.value = { type: (msg.errorType as ErrorType) || 'network', message: msg.message }
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
      case 'quote_code': {
        const qcMsg = msg as {
          type: string
          code: string
          language: string
          filename?: string
          filepath?: string
          lineStart?: number
          lineEnd?: number
        }
        chatInputRef.value?.setQuotedCode({
          code: qcMsg.code,
          language: qcMsg.language,
          filename: qcMsg.filename,
          filepath: qcMsg.filepath,
          lineStart: qcMsg.lineStart,
          lineEnd: qcMsg.lineEnd,
        })
        break
      }
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

interface SendOptions {
  images?: ImageAttachment[]
  files?: AttachedFile[]
  quotedCodes?: QuotedCode[]
  mode?: ChatMode
}

function formatFence(qc: QuotedCode): string {
  // Emit Cursor-style fence info: lang:filename:startLine-endLine
  const parts = [qc.language]
  if (qc.filename) parts.push(qc.filename)
  if (qc.lineStart != null && qc.lineEnd != null) {
    parts.push(qc.lineStart === qc.lineEnd ? `${qc.lineStart}` : `${qc.lineStart}-${qc.lineEnd}`)
  }
  return `\`\`\`${parts.join(':')}\n${qc.code}\n\`\`\``
}

function handleSend(text: string, options?: SendOptions) {
  errorState.value = null
  tokenMissingInfo.value = null

  let fullText = text
  if (options?.quotedCodes?.length) {
    const fences = options.quotedCodes.map(formatFence).join('\n\n')
    fullText = `${fences}\n\n${text}`.trim()
  }

  if (options?.images?.length) {
    for (const img of options.images) {
      postMessage({ type: 'attachImage', name: img.name, base64: img.base64 })
    }
  }

  const mode: ChatMode = options?.mode ?? currentMode.value
  sendMessage(fullText, mode)
  postMessage({ type: 'sendMessage', text: fullText, mode })
}

function handleBuild(payload: { modelId: string; content: string }) {
  // Switch to Agent mode so subsequent interactions keep applying changes,
  // update the active model, and delegate the plan to the extension host.
  if (payload.modelId && payload.modelId !== currentModel.value) {
    changeModel(payload.modelId)
    postMessage({ type: 'changeModel', modelId: payload.modelId })
  }
  setMode('agent')
  postMessage({
    type: 'buildFromPlan',
    planContent: payload.content,
    modelId: payload.modelId,
  })
}

function scrollToBottom() {
  if (messagesListRef.value) {
    messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
  }
}

watch(messages, () => { nextTick(scrollToBottom) }, { deep: true })

const quickPrompts = [
  { icon: 'lucide:square-code', text: '写一个 useDebounce hook', prompt: '帮我写一个 React useDebounce hook，支持泛型' },
  { icon: 'lucide:message-square-more', text: '解释这段代码的作用', prompt: '解释这段代码的作用，逐行分析' },
  { icon: 'lucide:bug', text: '找出代码 Bug 并修复', prompt: '帮我找出这段代码的 Bug 并修复' },
]

function handleQuickPrompt(prompt: string) { handleSend(prompt) }
function handleNewChat() { clearMessages(); errorState.value = null; postMessage({ type: 'newChat' }) }
function handleModelChange(modelId: string) { changeModel(modelId); postMessage({ type: 'changeModel', modelId }); showModelSelector.value = false }
function handleOpenSettings() { settingsTab.value = undefined; settingsHighlightGroup.value = undefined; showSettings.value = true }
function handleOnboardingComplete() { showOnboarding.value = false }
function handleErrorRetry() {
  errorState.value = null
  const lastUserMsg = [...messages.value].reverse().find((m) => m.role === 'user')
  if (lastUserMsg) postMessage({ type: 'sendMessage', text: lastUserMsg.content })
}
function handleErrorReconfigure() { errorState.value = null; showSettings.value = true }
function handleErrorSwitchModel() { errorState.value = null; showModelSelector.value = true }
</script>

<template>
  <div class="app-c">
    <Transition name="drop-overlay">
      <div v-if="isDragging" class="drop-overlay" aria-hidden="true">
        <div class="drop-overlay__panel">
          <Icon icon="lucide:cloud-upload" :width="40" :height="40" class="drop-overlay__icon" />
          <div class="drop-overlay__title">松开以添加到对话</div>
          <div class="drop-overlay__hint">
            从 VS Code 资源管理器拖入时请按住 <kbd>Shift</kbd>
          </div>
        </div>
      </div>
    </Transition>

    <TokenWarning
      v-if="tokenWarningLevel"
      :level="tokenWarningLevel"
      :percentage="tokenPercentage"
      @upgrade="showUpgrade = true"
    />

    <header class="app-c__header">
      <div class="app-c__brand">
        <div class="app-c__brand-mark">
          <Icon icon="lucide:sparkles" :width="14" :height="14" />
        </div>
        <span class="app-c__brand-name">LinkCode</span>
        <span class="app-c__brand-tag">AI</span>
      </div>
      <div class="app-c__header-actions">
        <Tooltip v-if="!isEmpty" content="新会话">
          <Button variant="icon" @click="handleNewChat">
            <Icon icon="lucide:plus" :width="14" :height="14" />
          </Button>
        </Tooltip>
        <Tooltip content="会话历史">
          <Button variant="icon" @click="showHistory = !showHistory">
            <Icon icon="lucide:history" :width="14" :height="14" />
          </Button>
        </Tooltip>
        <Tooltip content="设置">
          <Button variant="icon" @click="handleOpenSettings">
            <Icon icon="lucide:settings-2" :width="14" :height="14" />
          </Button>
        </Tooltip>
      </div>
    </header>

    <div ref="messagesListRef" class="app-c__messages">
      <div v-if="isEmpty && !errorState" class="app-c__empty">
        <div class="app-c__hero">
          <div class="app-c__hero-orb">
            <Icon icon="lucide:sparkles" :width="24" :height="24" />
          </div>
          <div class="app-c__hero-title">你好，我是 LinkCode</div>
          <div class="app-c__hero-subtitle">61+ 模型 · 智能路由 · 省钱 50%</div>
        </div>

        <div class="app-c__prompts">
          <button
            v-for="p in quickPrompts"
            :key="p.text"
            class="app-c__prompt-card"
            @click="handleQuickPrompt(p.prompt)"
          >
            <div class="app-c__prompt-icon">
              <Icon :icon="p.icon" :width="15" :height="15" />
            </div>
            <span class="app-c__prompt-text">{{ p.text }}</span>
            <Icon icon="lucide:arrow-right" :width="13" :height="13" class="app-c__prompt-arrow" />
          </button>
        </div>

        <div class="app-c__tips">
          <div class="app-c__tips-head">
            <Icon icon="lucide:lightbulb" :width="12" :height="12" />
            <span>快捷提示</span>
          </div>
          <ul>
            <li>选中代码按 <kbd>{{ modKey }}+Shift+I</kbd> 直接引用</li>
            <li>输入 <kbd>@</kbd> 引用文件和项目上下文</li>
            <li>拖拽文件到输入框快速引用</li>
          </ul>
        </div>
      </div>

      <div v-if="tokenMissingInfo" class="app-c__banner app-c__banner--warn">
        <Icon icon="lucide:key-round" :width="14" :height="14" />
        <span>模型 <strong>{{ tokenMissingInfo.model }}</strong> 需要配置 <strong>{{ tokenMissingInfo.group }}</strong> 分组的 Token</span>
        <Button size="sm" variant="primary" @click="settingsTab = 'tokens'; settingsHighlightGroup = tokenMissingInfo?.group; showSettings = true; tokenMissingInfo = null">去配置</Button>
        <Button size="sm" @click="showModelSelector = true; tokenMissingInfo = null">换个模型</Button>
      </div>

      <div v-if="tokenInvalidGroup" class="app-c__banner app-c__banner--danger">
        <Icon icon="lucide:triangle-alert" :width="14" :height="14" />
        <span>{{ tokenInvalidGroup }} 令牌已失效，请重新配置</span>
        <Button size="sm" variant="primary" @click="settingsTab = 'tokens'; settingsHighlightGroup = tokenInvalidGroup ?? undefined; showSettings = true; tokenInvalidGroup = null">更新令牌</Button>
      </div>

      <ErrorState
        v-if="errorState"
        :error-type="errorState.type"
        :message="errorState.message"
        @retry="handleErrorRetry"
        @reconfigure="handleErrorReconfigure"
        @switch-model="handleErrorSwitchModel"
      />

      <ChatMessage
        v-for="(msg, idx) in messages"
        :key="msg.id"
        :role="msg.role"
        :content="msg.content"
        :model="currentModel"
        :cost="msg.cost"
        :savings="msg.savings"
        :token-count="msg.tokenCount"
        :message-id="msg.id"
        :mode="msg.mode"
        :models="models"
        :current-model="currentModel"
        :is-streaming="isLoading && idx === messages.length - 1 && msg.role === 'assistant'"
        @build="handleBuild"
      />

      <div v-if="isLoading" class="app-c__thinking">
        <div class="app-c__thinking-head">
          <div class="msg-c__avatar-mini">
            <Icon icon="lucide:sparkles" :width="12" :height="12" />
          </div>
          <span class="app-c__thinking-name">LinkCode</span>
          <span class="app-c__thinking-meta">思考中</span>
        </div>
        <div class="app-c__thinking-body">
          <LoadingState type="chat" />
        </div>
      </div>
    </div>

    <ChatInput
      ref="chatInputRef"
      :disabled="isLoading"
      :current-model="currentModel"
      :current-mode="currentMode"
      @send="handleSend"
      @open-model-selector="showModelSelector = true"
      @change-mode="setMode"
    />

    <ModelSelector
      v-if="showModelSelector"
      :current-model="currentModel"
      :models="models"
      :loading="modelsLoading"
      :pricing-data="pricingData"
      @select="handleModelChange"
      @close="showModelSelector = false"
    />
    <SessionHistory v-if="showHistory" @close="showHistory = false" @new-chat="handleNewChat" />
    <Onboarding v-if="showOnboarding" :models="models" @complete="handleOnboardingComplete" @skip="showOnboarding = false" />
    <CostDashboard v-if="showCostDashboard" :stats="sessionStats" @close="showCostDashboard = false" />
    <Settings
      v-if="showSettings"
      :current-model="currentModel"
      :models="models"
      :initial-tab="settingsTab"
      :highlight-group="settingsHighlightGroup"
      @close="showSettings = false"
    />
    <CodeReview v-if="showCodeReview" @close="showCodeReview = false" />
    <InlineEditPanel v-if="showInlineEdit" @close="showInlineEdit = false" />
    <Login v-if="showLogin" @complete="showLogin = false" @skip="showLogin = false" />
    <UpgradePrompt v-if="showUpgrade" @close="showUpgrade = false" @select-plan="showUpgrade = false" />
  </div>
</template>

<style scoped>
.app-c {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--lcc-bg);
  color: var(--lcc-text);
  font-size: var(--lcc-font-md);
  font-feature-settings: 'cv11', 'ss01';
  letter-spacing: -0.005em;
}

.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--lcc-accent) 10%, rgba(0, 0, 0, 0.55));
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  pointer-events: none;
}
.drop-overlay__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 40px;
  border: 2px dashed var(--lcc-accent);
  border-radius: var(--lcc-radius-lg);
  background: color-mix(in srgb, var(--lcc-accent) 16%, var(--lcc-bg-elevated));
  color: var(--lcc-text);
  box-shadow: var(--lcc-shadow-lg);
}
.drop-overlay__icon { color: var(--lcc-accent); }
.drop-overlay__title {
  font-size: var(--lcc-font-md);
  font-weight: 600;
}
.drop-overlay__hint {
  font-size: var(--lcc-font-xs);
  color: var(--lcc-text-muted);
}
.drop-overlay__hint kbd {
  padding: 1px 6px;
  background: var(--lcc-bg);
  border: 1px solid var(--lcc-border-subtle);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-family: var(--lcc-font-code);
  font-size: 10px;
  color: var(--lcc-text);
}
.drop-overlay-enter-active,
.drop-overlay-leave-active {
  transition: opacity var(--lcc-duration-fast) var(--lcc-ease-out);
}
.drop-overlay-enter-from,
.drop-overlay-leave-to { opacity: 0; }

.app-c__header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--lcc-space-2) var(--lcc-space-3);
  height: 40px;
  background: var(--lcc-bg-glass);
  backdrop-filter: var(--lcc-blur-md);
  -webkit-backdrop-filter: var(--lcc-blur-md);
  border-bottom: 1px solid var(--lcc-border-subtle);
}

.app-c__brand { display: flex; align-items: center; gap: 7px; }

.app-c__brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--lcc-radius-sm);
  background: var(--lcc-accent-grad);
  color: var(--lcc-accent-fg);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--lcc-accent) 40%, transparent);
}

.app-c__brand-name { font-weight: 600; font-size: var(--lcc-font-md); letter-spacing: -0.01em; }

.app-c__brand-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--lcc-accent) 18%, transparent);
  color: var(--lcc-accent);
  letter-spacing: 0.5px;
}

.app-c__header-actions { display: flex; gap: 2px; }

.app-c__messages { flex: 1; overflow-y: auto; scroll-behavior: smooth; }

.app-c__empty {
  display: flex;
  flex-direction: column;
  padding: var(--lcc-space-8) var(--lcc-space-4) var(--lcc-space-4);
}

.app-c__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: var(--lcc-space-5);
}

.app-c__hero-orb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--lcc-radius-xl);
  background: var(--lcc-accent-grad);
  color: var(--lcc-accent-fg);
  margin-bottom: var(--lcc-space-3);
  box-shadow:
    0 8px 24px color-mix(in srgb, var(--lcc-accent) 38%, transparent),
    var(--lcc-shadow-inset);
  animation: lc-float 3.4s ease-in-out infinite;
}

.app-c__hero-title {
  font-size: var(--lcc-font-xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
  background: linear-gradient(180deg, var(--lcc-text) 0%, color-mix(in srgb, var(--lcc-text) 75%, transparent) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.app-c__hero-subtitle { font-size: var(--lcc-font-sm); color: var(--lcc-text-muted); }

.app-c__prompts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: var(--lcc-space-4);
}

.app-c__prompt-card {
  display: flex;
  align-items: center;
  gap: var(--lcc-space-2);
  padding: 10px 12px;
  background: var(--lcc-bg-elevated);
  border: 1px solid var(--lcc-border-subtle);
  border-radius: var(--lcc-radius-md);
  color: var(--lcc-text);
  font-size: var(--lcc-font-sm);
  text-align: left;
  cursor: pointer;
  box-shadow: var(--lcc-shadow-sm);
  transition: all var(--lcc-duration-base) var(--lcc-ease-out);
}

.app-c__prompt-card:hover {
  border-color: color-mix(in srgb, var(--lcc-accent) 40%, transparent);
  transform: translateY(-2px);
  box-shadow: var(--lcc-shadow-md);
}

.app-c__prompt-card:hover .app-c__prompt-arrow {
  transform: translateX(2px);
  color: var(--lcc-accent);
}

.app-c__prompt-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--lcc-radius-sm);
  background: color-mix(in srgb, var(--lcc-accent) 12%, transparent);
  color: var(--lcc-accent);
  flex-shrink: 0;
}

.app-c__prompt-text { flex: 1; }

.app-c__prompt-arrow {
  color: var(--lcc-text-subtle);
  transition: all var(--lcc-duration-base) var(--lcc-ease-out);
}

.app-c__tips {
  padding: var(--lcc-space-3);
  background: color-mix(in srgb, var(--lcc-warning) 7%, var(--lcc-bg-elevated));
  border: 1px solid color-mix(in srgb, var(--lcc-warning) 18%, transparent);
  border-radius: var(--lcc-radius-md);
}

.app-c__tips-head {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--lcc-font-xs);
  font-weight: 600;
  color: var(--lcc-warning);
  margin-bottom: 6px;
  letter-spacing: 0.02em;
}

.app-c__tips ul { list-style: none; padding: 0; margin: 0; }
.app-c__tips li { font-size: var(--lcc-font-xs); color: var(--lcc-text-muted); line-height: 1.9; }

.app-c__tips kbd {
  padding: 1px 6px;
  background: var(--lcc-bg);
  border: 1px solid var(--lcc-border-subtle);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-family: var(--lcc-font-code);
  font-size: 10px;
  color: var(--lcc-text);
}

.app-c__banner {
  display: flex;
  align-items: center;
  gap: var(--lcc-space-2);
  padding: 10px var(--lcc-space-3);
  margin: var(--lcc-space-2) var(--lcc-space-3);
  border-radius: var(--lcc-radius-md);
  font-size: var(--lcc-font-xs);
  box-shadow: var(--lcc-shadow-sm);
}

.app-c__banner--warn {
  background: color-mix(in srgb, var(--lcc-warning) 14%, var(--lcc-bg-elevated));
  border: 1px solid color-mix(in srgb, var(--lcc-warning) 35%, transparent);
  color: var(--lcc-text);
}
.app-c__banner--warn > svg { color: var(--lcc-warning); }

.app-c__banner--danger {
  background: color-mix(in srgb, var(--lcc-danger) 14%, var(--lcc-bg-elevated));
  border: 1px solid color-mix(in srgb, var(--lcc-danger) 35%, transparent);
  color: var(--lcc-text);
}
.app-c__banner--danger > svg { color: var(--lcc-danger); }

.app-c__banner span { flex: 1; line-height: 1.5; }

.app-c__thinking {
  padding: var(--lcc-space-3) var(--lcc-space-4);
  padding-left: calc(var(--lcc-space-4) + var(--lcc-space-3));
}

.app-c__thinking-head {
  display: flex;
  align-items: center;
  gap: var(--lcc-space-2);
  margin-bottom: 6px;
}

.msg-c__avatar-mini {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--lcc-radius-md);
  background: color-mix(in srgb, var(--lcc-accent) 14%, transparent);
  color: var(--lcc-accent);
}

.app-c__thinking-name { font-weight: 600; font-size: var(--lcc-font-sm); }
.app-c__thinking-meta { font-size: var(--lcc-font-xs); color: var(--lcc-text-subtle); font-style: italic; }
.app-c__thinking-body { opacity: 0.75; }
</style>
