<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const input = ref('')

function handleSend() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="chat-input">
    <textarea
      v-model="input"
      :disabled="disabled"
      placeholder="Ask LinkCode anything…"
      rows="2"
      @keydown="handleKeydown"
    />
    <button :disabled="disabled || !input.trim()" @click="handleSend">
      Send
    </button>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--border);
}

textarea {
  flex: 1;
  resize: none;
  background: var(--input-bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  font-family: inherit;
  font-size: inherit;
  outline: none;
}

textarea:focus {
  border-color: var(--accent);
}

button {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: inherit;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
