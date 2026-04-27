<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  readonly?: boolean
  autofocus?: boolean
  maxlength?: number
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}>()

const emit = defineEmits<{
  'update:modelValue': [v: string]
  change: [e: Event]
  keydown: [e: KeyboardEvent]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <textarea
    class="ui-textarea"
    :style="resize ? { resize } : undefined"
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows ?? 3"
    :disabled="disabled"
    :readonly="readonly"
    :autofocus="autofocus"
    :maxlength="maxlength"
    @input="onInput"
    @change="$emit('change', $event)"
    @keydown="$emit('keydown', $event)"
  />
</template>
