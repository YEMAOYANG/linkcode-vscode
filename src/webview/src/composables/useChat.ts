import { ref, watch, onMounted, onUnmounted } from 'vue'
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
  const { onMessage, postMessage } = useVSCode()

  let cleanup: (() => void) | undefined
  let historyLoaded = false

  onMounted(() => {
    // Request chat history from extension host on startup
    postMessage({ type: 'getHistory' })

    cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data as {
        type: string
        payload?: string
        action?: string
        error?: string
        messages?: ChatMsg[]
      }

      switch (msg.type) {
        case 'loadHistory':
          // Restore history from extension globalState
          if (msg.messages && Array.isArray(msg.messages)) {
            messages.value = msg.messages
            historyLoaded = true
          }
          break

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

  // Persist messages to extension host whenever they change
  watch(
    messages,
    (newMessages) => {
      if (historyLoaded || newMessages.length > 0) {
        postMessage({ type: 'saveMessages', messages: newMessages })
      }
    },
    { deep: true }
  )

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
