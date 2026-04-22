import { ref, onMounted, onUnmounted } from 'vue'
import { useVSCode } from './useVSCode'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

export function useChat() {
  const messages = ref<ChatMsg[]>([])
  const isLoading = ref(false)
  const { onMessage } = useVSCode()

  let cleanup: (() => void) | undefined

  onMounted(() => {
    cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data as { type: string; payload?: string; action?: string }

      switch (msg.type) {
        case 'assistantMessage':
          messages.value.push({
            role: 'assistant',
            content: msg.payload ?? '',
          })
          isLoading.value = false
          break

        case 'streamToken':
          // Append to last assistant message (or create one)
          if (
            messages.value.length === 0 ||
            messages.value[messages.value.length - 1].role !== 'assistant'
          ) {
            messages.value.push({ role: 'assistant', content: '' })
          }
          messages.value[messages.value.length - 1].content += msg.payload ?? ''
          break

        case 'streamDone':
          isLoading.value = false
          break

        case 'userAction':
          // Triggered by CodeLens / command (explain, refactor, etc.)
          messages.value.push({
            role: 'user',
            content: `[${msg.action}]\n${msg.payload ?? ''}`,
          })
          isLoading.value = true
          break
      }
    })
  })

  onUnmounted(() => {
    cleanup?.()
  })

  function sendMessage(text: string) {
    messages.value.push({ role: 'user', content: text })
    isLoading.value = true
  }

  function clearMessages() {
    messages.value = []
  }

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  }
}
