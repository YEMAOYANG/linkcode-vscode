<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useVSCode } from '../composables/useVSCode'

export type AtKind = 'files' | 'folders' | 'code' | 'codebase' | 'docs' | 'pastChats'

export interface AtMentionItem {
  kind: AtKind
  label: string
  detail?: string
  value: string
  filepath?: string
  lineStart?: number
  lineEnd?: number
  sessionId?: string
  snippet?: string
}

const props = defineProps<{
  visible: boolean
  query: string
}>()

const emit = defineEmits<{
  select: [item: AtMentionItem]
  close: []
}>()

const { postMessage, onMessage } = useVSCode()

interface TabDef {
  id: AtKind
  label: string
  icon: string
  placeholder: string
  comingSoon?: boolean
}

const TABS: TabDef[] = [
  { id: 'files',     label: 'Files',      icon: 'lucide:file',         placeholder: 'Search files...' },
  { id: 'folders',   label: 'Folders',    icon: 'lucide:folder',       placeholder: 'Search folders...' },
  { id: 'code',      label: 'Code',       icon: 'lucide:braces',       placeholder: 'Search symbols...' },
  { id: 'codebase',  label: 'Codebase',   icon: 'lucide:database',     placeholder: 'Ask about codebase...' },
  { id: 'docs',      label: 'Docs',       icon: 'lucide:book-open',    placeholder: 'Coming soon', comingSoon: true },
  { id: 'pastChats', label: 'Past Chats', icon: 'lucide:message-circle', placeholder: 'Search chats...' },
]

const activeKind = ref<AtKind>('files')
const items = ref<AtMentionItem[]>([])
const selectedIndex = ref(0)
const loading = ref(false)
const panelRef = ref<HTMLElement | null>(null)

let requestId = 0
let cleanup: (() => void) | undefined
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function triggerSearch(kind: AtKind, query: string) {
  const tab = TABS.find(t => t.id === kind)
  if (tab?.comingSoon) {
    items.value = []
    loading.value = false
    return
  }
  loading.value = true
  const id = `req-${++requestId}`
  ;(triggerSearch as unknown as { lastId: string }).lastId = id
  postMessage({ type: 'atSearch', requestId: id, kind, query })
}

watch(
  () => [props.visible, props.query, activeKind.value] as const,
  ([visible, query]) => {
    if (!visible) {
      selectedIndex.value = 0
      return
    }
    selectedIndex.value = 0
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => triggerSearch(activeKind.value, query as string), 150)
  },
  { immediate: true },
)

onMounted(() => {
  cleanup = onMessage((event: MessageEvent) => {
    const msg = event.data as {
      type: string
      requestId?: string
      kind?: AtKind
      items?: AtMentionItem[]
    }
    if (msg.type !== 'atSearchResult') return
    const expectedId = (triggerSearch as unknown as { lastId?: string }).lastId
    if (msg.requestId !== expectedId) return
    if (msg.kind !== activeKind.value) return
    items.value = msg.items ?? []
    loading.value = false
    selectedIndex.value = 0
  })
})

onUnmounted(() => {
  cleanup?.()
  if (debounceTimer) clearTimeout(debounceTimer)
})

const activeTabDef = computed(() => TABS.find((t) => t.id === activeKind.value)!)

function selectTab(kind: AtKind) {
  activeKind.value = kind
}

function handleSelect(item: AtMentionItem) {
  if (item.filepath) {
    postMessage({ type: 'getFileContent', filepath: item.filepath })
  }
  emit('select', item)
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, items.value.length - 1)
    scrollIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    scrollIntoView()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    const idx = TABS.findIndex((t) => t.id === activeKind.value)
    const dir = e.shiftKey ? -1 : 1
    const next = (idx + dir + TABS.length) % TABS.length
    activeKind.value = TABS[next].id
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = items.value[selectedIndex.value]
    if (item) handleSelect(item)
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

function scrollIntoView() {
  requestAnimationFrame(() => {
    const root = panelRef.value
    if (!root) return
    const el = root.querySelector(`[data-row-idx="${selectedIndex.value}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

defineExpose({ handleKeydown })
</script>

<template>
  <div v-if="visible" ref="panelRef" class="at-panel">
    <div class="at-panel__search">
      <Icon icon="lucide:search" :width="13" :height="13" class="at-panel__search-icon" />
      <span class="at-panel__search-placeholder">
        <template v-if="query">@{{ query }}</template>
        <template v-else>{{ activeTabDef.placeholder }}</template>
      </span>
      <span v-if="loading" class="at-panel__spinner">
        <Icon icon="lucide:loader-circle" :width="12" :height="12" />
      </span>
    </div>
    <div class="at-panel__tabs" role="tablist">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="at-panel__tab"
        :class="{ 'is-active': activeKind === tab.id }"
        role="tab"
        :aria-selected="activeKind === tab.id"
        type="button"
        @click="selectTab(tab.id)"
      >
        <Icon :icon="tab.icon" :width="11" :height="11" />
        <span>{{ tab.label }}</span>
      </button>
    </div>
    <div class="at-panel__list" role="listbox">
      <template v-if="activeTabDef.comingSoon">
        <div class="at-panel__empty">
          <Icon icon="lucide:clock" :width="14" :height="14" />
          <div class="at-panel__empty-title">Coming soon</div>
          <div class="at-panel__empty-detail">该引用类型正在开发中</div>
        </div>
      </template>
      <template v-else-if="items.length === 0 && !loading">
        <div class="at-panel__empty">
          <Icon icon="lucide:search-x" :width="14" :height="14" />
          <div class="at-panel__empty-title">未找到结果</div>
          <div class="at-panel__empty-detail">尝试不同的关键词</div>
        </div>
      </template>
      <button
        v-for="(item, idx) in items"
        :key="`${item.kind}-${item.value}-${idx}`"
        :data-row-idx="idx"
        class="at-panel__item"
        :class="{ 'is-selected': idx === selectedIndex }"
        type="button"
        role="option"
        :aria-selected="idx === selectedIndex"
        @click="handleSelect(item)"
        @mouseenter="selectedIndex = idx"
      >
        <Icon :icon="activeTabDef.icon" :width="13" :height="13" class="at-panel__item-icon" />
        <div class="at-panel__item-info">
          <span class="at-panel__item-label">{{ item.label }}</span>
          <span v-if="item.detail" class="at-panel__item-detail">{{ item.detail }}</span>
        </div>
        <kbd v-if="idx === selectedIndex" class="at-panel__item-kbd">⏎</kbd>
      </button>
    </div>
    <div class="at-panel__hint">
      <kbd>Tab</kbd> 切换类型 · <kbd>↑↓</kbd> 选择 · <kbd>⏎</kbd> 插入 · <kbd>Esc</kbd> 关闭
    </div>
  </div>
</template>

<style scoped>
.at-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 6px;
  background: var(--lcc-bg-elevated);
  border: 1px solid var(--lcc-border);
  border-radius: var(--lcc-radius-lg);
  box-shadow: var(--lcc-shadow-lg);
  max-height: 360px;
  display: flex;
  flex-direction: column;
  z-index: 200;
  overflow: hidden;
  animation: lc-slide-up 0.14s var(--lcc-ease-out);
}

.at-panel__search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--lcc-border-subtle);
  background: var(--lcc-bg);
}
.at-panel__search-icon { color: var(--lcc-text-muted); flex-shrink: 0; }
.at-panel__search-placeholder {
  flex: 1;
  color: var(--lcc-text);
  font-size: var(--lcc-font-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.at-panel__spinner {
  color: var(--lcc-text-subtle);
  animation: lc-spin 0.8s linear infinite;
  display: inline-flex;
}

.at-panel__tabs {
  display: flex;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--lcc-border-subtle);
  overflow-x: auto;
  scrollbar-width: none;
}
.at-panel__tabs::-webkit-scrollbar { display: none; }

.at-panel__tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  border-radius: var(--lcc-radius-sm);
  color: var(--lcc-text-muted);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--lcc-duration-fast) var(--lcc-ease-out);
}
.at-panel__tab:hover { background: var(--lcc-bg-hover); color: var(--lcc-text); }
.at-panel__tab.is-active {
  background: color-mix(in srgb, var(--lcc-accent) 16%, transparent);
  color: var(--lcc-accent);
  font-weight: 500;
}

.at-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  max-height: 240px;
}

.at-panel__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--lcc-text);
  border-radius: var(--lcc-radius-sm);
  cursor: pointer;
  text-align: left;
}
.at-panel__item.is-selected,
.at-panel__item:hover { background: var(--lcc-bg-hover); }

.at-panel__item-icon { color: var(--lcc-accent); flex-shrink: 0; }
.at-panel__item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.at-panel__item-label {
  font-size: var(--lcc-font-sm);
  color: var(--lcc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.at-panel__item-detail {
  font-size: 10px;
  color: var(--lcc-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.at-panel__item-kbd {
  padding: 1px 4px;
  font-size: 9px;
  font-family: var(--lcc-font-code);
  color: var(--lcc-text-muted);
  background: var(--lcc-bg-active);
  border-radius: 3px;
}

.at-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 24px 12px;
  color: var(--lcc-text-subtle);
}
.at-panel__empty-title { font-size: var(--lcc-font-xs); color: var(--lcc-text-muted); }
.at-panel__empty-detail { font-size: 10px; }

.at-panel__hint {
  padding: 6px 10px;
  font-size: 10px;
  color: var(--lcc-text-subtle);
  border-top: 1px solid var(--lcc-border-subtle);
  background: var(--lcc-bg);
  text-align: center;
}
.at-panel__hint kbd {
  padding: 1px 4px;
  background: var(--lcc-bg-elevated);
  border: 1px solid var(--lcc-border-subtle);
  border-radius: 3px;
  font-family: var(--lcc-font-code);
  color: var(--lcc-text-muted);
  margin: 0 2px;
}
</style>
