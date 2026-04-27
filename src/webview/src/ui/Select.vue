<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}

defineProps<{
  modelValue?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}>()

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="$emit('update:modelValue', ($event ?? '') as string)"
  >
    <SelectTrigger class="ui-select" :class="`ui-select--${size ?? 'md'}`">
      <SelectValue :placeholder="placeholder ?? '请选择...'" />
      <SelectIcon class="ui-select__icon">
        <Icon icon="lucide:chevron-down" :width="14" :height="14" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="ui-select__content" position="popper" :side-offset="4">
        <SelectViewport class="ui-select__viewport">
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
            class="ui-select__item"
          >
            <SelectItemIndicator class="ui-select__indicator">
              <Icon icon="lucide:check" :width="12" :height="12" />
            </SelectItemIndicator>
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
