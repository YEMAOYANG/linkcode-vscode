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
  <div class="flex gap-1.5 p-2 border-t border-border">
    <textarea
      v-model="input"
      :disabled="disabled"
      placeholder="Ask LinkCode anything…"
      rows="2"
      class="flex-1 resize-none bg-input-bg text-input-fg border border-border rounded-sm px-2 py-1.5 text-[length:inherit] outline-none focus:border-button-bg"
      @keydown="handleKeydown"
    />
    <button
      :disabled="disabled || !input.trim()"
      class="bg-button-bg text-button-fg border-none rounded-sm px-3.5 py-1.5 cursor-pointer text-[length:inherit] hover:bg-button-hover disabled:opacity-50 disabled:cursor-not-allowed"
      @click="handleSend"
    >
      Send
    </button>
  </div>
</template>
