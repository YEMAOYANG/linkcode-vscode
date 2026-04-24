<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { usePlatform } from '../composables/usePlatform'
import { MODEL_TO_GROUP } from '../../../shared/constants'

interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

const MAIN_GROUPS = [
  { id: 'Claude_aws', label: 'Claude (AWS)', hint: 'claude-sonnet-4-6, claude-opus-4-6' },
  { id: 'deepseek_tencent', label: 'DeepSeek (腾讯)', hint: 'deepseek-r1, deepseek-v3' },
  { id: 'gemini_Google', label: 'Gemini (Google)', hint: 'gemini-2.5-pro, gemini-2.5-flash' },
  { id: 'gpt_Azure', label: 'GPT (Azure)', hint: 'gpt-5, gpt-5.1' },
]

const props = defineProps<{
  models: ModelInfo[]
}>()

const emit = defineEmits<{
  complete: []
  skip: []
}>()

const { postMessage, onMessage } = useVSCode()
const { modKey } = usePlatform()

const currentStep = ref(1)
const selectedModel = ref('claude-sonnet-4-6')

// Step 2: Token configuration
const tokenMode = ref<'quick' | 'groups'>('quick')
const quickToken = ref('')
const quickTokenVisible = ref(false)
const verifying = ref(false)
const verifyResult = ref<{ success: boolean; message: string } | null>(null)
const quickDetectedGroup = ref<string | null>(null)
const quickDetectedModels = ref<string[]>([])

// Group-specific tokens
const groupTokens = ref<Record<string, string>>({})
const groupVerifying = ref<Record<string, boolean>>({})
const groupVerified = ref<Record<string, boolean>>({})
const addingGroupId = ref<string | null>(null)

/** Recommended groups for State B (exclude already configured) */
const RECOMMEND_ORDER = [
  { id: 'deepseek_tencent', label: 'DeepSeek (腾讯)', models: ['deepseek-r1', 'deepseek-v3', 'deepseek-v3.1', 'deepseek-v3.2'] },
  { id: 'gemini_Google', label: 'Gemini (Google)', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-image'] },
  { id: 'gpt_Azure', label: 'GPT (Azure)', models: ['gpt-5', 'gpt-5.1', 'gpt-5.2'] },
  { id: 'scnet', label: 'SCNet', models: ['Qwen3-235B-A22B', 'DeepSeek-R1-0528', 'QwQ-32B'] },
]

const configuredGroups = computed(() => {
  const ids = new Set<string>()
  if (quickDetectedGroup.value) ids.add(quickDetectedGroup.value)
  for (const [gId, verified] of Object.entries(groupVerified.value)) {
    if (verified) ids.add(gId)
  }
  return [...ids]
})

const availableModels = computed(() =>
  props.models.filter(m => {
    const group = MODEL_TO_GROUP[m.id]
    return !group || configuredGroups.value.includes(group)
  })
)

const recommendedGroups = computed(() => {
  const configuredIds = new Set<string>()
  if (quickDetectedGroup.value) configuredIds.add(quickDetectedGroup.value)
  for (const [gId, verified] of Object.entries(groupVerified.value)) {
    if (verified) configuredIds.add(gId)
  }
  return RECOMMEND_ORDER.filter(g => !configuredIds.has(g.id)).slice(0, 2)
})

const cleanupValidation = onMessage((event: MessageEvent) => {
  const msg = event.data as {
    type: string
    success?: boolean
    message?: string
    group?: string
    models?: string[]
  }
  if (msg.type === 'apiKeyValidated') {
    verifying.value = false
    if (msg.success) {
      verifyResult.value = { success: true, message: '✓ 连接成功' }
    } else {
      verifyResult.value = { success: false, message: `✗ 验证失败: ${msg.message || '请检查 Token'}` }
    }
  }
  if (msg.type === 'groupTokenValidated' && msg.group) {
    if (msg.group === '_detect') {
      // Quick start detection
      verifying.value = false
      if (msg.success && msg.models) {
        verifyResult.value = { success: true, message: '✓ Token 有效' }
        const detected = detectGroup(msg.models)
        if (detected) {
          quickDetectedGroup.value = detected
          quickDetectedModels.value = msg.models
          // Sync to group config side
          groupTokens.value[detected] = quickToken.value.trim()
          groupVerified.value[detected] = true
        }
      } else {
        verifyResult.value = { success: false, message: `✗ 验证失败: ${msg.message || '请检查 Token'}` }
      }
    } else {
      groupVerifying.value[msg.group] = false
      groupVerified.value[msg.group] = msg.success === true
    }
  }
})

onUnmounted(() => {
  cleanupValidation()
})

function detectGroup(modelIds: string[]): string | null {
  const MODEL_TO_GROUP: Record<string, string> = {
    'claude-sonnet-4-6': 'Claude_aws', 'claude-opus-4-6': 'Claude_aws', 'claude-haiku-4-5-20251001': 'Claude_aws',
    'deepseek-r1': 'deepseek_tencent', 'deepseek-v3': 'deepseek_tencent',
    'gemini-2.5-pro': 'gemini_Google', 'gemini-2.5-flash': 'gemini_Google',
    'gpt-5': 'gpt_Azure', 'gpt-5.1': 'gpt_Azure',
  }
  const counts: Record<string, number> = {}
  for (const id of modelIds) {
    const g = MODEL_TO_GROUP[id]
    if (g) counts[g] = (counts[g] ?? 0) + 1
  }
  let best: string | null = null
  let bestCount = 0
  for (const [g, c] of Object.entries(counts)) {
    if (c > bestCount) { bestCount = c; best = g }
  }
  return best
}

const hasAnyToken = computed(() => {
  if (verifyResult.value?.success) return true
  return Object.values(groupVerified.value).some(Boolean)
})

watch(quickToken, (val) => {
  if (!val.trim()) {
    verifyResult.value = null
    quickDetectedGroup.value = null
    quickDetectedModels.value = []
  }
})

watch(groupTokens, (tokens) => {
  for (const groupId of Object.keys(groupVerified.value)) {
    if (!tokens[groupId]?.trim()) {
      groupVerified.value[groupId] = false
    }
  }
}, { deep: true })

const progressDots = computed(() => {
  return [1, 2, 3, 4].map(n => ({
    step: n,
    active: n === currentStep.value,
    done: n < currentStep.value,
  }))
})

function nextStep() {
  if (currentStep.value < 4) currentStep.value++
}

function prevStep() {
  if (currentStep.value > 1) currentStep.value--
}

function verifyQuickToken() {
  if (!quickToken.value.trim()) return
  verifying.value = true
  verifyResult.value = null
  quickDetectedGroup.value = null
  postMessage({ type: 'validateGroupToken', group: '_detect', token: quickToken.value.trim() })
}

function saveQuickToken() {
  const token = quickToken.value.trim()
  if (!token) return
  postMessage({ type: 'setApiKey', key: token })
  if (quickDetectedGroup.value) {
    postMessage({ type: 'setGroupToken', group: quickDetectedGroup.value, token })
  }
}

function resetQuickVerify() {
  verifyResult.value = null
  quickDetectedGroup.value = null
  quickDetectedModels.value = []
  quickToken.value = ''
}

function verifyGroupToken(groupId: string) {
  const token = groupTokens.value[groupId]?.trim()
  if (!token) return
  groupVerifying.value[groupId] = true
  postMessage({ type: 'validateGroupToken', group: groupId, token })
  postMessage({ type: 'setGroupToken', group: groupId, token })
}

function selectModel(modelId: string) {
  selectedModel.value = modelId
}

function finishOnboarding() {
  // Save quick token as general key if used
  if (quickToken.value.trim()) {
    saveQuickToken()
  }
  postMessage({ type: 'updateConfig', key: 'model', value: selectedModel.value })
  postMessage({ type: 'onboardingComplete' })
  emit('complete')
}

const shortcuts = [
  { icon: 'tab', name: '接受补全', desc: '接受 Ghost Text 建议', keys: ['Tab'] },
  { icon: 'sparkle', name: '引用代码到 Chat', desc: '选中代码 → 发送到 AI 对话', keys: [modKey, 'Shift', 'I'] },
  { icon: 'pencil', name: 'Inline Edit', desc: '选中代码原地编辑', keys: [modKey, 'Shift', 'K'] },
  { icon: 'chat', name: '打开 Chat 面板', desc: '与 AI 对话', keys: [modKey, 'Shift', 'L'] },
  { icon: 'review', name: '代码审查', desc: 'Git Diff 一键审查', keys: [modKey, 'Shift', 'R'] },
]
</script>

<template>
  <div class="ob-overlay">
    <div class="ob-bg" />
    <div class="ob-card">
      <!-- Progress dots -->
      <div class="ob-progress">
        <div
          v-for="dot in progressDots"
          :key="dot.step"
          class="ob-dot"
          :class="{ active: dot.active, done: dot.done }"
        />
      </div>

      <!-- Step 1: Welcome -->
      <template v-if="currentStep === 1">
        <div class="ob-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-button-bg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/><path d="M22 5h-4"/>
            <path d="M4 17v2"/><path d="M5 18H3"/>
          </svg>
        </div>
        <div class="ob-title">欢迎使用 LinkCode</div>
        <div class="ob-subtitle">AI 多模型编程助手 · 比 Cursor 省 50%</div>

        <div class="ob-features">
          <div class="ob-feature">
            <span class="ob-feature-icon">🧠</span>
            <span class="ob-feature-value">61+</span>
            <span class="ob-feature-label">AI 模型</span>
          </div>
          <div class="ob-feature">
            <span class="ob-feature-icon">💰</span>
            <span class="ob-feature-value">¥39/月</span>
            <span class="ob-feature-label">起步价</span>
          </div>
          <div class="ob-feature">
            <span class="ob-feature-icon">🇨🇳</span>
            <span class="ob-feature-value">无需翻墙</span>
            <span class="ob-feature-label">国内直连</span>
          </div>
        </div>

        <button class="ob-btn ob-btn-primary" @click="nextStep">
          开始配置 <svg class="ob-arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
        <div class="ob-skip" @click="emit('skip')">稍后再说，先体验免费额度</div>
      </template>

      <!-- Step 2: Multi-Token Setup -->
      <template v-if="currentStep === 2">
        <div class="ob-title">🔑 配置 API Token</div>
        <div class="ob-subtitle">每个模型分组需要单独的 Token</div>

        <!-- Mode switcher -->
        <div class="ob-mode-tabs">
          <button class="ob-mode-tab" :class="{ active: tokenMode === 'quick' }" @click="tokenMode = 'quick'">
            ⚡ 快速开始
          </button>
          <button class="ob-mode-tab" :class="{ active: tokenMode === 'groups' }" @click="tokenMode = 'groups'">
            🔧 分组配置
          </button>
        </div>

        <!-- Quick Start Mode -->
        <template v-if="tokenMode === 'quick'">
          <!-- State A: Input phase (no detection yet) -->
          <template v-if="!quickDetectedGroup">
            <div class="ob-form-group">
              <label class="ob-form-label">输入任意一个 Token，自动探测分组</label>
              <div class="ob-input-wrap">
                <input
                  v-model="quickToken"
                  :type="quickTokenVisible ? 'text' : 'password'"
                  class="ob-input"
                  placeholder="sk-xxx...xxxx"
                >
                <button class="ob-toggle-vis" @click="quickTokenVisible = !quickTokenVisible">
                  <svg v-if="quickTokenVisible" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
              <div v-if="verifyResult && !verifyResult.success" class="ob-verify-result error">
                {{ verifyResult.message }}
              </div>
            </div>

            <button
              class="ob-btn"
              :disabled="quickToken.trim().length < 8 || verifying"
              @click="verifyQuickToken"
            >
              <template v-if="verifying">
                <span class="ob-spinner" /> 验证中...
              </template>
              <template v-else>
                验证并探测
              </template>
            </button>
          </template>

          <!-- State B: Verification success — show group + recommend more -->
          <template v-if="quickDetectedGroup">
            <div class="ob-success-panel">
              <div class="ob-verify-result success">✅ 令牌验证成功！</div>

              <div class="ob-detected-info">
                <div class="ob-detected-group">已识别分组：<strong>{{ quickDetectedGroup }}</strong></div>
                <div class="ob-detected-models">
                  已解锁 {{ quickDetectedModels.length }} 个模型：
                  <span v-for="(m, i) in quickDetectedModels.slice(0, 4)" :key="m">
                    {{ m }}<template v-if="i < Math.min(quickDetectedModels.length, 4) - 1">、</template>
                  </span>
                  <span v-if="quickDetectedModels.length > 4" class="ob-more-models">+{{ quickDetectedModels.length - 4 }} 个</span>
                </div>
                <button class="ob-reverify-btn" @click="resetQuickVerify">更换令牌</button>
              </div>

              <!-- Recommend more groups -->
              <template v-if="recommendedGroups.length > 0">
                <div class="ob-recommend-title">── 推荐继续配置（解锁更多模型）──</div>
                <div v-for="rg in recommendedGroups" :key="rg.id" class="ob-recommend-item">
                  <template v-if="addingGroupId !== rg.id">
                    <div class="ob-recommend-info">
                      <div class="ob-recommend-name">{{ rg.label }}</div>
                      <div class="ob-recommend-hint">{{ rg.models.slice(0, 3).join('、') }}</div>
                    </div>
                    <button v-if="!groupVerified[rg.id]" class="ob-btn-sm" @click="addingGroupId = rg.id">+ 添加</button>
                    <span v-else class="ob-group-status success">✅</span>
                  </template>
                  <template v-else>
                    <div class="ob-group-input-row" style="width: 100%;">
                      <input v-model="groupTokens[rg.id]" type="password" class="ob-input ob-group-token-input" :placeholder="`粘贴 ${rg.id} 分组令牌...`">
                      <button class="ob-btn-sm" :disabled="!groupTokens[rg.id]?.trim() || groupVerifying[rg.id]" @click="verifyGroupToken(rg.id)">
                        {{ groupVerifying[rg.id] ? '...' : '验证并添加' }}
                      </button>
                      <button class="ob-btn-sm" style="background: var(--lc-elevated); color: var(--lc-text-secondary);" @click="addingGroupId = null">取消</button>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </template>
        </template>

        <!-- Group Config Mode -->
        <template v-if="tokenMode === 'groups'">
          <div class="ob-group-list">
            <div v-for="group in MAIN_GROUPS" :key="group.id" class="ob-group-item">
              <div class="ob-group-header">
                <span class="ob-group-name">{{ group.label }}</span>
                <span v-if="groupVerified[group.id]" class="ob-group-status success">✓</span>
              </div>
              <div class="ob-group-hint">{{ group.hint }}</div>
              <div class="ob-group-input-row">
                <input
                  v-model="groupTokens[group.id]"
                  type="password"
                  class="ob-input ob-group-token-input"
                  placeholder="sk-..."
                >
                <button
                  class="ob-btn-sm"
                  :disabled="!groupTokens[group.id]?.trim() || groupVerifying[group.id]"
                  @click="verifyGroupToken(group.id)"
                >
                  {{ groupVerifying[group.id] ? '...' : '验证' }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <div class="ob-btn-row">
          <button class="ob-btn" @click="prevStep"><svg class="ob-arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> 上一步</button>
          <button v-if="quickDetectedGroup" class="ob-btn" @click="saveQuickToken(); nextStep()">
            跳过，稍后设置
          </button>
          <button class="ob-btn ob-btn-primary" :disabled="!hasAnyToken" @click="saveQuickToken(); nextStep()">
            继续 <svg class="ob-arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>

        <div class="ob-help">
          📋 还没有 Token？去 <a href="https://smoothlink.ai" @click.prevent="postMessage({ type: 'openExternal', url: 'https://smoothlink.ai/register' })">Smoothlink 获取</a>
        </div>
        <div class="ob-hint">💡 新用户注册即送 ¥5 免费额度</div>
      </template>

      <!-- Step 3: Select Model -->
      <template v-if="currentStep === 3">
        <div class="ob-title">🤖 选择默认模型</div>
        <div class="ob-subtitle">你可以随时在聊天中切换模型</div>

        <div class="ob-model-list">
          <button
            v-for="model in availableModels"
            :key="model.id"
            class="ob-model-row"
            :class="{ selected: model.id === selectedModel }"
            @click="selectModel(model.id)"
          >
            <div class="ob-model-info">
              <span class="ob-model-name">{{ model.label }}</span>
              <span v-if="model.tag" class="ob-model-tag">{{ model.tag }}</span>
            </div>
            <span class="ob-model-provider">{{ model.provider }}</span>
            <span v-if="model.id === selectedModel" class="ob-check">✓</span>
          </button>
        </div>

        <div class="ob-btn-row">
          <button class="ob-btn" @click="prevStep"><svg class="ob-arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> 上一步</button>
          <button class="ob-btn ob-btn-primary" @click="nextStep">下一步 <svg class="ob-arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
        </div>
      </template>

      <!-- Step 4: Shortcuts / Finish -->
      <template v-if="currentStep === 4">
        <div class="ob-title">⌨️ 掌握核心快捷键</div>
        <div class="ob-subtitle">这些快捷键让你事半功倍</div>

        <div class="ob-shortcut-list">
          <div
            v-for="sc in shortcuts"
            :key="sc.name"
            class="ob-shortcut-card"
          >
            <div class="ob-sc-left">
              <div>
                <div class="ob-sc-name">{{ sc.name }}</div>
                <div class="ob-sc-desc">{{ sc.desc }}</div>
              </div>
            </div>
            <div class="ob-sc-keys">
              <span v-for="k in sc.keys" :key="k" class="ob-sc-key">{{ k }}</span>
            </div>
          </div>
        </div>

        <button class="ob-btn ob-btn-primary ob-btn-full" @click="finishOnboarding">
          ✨ 完成配置，开始使用
        </button>
        <div class="ob-hint">可在设置中随时自定义快捷键</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ob-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

.ob-bg {
  position: absolute;
  inset: 0;
  background: var(--color-bg);
  opacity: 0.95;
}

.ob-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: 32px 24px;
  text-align: center;
  animation: slideUp 0.3s var(--lc-ease, ease);
}

.ob-progress {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 24px;
}

.ob-dot {
  width: 24px;
  height: 3px;
  border-radius: 2px;
  background: var(--lc-active);
  transition: all 0.4s ease;
}

.ob-dot.active {
  background: var(--lc-accent, #7c3aed);
  width: 40px;
}

.ob-dot.done {
  background: var(--lc-accent-text, #a78bfa);
}

.ob-icon {
  margin-bottom: 16px;
}

.ob-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--lc-text-primary);
  margin-bottom: 6px;
}

.ob-subtitle {
  font-size: 12px;
  color: var(--lc-text-tertiary);
  margin-bottom: 24px;
}

.ob-features {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 28px;
}

.ob-feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ob-feature-icon { font-size: 20px; }
.ob-feature-value { font-size: 13px; font-weight: 600; color: var(--lc-text-primary); }
.ob-feature-label { font-size: 11px; color: var(--lc-text-tertiary); }

.ob-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  background: var(--lc-elevated);
  color: var(--lc-text-primary);
  font-size: 13px;
  font-family: var(--lc-font-ui);
  cursor: pointer;
  transition: all 120ms;
  width: 100%;
}

.ob-btn:hover:not(:disabled) {
  background: var(--lc-hover);
}

.ob-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ob-btn-primary {
  background: var(--lc-accent, #7c3aed);
  border-color: var(--lc-accent, #7c3aed);
  color: #fff;
  font-weight: 600;
}

.ob-btn-primary:hover:not(:disabled) {
  background: var(--lc-accent-hover, #6d28d9);
}

.ob-btn-full { width: 100%; }

.ob-arrow-icon {
  vertical-align: middle;
  flex-shrink: 0;
}

.ob-btn-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.ob-btn-row .ob-btn { flex: 1; }

.ob-skip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--lc-text-tertiary);
  cursor: pointer;
}

.ob-skip:hover { color: var(--lc-text-secondary); }

.ob-form-group {
  margin-bottom: 16px;
  text-align: left;
}

.ob-form-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--lc-text-secondary);
  margin-bottom: 6px;
}

.ob-input-wrap {
  position: relative;
}

.ob-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  color: var(--lc-text-primary);
  font-size: 13px;
  font-family: var(--lc-font-code);
  outline: none;
  transition: border-color 120ms;
}

.ob-input:focus {
  border-color: var(--lc-accent, #7c3aed);
}

.ob-toggle-vis {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--lc-text-tertiary);
  cursor: pointer;
  padding: 4px;
}

.ob-toggle-vis:hover { color: var(--lc-text-secondary); }

.ob-verify-result {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--lc-radius-md, 6px);
  font-size: 12px;
  margin-top: 8px;
}

.ob-verify-result.success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--lc-green, #22c55e);
}

.ob-verify-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--lc-red, #ef4444);
}

.ob-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.ob-help {
  text-align: center;
  margin-top: 16px;
  font-size: 12px;
  color: var(--lc-text-tertiary);
}

.ob-help a { color: var(--lc-accent-text, #a78bfa); }

.ob-hint {
  text-align: center;
  margin-top: 10px;
  font-size: 11px;
  color: var(--lc-text-tertiary);
}

.ob-model-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
  max-height: 280px;
  overflow-y: auto;
  text-align: left;
}

.ob-model-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  background: var(--lc-elevated);
  cursor: pointer;
  transition: all 120ms;
  font-family: var(--lc-font-ui);
  color: var(--lc-text-primary);
  width: 100%;
  text-align: left;
}

.ob-model-row:hover {
  background: var(--lc-hover);
}

.ob-model-row.selected {
  border-color: var(--lc-accent, #7c3aed);
  background: var(--lc-accent-subtle, rgba(124, 58, 237, 0.12));
}

.ob-model-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ob-model-name { font-size: 13px; }

.ob-model-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(124, 58, 237, 0.12);
  color: var(--lc-accent-text, #a78bfa);
}

.ob-model-provider {
  font-size: 11px;
  color: var(--lc-text-tertiary);
}

.ob-check {
  color: var(--lc-accent-text, #a78bfa);
  font-weight: 600;
}

.ob-shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
  text-align: left;
}

.ob-shortcut-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  transition: background 120ms;
}

.ob-shortcut-card:hover {
  background: var(--lc-hover);
}

.ob-sc-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ob-sc-name { font-size: 13px; color: var(--lc-text-primary); }
.ob-sc-desc { font-size: 11px; color: var(--lc-text-tertiary); margin-top: 2px; }

.ob-sc-keys {
  display: flex;
  gap: 4px;
}

.ob-sc-key {
  padding: 3px 8px;
  background: var(--lc-active);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 11px;
  color: var(--lc-text-secondary);
  font-family: var(--lc-font-code);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Mode tabs */
.ob-mode-tabs {
  display: flex; gap: 4px; margin-bottom: 16px;
  background: var(--lc-elevated); border-radius: var(--lc-radius-md, 6px); padding: 3px;
}
.ob-mode-tab {
  flex: 1; padding: 7px 0; background: transparent; border: none;
  border-radius: var(--lc-radius-sm, 4px); color: var(--lc-text-tertiary);
  font-size: 12px; font-family: var(--lc-font-ui); cursor: pointer; transition: all 120ms;
}
.ob-mode-tab.active { background: var(--lc-accent, #7c3aed); color: #fff; }

/* Group list */
.ob-group-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; text-align: left; }
.ob-group-item {
  padding: 10px 12px; border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px); background: var(--lc-elevated);
}
.ob-group-header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.ob-group-name { font-size: 12px; font-weight: 500; color: var(--lc-text-primary); }
.ob-group-status.success { color: var(--lc-green, #22c55e); font-weight: 600; font-size: 12px; }
.ob-group-hint { font-size: 10px; color: var(--lc-text-tertiary); margin-bottom: 6px; }
.ob-group-input-row { display: flex; gap: 6px; align-items: center; }
.ob-group-token-input { max-width: 200px; padding: 6px 8px; font-size: 11px; }

.ob-btn-sm {
  padding: 5px 10px; background: var(--lc-accent, #7c3aed);
  border: none; border-radius: var(--lc-radius-md, 6px); color: #fff;
  font-size: 11px; cursor: pointer; font-family: var(--lc-font-ui);
  transition: background 120ms; white-space: nowrap;
}
.ob-btn-sm:hover:not(:disabled) { background: var(--lc-accent-hover, #6d28d9); }
.ob-btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

/* Detect result */
.ob-detect-result {
  margin-top: 8px; padding: 8px 12px; border-radius: var(--lc-radius-md, 6px);
  background: rgba(34, 197, 94, 0.08); font-size: 11px;
  color: var(--lc-green, #22c55e); line-height: 1.5;
}
.ob-detect-result strong { color: var(--lc-green, #22c55e); }

/* State B success panel */
.ob-success-panel { text-align: left; }
.ob-detected-info {
  margin: 12px 0; padding: 10px 12px;
  background: var(--lc-elevated); border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
}
.ob-detected-group { font-size: 12px; color: var(--lc-text-primary); margin-bottom: 4px; }
.ob-detected-models { font-size: 11px; color: var(--lc-text-tertiary); line-height: 1.6; }
.ob-more-models { color: var(--lc-accent-text, #a78bfa); }
.ob-recommend-title {
  font-size: 11px; color: var(--lc-text-tertiary); text-align: center;
  margin: 14px 0 10px;
}
.ob-recommend-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; margin-bottom: 6px;
  background: var(--lc-elevated); border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
}
.ob-recommend-info { flex: 1; }
.ob-recommend-name { font-size: 12px; color: var(--lc-text-primary); font-weight: 500; }
.ob-recommend-hint { font-size: 10px; color: var(--lc-text-tertiary); margin-top: 2px; }

.ob-reverify-btn {
  margin-top: 8px;
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-sm, 4px);
  color: var(--lc-text-tertiary);
  font-size: 11px;
  font-family: var(--lc-font-ui);
  cursor: pointer;
  transition: all 120ms;
}
.ob-reverify-btn:hover {
  color: var(--lc-text-secondary);
  border-color: var(--lc-text-tertiary);
}
</style>
