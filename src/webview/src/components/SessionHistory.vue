<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'

const emit = defineEmits<{
  close: []
  newChat: []
  selectSession: [id: string]
}>()

const { postMessage, onMessage } = useVSCode()

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

onUnmounted(() => {
  cleanup?.()
})

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
    ? sessions.value.filter(s => s.title.toLowerCase().includes(q) || (s.model && s.model.toLowerCase().includes(q)))
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
</script>

<template>
  <div class="history-overlay" @click.self="emit('close')">
    <div class="history-panel">
      <!-- Header -->
      <div class="history-top">
        <div class="history-top-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span class="history-heading">会话历史</span>
        </div>
        <button class="new-chat-btn" @click="emit('newChat'); emit('close')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新会话
        </button>
      </div>

      <!-- Search -->
      <div class="history-search">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索历史对话..."
          >
        </div>
      </div>

      <!-- List -->
      <div class="history-list">
        <template v-if="filteredGroups.length === 0">
          <div class="history-empty">暂无会话历史</div>
        </template>
        <template v-for="group in filteredGroups" :key="group.label">
          <div class="history-group-label">{{ group.label }}</div>
          <button
            v-for="item in group.items"
            :key="item.id"
            class="history-item"
            :class="{ active: item.id === activeSessionId }"
            @click="handleSelectSession(item.id)"
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
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
