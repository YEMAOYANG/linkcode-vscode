<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVSCode } from '../composables/useVSCode'

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

const MODEL_TO_GROUP: Record<string, string> = {
  'claude-sonnet-4-6': 'Claude_aws', 'claude-opus-4-6': 'Claude_aws',
  'claude-haiku-4-5-20251001': 'Claude_aws', 'claude-sonnet-4-5-20250929': 'Claude_aws',
  'claude-opus-4-5-20251101': 'Claude_aws', 'claude-sonnet-4-20250514': 'Claude_aws',
  'cursor-haik-4-5': 'Claude_aws', 'cursor-opu-4-5': 'Claude_aws', 'cursor-opu-4-6': 'Claude_aws',
  'cursor-sonne-4': 'Claude_aws', 'cursor-sonne-4-5': 'Claude_aws', 'cursor-sonne-4-6': 'Claude_aws',
  'deepseek-r1': 'deepseek_tencent', 'deepseek-v3': 'deepseek_tencent',
  'deepseek-v3.1': 'deepseek_tencent', 'deepseek-v3.2': 'deepseek_tencent',
  'gemini-2.5-pro': 'gemini_Google', 'gemini-2.5-flash': 'gemini_Google',
  'gemini-2.5-flash-image': 'gemini_Google', 'gemini-2.5-flash-lite': 'gemini_Google',
  'gemini-3-flash-preview': 'gemini_Google', 'gemini-3-pro-preview': 'gemini_Google',
  'gemini-3.1-flash-lite-preview': 'gemini_Google', 'gemini-3.1-pro-preview': 'gemini_Google',
  'gpt-5': 'gpt_Azure', 'gpt-5-codex': 'gpt_Azure', 'gpt-5.1': 'gpt_Azure',
  'gpt-5.1-codex': 'gpt_Azure', 'gpt-5.2': 'gpt_Azure', 'gpt-5.2-codex': 'gpt_Azure',
  'gpt-5.3-codex': 'gpt_Azure', 'gpt-5.4': 'gpt_Azure', 'gpt-5.4-pro': 'gpt_Azure',
  'M2-her': 'MiniMax', 'MiniMax-M2.1': 'MiniMax', 'MiniMax-M2.1-highspeed': 'MiniMax',
  'MiniMax-M2.5-highspeed': 'MiniMax', 'MiniMax-M2.7': 'MiniMax', 'MiniMax-M2.7-highspeed': 'MiniMax',
  'hunyuan-2.0-instruct': 'hunyuan_tencent', 'hunyuan-2.0-thinking': 'hunyuan_tencent',
  'glm-5': 'other_tencent', 'kimi-k2.5': 'other_tencent', 'minimax-m2.5': 'other_tencent',
  'MiniMax-M2': 'scnet-low', 'MiniMax-M2.5': 'scnet-low',
  'stepfun/step-3.5-flash:free': 'stepfun_openrouter',
}

const props = defineProps<{
  currentModel: string
  models: ModelInfo[]
  loading?: boolean
  filterUnlocked?: boolean
  pricingData?: PricingItemProp[]
  groupRatio?: Record<string, number>
}>()

const emit = defineEmits<{
  select: [modelId: string]
  close: []
}>()

const { postMessage, onMessage } = useVSCode()

const searchQuery = ref('')
const maxMode = ref(false)
const groupTokenStatus = ref<Record<string, boolean>>({})

let cleanup: (() => void) | undefined

onMounted(() => {
  postMessage({ type: 'getGroupTokenStatus' })
  cleanup = onMessage((event: MessageEvent) => {
    const msg = event.data as { type: string; tokens?: Record<string, boolean> }
    if (msg.type === 'groupTokenStatus' && msg.tokens) {
      groupTokenStatus.value = msg.tokens
    }
  })
})

onUnmounted(() => { cleanup?.() })

/** Pricing lookup: model_name → { ratio, tags[], isFree } */
const pricingMap = computed(() => {
  const map: Record<string, { ratio: number; tags: string[]; isFree: boolean }> = {}
  const gr = props.groupRatio ?? {}
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

/** Important capability tags to display */
const SHOWN_TAGS = new Set(['Reasoning', 'Vision', 'Tools', 'Audio'])

/** Format ratio number: remove trailing zeros */
function formatRatio(r: number): string {
  // Show up to 3 decimal places, strip trailing zeros
  return r.toFixed(3).replace(/\.?0+$/, '')
}

/** Provider → display group config */
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

function getIconClass(id: string): string {
  if (id.startsWith('claude')) return 'cl'
  if (id.startsWith('deepseek')) return 'ds'
  if (id.startsWith('qwen')) return 'qw'
  if (id.startsWith('glm') || id.startsWith('chatglm')) return 'glm'
  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) return 'gpt'
  if (id.startsWith('gemini')) return 'ge'
  if (id.startsWith('doubao')) return 'db'
  if (id.startsWith('hunyuan')) return 'hy'
  if (id.startsWith('kimi') || id.startsWith('moonshot')) return 'km'
  if (id.startsWith('minimax') || id.startsWith('MiniMax') || id.startsWith('M2')) return 'mm'
  return 'ai'
}

function getIconLabel(id: string): string {
  if (id.startsWith('claude')) return 'CL'
  if (id.startsWith('deepseek') || id.startsWith('DeepSeek')) return 'DS'
  if (id.startsWith('qwen') || id.startsWith('Qwen') || id.startsWith('QwQ')) return 'QW'
  if (id.startsWith('glm') || id.startsWith('chatglm')) return 'GL'
  if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) return 'GP'
  if (id.startsWith('gemini')) return 'GE'
  if (id.startsWith('doubao')) return 'DB'
  if (id.startsWith('hunyuan')) return 'HY'
  if (id.startsWith('kimi') || id.startsWith('moonshot')) return 'KM'
  if (id.startsWith('minimax') || id.startsWith('MiniMax') || id.startsWith('M2')) return 'MM'
  return 'AI'
}

function isModelUnlocked(modelId: string): boolean {
  const group = MODEL_TO_GROUP[modelId]
  if (!group) return true // Unknown models are considered unlocked
  return groupTokenStatus.value[group] === true
}

function getModelGroup(modelId: string): string | undefined {
  return MODEL_TO_GROUP[modelId]
}

/** Build grouped model list from flat models array */
const modelGroups = computed<ModelGroup[]>(() => {
  const groupMap = new Map<string, ModelInfo[]>()

  for (const model of props.models) {
    // Feature 6: if filterUnlocked, hide locked models
    if (props.filterUnlocked && !isModelUnlocked(model.id)) continue

    const groupConfig = PROVIDER_GROUPS[model.provider]
    const groupKey = groupConfig?.title ?? '其他模型'
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, [])
    }
    groupMap.get(groupKey)!.push(model)
  }

  const groups: ModelGroup[] = []
  for (const [title, models] of groupMap) {
    const firstModel = models[0]
    const config = firstModel ? PROVIDER_GROUPS[firstModel.provider] : undefined
    groups.push({
      title,
      emoji: config?.emoji ?? '🤖',
      models,
    })
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
          m.provider.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.models.length > 0)
})

function handleSelect(modelId: string) {
  if (modelId === 'auto') {
    emit('select', modelId)
    return
  }
  if (!isModelUnlocked(modelId)) {
    const group = getModelGroup(modelId)
    postMessage({ type: 'openSettings', tab: 'token', highlightGroup: group })
    emit('close')
    return
  }
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

        <!-- Model groups -->
        <template v-else>
          <div
            v-for="group in filteredGroups"
            :key="group.title"
          >
            <div class="group-title">{{ group.emoji }} {{ group.title }}</div>
            <button
              v-for="model in group.models"
              :key="model.id"
              class="model-row"
              :class="{
                selected: model.id === currentModel,
                locked: !isModelUnlocked(model.id),
              }"
              :title="isModelUnlocked(model.id) ? '' : `需要配置 ${getModelGroup(model.id)} 令牌`"
              @click="handleSelect(model.id)"
            >
              <span class="model-icon-badge" :class="getIconClass(model.id)">
                {{ getIconLabel(model.id) }}
              </span>
              <div class="model-info">
                <div class="model-name">
                  {{ model.label }}
                  <span v-if="pricingMap[model.id]?.isFree" class="model-ratio model-ratio-free">免费</span>
                  <span v-else-if="pricingMap[model.id]" class="model-ratio">x{{ formatRatio(pricingMap[model.id].ratio) }}</span>
                  <span v-if="!isModelUnlocked(model.id)" class="lock-icon">🔒</span>
                  <span
                    v-if="model.tag && isModelUnlocked(model.id)"
                    class="model-tag"
                    :class="getTagClass(model.tag)"
                  >
                    {{ model.tag }}
                  </span>
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
        </template>
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
