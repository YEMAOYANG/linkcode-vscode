<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useMarkdown } from '../composables/useMarkdown'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
  model?: string
}>()

const { renderMarkdown } = useMarkdown()
const renderedHtml = ref('')

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
        {{ role === 'user' ? 'U' : '✦' }}
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
  </div>
</template>
