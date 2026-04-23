<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useHighlight } from '../composables/useHighlight'
import { useVSCode } from '../composables/useVSCode'

const FEEDBACK_RESET_MS = 2000

const props = defineProps<{
  code: string
  language?: string
}>()

const { highlight } = useHighlight()
const { postMessage } = useVSCode()

const highlightedHtml = ref('')
const buttonText = ref('Copy')
const applyText = ref('Apply')

let copyTimer: ReturnType<typeof setTimeout> | undefined
let applyTimer: ReturnType<typeof setTimeout> | undefined

async function doHighlight() {
  highlightedHtml.value = await highlight(props.code, props.language ?? '')
}

onMounted(doHighlight)

watch(() => [props.code, props.language], doHighlight)

onUnmounted(() => {
  if (copyTimer !== undefined) clearTimeout(copyTimer)
  if (applyTimer !== undefined) clearTimeout(applyTimer)
})

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.code)
    buttonText.value = 'Copied!'
    if (copyTimer !== undefined) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      buttonText.value = 'Copy'
    }, FEEDBACK_RESET_MS)
  } catch {
    buttonText.value = 'Failed'
    if (copyTimer !== undefined) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      buttonText.value = 'Copy'
    }, FEEDBACK_RESET_MS)
  }
}
function handleApply() {
  postMessage({ type: 'applyEdit', code: props.code })
  applyText.value = 'Applied ✓'
  if (applyTimer !== undefined) clearTimeout(applyTimer)
  applyTimer = setTimeout(() => {
    applyText.value = 'Apply'
  }, FEEDBACK_RESET_MS)
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
