<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVSCode } from '../composables/useVSCode'

interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

const props = defineProps<{
  currentModel: string
  models: ModelInfo[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { postMessage } = useVSCode()

// Local state
const apiKeyInput = ref('')
const keyVisible = ref(false)
const selectedModel = ref(props.currentModel)
const inlineEnabled = ref(true)
const debounceMs = ref(300)

// Sync model changes
watch(() => props.currentModel, (val) => {
  selectedModel.value = val
})

function handleSetApiKey() {
  const key = apiKeyInput.value.trim()
  if (key) {
    postMessage({ type: 'setApiKey', key })
    apiKeyInput.value = ''
  }
}

function handleModelChange(modelId: string) {
  selectedModel.value = modelId
  postMessage({ type: 'updateConfig', key: 'model', value: modelId })
}

function handleInlineToggle() {
  inlineEnabled.value = !inlineEnabled.value
  postMessage({ type: 'updateConfig', key: 'enableInlineCompletion', value: inlineEnabled.value })
}

function handleDebounceChange() {
  postMessage({ type: 'updateConfig', key: 'completionDebounceMs', value: debounceMs.value })
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

      <!-- Account section -->
      <div class="st-section">
        <div class="st-section-title">账户</div>
        <div class="st-row">
          <div class="st-row-info">
            <div class="st-row-label">API Key</div>
            <div class="st-row-desc">Smoothlink API 密钥</div>
          </div>
          <div class="st-key-input">
            <input
              v-model="apiKeyInput"
              :type="keyVisible ? 'text' : 'password'"
              class="st-input"
              placeholder="sk-..."
            >
            <button class="st-input-btn" @click="keyVisible = !keyVisible">
              {{ keyVisible ? '隐藏' : '显示' }}
            </button>
            <button
              class="st-input-btn st-input-btn-primary"
              :disabled="!apiKeyInput.trim()"
              @click="handleSetApiKey"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      <!-- Model section -->
      <div class="st-section">
        <div class="st-section-title">默认模型</div>
        <div class="st-model-list">
          <button
            v-for="model in props.models"
            :key="model.id"
            class="st-model-row"
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

      <!-- Completion section -->
      <div class="st-section">
        <div class="st-section-title">补全</div>
        <div class="st-row">
          <div class="st-row-info">
            <div class="st-row-label">Inline 补全</div>
            <div class="st-row-desc">启用 Ghost Text 代码补全</div>
          </div>
          <button
            class="st-toggle"
            :class="{ active: inlineEnabled }"
            @click="handleInlineToggle"
          />
        </div>
        <div class="st-row">
          <div class="st-row-info">
            <div class="st-row-label">补全触发延迟</div>
            <div class="st-row-desc">输入停顿多久后触发补全</div>
          </div>
          <div class="st-slider-wrap">
            <input
              v-model.number="debounceMs"
              type="range"
              min="100"
              max="800"
              step="50"
              class="st-slider"
              @change="handleDebounceChange"
            >
            <span class="st-slider-val">{{ debounceMs }}ms</span>
          </div>
        </div>
      </div>
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
  max-width: 420px;
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

.st-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lc-text-primary);
}

.st-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--lc-radius-sm, 4px);
  color: var(--lc-text-secondary);
  cursor: pointer;
  transition: all 120ms;
}

.st-close:hover {
  background: var(--lc-hover);
  color: var(--lc-text-primary);
}

.st-section {
  margin-bottom: 20px;
}

.st-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--lc-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--lc-border);
}

.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  gap: 12px;
}

.st-row + .st-row {
  border-top: 1px solid var(--lc-border);
}

.st-row-info {
  flex: 1;
  min-width: 0;
}

.st-row-label {
  font-size: 13px;
  color: var(--lc-text-primary);
}

.st-row-desc {
  font-size: 11px;
  color: var(--lc-text-tertiary);
  margin-top: 2px;
}

.st-key-input {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  margin-top: 8px;
}

.st-input {
  flex: 1;
  padding: 8px 10px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  color: var(--lc-text-primary);
  font-size: 12px;
  font-family: var(--lc-font-code);
  outline: none;
  transition: border-color 120ms;
}

.st-input:focus {
  border-color: var(--lc-accent, #7c3aed);
}

.st-input-btn {
  padding: 6px 12px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  color: var(--lc-text-secondary);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--lc-font-ui);
  transition: all 120ms;
}

.st-input-btn:hover:not(:disabled) {
  background: var(--lc-hover);
  color: var(--lc-text-primary);
}

.st-input-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.st-input-btn-primary {
  background: var(--lc-accent, #7c3aed);
  border-color: var(--lc-accent, #7c3aed);
  color: #fff;
}

.st-input-btn-primary:hover:not(:disabled) {
  background: var(--lc-accent-hover, #6d28d9);
}

.st-model-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.st-model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
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

.st-model-row:hover {
  background: var(--lc-hover);
}

.st-model-row.selected {
  border-color: var(--lc-accent, #7c3aed);
  background: var(--lc-accent-subtle, rgba(124, 58, 237, 0.12));
}

.st-model-name {
  font-size: 12px;
  flex: 1;
}

.st-model-tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(124, 58, 237, 0.12);
  color: var(--lc-accent-text, #a78bfa);
}

.st-model-provider {
  font-size: 10px;
  color: var(--lc-text-tertiary);
}

.st-check {
  color: var(--lc-accent-text, #a78bfa);
  font-weight: 600;
  font-size: 12px;
}

.st-toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
  position: relative;
  transition: background 120ms;
  border: none;
  padding: 0;
  flex-shrink: 0;
}

.st-toggle::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  top: 2px;
  left: 2px;
  transition: all 120ms;
}

.st-toggle.active {
  background: var(--lc-accent, #7c3aed);
}

.st-toggle.active::after {
  left: 18px;
  background: #fff;
}

.st-slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.st-slider {
  width: 100px;
  accent-color: var(--lc-accent, #7c3aed);
  height: 4px;
}

.st-slider-val {
  font-size: 11px;
  color: var(--lc-accent-text, #a78bfa);
  min-width: 40px;
  text-align: right;
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
</style>
