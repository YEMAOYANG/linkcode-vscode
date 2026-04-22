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
  <div class="code-block">
    <div class="code-block__header">
      <span class="code-block__lang">{{ language ?? 'text' }}</span>
      <button class="code-block__copy" @click="handleCopy">
        {{ buttonText }}
      </button>
    </div>
    <pre class="code-block__body"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-block {
  background: var(--vscode-textCodeBlock-background, #1a1a1a);
  border-radius: 4px;
  overflow: hidden;
  margin: 4px 0;
}

.code-block__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 11px;
}

.code-block__lang {
  opacity: 0.6;
  text-transform: uppercase;
}

.code-block__copy {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 11px;
}

.code-block__body {
  padding: 8px;
  overflow-x: auto;
  font-family: var(--vscode-editor-font-family, 'Fira Code', monospace);
  font-size: var(--vscode-editor-font-size, 13px);
  line-height: 1.5;
  margin: 0;
}
</style>
