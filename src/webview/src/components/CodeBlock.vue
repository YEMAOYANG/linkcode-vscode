<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  code: string
  language?: string
}>()

const buttonText = ref('Copy')

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.code)
    buttonText.value = 'Copied!'
    setTimeout(() => {
      buttonText.value = 'Copy'
    }, 2000)
  } catch {
    buttonText.value = 'Failed'
    setTimeout(() => {
      buttonText.value = 'Copy'
    }, 2000)
  }
}
</script>

<template>
  <div class="bg-code-bg rounded-sm overflow-hidden my-1">
    <div class="flex justify-between items-center px-2 py-1 bg-white/[0.04] text-[11px]">
      <span class="opacity-60 uppercase">{{ language ?? 'text' }}</span>
      <button
        class="bg-transparent border-none text-link cursor-pointer text-[11px]"
        @click="handleCopy"
      >
        {{ buttonText }}
      </button>
    </div>
    <pre class="p-2 overflow-x-auto text-[length:var(--vscode-editor-font-size,_13px)] leading-relaxed m-0" style="font-family: var(--vscode-editor-font-family, 'Fira Code', monospace)"><code>{{ code }}</code></pre>
  </div>
</template>
