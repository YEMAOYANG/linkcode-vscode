<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { useTokenManagement } from '../composables/useTokenManagement'

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

const emit = defineEmits<{
  close: []
}>()

const { postMessage } = useVSCode()

// Active tab
const activeTab = ref<'general' | 'tokens' | 'advanced'>(
  (props.initialTab === 'tokens' || props.initialTab === 'token') ? 'tokens' : 'general'
)

// Token management composable
const tokenMgmt = useTokenManagement(() => props.highlightGroup)

// Local state
const selectedModel = ref(props.currentModel)
const inlineEnabled = ref(true)
const debounceMs = ref(300)
const temperature = ref(0.2)
const maxTokens = ref(4096)
const systemPrompt = ref('')
const contextWindow = ref('32K')
const smartRouting = ref(false)
const privacyMode = ref(false)

// Apply highlight on mount if needed
onMounted(() => {
  if (props.highlightGroup) {
    // Switch to tokens tab
    activeTab.value = 'tokens'
    tokenMgmt.applyHighlight(props.highlightGroup)
  }
})

watch(() => props.currentModel, (val) => {
  selectedModel.value = val
})

function handleModelChange(modelId: string) {
  selectedModel.value = modelId
  postMessage({ type: 'updateConfig', key: 'model', value: modelId })
}

function handleConfigUpdate(key: string, value: unknown) {
  postMessage({ type: 'updateConfig', key, value })
}
</script>

<template>
  <div class="st-overlay" @click.self="emit('close')">
    <div class="st-panel">
      <div class="st-header">
        <h2 class="st-title">⚙️ 设置</h2>
        <button class="st-close" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Tab switcher -->
      <div class="st-tabs">
        <button class="st-tab" :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">基本</button>
        <button class="st-tab" :class="{ active: activeTab === 'tokens' }" @click="activeTab = 'tokens'">🔑 Token</button>
        <button class="st-tab" :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">高级</button>
      </div>

      <!-- General tab -->
      <template v-if="activeTab === 'general'">
        <div class="st-section">
          <div class="st-section-title">默认模型</div>
          <div class="st-model-list">
            <button v-for="model in props.models" :key="model.id" class="st-model-row" :class="{ selected: model.id === selectedModel }" @click="handleModelChange(model.id)">
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
            <button class="st-toggle" :class="{ active: inlineEnabled }" @click="inlineEnabled = !inlineEnabled; handleConfigUpdate('enableInlineCompletion', inlineEnabled)" />
          </div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">补全触发延迟</div>
              <div class="st-row-desc">输入停顿多久后触发补全</div>
            </div>
            <div class="st-slider-wrap">
              <input v-model.number="debounceMs" type="range" min="100" max="800" step="50" class="st-slider" @change="handleConfigUpdate('completionDebounceMs', debounceMs)">
              <span class="st-slider-val">{{ debounceMs }}ms</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Token management tab (Feature 5) -->
      <template v-if="activeTab === 'tokens'">
        <!-- Console link -->
        <div class="st-token-hint">
          <a href="#" class="st-link" @click.prevent="tokenMgmt.openSmoothlink()">前往 Smoothlink 控制台创建令牌 →</a>
        </div>

        <!-- Configured groups -->
        <div v-if="tokenMgmt.configuredGroups.value.length > 0" class="st-section">
          <div class="st-section-title" style="color: var(--lc-green, #22c55e);">✅ 已配置</div>
          <div class="st-group-list">
            <div
              v-for="group in tokenMgmt.configuredGroups.value"
              :key="group.id"
              class="st-group-row"
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
                  <input v-model="tokenMgmt.groupTokens.value[group.id]" type="password" class="st-input st-group-input" placeholder="sk-...">
                  <button class="st-input-btn st-input-btn-primary" :disabled="!tokenMgmt.groupTokens.value[group.id]?.trim() || tokenMgmt.groupValidating.value[group.id]" @click="tokenMgmt.saveGroupToken(group.id)">
                    {{ tokenMgmt.groupValidating.value[group.id] ? '...' : '验证并保存' }}
                  </button>
                  <button class="st-input-btn" @click="tokenMgmt.cancelEditing(group.id)">取消</button>
                </template>
                <template v-else-if="tokenMgmt.confirmDeleteGroup.value === group.id">
                  <span class="st-row-desc">确认删除？</span>
                  <button class="st-input-btn" style="color: var(--lc-red, #ef4444);" @click="tokenMgmt.deleteGroupToken(group.id)">确认</button>
                  <button class="st-input-btn" @click="tokenMgmt.confirmDeleteGroup.value = undefined">取消</button>
                </template>
                <template v-else>
                  <span class="st-masked-token">{{ tokenMgmt.maskToken() }}</span>
                  <button class="st-input-btn" @click="tokenMgmt.startEditing(group.id)">更换</button>
                  <button class="st-input-btn" @click="tokenMgmt.confirmDeleteGroup.value = group.id">删除</button>
                </template>
              </div>
              <div v-if="tokenMgmt.groupValidationResult.value[group.id]" class="st-group-validation" :class="{ success: tokenMgmt.groupValidationResult.value[group.id]?.success, error: !tokenMgmt.groupValidationResult.value[group.id]?.success }">
                {{ tokenMgmt.groupValidationResult.value[group.id]?.message }}
              </div>
            </div>
          </div>
        </div>

        <!-- Unconfigured groups -->
        <div class="st-section">
          <div class="st-section-title" style="color: var(--lc-text-tertiary);">○ 未配置</div>
          <div class="st-group-list">
            <div
              v-for="group in tokenMgmt.visibleUnconfiguredGroups.value"
              :key="group.id"
              class="st-group-row"
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
                  <input v-model="tokenMgmt.groupTokens.value[group.id]" type="password" class="st-input st-group-input" placeholder="sk-...">
                  <button class="st-input-btn st-input-btn-primary" :disabled="!tokenMgmt.groupTokens.value[group.id]?.trim() || tokenMgmt.groupValidating.value[group.id]" @click="tokenMgmt.saveGroupToken(group.id)">
                    {{ tokenMgmt.groupValidating.value[group.id] ? '...' : '验证并保存' }}
                  </button>
                  <button class="st-input-btn" @click="tokenMgmt.cancelEditing(group.id)">取消</button>
                </template>
                <template v-else>
                  <button class="st-input-btn st-input-btn-primary" @click="tokenMgmt.startEditing(group.id)">+ 添加</button>
                </template>
              </div>
              <div v-if="tokenMgmt.groupValidationResult.value[group.id]" class="st-group-validation" :class="{ success: tokenMgmt.groupValidationResult.value[group.id]?.success, error: !tokenMgmt.groupValidationResult.value[group.id]?.success }">
                {{ tokenMgmt.groupValidationResult.value[group.id]?.message }}
              </div>
            </div>
            <button v-if="tokenMgmt.hasMoreUnconfigured.value" class="st-input-btn" style="width: 100%; margin-top: 8px;" @click="tokenMgmt.showAllUnconfigured.value = true">
              展开更多（{{ tokenMgmt.unconfiguredGroups.value.length - 4 }} 个）
            </button>
          </div>
          <div class="st-row-desc" style="margin-top: 8px; text-align: center;">配置更多分组令牌即可解锁对应模型</div>
        </div>
      </template>

      <!-- Advanced tab -->
      <template v-if="activeTab === 'advanced'">
        <div class="st-section">
          <div class="st-section-title">模型参数</div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">Temperature</div>
              <div class="st-row-desc">控制输出随机性，0 = 确定性，2 = 最随机</div>
            </div>
            <div class="st-slider-wrap">
              <input v-model.number="temperature" type="range" min="0" max="2" step="0.1" class="st-slider" @change="handleConfigUpdate('temperature', temperature)">
              <span class="st-slider-val">{{ temperature.toFixed(1) }}</span>
            </div>
          </div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">Max Tokens</div>
              <div class="st-row-desc">最大输出 Token 数</div>
            </div>
            <div class="st-number-wrap">
              <input v-model.number="maxTokens" type="number" min="512" max="128000" step="512" class="st-number-input" @change="handleConfigUpdate('maxTokens', maxTokens)">
            </div>
          </div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">Context Window</div>
              <div class="st-row-desc">上下文窗口大小</div>
            </div>
            <select v-model="contextWindow" class="st-select" @change="handleConfigUpdate('contextWindow', contextWindow)">
              <option value="8K">8K</option>
              <option value="32K">32K</option>
              <option value="64K">64K</option>
              <option value="128K">128K</option>
            </select>
          </div>
        </div>
        <div class="st-section">
          <div class="st-section-title">System Prompt</div>
          <textarea v-model="systemPrompt" class="st-textarea" rows="4" placeholder="自定义系统提示词，影响 AI 输出风格..." @change="handleConfigUpdate('systemPrompt', systemPrompt)" />
        </div>
        <div class="st-section">
          <div class="st-section-title">智能路由</div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">自动选择最优模型</div>
              <div class="st-row-desc">根据任务类型自动路由到最合适的模型</div>
            </div>
            <button class="st-toggle" :class="{ active: smartRouting }" @click="smartRouting = !smartRouting; handleConfigUpdate('smartRouting', smartRouting)" />
          </div>
        </div>
        <div class="st-section">
          <div class="st-section-title">隐私模式</div>
          <div class="st-row">
            <div class="st-row-info">
              <div class="st-row-label">数据不出境</div>
              <div class="st-row-desc">开启后只允许使用国产模型（DeepSeek/Qwen/GLM等）</div>
            </div>
            <button class="st-toggle" :class="{ active: privacyMode }" @click="privacyMode = !privacyMode; handleConfigUpdate('privacyMode', privacyMode)" />
          </div>
          <div v-if="privacyMode" class="st-privacy-hint">
            🔒 本地处理，数据不出境。仅允许国产模型。
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.st-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.st-panel {
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--lc-surface, var(--color-bg));
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg, 8px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 20px;
  animation: slideUp 0.2s var(--lc-ease, ease);
}

.st-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.st-title { font-size: 14px; font-weight: 600; color: var(--lc-text-primary); }

.st-close {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  border-radius: var(--lc-radius-sm, 4px);
  color: var(--lc-text-secondary); cursor: pointer;
  transition: all 120ms;
}
.st-close:hover { background: var(--lc-hover); color: var(--lc-text-primary); }

.st-section { margin-bottom: 20px; }

.st-section-title {
  font-size: 10px; font-weight: 600;
  color: var(--lc-text-tertiary); text-transform: uppercase;
  letter-spacing: 0.08em; margin-bottom: 10px;
  padding-bottom: 6px; border-bottom: 1px solid var(--lc-border);
}

.st-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; gap: 12px;
}
.st-row + .st-row { border-top: 1px solid var(--lc-border); }

.st-row-info { flex: 1; min-width: 0; }
.st-row-label { font-size: 13px; color: var(--lc-text-primary); }
.st-row-desc { font-size: 11px; color: var(--lc-text-tertiary); margin-top: 2px; }

.st-input {
  flex: 1; padding: 8px 10px;
  background: var(--lc-elevated); border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px); color: var(--lc-text-primary);
  font-size: 12px; font-family: var(--lc-font-code); outline: none;
  transition: border-color 120ms;
}
.st-input:focus { border-color: var(--lc-accent, #7c3aed); }

.st-input-btn {
  padding: 6px 12px; background: var(--lc-elevated);
  border: 1px solid var(--lc-border); border-radius: var(--lc-radius-md, 6px);
  color: var(--lc-text-secondary); font-size: 11px; cursor: pointer;
  white-space: nowrap; font-family: var(--lc-font-ui); transition: all 120ms;
}
.st-input-btn:hover:not(:disabled) { background: var(--lc-hover); color: var(--lc-text-primary); }
.st-input-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.st-input-btn-primary {
  background: var(--lc-accent, #7c3aed); border-color: var(--lc-accent, #7c3aed); color: #fff;
}
.st-input-btn-primary:hover:not(:disabled) { background: var(--lc-accent-hover, #6d28d9); }

.st-model-list { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }

.st-model-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border: 1px solid var(--lc-border); border-radius: var(--lc-radius-md, 6px);
  background: var(--lc-elevated); cursor: pointer; transition: all 120ms;
  font-family: var(--lc-font-ui); color: var(--lc-text-primary);
  width: 100%; text-align: left;
}
.st-model-row:hover { background: var(--lc-hover); }
.st-model-row.selected { border-color: var(--lc-accent, #7c3aed); background: var(--lc-accent-subtle, rgba(124, 58, 237, 0.12)); }

.st-model-name { font-size: 12px; flex: 1; }
.st-model-tag { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: rgba(124, 58, 237, 0.12); color: var(--lc-accent-text, #a78bfa); }
.st-model-provider { font-size: 10px; color: var(--lc-text-tertiary); }
.st-check { color: var(--lc-accent-text, #a78bfa); font-weight: 600; font-size: 12px; }

.st-toggle {
  width: 36px; height: 20px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.12); cursor: pointer;
  position: relative; transition: background 120ms; border: none; padding: 0; flex-shrink: 0;
}
.st-toggle::after {
  content: ''; position: absolute; width: 16px; height: 16px;
  border-radius: 50%; background: rgba(255, 255, 255, 0.4);
  top: 2px; left: 2px; transition: all 120ms;
}
.st-toggle.active { background: var(--lc-accent, #7c3aed); }
.st-toggle.active::after { left: 18px; background: #fff; }

.st-slider-wrap { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.st-slider { width: 100px; accent-color: var(--lc-accent, #7c3aed); height: 4px; }
.st-slider-val { font-size: 11px; color: var(--lc-accent-text, #a78bfa); min-width: 40px; text-align: right; font-family: var(--lc-font-code); }

/* Token management styles */
.st-token-hint {
  padding: 10px 14px; margin-bottom: 16px;
  background: rgba(124, 58, 237, 0.08); border: 1px solid rgba(124, 58, 237, 0.2);
  border-radius: var(--lc-radius-md, 6px); font-size: 11px;
  color: var(--lc-text-secondary); line-height: 1.5;
}
.st-link { color: var(--lc-accent-text, #a78bfa); text-decoration: none; }
.st-link:hover { text-decoration: underline; }

.st-group-list { display: flex; flex-direction: column; gap: 8px; }

.st-group-row {
  padding: 10px 12px;
  border: 1px solid var(--lc-border); border-radius: var(--lc-radius-md, 6px);
  background: var(--lc-elevated); transition: all 0.3s ease;
}

.st-group-info { margin-bottom: 6px; }
.st-group-name { font-size: 12px; font-weight: 500; color: var(--lc-text-primary); display: flex; align-items: center; gap: 6px; }
.st-group-models { font-size: 10px; color: var(--lc-text-tertiary); margin-top: 2px; }

.st-group-badge {
  font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 400;
}
.st-group-badge.configured { background: rgba(34, 197, 94, 0.12); color: var(--lc-green, #22c55e); }
.st-group-badge.unconfigured { background: rgba(255, 255, 255, 0.08); color: var(--lc-text-tertiary); }

.st-group-actions { display: flex; gap: 6px; align-items: center; }
.st-group-input { max-width: 180px; }
.st-masked-token { font-size: 11px; color: var(--lc-text-tertiary); font-family: var(--lc-font-code); }

.st-group-validation {
  margin-top: 6px; padding: 4px 8px; border-radius: 4px; font-size: 11px;
}
.st-group-validation.success { background: rgba(34, 197, 94, 0.1); color: var(--lc-green, #22c55e); }
.st-group-validation.error { background: rgba(239, 68, 68, 0.1); color: var(--lc-red, #ef4444); }

/* Tabs */
.st-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: var(--lc-elevated); border-radius: var(--lc-radius-md); padding: 3px; }
.st-tab {
  flex: 1; padding: 6px 0; background: transparent; border: none;
  border-radius: var(--lc-radius-sm); color: var(--lc-text-tertiary);
  font-size: 12px; font-family: var(--lc-font-ui); cursor: pointer; transition: all 120ms;
}
.st-tab.active { background: var(--lc-accent); color: #fff; }

/* Number input */
.st-number-wrap { flex-shrink: 0; }
.st-number-input {
  width: 80px; padding: 4px 8px; background: var(--lc-elevated);
  border: 1px solid var(--lc-border); border-radius: var(--lc-radius-md);
  color: var(--lc-text-primary); font-size: 12px; font-family: var(--lc-font-code);
  outline: none; text-align: right;
}
.st-number-input:focus { border-color: var(--lc-accent); }

/* Select */
.st-select {
  padding: 4px 8px; background: var(--lc-elevated);
  border: 1px solid var(--lc-border); border-radius: var(--lc-radius-md);
  color: var(--lc-text-primary); font-size: 12px; font-family: var(--lc-font-ui);
  outline: none; cursor: pointer;
}
.st-select:focus { border-color: var(--lc-accent); }

/* Textarea */
.st-textarea {
  width: 100%; padding: 8px 10px; background: var(--lc-elevated);
  border: 1px solid var(--lc-border); border-radius: var(--lc-radius-md);
  color: var(--lc-text-primary); font-size: 12px; font-family: var(--lc-font-code);
  resize: vertical; outline: none; transition: border-color 120ms; min-height: 60px;
}
.st-textarea:focus { border-color: var(--lc-accent); }

/* Privacy hint */
.st-privacy-hint {
  margin-top: 8px; padding: 8px 12px;
  background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: var(--lc-radius-md); font-size: 11px; color: var(--lc-green);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
