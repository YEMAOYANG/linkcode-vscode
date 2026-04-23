<script setup lang="ts">
import { ref } from 'vue'
import { useVSCode } from '../composables/useVSCode'

export interface AttachedFile {
  name: string
  size: number
  content?: string
  status: 'preview' | 'loading' | 'done'
}

const emit = defineEmits<{
  attach: [file: AttachedFile]
  remove: [index: number]
}>()

const props = defineProps<{
  files: AttachedFile[]
}>()

const { postMessage } = useVSCode()
const isDragging = ref(false)

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    const attached: AttachedFile = {
      name: file.name,
      size: file.size,
      status: 'loading',
    }
    emit('attach', attached)

    try {
      const content = await readFileContent(file)
      attached.content = content
      attached.status = 'done'
      postMessage({ type: 'attachFile', name: file.name, content })
    } catch {
      attached.status = 'done'
    }
  }
}

function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div
    class="file-drop-zone"
    :class="{ dragging: isDragging }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Drag overlay -->
    <div v-if="isDragging" class="drag-overlay">
      <div class="drag-overlay-content">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>拖放文件到这里</span>
      </div>
    </div>

    <!-- Attached files chips -->
    <div v-if="props.files.length > 0" class="attached-files">
      <div v-for="(file, idx) in props.files" :key="idx" class="file-chip" :class="`file-${file.status}`">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span class="file-chip-name">{{ file.name }}</span>
        <span class="file-chip-size">{{ formatSize(file.size) }}</span>
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
  border: 2px dashed var(--lc-blue);
  border-radius: var(--lc-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  animation: fadeIn 0.15s ease;
}

.drag-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--lc-blue);
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
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md);
  font-size: 11px;
  color: var(--lc-text-secondary);
  animation: fadeIn 0.15s ease;
}

.file-chip.file-done {
  border-color: rgba(34, 197, 94, 0.3);
}

.file-chip-name {
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--lc-text-primary);
}

.file-chip-size {
  color: var(--lc-text-tertiary);
  font-size: 10px;
}

.file-chip-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--lc-border);
  border-top-color: var(--lc-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.file-chip-remove {
  background: none;
  border: none;
  color: var(--lc-text-tertiary);
  cursor: pointer;
  padding: 0 2px;
  font-size: 14px;
  line-height: 1;
}

.file-chip-remove:hover {
  color: var(--lc-red);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
