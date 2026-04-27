<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useVSCode } from '../composables/useVSCode'
import { usePlatform } from '../composables/usePlatform'
import {
  TOKEN_GROUPS,
  inferTokenGroup,
} from '../../../shared/constants'
import { Button, Dialog, Input, Tabs, type TabItem } from '../ui'

interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

const MAIN_GROUPS = TOKEN_GROUPS.slice(0, 8).map(g => ({
  id: g.id,
  label: g.label,
  hint: g.models.slice(0, 3).join(', '),
}))

function inferProviderFromId(id: string): string {
  if (id.startsWith('claude') || id.startsWith('cursor-')) return 'Anthropic'
  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) return 'OpenAI'
  if (id.startsWith('gemini')) return 'Google'
  if (id.startsWith('deepseek') || id.startsWith('DeepSeek')) return 'DeepSeek'
  if (id.startsWith('qwen') || id.startsWith('Qwen') || id.startsWith('QwQ')) return 'Qwen'
  if (id.startsWith('glm') || id.startsWith('chatglm')) return 'GLM'
  if (id.startsWith('hunyuan')) return 'HunYuan'
  if (id.startsWith('kimi') || id.startsWith('moonshot')) return 'Kimi'
  if (id.toLowerCase().startsWith('minimax') || id.startsWith('M2-')) return 'MiniMax'
  if (id.startsWith('stepfun/') || id.startsWith('step-')) return 'StepFun'
  return 'Smoothlink'
}

const props = defineProps<{ models: ModelInfo[] }>()
const emit = defineEmits<{ complete: []; skip: [] }>()

const { postMessage, onMessage } = useVSCode()
const { modKey } = usePlatform()

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('skip') })

const currentStep = ref(1)
const selectedModel = ref('')

const tokenMode = ref<'quick' | 'groups'>('quick')
const tokenModeValue = computed({
  get: () => tokenMode.value as string,
  set: (v: string) => { tokenMode.value = v as 'quick' | 'groups' },
})
const tokenModeTabs: TabItem[] = [
  { label: '⚡ 快速开始', value: 'quick' },
  { label: '🔧 分组配置', value: 'groups' },
]

const quickToken = ref('')
const quickTokenVisible = ref(false)
const verifying = ref(false)
const verifyResult = ref<{ success: boolean; message: string } | null>(null)
const quickDetectedGroup = ref<string | null>(null)
const quickDetectedModels = ref<string[]>([])

const groupTokens = ref<Record<string, string>>({})
const groupVerifying = ref<Record<string, boolean>>({})
const groupVerified = ref<Record<string, boolean>>({})
const addingGroupId = ref<string | null>(null)

const RECOMMEND_ORDER = [
  { id: 'deepseek_tencent', label: 'DeepSeek (腾讯)', models: ['deepseek-r1', 'deepseek-v3', 'deepseek-v3.1', 'deepseek-v3.2'] },
  { id: 'gemini_Google', label: 'Gemini (Google)', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-image'] },
  { id: 'gpt_Azure', label: 'GPT (Azure)', models: ['gpt-5', 'gpt-5.1', 'gpt-5.2'] },
  { id: 'scnet', label: 'SCNet', models: ['Qwen3-235B-A22B', 'DeepSeek-R1-0528', 'QwQ-32B'] },
]

const configuredGroups = computed(() => {
  const ids = new Set<string>()
  if (quickDetectedGroup.value) ids.add(quickDetectedGroup.value)
  for (const [gId, v] of Object.entries(groupVerified.value)) {
    if (v) ids.add(gId)
  }
  return [...ids]
})

/**
 * 直接使用 Token 验证后 /v1/models 返回的模型列表，不做 MODEL_TO_GROUP 静态过滤。
 * 来源：quickDetectedModels（快速探测）+ props.models（后端聚合）。
 */
const availableModels = computed<ModelInfo[]>(() => {
  const propsById = new Map<string, ModelInfo>(props.models.map(m => [m.id, m]))
  const seen = new Set<string>()
  const result: ModelInfo[] = []

  const pushModel = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    const fromProps = propsById.get(id)
    result.push({
      id,
      label: fromProps?.label ?? id,
      provider: fromProps?.provider ?? inferProviderFromId(id),
      tag: fromProps?.tag,
    })
  }

  // 快速探测返回的模型优先
  for (const id of quickDetectedModels.value) {
    pushModel(id)
  }

  // 追加后端聚合的其余模型
  for (const model of props.models) {
    pushModel(model.id)
  }

  return result
})

function pickDefaultModel(): string {
  const list = availableModels.value
  if (list.length === 0) return ''
  return list[0].id
}

// 确保 selectedModel 始终指向一个可用模型；已配置分组变化时自动调整
watch(
  [availableModels, configuredGroups],
  () => {
    if (availableModels.value.length === 0) return
    if (!availableModels.value.some(m => m.id === selectedModel.value)) {
      selectedModel.value = pickDefaultModel()
    }
  },
  { immediate: true, deep: true },
)

const recommendedGroups = computed(() => {
  const done = new Set<string>()
  if (quickDetectedGroup.value) done.add(quickDetectedGroup.value)
  for (const [gId, v] of Object.entries(groupVerified.value)) {
    if (v) done.add(gId)
  }
  return RECOMMEND_ORDER.filter(g => !done.has(g.id)).slice(0, 2)
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
    verifyResult.value = msg.success
      ? { success: true, message: '✓ 连接成功' }
      : { success: false, message: `✗ 验证失败: ${msg.message || '请检查 Token'}` }
  }
  if (msg.type === 'groupTokenValidated' && msg.group) {
    if (msg.group === '_detect') {
      verifying.value = false
      if (msg.success && msg.models) {
        const detected = inferTokenGroup(msg.models)
        if (detected !== 'unknown') {
          const groupLabel = TOKEN_GROUPS.find(g => g.id === detected)?.label ?? detected
          verifyResult.value = { success: true, message: `✓ Token 有效，已识别分组: ${groupLabel}` }
          quickDetectedGroup.value = detected
          quickDetectedModels.value = msg.models
          groupTokens.value[detected] = quickToken.value.trim()
          groupVerified.value[detected] = true
        } else {
          verifyResult.value = {
            success: true,
            message: '⚠️ Token 有效但无法自动识别分组，请手动到「分组配置」选择',
          }
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

onUnmounted(() => { cleanupValidation() })

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

const progressDots = computed(() =>
  [1, 2, 3, 4].map(n => ({
    step: n,
    active: n === currentStep.value,
    done: n < currentStep.value,
  })),
)

function nextStep() { if (currentStep.value < 4) currentStep.value++ }
function prevStep() { if (currentStep.value > 1) currentStep.value-- }

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
  const prev = quickDetectedGroup.value
  if (prev) {
    delete groupTokens.value[prev]
    groupVerified.value[prev] = false
    postMessage({ type: 'deleteGroupToken', group: prev })
  }
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
  if (quickToken.value.trim()) saveQuickToken()
  postMessage({ type: 'updateConfig', key: 'model', value: selectedModel.value })
  postMessage({ type: 'onboardingComplete' })
  emit('complete')
}

const shortcuts = [
  { name: '接受补全', desc: '接受 Ghost Text 建议', keys: ['Tab'] },
  { name: '引用代码到 Chat', desc: '选中代码 → 发送到 AI 对话', keys: [modKey, 'Shift', 'I'] },
  { name: 'Inline Edit', desc: '选中代码原地编辑', keys: [modKey, 'Shift', 'K'] },
  { name: '打开 Chat 面板', desc: '与 AI 对话', keys: [modKey, 'Shift', 'L'] },
  { name: '代码审查', desc: 'Git Diff 一键审查', keys: [modKey, 'Shift', 'R'] },
]
</script>

<template>
  <Dialog v-model:open="dialogOpen" size="sm" class="ob-dialog" hide-close>
    <template #header>
      <div class="ob-progress">
        <div
          v-for="dot in progressDots"
          :key="dot.step"
          class="ob-dot"
          :class="{ active: dot.active, done: dot.done }"
        />
      </div>
    </template>

    <template v-if="currentStep === 1">
      <div class="ob-step1">
        <div class="ob-welcome-icon">
          <Icon icon="lucide:sparkles" :width="40" :height="40" />
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
      </div>
    </template>

    <template v-if="currentStep === 2">
      <div class="ob-title">🔑 配置 API Token</div>
      <div class="ob-subtitle">每个模型分组需要单独的 Token</div>

      <Tabs v-model="tokenModeValue" :tabs="tokenModeTabs" size="sm" class="ob-mode-tabs">
        <template #quick>
          <template v-if="!quickDetectedGroup">
            <div class="ob-form-group">
              <label class="ob-form-label">输入任意一个 Token，自动探测分组</label>
              <div class="ob-input-wrap">
                <Input
                  v-model="quickToken"
                  :type="quickTokenVisible ? 'text' : 'password'"
                  placeholder="sk-xxx...xxxx"
                />
                <button class="ob-toggle-vis" @click="quickTokenVisible = !quickTokenVisible">
                  <Icon :icon="quickTokenVisible ? 'lucide:eye' : 'lucide:eye-off'" :width="14" :height="14" />
                </button>
              </div>
              <div v-if="verifyResult && !verifyResult.success" class="ob-verify-result error">
                {{ verifyResult.message }}
              </div>
            </div>

            <Button
              block
              :disabled="quickToken.trim().length < 8 || verifying"
              :loading="verifying"
              @click="verifyQuickToken"
            >
              {{ verifying ? '验证中...' : '验证并探测' }}
            </Button>
          </template>

          <div v-else class="ob-success-panel">
            <div class="ob-verify-result success">✅ 令牌验证成功！</div>
            <div class="ob-detected-info lc-card">
              <div class="ob-detected-group">已识别分组：<strong>{{ quickDetectedGroup }}</strong></div>
              <div class="ob-detected-models">
                已解锁 {{ quickDetectedModels.length }} 个模型：
                <span v-for="(m, i) in quickDetectedModels.slice(0, 4)" :key="m">
                  {{ m }}<template v-if="i < Math.min(quickDetectedModels.length, 4) - 1">、</template>
                </span>
                <span v-if="quickDetectedModels.length > 4" class="ob-more-models">+{{ quickDetectedModels.length - 4 }} 个</span>
              </div>
              <Button size="sm" variant="ghost" class="ob-reverify-btn" @click="resetQuickVerify">更换令牌</Button>
            </div>

            <template v-if="recommendedGroups.length > 0">
              <div class="ob-recommend-title">── 推荐继续配置（解锁更多模型）──</div>
              <div v-for="rg in recommendedGroups" :key="rg.id" class="ob-recommend-item lc-card">
                <template v-if="addingGroupId !== rg.id">
                  <div class="ob-recommend-info">
                    <div class="ob-recommend-name">{{ rg.label }}</div>
                    <div class="ob-recommend-hint">{{ rg.models.slice(0, 3).join('、') }}</div>
                  </div>
                  <Button v-if="!groupVerified[rg.id]" size="sm" variant="primary" @click="addingGroupId = rg.id">+ 添加</Button>
                  <span v-else class="ob-group-status success">✅</span>
                </template>
                <template v-else>
                  <div class="ob-group-input-row">
                    <Input
                      v-model="groupTokens[rg.id]"
                      type="password"
                      size="sm"
                      :placeholder="`粘贴 ${rg.id} 分组令牌...`"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      :disabled="!groupTokens[rg.id]?.trim() || groupVerifying[rg.id]"
                      :loading="groupVerifying[rg.id]"
                      @click="verifyGroupToken(rg.id)"
                    >
                      {{ groupVerifying[rg.id] ? '...' : '验证并添加' }}
                    </Button>
                    <Button size="sm" variant="ghost" @click="addingGroupId = null">取消</Button>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>

        <template #groups>
          <div class="ob-group-list">
            <div v-for="group in MAIN_GROUPS" :key="group.id" class="ob-group-item lc-card">
              <div class="ob-group-header">
                <span class="ob-group-name">{{ group.label }}</span>
                <span v-if="groupVerified[group.id]" class="ob-group-status success">✓</span>
              </div>
              <div class="ob-group-hint">{{ group.hint }}</div>
              <div class="ob-group-input-row">
                <Input
                  v-model="groupTokens[group.id]"
                  type="password"
                  size="sm"
                  placeholder="sk-..."
                />
                <Button
                  size="sm"
                  variant="primary"
                  :disabled="!groupTokens[group.id]?.trim() || groupVerifying[group.id]"
                  :loading="groupVerifying[group.id]"
                  @click="verifyGroupToken(group.id)"
                >
                  {{ groupVerifying[group.id] ? '...' : '验证' }}
                </Button>
              </div>
            </div>
          </div>
        </template>
      </Tabs>

      <div class="ob-help">
        📋 还没有 Token？去 <a href="https://smoothlink.ai" @click.prevent="postMessage({ type: 'openExternal', url: 'https://smoothlink.ai/register' })">Smoothlink 获取</a>
      </div>
      <div class="ob-hint">💡 新用户注册即送 ¥5 免费额度</div>
    </template>

    <template v-if="currentStep === 3">
      <div class="ob-title">🤖 选择默认模型</div>
      <div class="ob-subtitle">你可以随时在聊天中切换模型</div>
      <div class="ob-model-list">
        <button
          v-for="model in availableModels"
          :key="model.id"
          class="ob-model-row lc-card"
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
    </template>

    <template v-if="currentStep === 4">
      <div class="ob-title">⌨️ 掌握核心快捷键</div>
      <div class="ob-subtitle">这些快捷键让你事半功倍</div>
      <div class="ob-shortcut-list">
        <div v-for="sc in shortcuts" :key="sc.name" class="ob-shortcut-card lc-card">
          <div>
            <div class="ob-sc-name">{{ sc.name }}</div>
            <div class="ob-sc-desc">{{ sc.desc }}</div>
          </div>
          <div class="ob-sc-keys">
            <span v-for="k in sc.keys" :key="k" class="ob-sc-key">{{ k }}</span>
          </div>
        </div>
      </div>
      <div class="ob-hint">可在设置中随时自定义快捷键</div>
    </template>

    <template #footer>
      <template v-if="currentStep === 1">
        <Button variant="primary" block @click="nextStep">
          开始配置
          <Icon icon="lucide:arrow-right" :width="14" :height="14" />
        </Button>
        <Button variant="ghost" block class="ob-skip-btn" @click="emit('skip')">
          稍后再说，先体验免费额度
        </Button>
      </template>
      <template v-else-if="currentStep === 2">
        <div class="ob-btn-row">
          <Button @click="prevStep">
            <Icon icon="lucide:arrow-left" :width="14" :height="14" />
            上一步
          </Button>
          <Button v-if="quickDetectedGroup" @click="saveQuickToken(); nextStep()">
            跳过，稍后设置
          </Button>
          <Button variant="primary" :disabled="!hasAnyToken" @click="saveQuickToken(); nextStep()">
            继续
            <Icon icon="lucide:arrow-right" :width="14" :height="14" />
          </Button>
        </div>
      </template>
      <template v-else-if="currentStep === 3">
        <div class="ob-btn-row">
          <Button @click="prevStep">
            <Icon icon="lucide:arrow-left" :width="14" :height="14" />
            上一步
          </Button>
          <Button variant="primary" @click="nextStep">
            下一步
            <Icon icon="lucide:arrow-right" :width="14" :height="14" />
          </Button>
        </div>
      </template>
      <template v-else>
        <Button variant="primary" block @click="finishOnboarding">
          ✨ 完成配置，开始使用
        </Button>
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
.ob-dialog :deep(.ui-dialog__header) {
  justify-content: center;
  padding: var(--lcc-space-4) var(--lcc-space-4) 0;
  border-bottom: none;
}

.ob-progress {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.ob-dot {
  width: 24px;
  height: 3px;
  border-radius: 2px;
  background: var(--lcc-bg-active);
  transition: all var(--lcc-duration-base) var(--lcc-ease-out);
}
.ob-dot.active {
  background: var(--lcc-accent);
  width: 40px;
}
.ob-dot.done { background: color-mix(in srgb, var(--lcc-accent) 60%, transparent); }

.ob-step1 { text-align: center; }
.ob-welcome-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--lcc-accent);
}

.ob-title {
  font-size: var(--lcc-font-lg);
  font-weight: 700;
  color: var(--lcc-text);
  margin-bottom: 6px;
  text-align: center;
}
.ob-subtitle {
  font-size: var(--lcc-font-xs);
  color: var(--lcc-text-subtle);
  margin-bottom: 20px;
  text-align: center;
}

.ob-features {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 8px;
}
.ob-feature { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.ob-feature-icon { font-size: 20px; }
.ob-feature-value { font-size: 13px; font-weight: 600; color: var(--lcc-text); }
.ob-feature-label { font-size: 11px; color: var(--lcc-text-subtle); }

.ob-mode-tabs { margin-bottom: 8px; }

.ob-form-group { margin-bottom: 12px; }
.ob-form-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--lcc-text-muted);
  margin-bottom: 6px;
}
.ob-input-wrap { position: relative; }
.ob-input-wrap :deep(.ui-input) { padding-right: 36px; }
.ob-toggle-vis {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--lcc-text-subtle);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
}
.ob-toggle-vis:hover { color: var(--lcc-text-muted); }

.ob-verify-result {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--lcc-radius-md);
  font-size: 12px;
  margin-top: 8px;
}
.ob-verify-result.success {
  background: color-mix(in srgb, var(--lcc-success) 10%, transparent);
  color: var(--lcc-success);
}
.ob-verify-result.error {
  background: color-mix(in srgb, var(--lcc-danger) 10%, transparent);
  color: var(--lcc-danger);
}

.ob-success-panel { text-align: left; }
.ob-detected-info { margin: 12px 0; padding: 10px 12px; }
.ob-detected-group { font-size: 12px; color: var(--lcc-text); margin-bottom: 4px; }
.ob-detected-models { font-size: 11px; color: var(--lcc-text-subtle); line-height: 1.6; }
.ob-more-models { color: var(--lcc-accent); }
.ob-reverify-btn { margin-top: 8px; }

.ob-recommend-title {
  font-size: 11px; color: var(--lcc-text-subtle); text-align: center;
  margin: 14px 0 10px;
}
.ob-recommend-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px; margin-bottom: 6px;
}
.ob-recommend-info { flex: 1; min-width: 0; }
.ob-recommend-name { font-size: 12px; color: var(--lcc-text); font-weight: 500; }
.ob-recommend-hint { font-size: 10px; color: var(--lcc-text-subtle); margin-top: 2px; }

.ob-group-list { display: flex; flex-direction: column; gap: 8px; text-align: left; }
.ob-group-item { padding: 10px 12px; }
.ob-group-header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.ob-group-name { font-size: 12px; font-weight: 500; color: var(--lcc-text); }
.ob-group-status.success { color: var(--lcc-success); font-weight: 600; font-size: 12px; }
.ob-group-hint { font-size: 10px; color: var(--lcc-text-subtle); margin-bottom: 6px; }
.ob-group-input-row { display: flex; gap: 6px; align-items: center; }
.ob-group-input-row > :deep(.ui-input) { flex: 1; min-width: 0; }

.ob-help {
  text-align: center;
  margin-top: 16px;
  font-size: 12px;
  color: var(--lcc-text-subtle);
}
.ob-help a { color: var(--lcc-accent); }

.ob-hint {
  text-align: center;
  margin-top: 10px;
  font-size: 11px;
  color: var(--lcc-text-subtle);
}

.ob-model-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 280px;
  overflow-y: auto;
  text-align: left;
}
.ob-model-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all var(--lcc-duration-fast) var(--lcc-ease-out);
  color: var(--lcc-text);
  width: 100%;
  text-align: left;
}
.ob-model-row:hover { background: var(--lcc-bg-hover); }
.ob-model-row.selected {
  border-color: var(--lcc-accent);
  background: color-mix(in srgb, var(--lcc-accent) 12%, transparent);
}
.ob-model-info { flex: 1; display: flex; align-items: center; gap: 6px; }
.ob-model-name { font-size: 13px; }
.ob-model-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--lcc-accent) 16%, transparent);
  color: var(--lcc-accent);
}
.ob-model-provider { font-size: 11px; color: var(--lcc-text-subtle); }
.ob-check { color: var(--lcc-accent); font-weight: 600; }

.ob-shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}
.ob-shortcut-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  transition: background var(--lcc-duration-fast) var(--lcc-ease-out);
}
.ob-shortcut-card:hover { background: var(--lcc-bg-hover); }
.ob-sc-name { font-size: 13px; color: var(--lcc-text); }
.ob-sc-desc { font-size: 11px; color: var(--lcc-text-subtle); margin-top: 2px; }
.ob-sc-keys { display: flex; gap: 4px; }
.ob-sc-key {
  padding: 3px 8px;
  background: var(--lcc-bg-active);
  border: 1px solid var(--lcc-border-subtle);
  border-radius: 4px;
  font-size: 11px;
  color: var(--lcc-text-muted);
  font-family: var(--lcc-font-code);
}

.ob-btn-row { display: flex; gap: 8px; width: 100%; }
.ob-btn-row > :deep(.ui-button) { flex: 1; }

.ob-skip-btn { margin-top: 8px; }
</style>
