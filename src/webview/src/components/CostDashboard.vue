<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog } from '../ui'

interface SessionStats {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  messageCount: number
  estimatedCost: number
}

const props = defineProps<{ stats: SessionStats }>()
const emit = defineEmits<{ close: [] }>()

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('close') })

const formattedCost = computed(() => `¥${props.stats.estimatedCost.toFixed(4)}`)
const formattedTokens = computed(() => props.stats.totalTokens.toLocaleString())
const formattedPrompt = computed(() => props.stats.promptTokens.toLocaleString())
const formattedCompletion = computed(() => props.stats.completionTokens.toLocaleString())

const hypotheticalCost = computed(() => props.stats.totalTokens * 0.1 / 1000)
const savedAmount = computed(() => Math.max(0, hypotheticalCost.value - props.stats.estimatedCost))
const savedPercent = computed(() => {
  if (hypotheticalCost.value <= 0) return 0
  return Math.round((savedAmount.value / hypotheticalCost.value) * 100)
})

const actualBarWidth = computed(() => {
  if (hypotheticalCost.value <= 0) return '0%'
  return `${Math.min(100, (props.stats.estimatedCost / hypotheticalCost.value) * 100)}%`
})
</script>

<template>
  <Dialog v-model:open="dialogOpen" title="📊 会话费用看板" size="sm">
    <div class="cd-summary">
      <div class="cd-sum-card lc-card">
        <div class="cd-sum-label">本次消耗</div>
        <div class="cd-sum-value">{{ formattedCost }}</div>
        <div class="cd-sum-sub">{{ stats.messageCount }} 次对话</div>
      </div>
      <div class="cd-sum-card lc-card">
        <div class="cd-sum-label">总 Token</div>
        <div class="cd-sum-value">{{ formattedTokens }}</div>
        <div class="cd-sum-sub">本次会话</div>
      </div>
      <div class="cd-sum-card lc-card">
        <div class="cd-sum-label">累计节省</div>
        <div class="cd-sum-value cd-green">¥{{ savedAmount.toFixed(4) }}</div>
        <div class="cd-sum-sub">vs 全用 GPT-4o</div>
      </div>
    </div>

    <div class="cd-section lc-card">
      <h3 class="cd-section-title">Token 分布</h3>
      <div class="cd-token-row">
        <span class="cd-token-label">Prompt</span>
        <div class="cd-token-bar">
          <div
            class="cd-token-fill cd-fill-prompt"
            :style="{ width: stats.totalTokens > 0 ? `${(stats.promptTokens / stats.totalTokens) * 100}%` : '0%' }"
          />
        </div>
        <span class="cd-token-val">{{ formattedPrompt }}</span>
      </div>
      <div class="cd-token-row">
        <span class="cd-token-label">Completion</span>
        <div class="cd-token-bar">
          <div
            class="cd-token-fill cd-fill-completion"
            :style="{ width: stats.totalTokens > 0 ? `${(stats.completionTokens / stats.totalTokens) * 100}%` : '0%' }"
          />
        </div>
        <span class="cd-token-val">{{ formattedCompletion }}</span>
      </div>
    </div>

    <div v-if="stats.totalTokens > 0" class="cd-savings-card">
      <h3 class="cd-savings-title">💰 智能路由节省对比</h3>
      <div class="cd-savings-compare">
        <div class="cd-savings-bar-wrap">
          <div class="cd-savings-bar-label">实际消费 {{ formattedCost }}</div>
          <div class="cd-savings-bar">
            <div class="cd-savings-fill cd-fill-actual" :style="{ width: actualBarWidth }" />
          </div>
        </div>
        <div class="cd-savings-bar-wrap">
          <div class="cd-savings-bar-label">如全用 GPT-4o ¥{{ hypotheticalCost.toFixed(4) }}</div>
          <div class="cd-savings-bar">
            <div class="cd-savings-fill cd-fill-hypoth" style="width: 100%" />
          </div>
        </div>
      </div>
      <p class="cd-savings-result">🎉 节省 {{ savedPercent }}%（¥{{ savedAmount.toFixed(4) }}）</p>
    </div>

    <div v-else class="cd-empty">
      <p>暂无使用数据，发送消息后这里会实时更新 📊</p>
    </div>
  </Dialog>
</template>

<style scoped>
.cd-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.cd-sum-card {
  padding: 12px 10px;
  text-align: center;
}
.cd-sum-label { font-size: 10px; color: var(--lcc-text-subtle); margin-bottom: 4px; }
.cd-sum-value { font-size: 16px; font-weight: 600; color: var(--lcc-text); }
.cd-sum-value.cd-green { color: var(--lcc-success); }
.cd-sum-sub { font-size: 10px; color: var(--lcc-text-subtle); margin-top: 2px; }

.cd-section {
  padding: 14px;
  margin-bottom: 12px;
}
.cd-section-title { font-size: 12px; font-weight: 600; color: var(--lcc-text); margin-bottom: 10px; }

.cd-token-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.cd-token-row:last-child { margin-bottom: 0; }
.cd-token-label { font-size: 11px; color: var(--lcc-text-muted); width: 80px; flex-shrink: 0; }
.cd-token-bar {
  flex: 1; height: 4px;
  background: var(--lcc-bg-active);
  border-radius: 2px; overflow: hidden;
}
.cd-token-fill { height: 100%; border-radius: 2px; transition: width 0.6s var(--lcc-ease-out); }
.cd-fill-prompt { background: var(--lcc-accent); }
.cd-fill-completion { background: var(--lcc-info); }

.cd-token-val {
  font-size: 11px; color: var(--lcc-text);
  width: 60px; text-align: right; font-family: var(--lcc-font-code);
}

.cd-savings-card {
  padding: 14px;
  background: color-mix(in srgb, var(--lcc-success) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--lcc-success) 20%, transparent);
  border-radius: var(--lcc-radius-md);
}
.cd-savings-title { font-size: 12px; color: var(--lcc-success); margin-bottom: 10px; }
.cd-savings-compare { display: flex; flex-direction: column; gap: 8px; }
.cd-savings-bar-wrap { width: 100%; }
.cd-savings-bar-label { font-size: 11px; color: var(--lcc-text-muted); margin-bottom: 3px; }
.cd-savings-bar {
  height: 6px; background: var(--lcc-bg-active);
  border-radius: 3px; overflow: hidden;
}
.cd-savings-fill { height: 100%; border-radius: 3px; transition: width 0.8s var(--lcc-ease-out); }
.cd-fill-actual { background: var(--lcc-success); }
.cd-fill-hypoth { background: var(--lcc-text-subtle); }
.cd-savings-result { margin-top: 8px; font-size: 12px; color: var(--lcc-success); }

.cd-empty { padding: 24px; text-align: center; color: var(--lcc-text-subtle); font-size: 12px; }
</style>
