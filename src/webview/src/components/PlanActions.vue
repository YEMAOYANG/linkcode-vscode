<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'

interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

const props = defineProps<{
  models: ModelInfo[]
  currentModel: string
  planContent: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  build: [payload: { modelId: string; content: string }]
}>()

const menuOpen = ref(false)
const selectedModel = ref(props.currentModel)

const displayName = computed(() => {
  const match = props.models.find((m) => m.id === selectedModel.value)
  return match?.label ?? selectedModel.value
})

function toggleMenu() {
  if (props.disabled) return
  menuOpen.value = !menuOpen.value
}

function selectModel(id: string) {
  selectedModel.value = id
  menuOpen.value = false
}

function handleBuild() {
  if (props.disabled) return
  emit('build', { modelId: selectedModel.value, content: props.planContent })
}
</script>

<template>
  <div class="plan-c" :class="{ 'is-disabled': disabled }">
    <div class="plan-c__hint">
      <Icon icon="lucide:sparkles" :width="12" :height="12" />
      <span>这是一份计划。选择模型后点击 Build 切换到 Agent 模式执行。</span>
    </div>

    <div class="plan-c__row">
      <div class="plan-c__picker">
        <button
          type="button"
          class="plan-c__model"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          <Icon icon="lucide:cpu" :width="12" :height="12" />
          <span class="plan-c__model-name">{{ displayName }}</span>
          <Icon icon="lucide:chevron-down" :width="11" :height="11" />
        </button>
        <div v-if="menuOpen" class="plan-c__menu" role="listbox">
          <button
            v-for="m in models"
            :key="m.id"
            type="button"
            role="option"
            :class="['plan-c__option', { 'is-active': m.id === selectedModel }]"
            :aria-selected="m.id === selectedModel"
            @click="selectModel(m.id)"
          >
            <span class="plan-c__option-name">{{ m.label }}</span>
            <span class="plan-c__option-provider">{{ m.provider }}</span>
          </button>
          <div v-if="models.length === 0" class="plan-c__empty">无可用模型</div>
        </div>
      </div>

      <button
        type="button"
        class="plan-c__build"
        :disabled="disabled"
        @click="handleBuild"
      >
        <Icon icon="lucide:hammer" :width="13" :height="13" />
        <span>Build</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.plan-c {
  margin-top: var(--lcc-space-3);
  padding: 10px 12px;
  background: color-mix(in srgb, var(--lcc-accent) 6%, var(--lcc-bg-elevated));
  border: 1px solid color-mix(in srgb, var(--lcc-accent) 22%, var(--lcc-border-subtle));
  border-radius: var(--lcc-radius-md);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-c.is-disabled { opacity: 0.55; pointer-events: none; }

.plan-c__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--lcc-font-xs);
  color: var(--lcc-text-muted);
}
.plan-c__hint > svg { color: var(--lcc-accent); flex-shrink: 0; }

.plan-c__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plan-c__picker { position: relative; }

.plan-c__model {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--lcc-bg);
  color: var(--lcc-text);
  border: 1px solid var(--lcc-border-subtle);
  border-radius: 999px;
  font-size: var(--lcc-font-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--lcc-duration-fast) var(--lcc-ease-out);
}
.plan-c__model:hover { border-color: color-mix(in srgb, var(--lcc-accent) 40%, transparent); }
.plan-c__model-name {
  font-family: var(--lcc-font-code);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-c__menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  background: var(--lcc-bg-elevated);
  border: 1px solid var(--lcc-border);
  border-radius: var(--lcc-radius-md);
  box-shadow: var(--lcc-shadow-lg);
  z-index: 10;
}

.plan-c__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: var(--lcc-radius-sm);
  color: var(--lcc-text);
  font-size: var(--lcc-font-xs);
  text-align: left;
  cursor: pointer;
}
.plan-c__option:hover { background: var(--lcc-bg-hover); }
.plan-c__option.is-active {
  background: color-mix(in srgb, var(--lcc-accent) 18%, transparent);
  color: var(--lcc-accent);
}
.plan-c__option-name { font-family: var(--lcc-font-code); }
.plan-c__option-provider {
  font-size: 10px;
  color: var(--lcc-text-subtle);
  text-transform: uppercase;
}
.plan-c__empty {
  padding: 10px;
  font-size: var(--lcc-font-xs);
  color: var(--lcc-text-subtle);
  text-align: center;
}

.plan-c__build {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  background: var(--lcc-accent-grad);
  color: var(--lcc-accent-fg);
  border: none;
  border-radius: 999px;
  font-size: var(--lcc-font-xs);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--lcc-accent) 35%, transparent);
  transition: all var(--lcc-duration-base) var(--lcc-ease-spring);
}
.plan-c__build:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--lcc-accent) 50%, transparent);
}
.plan-c__build:active:not(:disabled) { transform: translateY(0); }
.plan-c__build:disabled { cursor: not-allowed; opacity: 0.6; }
</style>
