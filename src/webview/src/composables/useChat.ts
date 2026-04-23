import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useVSCode } from './useVSCode'

export interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  cost?: string
  savings?: string
  tokenCount?: number
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function useChat() {
  const messages = ref<ChatMsg[]>([])
  const isLoading = ref(false)
  const currentModel = ref('claude-sonnet-4-6')
  const { onMessage, postMessage } = useVSCode()

  let cleanup: (() => void) | undefined
  let historyLoaded = false

  onMounted(() => {
    // Request chat history from extension host on startup
    postMessage({ type: 'getHistory' })
    // Signal ready — extension will send model info
    postMessage({ type: 'ready' })

    cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data as {
        type: string
        content?: string
        message?: string
        action?: string
        payload?: string
        code?: string
        language?: string
        messages?: ChatMsg[]
        modelId?: string
        cost?: string
        savings?: string
      }

      switch (msg.type) {
        case 'loadHistory':
          // Restore history from extension globalState
          if (msg.messages && Array.isArray(msg.messages)) {
            messages.value = msg.messages
            historyLoaded = true
          }
          break

        case 'modelInfo':
          if (msg.modelId) {
            currentModel.value = msg.modelId
          }
          break

        case 'chatCleared':
          messages.value = []
          break

        case 'stream_start':
          // Extension is about to stream — create an empty assistant bubble
          isLoading.value = true
          messages.value.push({ id: generateId(), role: 'assistant', content: '' })
          break

        case 'stream_chunk': {
          // Append token to the last assistant message
          const lastMsg = messages.value[messages.value.length - 1]
          if (!lastMsg || lastMsg.role !== 'assistant') {
            messages.value.push({ id: generateId(), role: 'assistant', content: '' })
          }
          const current = messages.value[messages.value.length - 1]
          current.content += msg.content ?? ''
          break
        }

        case 'stream_end':
          isLoading.value = false
          // Attach cost info if provided
          if (msg.cost) {
            const last = messages.value[messages.value.length - 1]
            if (last && last.role === 'assistant') {
              last.cost = msg.cost as string
              if (msg.savings) last.savings = msg.savings as string
            }
          }
          break

        case 'stream_error':
          isLoading.value = false
          // Append error info to the current assistant message
          if (msg.message) {
            const last = messages.value[messages.value.length - 1]
            if (last && last.role === 'assistant') {
              last.content += `\n\n⚠️ Error: ${msg.message}`
            }
          }
          break

        case 'user_action':
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

  function changeModel(modelId: string) {
    currentModel.value = modelId
  }

  return {
    messages,
    isLoading,
    currentModel,
    sendMessage,
    clearMessages,
    changeModel,
  }
}
