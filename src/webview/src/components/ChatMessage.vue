<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useMarkdown } from '../composables/useMarkdown'
import { useVSCode } from '../composables/useVSCode'
import type { ChatMode } from '../composables/useChat'
import PlanActions from './PlanActions.vue'
import { Popover, Tooltip } from '../ui'

interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
  model?: string
  cost?: string
  savings?: string
  tokenCount?: number
  messageId?: string
  mode?: ChatMode
  models?: ModelInfo[]
  currentModel?: string
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  build: [payload: { modelId: string; content: string }]
}>()

const { renderMarkdown } = useMarkdown()
const { postMessage } = useVSCode()
const renderedHtml = ref('')

const showPlanActions = computed(
  () =>
    props.role === 'assistant' &&
    props.mode === 'plan' &&
    !!props.content.trim() &&
    !props.isStreaming,
)

function handleBuild(payload: { modelId: string; content: string }) {
  emit('build', payload)
}

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
  <div class="msg-c" :class="`msg-c--${role}`">
    <template v-if="role === 'user'">
      <div class="msg-c__user-wrap">
        <div class="msg-c__user-bubble">{{ content }}</div>
      </div>
    </template>

    <template v-else>
      <div class="msg-c__ai">
        <div class="msg-c__ai-head">
          <div class="msg-c__avatar">
            <Icon icon="lucide:sparkles" :width="14" :height="14" />
          </div>
          <span class="msg-c__name">LinkCode</span>
          <span v-if="model" class="msg-c__model">{{ model }}</span>
        </div>

        <div class="msg-c__body markdown-body" v-html="renderedHtml" />

        <PlanActions
          v-if="showPlanActions"
          :models="models ?? []"
          :current-model="currentModel ?? ''"
          :plan-content="content"
          @build="handleBuild"
        />

        <div class="msg-c__footer">
          <div v-if="cost" class="msg-c__cost">
            <Icon icon="lucide:coins" :width="12" :height="12" />
            <span>{{ cost }}</span>
            <span v-if="savings" class="msg-c__save">{{ savings }}</span>
          </div>

          <div v-if="content" class="msg-c__actions">
            <Tooltip content="有帮助">
              <button
                class="msg-c__iconbtn"
                :class="{ 'is-active': feedbackRating === 'up' }"
                @click="handleThumbUp"
              >
                <Icon icon="lucide:thumbs-up" :width="13" :height="13" />
              </button>
            </Tooltip>
            <Popover v-model:open="showFeedbackPanel" side="bottom" align="end" :side-offset="6">
              <template #trigger>
                <button
                  class="msg-c__iconbtn"
                  :class="{ 'is-active': feedbackRating === 'down' }"
                  aria-label="无帮助"
                  @click="handleThumbDown"
                >
                  <Icon icon="lucide:thumbs-down" :width="13" :height="13" />
                </button>
              </template>
              <div class="msg-c__panel-title">请选择原因</div>
              <div class="msg-c__panel-cats">
                <button
                  v-for="cat in feedbackCategories"
                  :key="cat.id"
                  class="msg-c__panel-cat"
                  @click="submitFeedback(cat.id)"
                >
                  {{ cat.label }}
                </button>
              </div>
            </Popover>

            <Transition name="toast">
              <span v-if="feedbackSubmitted" class="msg-c__toast">
                <Icon icon="lucide:check" :width="12" :height="12" />
                感谢反馈
              </span>
            </Transition>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.msg-c {
  padding: var(--lcc-space-3) var(--lcc-space-4);
  font-size: var(--lcc-font-md);
  color: var(--lcc-text);
  animation: lc-slide-up 240ms var(--lcc-ease-out);
}

.msg-c__user-wrap { display: flex; justify-content: flex-end; }

.msg-c__user-bubble {
  max-width: 88%;
  padding: 8px 12px;
  background: var(--lcc-accent-grad);
  color: var(--lcc-accent-fg);
  border-radius: var(--lcc-radius-lg) var(--lcc-radius-sm) var(--lcc-radius-lg) var(--lcc-radius-lg);
  font-size: var(--lcc-font-md);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: var(--lcc-shadow-sm), var(--lcc-shadow-inset);
}

.msg-c__ai {
  position: relative;
  padding-left: var(--lcc-space-3);
}

.msg-c__ai::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 2px;
  background: var(--lcc-accent-grad);
  opacity: 0.6;
}

.msg-c__ai-head {
  display: flex;
  align-items: center;
  gap: var(--lcc-space-2);
  margin-bottom: 6px;
}

.msg-c__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--lcc-radius-md);
  background: color-mix(in srgb, var(--lcc-accent) 14%, transparent);
  color: var(--lcc-accent);
}

.msg-c__name { font-weight: 600; font-size: var(--lcc-font-sm); letter-spacing: -0.01em; }

.msg-c__model {
  font-size: 10px;
  color: var(--lcc-text-subtle);
  padding: 1px 6px;
  border: 1px solid var(--lcc-border-subtle);
  border-radius: var(--lcc-radius-sm);
  font-family: var(--lcc-font-code);
  font-weight: 500;
}

.msg-c__body { line-height: 1.62; word-break: break-word; }

.msg-c__footer {
  display: flex;
  align-items: center;
  gap: var(--lcc-space-3);
  margin-top: var(--lcc-space-2);
  min-height: 24px;
}

.msg-c__cost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--lcc-font-xs);
  color: var(--lcc-text-muted);
}

.msg-c__save { color: var(--lcc-success); font-weight: 500; }

.msg-c__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  position: relative;
  margin-left: auto;
}

.msg-c__iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--lcc-radius-sm);
  color: var(--lcc-text-subtle);
  cursor: pointer;
  transition:
    background var(--lcc-duration-fast) var(--lcc-ease-out),
    color var(--lcc-duration-fast) var(--lcc-ease-out),
    transform var(--lcc-duration-base) var(--lcc-ease-spring);
}

.msg-c__iconbtn:hover {
  background: var(--lcc-bg-hover);
  color: var(--lcc-text);
  transform: scale(1.08);
}

.msg-c__iconbtn.is-active {
  background: color-mix(in srgb, var(--lcc-accent) 20%, transparent);
  color: var(--lcc-accent);
}

.msg-c__panel-title {
  font-size: var(--lcc-font-xs);
  color: var(--lcc-text-muted);
  margin-bottom: 6px;
  padding: 0 4px;
  min-width: 200px;
}

.msg-c__panel-cats { display: flex; flex-wrap: wrap; gap: 4px; }

.msg-c__panel-cat {
  font-size: var(--lcc-font-xs);
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--lcc-border-subtle);
  border-radius: var(--lcc-radius-sm);
  color: var(--lcc-text);
  cursor: pointer;
  transition: all var(--lcc-duration-fast) var(--lcc-ease-out);
}

.msg-c__panel-cat:hover {
  background: var(--lcc-accent-grad);
  border-color: transparent;
  color: var(--lcc-accent-fg);
  transform: translateY(-1px);
}

.msg-c__toast {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--lcc-font-xs);
  color: var(--lcc-success);
  font-weight: 500;
}

.toast-enter-active, .toast-leave-active { transition: all var(--lcc-duration-base) var(--lcc-ease-out); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(4px); }
</style>
