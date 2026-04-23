<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import { useChat } from './composables/useChat'
import { useVSCode } from './composables/useVSCode'

const { messages, sendMessage, isLoading } = useChat()
const { postMessage } = useVSCode()

const messagesListRef = ref<HTMLElement | null>(null)

function handleSend(text: string) {
  sendMessage(text)
  postMessage({ type: 'sendMessage', payload: text })
}

function scrollToBottom() {
  if (messagesListRef.value) {
    messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
  }
}

watch(
  messages,
  () => {
    nextTick(scrollToBottom)
  },
  { deep: true }
)

const quickPrompts = [
  { icon: '💡', text: 'Explain this code' },
  { icon: '🔧', text: 'Fix the bug in my selection' },
  { icon: '📝', text: 'Write unit tests' },
  { icon: '♻️', text: 'Refactor for readability' },
]

function handleQuickPrompt(text: string) {
  handleSend(text)
}
</script>

<template>
  <div class="chat-container">
    <!-- Messages area -->
    <div
      ref="messagesListRef"
      class="chat-messages"
    >
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">🤖</div>
        <div class="empty-title">LinkCode AI</div>
        <div class="empty-subtitle">Ask me anything about your code…</div>
        <div class="quick-prompts">
          <button
            v-for="prompt in quickPrompts"
            :key="prompt.text"
            class="quick-prompt-btn"
            @click="handleQuickPrompt(prompt.text)"
          >
            <span class="quick-prompt-icon">{{ prompt.icon }}</span>
            <span>{{ prompt.text }}</span>
          </button>
        </div>
      </div>

      <!-- Message list -->
      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :role="msg.role"
        :content="msg.content"
      />

      <!-- Typing indicator -->
      <div v-if="isLoading" class="typing-indicator">
        <div class="typing-avatar">🤖</div>
        <div class="typing-dots">
          <span class="typing-dot" />
          <span class="typing-dot" />
          <span class="typing-dot" />
        </div>
      </div>
    </div>

    <!-- Input -->
    <ChatInput :disabled="isLoading" @send="handleSend" />
  </div>
</template>
