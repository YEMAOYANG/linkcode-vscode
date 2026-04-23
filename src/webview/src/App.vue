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
</script>

<template>
  <div class="flex flex-col h-screen bg-bg text-fg text-[length:var(--vscode-font-size,_13px)]" style="font-family: var(--vscode-font-family, 'Segoe UI', sans-serif)">
    <div
      ref="messagesListRef"
      class="flex-1 overflow-y-auto p-2"
    >
      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :role="msg.role"
        :content="msg.content"
      />
      <div
        v-if="isLoading"
        class="flex gap-1 px-3 py-2"
      >
        <span class="size-1.5 rounded-full bg-fg opacity-40 animate-[blink_1.4s_infinite_both]" />
        <span class="size-1.5 rounded-full bg-fg opacity-40 animate-[blink_1.4s_infinite_both_0.2s]" />
        <span class="size-1.5 rounded-full bg-fg opacity-40 animate-[blink_1.4s_infinite_both_0.4s]" />
      </div>
    </div>
    <ChatInput :disabled="isLoading" @send="handleSend" />
  </div>
</template>

<style>
/* Global reset — keep minimal, Tailwind preflight handles most */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
}

body {
  background: var(--color-bg);
  color: var(--color-fg);
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0.4; }
  40% { opacity: 1; }
}
</style>
