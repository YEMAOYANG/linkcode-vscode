<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { useMarkdown } from '../composables/useMarkdown'
import { Button, Dialog } from '../ui'

const emit = defineEmits<{ close: [] }>()

const { postMessage, onMessage } = useVSCode()
const { renderMarkdown } = useMarkdown()

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('close') })

const isLoading = ref(false)
const reviewResult = ref('')
const renderedHtml = ref('')
const fileName = ref('')
let cleanup: (() => void) | undefined

interface ReviewIssue { level: 'error' | 'warning' | 'info'; text: string }

const issues = computed<ReviewIssue[]>(() => {
  if (!reviewResult.value) return []
  const lines = reviewResult.value.split('\n')
  const result: ReviewIssue[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^(❌|🔴|error|严重)/i.test(trimmed)) {
      result.push({ level: 'error', text: trimmed })
    } else if (/^(⚠️|🟡|warning|警告)/i.test(trimmed)) {
      result.push({ level: 'warning', text: trimmed })
    } else if (/^(ℹ️|🔵|info|建议)/i.test(trimmed)) {
      result.push({ level: 'info', text: trimmed })
    }
  }
  return result
})

const errorCount = computed(() => issues.value.filter((i) => i.level === 'error').length)
const warningCount = computed(() => issues.value.filter((i) => i.level === 'warning').length)
const infoCount = computed(() => issues.value.filter((i) => i.level === 'info').length)

onMounted(() => {
  cleanup = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string; content?: string; fileName?: string }
    switch (msg.type) {
      case 'code_review_start':
        isLoading.value = true
        reviewResult.value = ''
        renderedHtml.value = ''
        fileName.value = msg.fileName || '当前文件'
        break
      case 'code_review_chunk':
        reviewResult.value += msg.content ?? ''
        void renderMarkdown(reviewResult.value).then((html) => {
          renderedHtml.value = html
        })
        break
      case 'code_review_end':
        isLoading.value = false
        break
    }
  })
})

onUnmounted(() => { cleanup?.() })

function handleStartReview() {
  postMessage({ type: 'startCodeReview' })
}
</script>

<template>
  <Dialog v-model:open="dialogOpen" title="🔍 代码审查" size="md">
    <div v-if="!reviewResult && !isLoading" class="cr-empty">
      <p>点击下方按钮，AI 将审查当前活动文件的代码质量。</p>
      <Button variant="primary" @click="handleStartReview">开始审查</Button>
    </div>

    <div v-else-if="isLoading && !reviewResult" class="cr-loading">
      <div class="cr-spinner" />
      <span>正在审查 {{ fileName }}...</span>
    </div>

    <div v-else class="cr-results">
      <div class="cr-file-name">📄 {{ fileName }}</div>
      <div v-if="issues.length > 0" class="cr-summary">
        <span v-if="errorCount" class="cr-badge cr-badge-error">{{ errorCount }} Error</span>
        <span v-if="warningCount" class="cr-badge cr-badge-warning">{{ warningCount }} Warning</span>
        <span v-if="infoCount" class="cr-badge cr-badge-info">{{ infoCount }} Info</span>
      </div>
      <div class="cr-body markdown-body" v-html="renderedHtml" />
      <div v-if="isLoading" class="cr-streaming">
        <div class="cr-spinner-sm" />
        <span>审查中...</span>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.cr-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--lcc-text-subtle);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.cr-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 24px;
  color: var(--lcc-text-subtle);
  font-size: 12px;
}
.cr-spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--lcc-border);
  border-top-color: var(--lcc-accent);
  border-radius: 50%;
  animation: lc-spin 0.8s linear infinite;
}
.cr-spinner-sm {
  width: 12px; height: 12px;
  border: 1.5px solid var(--lcc-border);
  border-top-color: var(--lcc-accent);
  border-radius: 50%;
  animation: lc-spin 0.8s linear infinite;
}
.cr-file-name { font-size: 12px; color: var(--lcc-text-muted); margin-bottom: 8px; }
.cr-summary { display: flex; gap: 6px; margin-bottom: 12px; }
.cr-badge {
  padding: 2px 8px;
  border-radius: var(--lcc-radius-sm);
  font-size: 10px;
  font-weight: 600;
}
.cr-badge-error {
  background: color-mix(in srgb, var(--lcc-danger) 14%, transparent);
  color: var(--lcc-danger);
}
.cr-badge-warning {
  background: color-mix(in srgb, var(--lcc-warning) 14%, transparent);
  color: var(--lcc-warning);
}
.cr-badge-info {
  background: color-mix(in srgb, var(--lcc-info) 14%, transparent);
  color: var(--lcc-info);
}
.cr-body { font-size: 12px; line-height: 1.7; }
.cr-streaming {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  font-size: 11px;
  color: var(--lcc-text-subtle);
}
</style>
