<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  level: 'warning' | 'critical'
  percentage?: number
}>()

const emit = defineEmits<{
  upgrade: []
  dismiss: []
}>()

const dismissed = ref(false)

const config = computed(() => {
  if (props.level === 'critical') {
    return {
      icon: '🔴',
      text: `Token 余额不足 5%${props.percentage !== undefined ? ` (${props.percentage}%)` : ''}，服务即将中断`,
      cls: 'token-critical',
    }
  }
  return {
    icon: '🟡',
    text: `Token 余额不足 20%${props.percentage !== undefined ? ` (${props.percentage}%)` : ''}，建议充值`,
    cls: 'token-warning',
  }
})

function handleDismiss() {
  dismissed.value = true
  emit('dismiss')
}
</script>

<template>
  <div v-if="!dismissed" class="token-banner" :class="config.cls">
    <span class="token-banner-icon">{{ config.icon }}</span>
    <span class="token-banner-text">{{ config.text }}</span>
    <div class="token-banner-actions">
      <button class="token-banner-btn upgrade" @click="emit('upgrade')">升级</button>
      <button class="token-banner-btn dismiss" @click="handleDismiss">×</button>
    </div>
  </div>
</template>

<style scoped>
.token-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11px;
  animation: slideDown 0.2s ease;
  flex-shrink: 0;
}

.token-warning {
  background: rgba(245, 158, 11, 0.12);
  border-bottom: 1px solid rgba(245, 158, 11, 0.25);
  color: var(--lc-yellow);
}

.token-critical {
  background: rgba(239, 68, 68, 0.12);
  border-bottom: 1px solid rgba(239, 68, 68, 0.25);
  color: var(--lc-red);
}

.token-banner-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.token-banner-text {
  flex: 1;
  min-width: 0;
}

.token-banner-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.token-banner-btn {
  padding: 2px 8px;
  border: none;
  border-radius: var(--lc-radius-sm);
  font-size: 10px;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: all 120ms;
}

.token-banner-btn.upgrade {
  background: var(--lc-accent);
  color: #fff;
}

.token-banner-btn.upgrade:hover {
  background: var(--lc-accent-hover);
}

.token-banner-btn.dismiss {
  background: transparent;
  color: inherit;
  font-size: 14px;
  padding: 0 4px;
}

.token-banner-btn.dismiss:hover {
  background: rgba(255, 255, 255, 0.1);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-100%); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
