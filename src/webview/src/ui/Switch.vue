<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{
  modelValue?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
}>()

defineEmits<{ 'update:modelValue': [v: boolean] }>()
</script>

<template>
  <SwitchRoot
    :checked="modelValue"
    :disabled="disabled"
    class="ui-switch"
    :class="`ui-switch--${size ?? 'md'}`"
    @update:checked="$emit('update:modelValue', $event)"
  >
    <SwitchThumb class="ui-switch__thumb" />
  </SwitchRoot>
</template>
