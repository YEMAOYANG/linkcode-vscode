<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { Button } from '../ui'

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
      <Button size="sm" variant="primary" @click="emit('upgrade')">升级</Button>
      <Button size="sm" variant="ghost" class="token-banner-dismiss" @click="handleDismiss">
        <Icon icon="lucide:x" :width="12" :height="12" />
      </Button>
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
  background: color-mix(in srgb, var(--lcc-warning) 12%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--lcc-warning) 25%, transparent);
  color: var(--lcc-warning);
}

.token-critical {
  background: color-mix(in srgb, var(--lcc-danger) 12%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--lcc-danger) 25%, transparent);
  color: var(--lcc-danger);
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

.token-banner-dismiss { padding: 4px; }

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-100%); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
