<script setup lang="ts">
defineProps<{
  role: 'user' | 'assistant'
  content: string
}>()
</script>

<template>
  <div class="chat-message" :class="[`chat-message--${role}`]">
    <div class="chat-message__avatar">
      {{ role === 'user' ? '👤' : '✨' }}
    </div>
    <div class="chat-message__body">
      <div class="chat-message__role">{{ role === 'user' ? 'You' : 'LinkCode' }}</div>
      <div class="chat-message__content">{{ content }}</div>
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
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}
</style>
