<script setup lang="ts">
import { computed } from 'vue'
import { ComboboxItem as RekaComboboxItem } from 'reka-ui'

const props = withDefaults(
  defineProps<{
    value: string
    disabled?: boolean
    selected?: boolean
    raw?: boolean
  }>(),
  { raw: false },
)

defineEmits<{ select: [e: Event] }>()

const rootClass = computed(() =>
  props.raw ? undefined : ['ui-combobox__item', { 'ui-combobox__item--selected': props.selected }],
)
</script>

<template>
  <RekaComboboxItem
    :value="value"
    :disabled="disabled"
    :class="rootClass"
    @select="$emit('select', $event)"
  >
    <slot />
  </RekaComboboxItem>
</template>
