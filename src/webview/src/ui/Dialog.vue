<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

const props = withDefaults(
  defineProps<{
    open?: boolean
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'
    hideClose?: boolean
    closeOnOverlayClick?: boolean
  }>(),
  { size: 'md', closeOnOverlayClick: true },
)

defineEmits<{ 'update:open': [v: boolean] }>()

function onPointerDownOutside(e: Event) {
  if (!props.closeOnOverlayClick) e.preventDefault()
}
</script>

<template>
  <DialogRoot :open="open" @update:open="$emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="ui-dialog__overlay" />
      <DialogContent
        class="ui-dialog__content"
        :class="`ui-dialog__content--${size}`"
        @pointer-down-outside="onPointerDownOutside"
      >
        <header v-if="title || $slots.header" class="ui-dialog__header">
          <slot name="header">
            <div class="ui-dialog__heading">
              <DialogTitle class="ui-dialog__title">{{ title }}</DialogTitle>
              <DialogDescription v-if="description" class="ui-dialog__desc">
                {{ description }}
              </DialogDescription>
            </div>
          </slot>
          <DialogClose v-if="!hideClose" class="ui-dialog__close" aria-label="关闭">
            <Icon icon="lucide:x" :width="14" :height="14" />
          </DialogClose>
        </header>
        <DialogClose
          v-else-if="!hideClose"
          class="ui-dialog__close ui-dialog__close--float"
          aria-label="关闭"
        >
          <Icon icon="lucide:x" :width="14" :height="14" />
        </DialogClose>
        <div class="ui-dialog__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="ui-dialog__footer">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
