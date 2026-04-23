<script setup lang="ts">
import { ref } from 'vue'

export interface ImageAttachment {
  id: string
  name: string
  base64: string
  preview: string
}

const emit = defineEmits<{
  add: [image: ImageAttachment]
  remove: [id: string]
}>()

const props = defineProps<{
  images: ImageAttachment[]
}>()

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) processImage(file)
    }
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files) return

  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) {
      processImage(file)
    }
  }
}

function processImage(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = reader.result as string
    const img: ImageAttachment = {
      id: generateId(),
      name: file.name || 'pasted-image.png',
      base64,
      preview: base64,
    }
    emit('add', img)
  }
  reader.readAsDataURL(file)
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files) return

  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) {
      processImage(file)
    }
  }
  input.value = ''
}

const fileInput = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInput.value?.click()
}

defineExpose({ handlePaste, handleDrop, openFilePicker })
</script>

<template>
  <div class="image-upload-area">
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      style="display: none"
      @change="handleFileInput"
    >

    <!-- Image previews -->
    <div v-if="props.images.length > 0" class="image-previews">
      <div v-for="img in props.images" :key="img.id" class="image-preview">
        <img :src="img.preview" :alt="img.name" class="preview-thumb">
        <button class="preview-remove" @click="emit('remove', img.id)">×</button>
      </div>
      <button class="add-image-btn" @click="openFilePicker" title="添加图片">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.image-upload-area {
  width: 100%;
}

.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0 4px;
}

.image-preview {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: var(--lc-radius-md);
  overflow: hidden;
  border: 1px solid var(--lc-border);
  animation: fadeIn 0.15s ease;
}

.preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 120ms;
}

.image-preview:hover .preview-remove {
  opacity: 1;
}

.add-image-btn {
  width: 52px;
  height: 52px;
  border-radius: var(--lc-radius-md);
  border: 1px dashed var(--lc-border);
  background: transparent;
  color: var(--lc-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 120ms;
}

.add-image-btn:hover {
  border-color: var(--lc-accent);
  color: var(--lc-accent-text);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
