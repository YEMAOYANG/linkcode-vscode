<script setup lang="ts">
import { computed } from 'vue'

interface SessionStats {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  messageCount: number
  estimatedCost: number
}

const props = defineProps<{
  stats: SessionStats
}>()

const emit = defineEmits<{
  close: []
}>()

const formattedCost = computed(() => `¥${props.stats.estimatedCost.toFixed(4)}`)
const formattedTokens = computed(() => props.stats.totalTokens.toLocaleString())
const formattedPrompt = computed(() => props.stats.promptTokens.toLocaleString())
const formattedCompletion = computed(() => props.stats.completionTokens.toLocaleString())

// Hypothetical cost if using GPT-4o at ¥0.1/1K tokens
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
  <div class="cd-overlay" @click.self="emit('close')">
    <div class="cd-panel">
      <div class="cd-header">
        <h2 class="cd-title">📊 会话费用看板</h2>
        <button class="cd-close" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Summary cards -->
      <div class="cd-summary">
        <div class="cd-sum-card">
          <div class="cd-sum-label">本次消耗</div>
          <div class="cd-sum-value">{{ formattedCost }}</div>
          <div class="cd-sum-sub">{{ stats.messageCount }} 次对话</div>
        </div>
        <div class="cd-sum-card">
          <div class="cd-sum-label">总 Token</div>
          <div class="cd-sum-value">{{ formattedTokens }}</div>
          <div class="cd-sum-sub">本次会话</div>
        </div>
        <div class="cd-sum-card">
          <div class="cd-sum-label">累计节省</div>
          <div class="cd-sum-value cd-green">¥{{ savedAmount.toFixed(4) }}</div>
          <div class="cd-sum-sub">vs 全用 GPT-4o</div>
        </div>
      </div>

      <!-- Token breakdown -->
      <div class="cd-section">
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

      <!-- Savings comparison -->
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

      <!-- Empty state -->
      <div v-else class="cd-empty">
        <p>暂无使用数据，发送消息后这里会实时更新 📊</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.cd-panel {
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--lc-surface, var(--color-bg));
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg, 8px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 20px;
  animation: slideUp 0.2s var(--lc-ease, ease);
}

.cd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cd-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lc-text-primary);
}

.cd-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--lc-radius-sm, 4px);
  color: var(--lc-text-secondary);
  cursor: pointer;
  transition: all 120ms;
}

.cd-close:hover {
  background: var(--lc-hover);
  color: var(--lc-text-primary);
}

.cd-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.cd-sum-card {
  padding: 12px 10px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  text-align: center;
}

.cd-sum-label {
  font-size: 10px;
  color: var(--lc-text-tertiary);
  margin-bottom: 4px;
}

.cd-sum-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--lc-text-primary);
}

.cd-sum-value.cd-green {
  color: var(--lc-green, #22c55e);
}

.cd-sum-sub {
  font-size: 10px;
  color: var(--lc-text-tertiary);
  margin-top: 2px;
}

.cd-section {
  padding: 14px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md, 6px);
  margin-bottom: 12px;
}

.cd-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--lc-text-primary);
  margin-bottom: 10px;
}

.cd-token-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cd-token-row:last-child { margin-bottom: 0; }

.cd-token-label {
  font-size: 11px;
  color: var(--lc-text-secondary);
  width: 80px;
  flex-shrink: 0;
}

.cd-token-bar {
  flex: 1;
  height: 4px;
  background: var(--lc-active);
  border-radius: 2px;
  overflow: hidden;
}

.cd-token-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s var(--lc-ease, ease);
}

.cd-fill-prompt { background: var(--lc-accent, #7c3aed); }
.cd-fill-completion { background: var(--lc-blue, #3b82f6); }

.cd-token-val {
  font-size: 11px;
  color: var(--lc-text-primary);
  width: 60px;
  text-align: right;
  font-family: var(--lc-font-code);
}

.cd-savings-card {
  padding: 14px;
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.15);
  border-radius: var(--lc-radius-md, 6px);
}

.cd-savings-title {
  font-size: 12px;
  color: var(--lc-green, #22c55e);
  margin-bottom: 10px;
}

.cd-savings-compare {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cd-savings-bar-wrap {
  width: 100%;
}

.cd-savings-bar-label {
  font-size: 11px;
  color: var(--lc-text-secondary);
  margin-bottom: 3px;
}

.cd-savings-bar {
  height: 6px;
  background: var(--lc-active);
  border-radius: 3px;
  overflow: hidden;
}

.cd-savings-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s var(--lc-ease, ease);
}

.cd-fill-actual { background: var(--lc-green, #22c55e); }
.cd-fill-hypoth { background: var(--lc-text-tertiary); }

.cd-savings-result {
  margin-top: 8px;
  font-size: 12px;
  color: var(--lc-green, #22c55e);
}

.cd-empty {
  padding: 24px;
  text-align: center;
  color: var(--lc-text-tertiary);
  font-size: 12px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
