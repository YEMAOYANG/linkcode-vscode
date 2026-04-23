<script setup lang="ts">
import { computed } from 'vue'
import CodeBlock from './CodeBlock.vue'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
}>()

interface ContentPart {
  type: 'text' | 'code'
  content: string
  language?: string
}

const parts = computed<ContentPart[]>(() => {
  const result: ContentPart[] = []
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(props.content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: props.content.slice(lastIndex, match.index) })
    }
    result.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2],
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < props.content.length) {
    result.push({ type: 'text', content: props.content.slice(lastIndex) })
  }

  return result
})
</script>

<template>
  <div
    class="flex gap-2 p-2 rounded-sm mb-1"
    :class="role === 'assistant' ? 'bg-code-bg/40' : ''"
  >
    <div class="shrink-0 w-6 text-center text-sm">
      {{ role === 'user' ? '👤' : '✨' }}
    </div>
    <div class="min-w-0 flex-1">
      <div class="font-semibold text-[11px] uppercase tracking-wide opacity-70 mb-0.5">
        {{ role === 'user' ? 'You' : 'LinkCode' }}
      </div>
      <div class="break-words leading-relaxed">
        <template v-for="(part, idx) in parts" :key="idx">
          <CodeBlock
            v-if="part.type === 'code'"
            :code="part.content"
            :language="part.language"
          />
          <span v-else class="whitespace-pre-wrap">{{ part.content }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
