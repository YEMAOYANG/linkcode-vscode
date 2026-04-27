<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { Dialog, Switch } from '../ui'

interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

interface PricingItemProp {
  model_name: string
  model_ratio: number
  enable_groups: string[]
  tags?: string
  quota_type?: number
}

interface ModelGroup {
  title: string
  emoji: string
  models: ModelInfo[]
}

const props = defineProps<{
  currentModel: string
  models: ModelInfo[]
  loading?: boolean
  pricingData?: PricingItemProp[]
}>()

const emit = defineEmits<{ select: [modelId: string]; close: [] }>()

const { postMessage } = useVSCode()

const searchQuery = ref('')
const maxMode = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('close') })

onMounted(() => {
  nextTick(() => searchInputRef.value?.focus())
})

function openTokenSettings(): void {
  postMessage({ type: 'openSettings', tab: 'token' })
  emit('close')
}

const pricingMap = computed(() => {
  const map: Record<string, { ratio: number; tags: string[]; isFree: boolean }> = {}
  for (const item of (props.pricingData ?? [])) {
    const isFree = item.quota_type === 1
    const ratio = item.model_ratio / 2
    map[item.model_name] = {
      ratio,
      tags: item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      isFree,
    }
  }
  return map
})

const SHOWN_TAGS = new Set(['Reasoning', 'Vision', 'Tools', 'Audio'])

function formatRatio(r: number): string {
  return r.toFixed(3).replace(/\.?0+$/, '')
}

const PROVIDER_GROUPS: Record<string, { title: string; emoji: string; order: number }> = {
  DeepSeek: { title: '国产模型（低成本）', emoji: '🇨🇳', order: 0 },
  Qwen:     { title: '国产模型（低成本）', emoji: '🇨🇳', order: 0 },
  GLM:      { title: '国产模型（低成本）', emoji: '🇨🇳', order: 0 },
  HunYuan:  { title: '国产模型（低成本）', emoji: '🇨🇳', order: 0 },
  Kimi:     { title: '国产模型（低成本）', emoji: '🇨🇳', order: 0 },
  MiniMax:  { title: '国产模型（低成本）', emoji: '🇨🇳', order: 0 },
  Doubao:   { title: '国产模型（低成本）', emoji: '🇨🇳', order: 0 },
  Anthropic:{ title: '国际模型（高质量）', emoji: '🌍', order: 1 },
  OpenAI:   { title: '国际模型（高质量）', emoji: '🌍', order: 1 },
  Google:   { title: '国际模型（高质量）', emoji: '🌍', order: 1 },
}

const ICON_COLORS: Record<string, string> = {
  cl: '#D97706', ds: '#4F46E5', qw: '#0EA5E9', glm: '#E11D48',
  gpt: '#10B981', ge: '#3B82F6', db: '#F97316', hy: '#8B5CF6',
  km: '#06B6D4', mm: '#F59E0B', ai: '#6B7280',
}

function getIconKey(id: string): string {
  const lower = id.toLowerCase()
  if (lower.startsWith('claude') || lower.startsWith('cursor-')) return 'cl'
  if (lower.startsWith('deepseek')) return 'ds'
  if (lower.startsWith('qwen') || lower.startsWith('qwq')) return 'qw'
  if (lower.startsWith('glm') || lower.startsWith('chatglm')) return 'glm'
  if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4')) return 'gpt'
  if (lower.startsWith('gemini')) return 'ge'
  if (lower.startsWith('doubao')) return 'db'
  if (lower.startsWith('hunyuan')) return 'hy'
  if (lower.startsWith('kimi') || lower.startsWith('moonshot')) return 'km'
  if (lower.startsWith('minimax') || lower.startsWith('m2')) return 'mm'
  return 'ai'
}

function getIconColor(id: string): string {
  return ICON_COLORS[getIconKey(id)]
}

function getIconLabel(id: string): string {
  const lower = id.toLowerCase()
  if (lower.startsWith('claude') || lower.startsWith('cursor-')) return 'CL'
  if (lower.startsWith('deepseek')) return 'DS'
  if (lower.startsWith('qwen') || lower.startsWith('qwq')) return 'QW'
  if (lower.startsWith('glm') || lower.startsWith('chatglm')) return 'GL'
  if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4')) return 'GP'
  if (lower.startsWith('gemini')) return 'GE'
  if (lower.startsWith('doubao')) return 'DB'
  if (lower.startsWith('hunyuan')) return 'HY'
  if (lower.startsWith('kimi') || lower.startsWith('moonshot')) return 'KM'
  if (lower.startsWith('minimax') || lower.startsWith('m2')) return 'MM'
  return 'AI'
}

const modelGroups = computed<ModelGroup[]>(() => {
  const groupMap = new Map<string, ModelInfo[]>()
  for (const model of props.models) {
    const groupConfig = PROVIDER_GROUPS[model.provider]
    const groupKey = groupConfig?.title ?? '其他模型'
    if (!groupMap.has(groupKey)) groupMap.set(groupKey, [])
    groupMap.get(groupKey)!.push(model)
  }
  const groups: ModelGroup[] = []
  for (const [title, models] of groupMap) {
    const firstModel = models[0]
    const config = firstModel ? PROVIDER_GROUPS[firstModel.provider] : undefined
    groups.push({ title, emoji: config?.emoji ?? '🤖', models })
  }
  groups.sort((a, b) => {
    const orderA = a.title.includes('国产') ? 0 : a.title.includes('国际') ? 1 : 2
    const orderB = b.title.includes('国产') ? 0 : b.title.includes('国际') ? 1 : 2
    return orderA - orderB
  })
  return groups
})

const filteredGroups = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return modelGroups.value
  return modelGroups.value
    .map((g) => ({
      ...g,
      models: g.models.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.models.length > 0)
})

function handleSelect(modelId: string) {
  emit('select', modelId)
}

function getTagClass(tag?: string): string {
  if (!tag) return ''
  if (tag.includes('推荐') || tag.includes('性价比')) return 'tag-green'
  if (tag.includes('最强') || tag.includes('最高')) return 'tag-purple'
  if (tag.includes('最快') || tag.includes('快速')) return 'tag-blue'
  if (tag.includes('推理')) return 'tag-blue'
  if (tag.includes('长上下文') || tag.includes('代码')) return 'tag-blue'
  return 'tag-default'
}
</script>

<template>
  <Dialog v-model:open="dialogOpen" size="md" title="选择模型" class="ms-dialog">
    <!-- Empty state -->
    <div v-if="!loading && models.length === 0" class="ms-empty">
      <div class="ms-empty-icon">🔐</div>
      <div class="ms-empty-title">尚未配置任何 Token</div>
      <div class="ms-empty-desc">配置 Token 后，系统将从 Smoothlink 动态拉取该 Token 可用的所有模型。</div>
      <button class="ms-empty-btn" @click="openTokenSettings">前往配置 Token</button>
    </div>

    <!-- Inline search + list -->
    <template v-else>
      <div class="ms-search-bar">
        <svg class="ms-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="ms-search-input"
          type="text"
          placeholder="搜索模型..."
        />
        <span v-if="searchQuery" class="ms-search-clear" @click="searchQuery = ''">×</span>
      </div>

      <div class="ms-list">
        <!-- Auto-route -->
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

        <!-- Loading skeleton -->
        <template v-if="loading && models.length === 0">
          <div class="group-title">⏳ 加载模型列表中...</div>
          <div v-for="i in 4" :key="i" class="model-row skeleton-row">
            <span class="model-icon-badge skeleton-icon" />
            <div class="model-info">
              <div class="skeleton-text skeleton-name" />
              <div class="skeleton-text skeleton-detail" />
            </div>
          </div>
        </template>

        <!-- Grouped model list -->
        <template v-else>
          <template v-for="group in filteredGroups" :key="group.title">
            <div class="group-title">{{ group.emoji }} {{ group.title }}</div>
            <button
              v-for="model in group.models"
              :key="model.id"
              class="model-row"
              :class="{ selected: model.id === currentModel }"
              @click="handleSelect(model.id)"
            >
              <span class="model-icon-badge" :style="{ background: getIconColor(model.id) }">
                {{ getIconLabel(model.id) }}
              </span>
              <div class="model-info">
                <div class="model-name">
                  {{ model.label }}
                  <span v-if="pricingMap[model.id]?.isFree" class="model-ratio model-ratio-free">免费</span>
                  <span v-else-if="pricingMap[model.id]" class="model-ratio">x{{ formatRatio(pricingMap[model.id].ratio) }}</span>
                  <span
                    v-if="model.tag"
                    class="model-tag"
                    :class="getTagClass(model.tag)"
                  >{{ model.tag }}</span>
                  <span
                    v-for="tag in (pricingMap[model.id]?.tags ?? []).filter(t => SHOWN_TAGS.has(t))"
                    :key="tag"
                    class="model-cap-tag"
                  >{{ tag }}</span>
                </div>
                <div class="model-price">{{ model.provider }} · {{ model.id }}</div>
              </div>
              <svg
                v-if="model.id === currentModel"
                class="check-icon"
                width="14" height="14"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </template>

          <div v-if="filteredGroups.length === 0 && searchQuery" class="ms-no-results">
            无匹配结果
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="max-mode">
        <span>⚡ Max Mode</span>
        <Switch v-model="maxMode" />
      </div>
      <span class="max-mode-hint">使用最大上下文窗口</span>
    </template>
  </Dialog>
</template>

<style scoped>
.ms-dialog :deep(.ui-dialog__body) { padding: 0; display: flex; flex-direction: column; }
.ms-dialog :deep(.ui-dialog__content) { height: min(560px, calc(100vh - 24px)); }

/* ---- Search bar ---- */
.ms-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--lcc-border-subtle);
  flex-shrink: 0;
}
.ms-search-icon {
  color: var(--lcc-text-subtle);
  flex-shrink: 0;
}
.ms-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--lcc-text);
  font-size: 13px;
  font-family: inherit;
}
.ms-search-input::placeholder { color: var(--lcc-text-subtle); }
.ms-search-clear {
  cursor: pointer;
  color: var(--lcc-text-subtle);
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
}
.ms-search-clear:hover { background: var(--lcc-bg-hover); color: var(--lcc-text); }

/* ---- Scrollable list ---- */
.ms-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ---- Empty state ---- */
.ms-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  text-align: center;
  gap: 10px;
}
.ms-empty-icon { font-size: 28px; opacity: 0.85; }
.ms-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lcc-text);
}
.ms-empty-desc {
  font-size: 12px;
  color: var(--lcc-text-muted);
  line-height: 1.6;
  max-width: 320px;
}
.ms-empty-btn {
  margin-top: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: var(--lcc-radius-md);
  background: var(--lcc-accent);
  color: var(--lcc-accent-fg, #fff);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 120ms;
}
.ms-empty-btn:hover { filter: brightness(1.08); }

.ms-no-results {
  padding: 24px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--lcc-text-subtle);
}

/* ---- Group titles ---- */
.group-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--lcc-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 10px 16px 4px;
}

/* ---- Model rows ---- */
.model-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 120ms;
  position: relative;
  width: 100%;
  background: transparent;
  border: none;
  text-align: left;
  color: var(--lcc-text);
}
.model-row:hover { background: var(--lcc-bg-hover); }
.model-row.selected { background: var(--lcc-bg-hover); }
.model-row.selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: var(--lcc-accent);
  border-radius: 0 2px 2px 0;
}

/* ---- Auto-route row ---- */
.auto-route-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: color-mix(in srgb, var(--lcc-accent) 14%, transparent);
  cursor: pointer;
  transition: background 120ms;
  width: 100%;
  border: none;
  text-align: left;
  color: var(--lcc-accent);
}
.auto-route-row:hover { background: color-mix(in srgb, var(--lcc-accent) 18%, transparent); }
.auto-route-row.selected { background: color-mix(in srgb, var(--lcc-accent) 20%, transparent); }
.auto-route-name {
  font-size: 13px;
  color: var(--lcc-accent);
  font-weight: 600;
}

/* ---- Footer ---- */
.max-mode {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--lcc-text-muted);
}
.max-mode-hint {
  font-size: 11px;
  color: var(--lcc-text-subtle);
}

/* ---- Model cells ---- */
.model-icon-badge {
  width: 20px;
  height: 20px;
  border-radius: var(--lcc-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.model-info { flex: 1; min-width: 0; }
.model-name {
  font-size: 13px;
  color: var(--lcc-text);
}
.model-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 6px;
  font-weight: 500;
}
.tag-green { background: rgba(34, 197, 94, 0.12); color: var(--lcc-success); }
.tag-blue { background: rgba(59, 130, 246, 0.12); color: var(--lcc-info); }
.tag-purple { background: color-mix(in srgb, var(--lcc-accent) 14%, transparent); color: var(--lcc-accent); }
.tag-default { background: rgba(255, 255, 255, 0.06); color: var(--lcc-text-muted); }

.model-price {
  font-size: 11px;
  color: var(--lcc-text-subtle);
}
.model-ratio {
  font-size: 10px;
  color: var(--lcc-text);
  opacity: 0.5;
  margin-left: 4px;
  font-family: monospace;
}
.model-ratio-free {
  opacity: 1;
  color: var(--lcc-success, #22c55e);
  font-weight: 600;
  font-family: inherit;
}
.model-cap-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--vscode-badge-background, rgba(100,100,100,0.3));
  color: var(--vscode-badge-foreground, #ccc);
  margin-left: 2px;
  vertical-align: middle;
}
.check-icon { color: var(--lcc-accent); flex-shrink: 0; }

/* ---- Skeleton ---- */
.skeleton-row { pointer-events: none; opacity: 0.5; }
.skeleton-icon {
  background: var(--lcc-bg-elevated) !important;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-text {
  border-radius: 4px;
  background: var(--lcc-bg-elevated);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-name { width: 140px; height: 14px; margin-bottom: 4px; }
.skeleton-detail { width: 200px; height: 11px; }

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
</style>
