<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { Button, Combobox, ComboboxGroup, ComboboxItem, Dialog } from '../ui'

const emit = defineEmits<{
  close: []
  newChat: []
  selectSession: [id: string]
}>()

const { postMessage, onMessage } = useVSCode()

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('close') })

const activeSessionId = ref('')
const searchQuery = ref('')

interface SessionSummary {
  id: string
  title: string
  messageCount: number
  timestamp: number
  model?: string
}

interface HistoryGroup {
  label: string
  items: SessionSummary[]
}

const sessions = ref<SessionSummary[]>([])
let cleanup: (() => void) | undefined

onMounted(() => {
  postMessage({ type: 'getSessionHistory' })
  cleanup = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string; sessions?: SessionSummary[] }
    if (msg.type === 'historyList' && msg.sessions) {
      sessions.value = msg.sessions
    }
  })
})

onUnmounted(() => { cleanup?.() })

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  if (isYesterday) return `昨天 ${time}`
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function getGroupLabel(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return '今天'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  if (date > weekAgo) return '本周'
  return '更早'
}

const filteredGroups = computed<HistoryGroup[]>(() => {
  const q = searchQuery.value.toLowerCase()
  const filtered = q
    ? sessions.value.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.model && s.model.toLowerCase().includes(q)),
      )
    : sessions.value
  const groupMap = new Map<string, SessionSummary[]>()
  for (const s of filtered) {
    const label = getGroupLabel(s.timestamp)
    const items = groupMap.get(label) ?? []
    items.push(s)
    groupMap.set(label, items)
  }
  const order = ['今天', '昨天', '本周', '更早']
  return order
    .filter(label => groupMap.has(label))
    .map(label => ({ label, items: groupMap.get(label)! }))
})

function handleSelectSession(id: string) {
  activeSessionId.value = id
  postMessage({ type: 'loadSession', sessionId: id })
  emit('selectSession', id)
  emit('close')
}

function handleNewChat() {
  emit('newChat')
  emit('close')
}
</script>

<template>
  <Dialog v-model:open="dialogOpen" size="md" class="sh-dialog" hide-close>
    <template #header>
      <div class="sh-heading">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span class="sh-title">会话历史</span>
      </div>
      <Button size="sm" variant="primary" @click="handleNewChat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        新会话
      </Button>
    </template>

    <Combobox
      :search-term="searchQuery"
      placeholder="搜索历史对话..."
      autofocus
      class="sh-combobox"
      @update:search-term="searchQuery = $event"
      @update:model-value="handleSelectSession($event)"
    >
      <template v-if="filteredGroups.length === 0">
        <div class="history-empty">暂无会话历史</div>
      </template>
      <ComboboxGroup
        v-for="group in filteredGroups"
        :key="group.label"
      >
        <template #label>
          <div class="history-group-label">{{ group.label }}</div>
        </template>
        <ComboboxItem
          v-for="item in group.items"
          :key="item.id"
          raw
          :value="item.id"
          class="history-item"
          :class="{ active: item.id === activeSessionId }"
        >
          <div class="history-icon-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div class="history-info">
            <div class="history-title">{{ item.title }}</div>
            <div class="history-meta">
              <span v-if="item.model">{{ item.model }}</span>
              <span>{{ formatTime(item.timestamp) }}</span>
              <span>{{ item.messageCount }} 条消息</span>
            </div>
          </div>
        </ComboboxItem>
      </ComboboxGroup>
    </Combobox>
  </Dialog>
</template>

<style scoped>
.sh-dialog :deep(.ui-dialog__body) { padding: 0; display: flex; flex-direction: column; }
.sh-dialog :deep(.ui-dialog__content) { height: min(560px, calc(100vh - 24px)); }

.sh-heading { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; color: var(--lcc-text); }
.sh-title { font-weight: 600; font-size: var(--lcc-font-md); }

.sh-combobox { flex: 1; }

.history-group-label {
  padding: 8px 16px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--lcc-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 120ms;
  border-left: 3px solid transparent;
  width: 100%;
  background: transparent;
  border-top: none;
  border-right: none;
  border-bottom: none;
  text-align: left;
  color: var(--lcc-text);
}
.history-item:hover { background: var(--lcc-bg-hover); }
.history-item.active {
  background: var(--lcc-bg-hover);
  border-left-color: var(--lcc-accent);
}

.history-icon-box {
  width: 28px;
  height: 28px;
  border-radius: var(--lcc-radius-sm);
  background: var(--lcc-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lcc-text-subtle);
  flex-shrink: 0;
}

.history-info { flex: 1; min-width: 0; }
.history-title {
  font-size: 13px;
  color: var(--lcc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.history-meta {
  font-size: 11px;
  color: var(--lcc-text-subtle);
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.history-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--lcc-text-subtle);
  font-size: var(--lcc-font-sm);
}

:deep([data-highlighted].history-item) { background: var(--lcc-bg-hover); }
</style>
