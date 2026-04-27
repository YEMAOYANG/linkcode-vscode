<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, Dialog } from '../ui'

const emit = defineEmits<{
  close: []
  selectPlan: [plan: string]
}>()

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('close') })

interface PlanFeature { text: string; included: boolean }
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
    id: 'free', name: 'Free', price: '¥0', period: '/月', highlight: false,
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
    id: 'pro', name: 'Pro', price: '¥99', period: '/月', highlight: true, badge: '推荐',
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
    id: 'team', name: 'Team', price: '¥299', period: '/人/月', highlight: false,
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
  <Dialog
    v-model:open="dialogOpen"
    title="🚀 升级计划"
    description="选择适合你的计划，解锁完整 AI 编程体验"
    size="lg"
  >
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
        <Button
          :variant="plan.highlight ? 'primary' : 'default'"
          block
          @click="emit('selectPlan', plan.id)"
        >
          {{ plan.id === 'free' ? '当前计划' : '选择' }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.up-plans {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.up-plan {
  position: relative;
  padding: 16px;
  border: 1px solid var(--lcc-border);
  border-radius: var(--lcc-radius-lg);
  background: var(--lcc-bg-elevated);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.up-plan.highlight {
  border-color: var(--lcc-accent);
  background: color-mix(in srgb, var(--lcc-accent) 10%, transparent);
}

.up-badge {
  position: absolute;
  top: -8px;
  right: 12px;
  padding: 2px 8px;
  background: var(--lcc-accent);
  color: var(--lcc-accent-fg);
  font-size: 9px;
  font-weight: 600;
  border-radius: var(--lcc-radius-sm);
}

.up-plan-name { font-size: 13px; font-weight: 600; color: var(--lcc-text); }

.up-plan-price { display: flex; align-items: baseline; gap: 2px; }
.up-price-amount { font-size: 20px; font-weight: 700; color: var(--lcc-text); }
.up-price-period { font-size: 11px; color: var(--lcc-text-subtle); }

.up-features { list-style: none; padding: 0; margin: 0; flex: 1; }
.up-feature {
  font-size: 11px; color: var(--lcc-text-muted);
  padding: 3px 0; display: flex; align-items: center; gap: 6px;
}
.up-feature.disabled { color: var(--lcc-text-subtle); opacity: 0.5; }
.up-feature-icon { font-size: 10px; flex-shrink: 0; }
</style>
