<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { useMarkdown } from '../composables/useMarkdown'

const emit = defineEmits<{
  close: []
}>()

const { postMessage, onMessage } = useVSCode()
const { renderMarkdown } = useMarkdown()

const instruction = ref('')
const isLoading = ref(false)
const originalCode = ref('')
const modifiedCode = ref('')
const diffHtml = ref('')
const fileName = ref('')
let cleanup: (() => void) | undefined

onMounted(() => {
  cleanup = onMessage((event: MessageEvent) => {
    const msg = event.data as {
      type: string
      content?: string
      code?: string
      original?: string
      fileName?: string
    }
    switch (msg.type) {
      case 'inline_edit_context':
        originalCode.value = msg.code || ''
        fileName.value = msg.fileName || ''
        break
      case 'inline_edit_start':
        isLoading.value = true
        modifiedCode.value = ''
        break
      case 'inline_edit_chunk':
        modifiedCode.value += msg.content ?? ''
        break
      case 'inline_edit_end':
        isLoading.value = false
        void generateDiff()
        break
    }
  })
})

onUnmounted(() => {
  cleanup?.()
})

async function generateDiff() {
  // Simple diff display
  const diffText = `\`\`\`diff\n${createSimpleDiff(originalCode.value, modifiedCode.value)}\n\`\`\``
  diffHtml.value = await renderMarkdown(diffText)
}

function createSimpleDiff(original: string, modified: string): string {
  const origLines = original.split('\n')
  const modLines = modified.split('\n')
  const lines: string[] = []
  const maxLen = Math.max(origLines.length, modLines.length)

  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i]
    const modLine = modLines[i]

    if (origLine === undefined && modLine !== undefined) {
      lines.push(`+ ${modLine}`)
    } else if (origLine !== undefined && modLine === undefined) {
      lines.push(`- ${origLine}`)
    } else if (origLine !== modLine) {
      lines.push(`- ${origLine}`)
      lines.push(`+ ${modLine}`)
    } else {
      lines.push(`  ${origLine}`)
    }
  }
  return lines.join('\n')
}

function handleSubmit() {
  if (!instruction.value.trim()) return
  postMessage({
    type: 'inlineEditRequest',
    instruction: instruction.value.trim(),
    code: originalCode.value,
  })
}

function handleAccept() {
  postMessage({ type: 'inlineEditAccept', code: modifiedCode.value })
  emit('close')
}

function handleReject() {
  modifiedCode.value = ''
  diffHtml.value = ''
}
</script>

<template>
  <div class="ie-overlay" @click.self="emit('close')">
    <div class="ie-panel">
      <div class="ie-header">
        <h2 class="ie-title">✏️ 内联编辑</h2>
        <span v-if="fileName" class="ie-filename">{{ fileName }}</span>
        <button class="ie-close" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Instruction input -->
      <div class="ie-input-area">
        <textarea
          v-model="instruction"
          placeholder="描述你想要的修改，例如：添加错误处理、优化性能、添加注释..."
          rows="2"
          class="ie-textarea"
          :disabled="isLoading"
          @keydown.enter.ctrl="handleSubmit"
        />
        <button
          class="ie-submit"
          :disabled="!instruction.trim() || isLoading"
          @click="handleSubmit"
        >
          {{ isLoading ? '生成中...' : '生成修改' }}
        </button>
      </div>

      <!-- Diff display -->
      <div v-if="diffHtml" class="ie-diff">
        <div class="ie-diff-header">代码变更预览</div>
        <div class="ie-diff-body markdown-body" v-html="diffHtml" />
        <div class="ie-diff-actions">
          <button class="ie-btn ie-btn-accept" @click="handleAccept">
            ✓ Accept
          </button>
          <button class="ie-btn ie-btn-reject" @click="handleReject">
            ✗ Reject
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="isLoading" class="ie-loading">
        <div class="ie-spinner" />
        <span>AI 正在修改代码...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ie-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.ie-panel {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--lc-surface, var(--color-bg));
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 20px;
  animation: slideUp 0.2s var(--lc-ease);
}

.ie-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.ie-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lc-text-primary);
}

.ie-filename {
  font-size: 11px;
  color: var(--lc-text-tertiary);
  font-family: var(--lc-font-code);
  flex: 1;
}

.ie-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--lc-radius-sm);
  color: var(--lc-text-secondary);
  cursor: pointer;
  transition: all 120ms;
  margin-left: auto;
}

.ie-close:hover {
  background: var(--lc-hover);
  color: var(--lc-text-primary);
}

.ie-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.ie-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md);
  color: var(--lc-text-primary);
  font-size: 12px;
  font-family: var(--lc-font-ui);
  resize: vertical;
  outline: none;
  transition: border-color 120ms;
}

.ie-textarea:focus {
  border-color: var(--lc-accent);
}

.ie-submit {
  align-self: flex-end;
  padding: 6px 16px;
  background: var(--lc-accent);
  border: none;
  border-radius: var(--lc-radius-md);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: background 120ms;
}

.ie-submit:hover:not(:disabled) {
  background: var(--lc-accent-hover);
}

.ie-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ie-diff {
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md);
  overflow: hidden;
}

.ie-diff-header {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--lc-border);
  font-size: 11px;
  color: var(--lc-text-tertiary);
  font-weight: 500;
}

.ie-diff-body {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 12px;
}

.ie-diff-actions {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--lc-border);
  justify-content: flex-end;
}

.ie-btn {
  padding: 6px 16px;
  border: none;
  border-radius: var(--lc-radius-md);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: all 120ms;
}

.ie-btn-accept {
  background: var(--lc-green);
  color: #fff;
}

.ie-btn-accept:hover {
  background: #16a34a;
}

.ie-btn-reject {
  background: var(--lc-elevated);
  color: var(--lc-text-secondary);
  border: 1px solid var(--lc-border);
}

.ie-btn-reject:hover {
  background: var(--lc-hover);
  color: var(--lc-text-primary);
}

.ie-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 24px;
  color: var(--lc-text-tertiary);
  font-size: 12px;
}

.ie-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--lc-border);
  border-top-color: var(--lc-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
