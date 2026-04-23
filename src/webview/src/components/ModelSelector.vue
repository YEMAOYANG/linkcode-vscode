<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  currentModel: string
}>()

const emit = defineEmits<{
  select: [modelId: string]
  close: []
}>()

const searchQuery = ref('')

interface ModelItem {
  id: string
  name: string
  tag?: string
  tagColor?: string
  price: string
  iconClass: string
  iconLabel: string
}

interface ModelGroup {
  title: string
  emoji: string
  models: ModelItem[]
}

const maxMode = ref(false)

const modelGroups: ModelGroup[] = [
  {
    title: '国产模型（低成本）',
    emoji: '🇨🇳',
    models: [
      { id: 'deepseek-v3', name: 'DeepSeek-V3', tag: '性价比之王', tagColor: 'green', price: '¥0.001/1K tokens · 128K', iconClass: 'ds', iconLabel: 'DS' },
      { id: 'deepseek-r1', name: 'DeepSeek-R1', tag: '强推理', tagColor: 'blue', price: '¥0.002/1K tokens · 64K', iconClass: 'ds', iconLabel: 'DS' },
      { id: 'qwen2.5-coder-32b', name: 'Qwen2.5-Coder-32B', tag: '代码专家', tagColor: 'blue', price: '¥0.002/1K tokens · 128K', iconClass: 'qw', iconLabel: 'QW' },
      { id: 'doubao-pro', name: 'Doubao-Pro', price: '¥0.001/1K tokens · 32K', iconClass: 'db', iconLabel: 'DB' },
      { id: 'glm-4', name: 'GLM-4', price: '¥0.001/1K tokens · 128K', iconClass: 'glm', iconLabel: 'GL' },
    ],
  },
  {
    title: '国际模型（高质量）',
    emoji: '🌍',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', tag: '推理最强', tagColor: 'purple', price: '¥0.015/1K tokens · 200K', iconClass: 'cl', iconLabel: 'CL' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', tag: '最高质量', tagColor: 'yellow', price: '¥0.075/1K tokens · 200K', iconClass: 'cl', iconLabel: 'CL' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', tag: '最快', tagColor: 'blue', price: '¥0.001/1K tokens · 200K', iconClass: 'cl', iconLabel: 'CL' },
      { id: 'gpt-5', name: 'GPT-5', price: '¥0.010/1K tokens · 128K', iconClass: 'gpt', iconLabel: 'GP' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: '长上下文', tagColor: 'blue', price: '¥0.005/1K tokens · 200K', iconClass: 'ge', iconLabel: 'GE' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: '快速', tagColor: 'green', price: '¥0.001/1K tokens · 100K', iconClass: 'ge', iconLabel: 'GE' },
    ],
  },
]

const filteredGroups = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return modelGroups
  return modelGroups
    .map((g) => ({
      ...g,
      models: g.models.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.models.length > 0)
})

function handleSelect(modelId: string) {
  emit('select', modelId)
}

function getTagClass(color?: string): string {
  if (!color) return 'tag-default'
  return `tag-${color}`
}
</script>

<template>
  <div class="selector-overlay" @click.self="emit('close')">
    <div class="selector-panel">
      <!-- Search header -->
      <div class="selector-header">
        <div class="selector-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索模型..."
            class="selector-search-input"
            autofocus
          >
        </div>
      </div>

      <!-- Model list -->
      <div class="selector-body">
        <!-- Auto routing row -->
        <button
          class="auto-route-row"
          :class="{ selected: currentModel === 'auto' }"
          @click="handleSelect('auto')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <div class="model-info">
            <div class="auto-route-name">🔄 自动路由（推荐）</div>
            <div class="model-price">基于任务自动选择最优模型，节省 40% 成本</div>
          </div>
        </button>
        <div
          v-for="group in filteredGroups"
          :key="group.title"
        >
          <div class="group-title">{{ group.emoji }} {{ group.title }}</div>
          <button
            v-for="model in group.models"
            :key="model.id"
            class="model-row"
            :class="{ selected: model.id === currentModel }"
            @click="handleSelect(model.id)"
          >
            <span class="model-icon-badge" :class="model.iconClass">
              {{ model.iconLabel }}
            </span>
            <div class="model-info">
              <div class="model-name">
                {{ model.name }}
                <span
                  v-if="model.tag"
                  class="model-tag"
                  :class="getTagClass(model.tagColor)"
                >
                  {{ model.tag }}
                </span>
              </div>
              <div class="model-price">{{ model.price }}</div>
            </div>
            <svg
              v-if="model.id === currentModel"
              class="check-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Footer with Max Mode -->
      <div class="selector-footer">
        <div class="max-mode">
          <span>⚡ Max Mode</span>
          <button
            class="toggle-switch"
            :class="{ active: maxMode }"
            @click="maxMode = !maxMode"
          />
        </div>
        <span class="max-mode-hint">使用最大上下文窗口</span>
      </div>
    </div>
  </div>
</template>
