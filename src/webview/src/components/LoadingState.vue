<script setup lang="ts">
defineProps<{
  type: 'chat' | 'models' | 'init'
  text?: string
}>()
</script>

<template>
  <div class="loading-state" :class="`loading-${type}`">
    <!-- Chat response waiting -->
    <template v-if="type === 'chat'">
      <div class="loading-indicator">
        <div class="thinking-dots-enhanced">
          <span /><span /><span />
        </div>
        <span class="loading-text">{{ text || '正在思考...' }}</span>
      </div>
    </template>

    <!-- Model list loading -->
    <template v-else-if="type === 'models'">
      <div class="loading-indicator">
        <div class="loading-spinner" />
        <span class="loading-text">{{ text || '加载模型列表...' }}</span>
      </div>
    </template>

    <!-- Init loading -->
    <template v-else>
      <div class="loading-indicator loading-init">
        <div class="loading-spinner" />
        <span class="loading-text">{{ text || '初始化 LinkCode...' }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  animation: lc-fade-in 0.2s ease;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-init {
  flex-direction: column;
  gap: 12px;
  padding: 32px;
}

.loading-text {
  font-size: 12px;
  color: var(--lcc-text-subtle);
}

/* Enhanced thinking dots with text */
.thinking-dots-enhanced {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}

.thinking-dots-enhanced span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lcc-accent);
  animation: lc-float 1.2s ease-in-out infinite;
}

.thinking-dots-enhanced span:nth-child(2) { animation-delay: 0.15s; }
.thinking-dots-enhanced span:nth-child(3) { animation-delay: 0.3s; }

/* Spinner */
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--lcc-border);
  border-top-color: var(--lcc-accent);
  border-radius: 50%;
  animation: lc-spin 0.8s linear infinite;
}
</style>
