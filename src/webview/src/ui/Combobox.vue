<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxRoot,
  ComboboxViewport,
} from 'reka-ui'

withDefaults(
  defineProps<{
    modelValue?: string
    searchTerm?: string
    placeholder?: string
    emptyText?: string
    disabled?: boolean
    autofocus?: boolean
    defaultOpen?: boolean
  }>(),
  { defaultOpen: false },
)

defineEmits<{
  'update:modelValue': [v: string]
  'update:searchTerm': [v: string]
}>()
</script>

<template>
  <ComboboxRoot
    :model-value="modelValue"
    :search-term="searchTerm"
    :disabled="disabled"
    :default-open="defaultOpen"
    :filter-function="(l: string[]) => l"
    class="ui-combobox"
    @update:model-value="$emit('update:modelValue', ($event ?? '') as string)"
    @update:search-term="$emit('update:searchTerm', $event)"
  >
    <ComboboxAnchor class="ui-combobox__anchor">
      <Icon icon="lucide:search" :width="14" :height="14" class="ui-combobox__icon" />
      <ComboboxInput
        class="ui-combobox__input"
        :placeholder="placeholder ?? '搜索...'"
        :auto-focus="autofocus"
        :display-value="() => ''"
      />
      <slot name="anchor-extra" />
    </ComboboxAnchor>
    <ComboboxContent class="ui-combobox__content">
      <ComboboxViewport class="ui-combobox__viewport">
        <ComboboxEmpty class="ui-combobox__empty">
          <slot name="empty">{{ emptyText ?? '无匹配结果' }}</slot>
        </ComboboxEmpty>
        <slot />
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxRoot>
</template>
