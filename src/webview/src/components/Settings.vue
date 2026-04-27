<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { useTokenManagement } from '../composables/useTokenManagement'
import {
  Button, Dialog, Input, Select, Slider, Switch, Tabs, Textarea,
  type SelectOption, type TabItem,
} from '../ui'

interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

const props = defineProps<{
  currentModel: string
  models: ModelInfo[]
  initialTab?: string
  highlightGroup?: string
}>()

const emit = defineEmits<{ close: [] }>()

const { postMessage } = useVSCode()

const activeTab = ref<'general' | 'tokens' | 'advanced'>(
  (props.initialTab === 'tokens' || props.initialTab === 'token') ? 'tokens' : 'general',
)

const tokenMgmt = useTokenManagement(() => props.highlightGroup)

const showUnconfiguredList = ref(false)

const selectedModel = ref(props.currentModel)
const inlineEnabled = ref(true)
const debounceMs = ref(300)
const temperature = ref(0.2)
const maxTokens = ref(4096)
const systemPrompt = ref('')
const contextWindow = ref('32K')
const smartRouting = ref(false)
const privacyMode = ref(false)

const tabs: TabItem[] = [
  { label: '基本', value: 'general' },
  { label: 'Token', value: 'tokens' },
  { label: '高级', value: 'advanced' },
]

const ctxWindowOptions: SelectOption[] = [
  { label: '8K', value: '8K' }, { label: '32K', value: '32K' },
  { label: '64K', value: '64K' }, { label: '128K', value: '128K' },
]

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('close') })

const tabValue = computed({
  get: () => activeTab.value as string,
  set: (v: string) => { activeTab.value = v as typeof activeTab.value },
})

onMounted(() => {
  if (props.highlightGroup) {
    activeTab.value = 'tokens'
    tokenMgmt.applyHighlight(props.highlightGroup)
    showUnconfiguredList.value = true
  }
})

watch(() => props.currentModel, (val) => { selectedModel.value = val })

function handleModelChange(modelId: string) {
  selectedModel.value = modelId
  postMessage({ type: 'updateConfig', key: 'model', value: modelId })
}

function handleConfigUpdate(key: string, value: unknown) {
  postMessage({ type: 'updateConfig', key, value })
}

function onToggleInline(v: boolean) { inlineEnabled.value = v; handleConfigUpdate('enableInlineCompletion', v) }
function onToggleSmart(v: boolean) { smartRouting.value = v; handleConfigUpdate('smartRouting', v) }
function onTogglePrivacy(v: boolean) { privacyMode.value = v; handleConfigUpdate('privacyMode', v) }
</script>

<template>
  <Dialog v-model:open="dialogOpen" title="⚙️ 设置" size="md">
    <Tabs v-model="tabValue" :tabs="tabs">
      <template #general>
        <div class="st-section">
          <div class="st-section-title">默认模型</div>
          <div v-if="props.models.length === 0" class="st-empty">
            <div class="st-empty-icon">🔐</div>
            <div class="st-empty-title">尚未配置任何 Token</div>
            <div class="st-empty-desc">请先在 Token 标签页配置 Token，保存后将动态拉取可用模型列表。</div>
            <Button variant="primary" size="sm" @click="activeTab = 'tokens'">前往配置 Token</Button>
          </div>
          <div v-else class="st-model-list">
            <button
              v-for="model in props.models"
              :key="model.id"
              class="st-model-row lc-card"
              :class="{ selected: model.id === selectedModel }"
              @click="handleModelChange(model.id)"
            >
              <span class="st-model-name">{{ model.label }}</span>
              <span v-if="model.tag" class="st-model-tag">{{ model.tag }}</span>
              <span class="st-model-provider">{{ model.provider }}</span>
              <span v-if="model.id === selectedModel" class="st-check">✓</span>
            </button>
          </div>
        </div>
        <div class="st-section">
          <div class="st-section-title">补全</div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">Inline 补全</div>
              <div class="st-row-desc">启用 Ghost Text 代码补全</div>
            </div>
            <Switch :model-value="inlineEnabled" @update:model-value="onToggleInline" />
          </div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">补全触发延迟</div>
              <div class="st-row-desc">输入停顿多久后触发补全</div>
            </div>
            <div class="st-slider-wrap">
              <Slider
                v-model="debounceMs"
                :min="100"
                :max="800"
                :step="50"
                @update:model-value="handleConfigUpdate('completionDebounceMs', $event)"
              />
              <span class="st-slider-val">{{ debounceMs }}ms</span>
            </div>
          </div>
        </div>
      </template>

      <template #tokens>
        <div class="st-token-hint">
          <a href="#" class="st-link" @click.prevent="tokenMgmt.openSmoothlink()">前往 Smoothlink 控制台创建令牌 →</a>
        </div>

        <div v-if="tokenMgmt.configuredGroups.value.length > 0" class="st-section">
          <div class="st-section-title" style="color: var(--lcc-success);">✅ 已配置</div>
          <div class="st-group-list">
            <div
              v-for="group in tokenMgmt.configuredGroups.value"
              :key="group.id"
              class="st-group-row lc-card"
              :class="{ 'highlight-group': tokenMgmt.highlightedGroup.value === group.id }"
            >
              <div class="st-group-info">
                <div class="st-group-name">
                  {{ group.label }}
                  <span class="st-group-badge configured">已配置</span>
                </div>
                <div class="st-group-models">{{ group.models.slice(0, 3).join(', ') }}{{ group.models.length > 3 ? ` +${group.models.length - 3}` : '' }}</div>
              </div>
              <div class="st-group-actions">
                <template v-if="tokenMgmt.groupEditing.value[group.id]">
                  <Input
                    v-model="tokenMgmt.groupTokens.value[group.id]"
                    type="password"
                    size="sm"
                    placeholder="sk-..."
                    class="st-group-input"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    :disabled="!tokenMgmt.groupTokens.value[group.id]?.trim() || tokenMgmt.groupValidating.value[group.id]"
                    @click="tokenMgmt.saveGroupToken(group.id)"
                  >
                    {{ tokenMgmt.groupValidating.value[group.id] ? '...' : '验证并保存' }}
                  </Button>
                  <Button size="sm" @click="tokenMgmt.cancelEditing(group.id)">取消</Button>
                </template>
                <template v-else-if="tokenMgmt.confirmDeleteGroup.value === group.id">
                  <span class="st-row-desc">确认删除？</span>
                  <Button variant="danger" size="sm" @click="tokenMgmt.deleteGroupToken(group.id)">确认</Button>
                  <Button size="sm" @click="tokenMgmt.confirmDeleteGroup.value = undefined">取消</Button>
                </template>
                <template v-else>
                  <span class="st-masked-token">{{ tokenMgmt.maskToken() }}</span>
                  <Button size="sm" @click="tokenMgmt.startEditing(group.id)">更换</Button>
                  <Button size="sm" @click="tokenMgmt.confirmDeleteGroup.value = group.id">删除</Button>
                </template>
              </div>
              <div v-if="tokenMgmt.groupValidationResult.value[group.id]" class="st-group-validation" :class="{ success: tokenMgmt.groupValidationResult.value[group.id]?.success, error: !tokenMgmt.groupValidationResult.value[group.id]?.success }">
                {{ tokenMgmt.groupValidationResult.value[group.id]?.message }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="tokenMgmt.unconfiguredGroups.value.length > 0" class="st-section">
          <div class="st-section-title" style="color: var(--lcc-text-subtle);">可添加分组</div>

          <div v-if="!showUnconfiguredList" class="st-add-group-cta">
            <Button variant="primary" size="sm" block @click="showUnconfiguredList = true">
              + 添加新的 Token 分组（{{ tokenMgmt.unconfiguredGroups.value.length }} 个可用）
            </Button>
            <div class="st-row-desc" style="margin-top: 8px; text-align: center;">点击展开可配置的分组清单，配置后对应模型即可解锁</div>
          </div>

          <div v-else class="st-group-list">
            <div
              v-for="group in tokenMgmt.visibleUnconfiguredGroups.value"
              :key="group.id"
              class="st-group-row lc-card"
              :class="{ 'highlight-group': tokenMgmt.highlightedGroup.value === group.id }"
            >
              <div class="st-group-info">
                <div class="st-group-name">
                  {{ group.label }}
                  <span class="st-group-badge unconfigured">未配置</span>
                </div>
                <div class="st-group-models">{{ group.models.slice(0, 3).join(', ') }}{{ group.models.length > 3 ? ` +${group.models.length - 3}` : '' }}</div>
              </div>
              <div class="st-group-actions">
                <template v-if="tokenMgmt.groupEditing.value[group.id]">
                  <Input
                    v-model="tokenMgmt.groupTokens.value[group.id]"
                    type="password"
                    size="sm"
                    placeholder="sk-..."
                    class="st-group-input"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    :disabled="!tokenMgmt.groupTokens.value[group.id]?.trim() || tokenMgmt.groupValidating.value[group.id]"
                    @click="tokenMgmt.saveGroupToken(group.id)"
                  >
                    {{ tokenMgmt.groupValidating.value[group.id] ? '...' : '验证并保存' }}
                  </Button>
                  <Button size="sm" @click="tokenMgmt.cancelEditing(group.id)">取消</Button>
                </template>
                <template v-else>
                  <Button variant="primary" size="sm" @click="tokenMgmt.startEditing(group.id)">+ 添加</Button>
                </template>
              </div>
              <div v-if="tokenMgmt.groupValidationResult.value[group.id]" class="st-group-validation" :class="{ success: tokenMgmt.groupValidationResult.value[group.id]?.success, error: !tokenMgmt.groupValidationResult.value[group.id]?.success }">
                {{ tokenMgmt.groupValidationResult.value[group.id]?.message }}
              </div>
            </div>
            <Button v-if="tokenMgmt.hasMoreUnconfigured.value" size="sm" block @click="tokenMgmt.showAllUnconfigured.value = true">
              展开更多（{{ tokenMgmt.unconfiguredGroups.value.length - 4 }} 个）
            </Button>
            <Button size="sm" block @click="showUnconfiguredList = false">收起</Button>
          </div>
        </div>
      </template>

      <template #advanced>
        <div class="st-section">
          <div class="st-section-title">模型参数</div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">Temperature</div>
              <div class="st-row-desc">控制输出随机性，0 = 确定性，2 = 最随机</div>
            </div>
            <div class="st-slider-wrap">
              <Slider
                v-model="temperature"
                :min="0"
                :max="2"
                :step="0.1"
                @update:model-value="handleConfigUpdate('temperature', $event)"
              />
              <span class="st-slider-val">{{ temperature.toFixed(1) }}</span>
            </div>
          </div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">Max Tokens</div>
              <div class="st-row-desc">最大输出 Token 数</div>
            </div>
            <Input
              v-model="maxTokens"
              type="number"
              size="sm"
              :min="512"
              :max="128000"
              :step="512"
              class="st-number-input"
              @change="handleConfigUpdate('maxTokens', maxTokens)"
            />
          </div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">Context Window</div>
              <div class="st-row-desc">上下文窗口大小</div>
            </div>
            <Select
              v-model="contextWindow"
              :options="ctxWindowOptions"
              size="sm"
              @update:model-value="handleConfigUpdate('contextWindow', $event)"
            />
          </div>
        </div>
        <div class="st-section">
          <div class="st-section-title">System Prompt</div>
          <Textarea
            v-model="systemPrompt"
            :rows="4"
            placeholder="自定义系统提示词，影响 AI 输出风格..."
            @change="handleConfigUpdate('systemPrompt', systemPrompt)"
          />
        </div>
        <div class="st-section">
          <div class="st-section-title">智能路由</div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">自动选择最优模型</div>
              <div class="st-row-desc">根据任务类型自动路由到最合适的模型</div>
            </div>
            <Switch :model-value="smartRouting" @update:model-value="onToggleSmart" />
          </div>
        </div>
        <div class="st-section">
          <div class="st-section-title">隐私模式</div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">数据不出境</div>
              <div class="st-row-desc">开启后只允许使用国产模型（DeepSeek/Qwen/GLM等）</div>
            </div>
            <Switch :model-value="privacyMode" @update:model-value="onTogglePrivacy" />
          </div>
          <div v-if="privacyMode" class="st-privacy-hint">
            🔒 本地处理，数据不出境。仅允许国产模型。
          </div>
        </div>
      </template>
    </Tabs>
  </Dialog>
</template>

<style scoped>
.st-section { margin-bottom: 20px; }
.st-section:last-child { margin-bottom: 0; }

.st-section-title {
  font-size: 10px; font-weight: 600;
  color: var(--lcc-text-subtle); text-transform: uppercase;
  letter-spacing: 0.08em; margin-bottom: 10px;
  padding-bottom: 6px; border-bottom: 1px solid var(--lcc-border-subtle);
}

.st-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; gap: 12px;
}
.st-row + .st-row { border-top: 1px solid var(--lcc-border-subtle); }
.st-row-info { flex: 1; min-width: 0; }
.st-row-label { font-size: 13px; color: var(--lcc-text); }
.st-row-desc { font-size: 11px; color: var(--lcc-text-subtle); margin-top: 2px; }

.st-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 12px;
  text-align: center;
  background: color-mix(in srgb, var(--lcc-accent) 4%, transparent);
  border: 1px dashed color-mix(in srgb, var(--lcc-accent) 30%, transparent);
  border-radius: var(--lcc-radius-md);
}
.st-empty-icon { font-size: 24px; opacity: 0.85; }
.st-empty-title { font-size: 13px; font-weight: 600; color: var(--lcc-text); }
.st-empty-desc {
  font-size: 11px;
  color: var(--lcc-text-muted);
  line-height: 1.6;
  max-width: 280px;
  margin-bottom: 4px;
}

.st-add-group-cta { padding: 4px 0; }

.st-model-list { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
.st-model-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  cursor: pointer; transition: all 120ms;
  color: var(--lcc-text);
  width: 100%; text-align: left;
}
.st-model-row:hover { background: var(--lcc-bg-hover); }
.st-model-row.selected {
  border-color: var(--lcc-accent);
  background: color-mix(in srgb, var(--lcc-accent) 12%, transparent);
}
.st-model-name { font-size: 12px; flex: 1; }
.st-model-tag {
  font-size: 9px; padding: 1px 5px; border-radius: 3px;
  background: color-mix(in srgb, var(--lcc-accent) 16%, transparent);
  color: var(--lcc-accent);
}
.st-model-provider { font-size: 10px; color: var(--lcc-text-subtle); }
.st-check { color: var(--lcc-accent); font-weight: 600; font-size: 12px; }

.st-slider-wrap { display: flex; align-items: center; gap: 10px; min-width: 160px; flex-shrink: 0; }
.st-slider-wrap > :first-child { flex: 1; min-width: 100px; }
.st-slider-val {
  font-size: 11px; color: var(--lcc-accent); min-width: 42px;
  text-align: right; font-family: var(--lcc-font-code); flex-shrink: 0;
}

.st-number-input { width: 100px; flex-shrink: 0; text-align: right; }

.st-token-hint {
  padding: 10px 14px; margin-bottom: 16px;
  background: color-mix(in srgb, var(--lcc-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--lcc-accent) 20%, transparent);
  border-radius: var(--lcc-radius-md); font-size: 11px;
  color: var(--lcc-text-muted); line-height: 1.5;
}
.st-link { color: var(--lcc-accent); text-decoration: none; }
.st-link:hover { text-decoration: underline; }

.st-group-list { display: flex; flex-direction: column; gap: 8px; }
.st-group-row { padding: 10px 12px; transition: all 0.3s ease; }
.st-group-row.highlight-group {
  border-color: var(--lcc-accent);
  box-shadow: var(--lcc-accent-ring);
  animation: st-highlight-pulse 0.5s ease 4;
}

@keyframes st-highlight-pulse {
  0% { background: color-mix(in srgb, var(--lcc-accent) 20%, transparent); }
  50% { background: color-mix(in srgb, var(--lcc-accent) 8%, transparent); }
  100% { background: color-mix(in srgb, var(--lcc-accent) 20%, transparent); }
}

.st-group-info { margin-bottom: 6px; }
.st-group-name { font-size: 12px; font-weight: 500; color: var(--lcc-text); display: flex; align-items: center; gap: 6px; }
.st-group-models { font-size: 10px; color: var(--lcc-text-subtle); margin-top: 2px; }

.st-group-badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 400; }
.st-group-badge.configured {
  background: color-mix(in srgb, var(--lcc-success) 14%, transparent); color: var(--lcc-success);
}
.st-group-badge.unconfigured {
  background: color-mix(in srgb, var(--lcc-text) 8%, transparent); color: var(--lcc-text-subtle);
}

.st-group-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.st-group-input { max-width: 180px; flex: 1 1 140px; }
.st-masked-token { font-size: 11px; color: var(--lcc-text-subtle); font-family: var(--lcc-font-code); }

.st-group-validation { margin-top: 6px; padding: 4px 8px; border-radius: 4px; font-size: 11px; }
.st-group-validation.success {
  background: color-mix(in srgb, var(--lcc-success) 12%, transparent); color: var(--lcc-success);
}
.st-group-validation.error {
  background: color-mix(in srgb, var(--lcc-danger) 12%, transparent); color: var(--lcc-danger);
}

.st-privacy-hint {
  margin-top: 8px; padding: 8px 12px;
  background: color-mix(in srgb, var(--lcc-success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--lcc-success) 25%, transparent);
  border-radius: var(--lcc-radius-md); font-size: 11px; color: var(--lcc-success);
}
</style>
