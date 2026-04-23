<script setup lang="ts">
const emit = defineEmits<{
  close: []
  selectPlan: [plan: string]
}>()

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  price: string
  period: string
  highlight: boolean
  badge?: string
  features: PlanFeature[]
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '¥0',
    period: '/月',
    highlight: false,
    features: [
      { text: '每日 50 次对话', included: true },
      { text: '基础模型（Haiku）', included: true },
      { text: 'Inline 补全', included: true },
      { text: '高级模型', included: false },
      { text: '无限对话', included: false },
      { text: '优先响应', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '¥99',
    period: '/月',
    highlight: true,
    badge: '推荐',
    features: [
      { text: '无限对话', included: true },
      { text: '全部 61+ 模型', included: true },
      { text: 'Inline 补全', included: true },
      { text: '高级模型（Opus/GPT-5）', included: true },
      { text: '优先响应', included: true },
      { text: '团队协作', included: false },
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '¥299',
    period: '/人/月',
    highlight: false,
    features: [
      { text: '无限对话', included: true },
      { text: '全部 61+ 模型', included: true },
      { text: 'Inline 补全', included: true },
      { text: '高级模型', included: true },
      { text: '优先响应', included: true },
      { text: '团队管理 & 用量统计', included: true },
    ],
  },
]
</script>

<template>
  <div class="up-overlay" @click.self="emit('close')">
    <div class="up-panel">
      <div class="up-header">
        <h2 class="up-title">🚀 升级计划</h2>
        <button class="up-close" @click="emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <p class="up-desc">选择适合你的计划，解锁完整 AI 编程体验</p>

      <div class="up-plans">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="up-plan"
          :class="{ highlight: plan.highlight }"
        >
          <div v-if="plan.badge" class="up-badge">{{ plan.badge }}</div>
          <div class="up-plan-name">{{ plan.name }}</div>
          <div class="up-plan-price">
            <span class="up-price-amount">{{ plan.price }}</span>
            <span class="up-price-period">{{ plan.period }}</span>
          </div>
          <ul class="up-features">
            <li v-for="(feat, idx) in plan.features" :key="idx" class="up-feature" :class="{ disabled: !feat.included }">
              <span class="up-feature-icon">{{ feat.included ? '✓' : '—' }}</span>
              {{ feat.text }}
            </li>
          </ul>
          <button
            class="up-plan-btn"
            :class="{ primary: plan.highlight }"
            @click="emit('selectPlan', plan.id)"
          >
            {{ plan.id === 'free' ? '当前计划' : '选择' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.up-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.up-panel {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--lc-surface, var(--color-bg));
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 24px;
  animation: slideUp 0.2s var(--lc-ease);
}

.up-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.up-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--lc-text-primary);
}

.up-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--lc-radius-sm);
  color: var(--lc-text-secondary);
  cursor: pointer;
  transition: all 120ms;
}

.up-close:hover {
  background: var(--lc-hover);
}

.up-desc {
  font-size: 12px;
  color: var(--lc-text-tertiary);
  margin-bottom: 20px;
}

.up-plans {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.up-plan {
  position: relative;
  padding: 16px;
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  background: var(--lc-elevated);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.up-plan.highlight {
  border-color: var(--lc-accent);
  background: var(--lc-accent-subtle);
}

.up-badge {
  position: absolute;
  top: -8px;
  right: 12px;
  padding: 2px 8px;
  background: var(--lc-accent);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
  border-radius: var(--lc-radius-sm);
}

.up-plan-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--lc-text-primary);
}

.up-plan-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.up-price-amount {
  font-size: 20px;
  font-weight: 700;
  color: var(--lc-text-primary);
}

.up-price-period {
  font-size: 11px;
  color: var(--lc-text-tertiary);
}

.up-features {
  list-style: none;
  padding: 0;
  flex: 1;
}

.up-feature {
  font-size: 11px;
  color: var(--lc-text-secondary);
  padding: 3px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.up-feature.disabled {
  color: var(--lc-text-tertiary);
  opacity: 0.5;
}

.up-feature-icon {
  font-size: 10px;
  flex-shrink: 0;
}

.up-plan-btn {
  width: 100%;
  padding: 6px 0;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md);
  color: var(--lc-text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: all 120ms;
}

.up-plan-btn.primary {
  background: var(--lc-accent);
  border-color: var(--lc-accent);
  color: #fff;
}

.up-plan-btn:hover {
  background: var(--lc-hover);
}

.up-plan-btn.primary:hover {
  background: var(--lc-accent-hover);
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
