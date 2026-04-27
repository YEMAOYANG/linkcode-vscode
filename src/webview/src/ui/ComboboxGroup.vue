<script setup lang="ts">
import { ComboboxGroup as RekaComboboxGroup, ComboboxLabel } from 'reka-ui'

defineProps<{ label?: string }>()
</script>

<template>
  <RekaComboboxGroup class="ui-combobox__group">
    <ComboboxLabel v-if="label || $slots.label" class="ui-combobox__label">
      <slot name="label">{{ label }}</slot>
    </ComboboxLabel>
    <slot />
  </RekaComboboxGroup>
</template>
