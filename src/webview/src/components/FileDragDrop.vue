<script setup lang="ts">
export interface AttachedFile {
  name: string
  size: number
  content?: string
  status: 'preview' | 'loading' | 'done'
  filepath?: string
}

const emit = defineEmits<{
  remove: [index: number]
}>()

const props = defineProps<{
  files: AttachedFile[]
}>()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="file-drop-zone">
    <div v-if="props.files.length > 0" class="attached-files">
      <div v-for="(file, idx) in props.files" :key="idx" class="file-chip" :class="`file-${file.status}`">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span class="file-chip-name">{{ file.name }}</span>
        <span v-if="file.size > 0" class="file-chip-size">{{ formatSize(file.size) }}</span>
        <div v-if="file.status === 'loading'" class="file-chip-spinner" />
        <button v-else class="file-chip-remove" @click="emit('remove', idx)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-drop-zone {
  position: relative;
}

.dragging {
  position: relative;
}

.drag-overlay {
  position: absolute;
  inset: -8px;
  background: rgba(59, 130, 246, 0.08);
  border: 2px dashed var(--lcc-info);
  border-radius: var(--lcc-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  animation: lc-fade-in 0.15s ease;
}

.drag-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--lcc-info);
  font-size: 12px;
}

.attached-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0 4px;
}

.file-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--lcc-bg-elevated);
  border: 1px solid var(--lcc-border);
  border-radius: var(--lcc-radius-md);
  font-size: 11px;
  color: var(--lcc-text-muted);
  animation: lc-fade-in 0.15s ease;
}

.file-chip.file-done {
  border-color: rgba(34, 197, 94, 0.3);
}

.file-chip-name {
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--lcc-text);
}

.file-chip-size {
  color: var(--lcc-text-subtle);
  font-size: 10px;
}

.file-chip-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--lcc-border);
  border-top-color: var(--lcc-accent);
  border-radius: 50%;
  animation: lc-spin 0.6s linear infinite;
}

.file-chip-remove {
  background: none;
  border: none;
  color: var(--lcc-text-subtle);
  cursor: pointer;
  padding: 0 2px;
  font-size: 14px;
  line-height: 1;
}

.file-chip-remove:hover {
  color: var(--lcc-danger);
}
</style>
