<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useMarkdown } from '../composables/useMarkdown'
import { useVSCode } from '../composables/useVSCode'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
  model?: string
  cost?: string
  savings?: string
  tokenCount?: number
  messageId?: string
}>()

const { renderMarkdown } = useMarkdown()
const { postMessage } = useVSCode()
const renderedHtml = ref('')

// Feedback state
const feedbackRating = ref<'up' | 'down' | null>(null)
const showFeedbackPanel = ref(false)
const feedbackSubmitted = ref(false)
const FEEDBACK_TOAST_MS = 2000

const feedbackCategories = [
  { id: 'inaccurate', label: '回答不准确' },
  { id: 'buggy', label: '代码有 Bug' },
  { id: 'insufficient', label: '不够详细' },
  { id: 'other', label: '其他' },
]

function handleThumbUp() {
  feedbackRating.value = 'up'
  showFeedbackPanel.value = false
  postMessage({ type: 'feedback', messageId: props.messageId, rating: 'up', category: '' })
  feedbackSubmitted.value = true
  setTimeout(() => { feedbackSubmitted.value = false }, FEEDBACK_TOAST_MS)
}

function handleThumbDown() {
  feedbackRating.value = 'down'
  showFeedbackPanel.value = true
}

function submitFeedback(category: string) {
  postMessage({ type: 'feedback', messageId: props.messageId, rating: 'down', category })
  showFeedbackPanel.value = false
  feedbackSubmitted.value = true
  setTimeout(() => { feedbackSubmitted.value = false }, FEEDBACK_TOAST_MS)
}

async function render() {
  if (props.role === 'assistant') {
    renderedHtml.value = await renderMarkdown(props.content)
  }
}

onMounted(render)
watch(() => props.content, render)
</script>

<template>
  <div class="message" :class="{ 'message--streaming': role === 'assistant' && !content }">
    <div class="msg-header">
      <div class="msg-avatar" :class="role === 'user' ? 'user' : 'ai'">
        <template v-if="role === 'user'">U</template>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-button-bg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          <path d="M20 3v4"/><path d="M22 5h-4"/>
          <path d="M4 17v2"/><path d="M5 18H3"/>
        </svg>
      </div>
      <span class="msg-name" :class="{ 'ai-name': role === 'assistant' }">
        {{ role === 'user' ? '你' : 'LinkCode' }}
      </span>
      <span v-if="role === 'assistant' && model" class="msg-meta">
        <span class="model-badge">{{ model }}</span>
      </span>
    </div>
    <div class="msg-body">
      <!-- Assistant: full markdown rendered -->
      <div
        v-if="role === 'assistant'"
        class="markdown-body"
        v-html="renderedHtml"
      />
      <!-- User: plain text with whitespace preserved -->
      <div v-else class="user-text">
        {{ content }}
      </div>
    </div>
    <!-- Cost display for AI messages -->
    <div v-if="role === 'assistant' && cost" class="msg-cost">
      <span>💰 {{ cost }}</span>
      <span v-if="savings" class="msg-cost-save">{{ savings }}</span>
    </div>

    <!-- Feedback buttons for AI messages -->
    <div v-if="role === 'assistant' && content" class="msg-feedback">
      <div class="feedback-btns">
        <button
          class="feedback-btn"
          :class="{ active: feedbackRating === 'up' }"
          title="有帮助"
          @click="handleThumbUp"
        >
          👍
        </button>
        <button
          class="feedback-btn"
          :class="{ active: feedbackRating === 'down' }"
          title="无帮助"
          @click="handleThumbDown"
        >
          👎
        </button>
      </div>

      <!-- Feedback category panel -->
      <div v-if="showFeedbackPanel" class="feedback-panel">
        <div class="feedback-panel-title">请选择原因：</div>
        <button
          v-for="cat in feedbackCategories"
          :key="cat.id"
          class="feedback-cat-btn"
          @click="submitFeedback(cat.id)"
        >
          {{ cat.label }}
        </button>
      </div>

      <!-- Feedback submitted toast -->
      <div v-if="feedbackSubmitted" class="feedback-toast">
        感谢反馈 ✓
      </div>
    </div>
  </div>
</template>
