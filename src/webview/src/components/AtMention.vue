<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'

const props = defineProps<{
  visible: boolean
  query: string
}>()

const emit = defineEmits<{
  select: [item: AtMentionItem]
  close: []
}>()

export interface AtMentionItem {
  type: 'file' | 'workspace' | 'doc' | 'web' | 'symbol'
  label: string
  detail?: string
  value: string
}

const { postMessage, onMessage } = useVSCode()
const recentFiles = ref<AtMentionItem[]>([])
const selectedIndex = ref(0)
let cleanup: (() => void) | undefined

const categories: AtMentionItem[] = [
  { type: 'file', label: '文件', detail: '引用项目文件', value: '@file' },
  { type: 'workspace', label: '工作区', detail: '引用工作区上下文', value: '@workspace' },
  { type: 'doc', label: '文档', detail: '引用文档内容', value: '@doc' },
  { type: 'web', label: '网页', detail: '搜索网页', value: '@web' },
  { type: 'symbol', label: '符号', detail: '引用代码符号', value: '@symbol' },
]

const filteredItems = computed(() => {
  const q = props.query.toLowerCase()
  if (!q) {
    return [...categories, ...recentFiles.value.slice(0, 5)]
  }
  const allItems = [...categories, ...recentFiles.value]
  return allItems.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      (item.detail && item.detail.toLowerCase().includes(q))
  )
})

watch(() => props.visible, (visible) => {
  if (visible) {
    selectedIndex.value = 0
    postMessage({ type: 'getRecentFiles' })
  }
})

onMounted(() => {
  cleanup = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string; files?: Array<{ name: string; path: string }> }
    if (msg.type === 'recentFiles' && msg.files) {
      recentFiles.value = msg.files.map((f) => ({
        type: 'file' as const,
        label: f.name,
        detail: f.path,
        value: f.path,
      }))
    }
  })
})

onUnmounted(() => {
  cleanup?.()
})

function handleSelect(item: AtMentionItem) {
  if (item.type === 'file' && item.value && item.value !== '@file') {
    // Request file content from extension
    postMessage({ type: 'getFileContent', filepath: item.value })
  }
  emit('select', item)
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredItems.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = filteredItems.value[selectedIndex.value]
    if (item) handleSelect(item)
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

defineExpose({ handleKeydown })
</script>

<template>
  <div v-if="visible && filteredItems.length > 0" class="at-mention-panel">
    <div class="at-mention-header">
      <span class="at-mention-title">@ 引用</span>
    </div>
    <div class="at-mention-list">
      <button
        v-for="(item, idx) in filteredItems"
        :key="`${item.type}-${item.label}`"
        class="at-mention-item"
        :class="{ selected: idx === selectedIndex }"
        @click="handleSelect(item)"
        @mouseenter="selectedIndex = idx"
      >
        <span class="at-mention-icon">
          <template v-if="item.type === 'file'">📄</template>
          <template v-else-if="item.type === 'workspace'">📁</template>
          <template v-else-if="item.type === 'doc'">📝</template>
          <template v-else-if="item.type === 'web'">🌐</template>
          <template v-else>🔗</template>
        </span>
        <div class="at-mention-info">
          <span class="at-mention-label">{{ item.label }}</span>
          <span v-if="item.detail" class="at-mention-detail">{{ item.detail }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.at-mention-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 4px;
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.3);
  max-height: 240px;
  overflow-y: auto;
  z-index: 200;
  animation: slideUp 0.15s var(--lc-ease);
}

.at-mention-header {
  padding: 8px 12px 4px;
  border-bottom: 1px solid var(--lc-border);
}

.at-mention-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--lc-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.at-mention-list {
  display: flex;
  flex-direction: column;
}

.at-mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 80ms;
  border: none;
  background: transparent;
  text-align: left;
  font-family: var(--lc-font-ui);
  color: var(--lc-text-primary);
  width: 100%;
}

.at-mention-item:hover,
.at-mention-item.selected {
  background: var(--lc-hover);
}

.at-mention-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.at-mention-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.at-mention-label {
  font-size: 12px;
  color: var(--lc-text-primary);
}

.at-mention-detail {
  font-size: 10px;
  color: var(--lc-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
