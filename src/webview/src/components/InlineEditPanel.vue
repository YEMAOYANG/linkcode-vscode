<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { useMarkdown } from '../composables/useMarkdown'
import { Button, Dialog, Textarea } from '../ui'

const emit = defineEmits<{ close: [] }>()

const { postMessage, onMessage } = useVSCode()
const { renderMarkdown } = useMarkdown()

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('close') })

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

onUnmounted(() => { cleanup?.() })

async function generateDiff() {
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
  <Dialog v-model:open="dialogOpen" size="md">
    <template #header>
      <div class="ie-heading">
        <h2 class="ie-title">✏️ 内联编辑</h2>
        <span v-if="fileName" class="ie-filename">{{ fileName }}</span>
      </div>
    </template>

    <div class="ie-input-area">
      <Textarea
        v-model="instruction"
        placeholder="描述你想要的修改，例如：添加错误处理、优化性能、添加注释..."
        :rows="2"
        :disabled="isLoading"
        @keydown.enter.ctrl="handleSubmit"
      />
      <Button
        variant="primary"
        :disabled="!instruction.trim() || isLoading"
        :loading="isLoading"
        class="ie-submit-btn"
        @click="handleSubmit"
      >
        {{ isLoading ? '生成中...' : '生成修改' }}
      </Button>
    </div>

    <div v-if="diffHtml" class="ie-diff">
      <div class="ie-diff-header">代码变更预览</div>
      <div class="ie-diff-body markdown-body" v-html="diffHtml" />
      <div class="ie-diff-actions">
        <Button variant="primary" @click="handleAccept">✓ Accept</Button>
        <Button @click="handleReject">✗ Reject</Button>
      </div>
    </div>

    <div v-else-if="isLoading" class="ie-loading">
      <div class="ie-spinner" />
      <span>AI 正在修改代码...</span>
    </div>
  </Dialog>
</template>

<style scoped>
.ie-heading { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.ie-title { font-size: var(--lcc-font-md); font-weight: 600; color: var(--lcc-text); margin: 0; }
.ie-filename {
  font-size: 11px;
  color: var(--lcc-text-subtle);
  font-family: var(--lcc-font-code);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ie-input-area { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.ie-submit-btn { align-self: flex-end; }

.ie-diff {
  border: 1px solid var(--lcc-border);
  border-radius: var(--lcc-radius-md);
  overflow: hidden;
}
.ie-diff-header {
  padding: 6px 12px;
  background: var(--lcc-bg-elevated);
  border-bottom: 1px solid var(--lcc-border);
  font-size: 11px;
  color: var(--lcc-text-subtle);
  font-weight: 500;
}
.ie-diff-body { padding: 12px; max-height: 300px; overflow-y: auto; font-size: 12px; }
.ie-diff-actions {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--lcc-border);
  justify-content: flex-end;
}

.ie-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 24px;
  color: var(--lcc-text-subtle);
  font-size: 12px;
}
.ie-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--lcc-border);
  border-top-color: var(--lcc-accent);
  border-radius: 50%;
  animation: lc-spin 0.8s linear infinite;
}
</style>
