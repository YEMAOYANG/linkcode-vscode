<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onUnmounted } from 'vue'
import AtMention from './AtMention.vue'
import FileDragDrop from './FileDragDrop.vue'
import ImageUpload from './ImageUpload.vue'
import type { AttachedFile } from './FileDragDrop.vue'
import type { ImageAttachment } from './ImageUpload.vue'
import type { AtMentionItem } from './AtMention.vue'
import { useVSCode } from '../composables/useVSCode'

defineProps<{
  disabled?: boolean
  currentModel?: string
}>()

const emit = defineEmits<{
  send: [text: string, options?: { images?: ImageAttachment[]; files?: AttachedFile[]; quotedCode?: QuotedCode | null }]
  openModelSelector: []
}>()

export interface QuotedCode {
  code: string
  language: string
}

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const atMentionRef = ref<InstanceType<typeof AtMention> | null>(null)
const imageUploadRef = ref<InstanceType<typeof ImageUpload> | null>(null)
const { postMessage, onMessage } = useVSCode()

// AtMention state
const showAtMention = ref(false)
const atMentionQuery = ref('')

// File attachments
const attachedFiles = ref<AttachedFile[]>([])

// Image attachments
const attachedImages = ref<ImageAttachment[]>([])

// Quoted code
const quotedCode = ref<QuotedCode | null>(null)

// Listen for fileContent from extension
let cleanupFileContent: (() => void) | undefined
onMounted(() => {
  cleanupFileContent = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string; filepath?: string; content?: string; name?: string }
    if (msg.type === 'fileContent' && msg.filepath && msg.content && msg.name) {
      // Add as attached file and also send to extension
      attachedFiles.value.push({ name: msg.name, content: msg.content, size: msg.content.length, status: 'done' })
      postMessage({ type: 'attachFile', name: msg.name, content: msg.content })
    }
  })
})
onUnmounted(() => {
  cleanupFileContent?.()
})

function handleSend() {
  const text = input.value.trim()
  if (!text && attachedImages.value.length === 0 && !quotedCode.value) return
  emit('send', text, {
    images: attachedImages.value.length > 0 ? [...attachedImages.value] : undefined,
    files: attachedFiles.value.length > 0 ? [...attachedFiles.value] : undefined,
    quotedCode: quotedCode.value,
  })
  input.value = ''
  attachedFiles.value = []
  attachedImages.value = []
  quotedCode.value = null
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

function handleKeydown(e: KeyboardEvent) {
  // Forward to AtMention if visible
  if (showAtMention.value) {
    if (['ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) {
      atMentionRef.value?.handleKeydown(e)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      atMentionRef.value?.handleKeydown(e)
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const MAX_TEXTAREA_HEIGHT = 120

function handleInput() {
  const el = textareaRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px'

    // Detect @ trigger
    const val = el.value
    const cursorPos = el.selectionStart ?? 0
    const beforeCursor = val.slice(0, cursorPos)
    const atIndex = beforeCursor.lastIndexOf('@')

    if (atIndex >= 0 && (atIndex === 0 || beforeCursor[atIndex - 1] === ' ' || beforeCursor[atIndex - 1] === '\n')) {
      showAtMention.value = true
      atMentionQuery.value = beforeCursor.slice(atIndex + 1)
    } else {
      showAtMention.value = false
      atMentionQuery.value = ''
    }
  }
}

function handleAtMentionSelect(item: AtMentionItem) {
  // Replace @query with the selected item
  const el = textareaRef.value
  if (el) {
    const val = el.value
    const cursorPos = el.selectionStart ?? 0
    const beforeCursor = val.slice(0, cursorPos)
    const atIndex = beforeCursor.lastIndexOf('@')
    if (atIndex >= 0) {
      input.value = val.slice(0, atIndex) + `@${item.label} ` + val.slice(cursorPos)
    }
  }
  showAtMention.value = false
}

function handleAtMentionClose() {
  showAtMention.value = false
}

function handleFileAttach(file: AttachedFile) {
  attachedFiles.value.push(file)
}

function handleFileRemove(index: number) {
  attachedFiles.value.splice(index, 1)
}

function handleImageAdd(img: ImageAttachment) {
  attachedImages.value.push(img)
}

function handleImageRemove(id: string) {
  attachedImages.value = attachedImages.value.filter((i) => i.id !== id)
}

function handlePaste(e: ClipboardEvent) {
  imageUploadRef.value?.handlePaste(e)
}

// Expose method for parent to set quoted code
function setQuotedCode(code: string, language: string) {
  quotedCode.value = { code, language }
}

defineExpose({ setQuotedCode })

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

function truncateCode(code: string, maxLen = 50): string {
  const firstLine = code.split('\n')[0] || ''
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '...' : firstLine
}
</script>

<template>
  <div class="chat-input-area" @paste="handlePaste">
    <!-- Quoted code card -->
    <div v-if="quotedCode" class="quoted-code-card">
      <div class="quoted-code-header">
        <span class="quoted-code-lang">{{ quotedCode.language }}</span>
        <button class="quoted-code-remove" @click="quotedCode = null">×</button>
      </div>
      <code class="quoted-code-preview">{{ truncateCode(quotedCode.code) }}</code>
    </div>

    <!-- Image previews -->
    <ImageUpload
      ref="imageUploadRef"
      :images="attachedImages"
      @add="handleImageAdd"
      @remove="handleImageRemove"
    />

    <!-- File attachments -->
    <FileDragDrop
      :files="attachedFiles"
      @attach="handleFileAttach"
      @remove="handleFileRemove"
    />

    <div class="chat-input-box-wrapper">
      <!-- AtMention panel -->
      <AtMention
        ref="atMentionRef"
        :visible="showAtMention"
        :query="atMentionQuery"
        @select="handleAtMentionSelect"
        @close="handleAtMentionClose"
      />

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
          :disabled="disabled || (!input.trim() && attachedImages.length === 0 && !quotedCode)"
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
    </div>
    <div class="input-toolbar">
      <div class="toolbar-left">
        <button class="toolbar-btn" @click="showAtMention = !showAtMention">@ 引用</button>
        <button class="toolbar-btn" @click="imageUploadRef?.openFilePicker?.()">📎 附件</button>
      </div>
      <button class="model-selector" @click="emit('openModelSelector')">
        <span class="model-icon-sm" :class="getModelClass(currentModel)">
          {{ getModelPrefix(currentModel) }}
        </span>
        <span>{{ getModelDisplayName(currentModel) }}</span>
        <span v-if="!currentModel || currentModel === 'auto'" class="routing-badge">Auto</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-box-wrapper {
  position: relative;
}

.quoted-code-card {
  margin-bottom: 6px;
  padding: 6px 10px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md);
  animation: fadeIn 0.15s ease;
}

.quoted-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.quoted-code-lang {
  font-size: 10px;
  color: var(--lc-text-tertiary);
  text-transform: uppercase;
}

.quoted-code-remove {
  background: none;
  border: none;
  color: var(--lc-text-tertiary);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
}

.quoted-code-remove:hover {
  color: var(--lc-red);
}

.quoted-code-preview {
  display: block;
  font-size: 11px;
  font-family: var(--lc-font-code);
  color: var(--lc-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
