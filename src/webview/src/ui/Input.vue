<script setup lang="ts">
import { computed } from 'vue'

type InputType = 'text' | 'password' | 'number' | 'email' | 'search' | 'url' | 'tel'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    type?: InputType
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    autofocus?: boolean
    size?: 'sm' | 'md'
    min?: number | string
    max?: number | string
    step?: number | string
    maxlength?: number
  }>(),
  { type: 'text', size: 'md' },
)

const emit = defineEmits<{
  'update:modelValue': [v: string | number]
  change: [e: Event]
  focus: [e: FocusEvent]
  blur: [e: FocusEvent]
  keydown: [e: KeyboardEvent]
}>()

const inputClass = computed(() => ['ui-input', `ui-input--${props.size}`])

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  const raw = target.value
  const value = props.type === 'number' ? (raw === '' ? NaN : target.valueAsNumber) : raw
  emit('update:modelValue', value)
}
</script>

<template>
  <input
    :class="inputClass"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :autofocus="autofocus"
    :min="min"
    :max="max"
    :step="step"
    :maxlength="maxlength"
    @input="onInput"
    @change="$emit('change', $event)"
    @focus="$emit('focus', $event)"
    @blur="$emit('blur', $event)"
    @keydown="$emit('keydown', $event)"
  >
</template>
