<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useHighlight } from '../composables/useHighlight'

const props = defineProps<{
  code: string
  language?: string
}>()

const { highlight } = useHighlight()

const highlightedHtml = ref('')
const buttonText = ref('Copy')
const applyText = ref('Apply')

async function doHighlight() {
  highlightedHtml.value = await highlight(props.code, props.language ?? '')
}

onMounted(doHighlight)

watch(() => [props.code, props.language], doHighlight)

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.code)
    buttonText.value = 'Copied!'
    setTimeout(() => {
      buttonText.value = 'Copy'
    }, 2000)
  } catch {
    buttonText.value = 'Failed'
    setTimeout(() => {
      buttonText.value = 'Copy'
    }, 2000)
  }
}
function handleApply() {
  applyText.value = 'Applied ✓'
  setTimeout(() => {
    applyText.value = 'Apply'
  }, 2000)
}
</script>

<template>
  <div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-block-lang">{{ language ?? 'text' }}</span>
      <div class="code-block-actions">
        <button class="code-block-copy" @click="handleCopy">
          {{ buttonText }}
        </button>
        <button class="code-block-apply" @click="handleApply">
          {{ applyText }}
        </button>
      </div>
    </div>
    <div
      class="code-block-body"
      v-html="highlightedHtml"
    />
  </div>
</template>
