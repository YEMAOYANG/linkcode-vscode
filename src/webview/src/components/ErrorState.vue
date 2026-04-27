<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '../ui'

export type ErrorType = 'network' | 'apiKey' | 'modelError'

const props = defineProps<{
  errorType: ErrorType
  message?: string
}>()

const emit = defineEmits<{
  retry: []
  reconfigure: []
  switchModel: []
}>()

const errorConfig = computed(() => {
  const configs: Record<ErrorType, { icon: string; title: string; desc: string; action: string; actionEmit: 'retry' | 'reconfigure' | 'switchModel' }> = {
    network: {
      icon: 'wifi-off',
      title: '网络连接失败',
      desc: props.message || '无法连接到 API 服务器，请检查网络连接后重试。',
      action: '重试',
      actionEmit: 'retry',
    },
    apiKey: {
      icon: 'key',
      title: 'API Key 无效',
      desc: props.message || 'API Key 已过期或无效，请重新配置。',
      action: '重新配置',
      actionEmit: 'reconfigure',
    },
    modelError: {
      icon: 'alert',
      title: '模型调用失败',
      desc: props.message || '当前模型暂不可用，请尝试切换其他模型。',
      action: '切换模型',
      actionEmit: 'switchModel',
    },
  }
  return configs[props.errorType]
})

function handleAction() {
  const action = errorConfig.value.actionEmit
  if (action === 'retry') emit('retry')
  else if (action === 'reconfigure') emit('reconfigure')
  else emit('switchModel')
}
</script>

<template>
  <div class="error-state">
    <div class="error-icon-wrap">
      <svg v-if="errorConfig.icon === 'wifi-off'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <svg v-else-if="errorConfig.icon === 'key'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
      <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
    <div class="error-title">{{ errorConfig.title }}</div>
    <div class="error-desc">{{ errorConfig.desc }}</div>
    <Button variant="primary" size="sm" @click="handleAction">
      {{ errorConfig.action }}
    </Button>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
  text-align: center;
  animation: lc-slide-up 0.2s ease;
}

.error-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--lcc-danger) 12%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lcc-danger);
}

.error-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lcc-text);
}

.error-desc {
  font-size: 12px;
  color: var(--lcc-text-subtle);
  max-width: 280px;
  line-height: 1.5;
}
</style>
