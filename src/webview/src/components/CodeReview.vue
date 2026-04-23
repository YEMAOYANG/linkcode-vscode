<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { useMarkdown } from '../composables/useMarkdown'

const emit = defineEmits<{
  close: []
}>()

const { postMessage, onMessage } = useVSCode()
const { renderMarkdown } = useMarkdown()

const isLoading = ref(false)
const reviewResult = ref('')
const renderedHtml = ref('')
const fileName = ref('')
let cleanup: (() => void) | undefined

interface ReviewIssue {
  level: 'error' | 'warning' | 'info'
  text: string
}

const issues = computed<ReviewIssue[]>(() => {
  if (!reviewResult.value) return []
  // Parse review result for severity markers
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

onUnmounted(() => {
  cleanup?.()
})

function handleStartReview() {
  postMessage({ type: 'startCodeReview' })
}
</script>

<template>
  <div class="cr-overlay" @click.self="emit('close')">
    <div class="cr-panel">
      <div class="cr-header">
        <h2 class="cr-title">🔍 代码审查</h2>
        <button class="cr-close" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- No review yet -->
      <div v-if="!reviewResult && !isLoading" class="cr-empty">
        <p>点击下方按钮，AI 将审查当前活动文件的代码质量。</p>
        <button class="cr-start-btn" @click="handleStartReview">
          开始审查
        </button>
      </div>

      <!-- Loading -->
      <div v-else-if="isLoading && !reviewResult" class="cr-loading">
        <div class="cr-spinner" />
        <span>正在审查 {{ fileName }}...</span>
      </div>

      <!-- Results -->
      <div v-else class="cr-results">
        <div class="cr-file-name">📄 {{ fileName }}</div>

        <!-- Summary badges -->
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
    </div>
  </div>
</template>

<style scoped>
.cr-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.cr-panel {
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  background: var(--lc-surface, var(--color-bg));
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 20px;
  animation: slideUp 0.2s var(--lc-ease);
}

.cr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cr-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lc-text-primary);
}

.cr-close {
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
}

.cr-close:hover {
  background: var(--lc-hover);
  color: var(--lc-text-primary);
}

.cr-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--lc-text-tertiary);
  font-size: 12px;
}

.cr-start-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: var(--lc-accent);
  border: none;
  border-radius: var(--lc-radius-md);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: background 120ms;
}

.cr-start-btn:hover {
  background: var(--lc-accent-hover);
}

.cr-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 24px;
  color: var(--lc-text-tertiary);
  font-size: 12px;
}

.cr-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--lc-border);
  border-top-color: var(--lc-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.cr-spinner-sm {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--lc-border);
  border-top-color: var(--lc-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.cr-file-name {
  font-size: 12px;
  color: var(--lc-text-secondary);
  margin-bottom: 8px;
}

.cr-summary {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.cr-badge {
  padding: 2px 8px;
  border-radius: var(--lc-radius-sm);
  font-size: 10px;
  font-weight: 600;
}

.cr-badge-error { background: rgba(239, 68, 68, 0.12); color: var(--lc-red); }
.cr-badge-warning { background: rgba(245, 158, 11, 0.12); color: var(--lc-yellow); }
.cr-badge-info { background: rgba(59, 130, 246, 0.12); color: var(--lc-blue); }

.cr-results {
  animation: fadeIn 0.2s ease;
}

.cr-body {
  font-size: 12px;
  line-height: 1.7;
}

.cr-streaming {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  font-size: 11px;
  color: var(--lc-text-tertiary);
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
