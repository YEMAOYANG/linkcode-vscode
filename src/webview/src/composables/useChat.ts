import { ref, onMounted, onUnmounted } from 'vue'
import { useVSCode } from './useVSCode'

export interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function useChat() {
  const messages = ref<ChatMsg[]>([])
  const isLoading = ref(false)
  const { onMessage } = useVSCode()

  let cleanup: (() => void) | undefined

  onMounted(() => {
    cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data as { type: string; payload?: string; action?: string; error?: string }

      switch (msg.type) {
        case 'assistantMessage':
          messages.value.push({
            id: generateId(),
            role: 'assistant',
            content: msg.payload ?? '',
          })
          isLoading.value = false
          break

        case 'streamToken': {
          // Append to last assistant message (or create one)
          const lastMsg = messages.value[messages.value.length - 1]
          if (!lastMsg || lastMsg.role !== 'assistant' || !isLoading.value) {
            messages.value.push({ id: generateId(), role: 'assistant', content: '' })
          }
          const current = messages.value[messages.value.length - 1]
          current.content += msg.payload ?? ''
          break
        }

        case 'streamDone':
          isLoading.value = false
          break

        case 'streamError':
          isLoading.value = false
          break

        case 'userAction':
          // Triggered by CodeLens / command (explain, refactor, etc.)
          messages.value.push({
            id: generateId(),
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
    messages.value.push({ id: generateId(), role: 'user', content: text })
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
