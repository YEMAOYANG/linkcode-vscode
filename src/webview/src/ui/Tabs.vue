<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

export interface TabItem {
  label: string
  value: string
  icon?: string
  disabled?: boolean
}

defineProps<{
  modelValue?: string
  tabs: TabItem[]
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md'
}>()

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    :orientation="orientation ?? 'horizontal'"
    class="ui-tabs"
    :class="[
      `ui-tabs--${orientation ?? 'horizontal'}`,
      `ui-tabs--${size ?? 'md'}`,
    ]"
    @update:model-value="$emit('update:modelValue', ($event ?? '') as string)"
  >
    <TabsList class="ui-tabs__list">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :disabled="tab.disabled"
        class="ui-tabs__trigger"
      >
        <slot name="label" :tab="tab">{{ tab.label }}</slot>
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="tab in tabs"
      :key="tab.value"
      :value="tab.value"
      class="ui-tabs__content"
    >
      <slot :name="tab.value" :tab="tab" />
    </TabsContent>
  </TabsRoot>
</template>
