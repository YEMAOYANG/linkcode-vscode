<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  close: []
  newChat: []
  selectSession: [id: string]
}>()

const activeSessionId = ref('1') // current session
const searchQuery = ref('')

interface HistoryItem {
  id: string
  title: string
  model: string
  time: string
  cost: string
  icon: string
}

interface HistoryGroup {
  label: string
  items: HistoryItem[]
}

// Mock data — in real app this would come from extension host
const historyGroups: HistoryGroup[] = [
  {
    label: '今天',
    items: [
      { id: '1', title: 'React useDebounce hook 实现', model: 'DeepSeek-V3', time: '14:32', cost: '¥0.002', icon: 'code' },
      { id: '2', title: 'Express rate limiter 中间件配置', model: 'Claude Sonnet 4', time: '13:15', cost: '¥0.018', icon: 'server' },
      { id: '3', title: 'TypeScript 泛型约束最佳实践', model: 'DeepSeek-V3', time: '11:42', cost: '¥0.003', icon: 'type' },
    ],
  },
  {
    label: '昨天',
    items: [
      { id: '4', title: '设计 REST API 路由结构', model: 'GPT-4o', time: '昨天 18:20', cost: '¥0.024', icon: 'globe' },
      { id: '5', title: 'Docker 多阶段构建优化', model: 'Qwen2.5-Coder', time: '昨天 15:08', cost: '¥0.004', icon: 'box' },
    ],
  },
  {
    label: '本周',
    items: [
      { id: '6', title: 'Prisma Schema 关系定义', model: 'DeepSeek-V3', time: '4月19日', cost: '¥0.005', icon: 'database' },
      { id: '7', title: 'Jest 单元测试 Mock 配置', model: 'Qwen2.5-Coder', time: '4月18日', cost: '¥0.006', icon: 'check' },
    ],
  },
]

const filteredGroups = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return historyGroups
  return historyGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.items.length > 0)
})
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
        <template v-for="group in filteredGroups" :key="group.label">
          <div class="history-group-label">{{ group.label }}</div>
          <button
            v-for="item in group.items"
            :key="item.id"
            class="history-item"
            :class="{ active: item.id === activeSessionId }"
            @click="activeSessionId = item.id; emit('selectSession', item.id)"
          >
            <div class="history-icon-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline v-if="item.icon === 'code'" points="16 18 22 12 16 6" />
                <polyline v-if="item.icon === 'code'" points="8 6 2 12 8 18" />
                <rect v-if="item.icon === 'server'" x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect v-if="item.icon === 'server'" x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <path v-if="item.icon === 'type'" d="M4 7V4h16v3" />
                <line v-if="item.icon === 'type'" x1="12" y1="4" x2="12" y2="20" />
                <line v-if="item.icon === 'type'" x1="8" y1="20" x2="16" y2="20" />
                <circle v-if="item.icon === 'globe'" cx="12" cy="12" r="10" />
                <line v-if="item.icon === 'globe'" x1="2" y1="12" x2="22" y2="12" />
                <rect v-if="item.icon === 'box'" x="2" y="4" width="20" height="16" rx="2" ry="2" />
                <ellipse v-if="item.icon === 'database'" cx="12" cy="5" rx="9" ry="3" />
                <path v-if="item.icon === 'database'" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path v-if="item.icon === 'database'" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                <polyline v-if="item.icon === 'check'" points="22 11.08 12 21.08 7 16.08" />
              </svg>
            </div>
            <div class="history-info">
              <div class="history-title">{{ item.title }}</div>
              <div class="history-meta">
                <span>{{ item.model }}</span>
                <span>{{ item.time }}</span>
                <span>{{ item.cost }}</span>
              </div>
            </div>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
