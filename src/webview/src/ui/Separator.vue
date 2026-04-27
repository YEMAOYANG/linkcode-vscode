<script setup lang="ts">
import { Separator as RekaSeparator } from 'reka-ui'

defineProps<{ orientation?: 'horizontal' | 'vertical' }>()
</script>

<template>
  <RekaSeparator
    :orientation="orientation ?? 'horizontal'"
    class="ui-separator"
    :class="`ui-separator--${orientation ?? 'horizontal'}`"
  />
</template>
