<script setup lang="ts">
import { ref, nextTick } from 'vue'

defineProps<{
  disabled?: boolean
  currentModel?: string
}>()

const emit = defineEmits<{
  send: [text: string]
  openModelSelector: []
}>()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function handleSend() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleInput() {
  const el = textareaRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }
}

/** Get short display name for a model ID */
function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'Claude Sonnet 4.6'
  const map: Record<string, string> = {
    'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-opus-4-6': 'Claude Opus 4.6',
    'claude-haiku-4-5-20251001': 'Haiku 4.5',
    'deepseek-r1': 'DeepSeek R1',
    'deepseek-v3': 'DeepSeek V3',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gpt-5': 'GPT-5',
  }
  return map[modelId] ?? modelId
}

function getModelPrefix(modelId?: string): string {
  if (!modelId) return 'CL'
  if (modelId.startsWith('claude')) return 'CL'
  if (modelId.startsWith('deepseek')) return 'DS'
  if (modelId.startsWith('gemini')) return 'GE'
  if (modelId.startsWith('gpt')) return 'GP'
  return 'AI'
}

function getModelClass(modelId?: string): string {
  if (!modelId) return 'cl'
  if (modelId.startsWith('claude')) return 'cl'
  if (modelId.startsWith('deepseek')) return 'ds'
  if (modelId.startsWith('gemini')) return 'ge'
  if (modelId.startsWith('gpt')) return 'gpt'
  return 'cl'
}
</script>

<template>
  <div class="chat-input-area">
    <div class="chat-input-box" :class="{ 'input-disabled': disabled }">
      <textarea
        ref="textareaRef"
        v-model="input"
        :disabled="disabled"
        placeholder="输入消息或按 @ 引用文件..."
        rows="1"
        class="chat-textarea"
        @keydown="handleKeydown"
        @input="handleInput"
      />
      <button
        :disabled="disabled || !input.trim()"
        class="send-btn"
        title="发送消息"
        @click="handleSend"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </div>
    <div class="input-toolbar">
      <div class="toolbar-left">
        <button class="toolbar-btn">@ 引用</button>
        <button class="toolbar-btn">📎 附件</button>
      </div>
      <button class="model-selector" @click="emit('openModelSelector')">
        <span class="model-icon-sm" :class="getModelClass(currentModel)">
          {{ getModelPrefix(currentModel) }}
        </span>
        <span>{{ getModelDisplayName(currentModel) }}</span>
      </button>
    </div>
  </div>
</template>
