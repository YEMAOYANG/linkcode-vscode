<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useMarkdown } from '../composables/useMarkdown'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
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
  <div
    class="chat-message"
    :class="role === 'user' ? 'chat-message--user' : 'chat-message--assistant'"
  >
    <div class="chat-avatar">
      {{ role === 'user' ? '👤' : '🤖' }}
    </div>
    <div class="chat-bubble" :class="role === 'user' ? 'bubble--user' : 'bubble--assistant'">
      <div class="chat-role-label">
        {{ role === 'user' ? 'You' : 'LinkCode' }}
      </div>
      <div class="chat-body">
        <!-- Assistant: full markdown rendered -->
        <div
          v-if="role === 'assistant'"
          class="markdown-body"
          v-html="renderedHtml"
        />
        <!-- User: plain text with whitespace preserved -->
        <div v-else class="whitespace-pre-wrap break-words">
          {{ content }}
        </div>
      </div>
    </div>
  </div>
</template>
