<script setup lang="ts">
import { computed } from 'vue'
import CodeBlock from './CodeBlock.vue'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
}>()

interface ContentPart {
  type: 'text' | 'code'
  content: string
  language?: string
}

const parts = computed<ContentPart[]>(() => {
  const result: ContentPart[] = []
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(props.content)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: props.content.slice(lastIndex, match.index) })
    }
    result.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2],
    })
    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < props.content.length) {
    result.push({ type: 'text', content: props.content.slice(lastIndex) })
  }

  return result
})
</script>

<template>
  <div class="chat-message" :class="[`chat-message--${role}`]">
    <div class="chat-message__avatar">
      {{ role === 'user' ? '👤' : '✨' }}
    </div>
    <div class="chat-message__body">
      <div class="chat-message__role">{{ role === 'user' ? 'You' : 'LinkCode' }}</div>
      <div class="chat-message__content">
        <template v-for="(part, idx) in parts" :key="idx">
          <CodeBlock
            v-if="part.type === 'code'"
            :code="part.content"
            :language="part.language"
          />
          <span v-else class="chat-message__text">{{ part.content }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.chat-message--assistant {
  background: var(--vscode-textBlockQuote-background, rgba(255, 255, 255, 0.04));
}

.chat-message__avatar {
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  font-size: 14px;
}

.chat-message__role {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
  margin-bottom: 2px;
}

.chat-message__content {
  word-break: break-word;
  line-height: 1.5;
}

.chat-message__text {
  white-space: pre-wrap;
}
</style>
