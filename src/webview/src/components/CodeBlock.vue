<script setup lang="ts">
defineProps<{
  code: string
  language?: string
}>()
</script>

<template>
  <div class="code-block">
    <div class="code-block__header">
      <span class="code-block__lang">{{ language ?? 'text' }}</span>
      <button class="code-block__copy" @click="navigator.clipboard.writeText(code)">
        Copy
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
