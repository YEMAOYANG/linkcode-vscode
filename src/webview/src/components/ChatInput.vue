<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import AtMention from './AtMention.vue'
import FileDragDrop from './FileDragDrop.vue'
import ImageUpload from './ImageUpload.vue'
import type { AttachedFile } from './FileDragDrop.vue'
import type { ImageAttachment } from './ImageUpload.vue'
import type { AtMentionItem } from './AtMention.vue'
import type { ChatMode } from '../composables/useChat'
import { useVSCode } from '../composables/useVSCode'
import { Popover } from '../ui'

export interface QuotedCode {
  code: string
  language: string
  filename?: string
  filepath?: string
  lineStart?: number
  lineEnd?: number
}

export interface SendOptions {
  images?: ImageAttachment[]
  files?: AttachedFile[]
  quotedCodes?: QuotedCode[]
  mode?: ChatMode
}

const props = defineProps<{
  disabled?: boolean
  currentModel?: string
  currentMode?: ChatMode
}>()

const emit = defineEmits<{
  send: [text: string, options?: SendOptions]
  openModelSelector: []
  changeMode: [mode: ChatMode]
}>()

interface ModeOption {
  id: ChatMode
  label: string
  icon: string
  hint: string
}

const modeOptions: ModeOption[] = [
  { id: 'ask', label: 'Ask', icon: 'lucide:message-circle-question', hint: '只答疑，不改代码' },
  { id: 'agent', label: 'Agent', icon: 'lucide:wand-sparkles', hint: '自动改代码，显示 diff 预览' },
  { id: 'plan', label: 'Plan', icon: 'lucide:list-checks', hint: '生成计划文档，可一键 Build' },
]

const showModeMenu = ref(false)

const activeMode = computed<ModeOption>(
  () => modeOptions.find((m) => m.id === (props.currentMode ?? 'ask')) ?? modeOptions[0],
)

function pickMode(mode: ChatMode) {
  showModeMenu.value = false
  if (mode === props.currentMode) return
  emit('changeMode', mode)
}

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const atMentionRef = ref<InstanceType<typeof AtMention> | null>(null)
const imageUploadRef = ref<InstanceType<typeof ImageUpload> | null>(null)
const { postMessage, onMessage } = useVSCode()

const showAtMention = ref(false)
const atMentionQuery = ref('')
const attachedFiles = ref<AttachedFile[]>([])
const attachedImages = ref<ImageAttachment[]>([])
const quotedCodes = ref<QuotedCode[]>([])
const expandedChips = ref<Set<number>>(new Set())

let cleanupFileContent: (() => void) | undefined
onMounted(() => {
  cleanupFileContent = onMessage((event: MessageEvent) => {
    const msg = event.data as {
      type: string
      filepath?: string
      content?: string
      name?: string
      message?: string
    }
    if (msg.type === 'fileContent' && msg.filepath && msg.content && msg.name) {
      // Update an existing loading entry (from drag) if present, else push a new one
      const existing = attachedFiles.value.find(
        (f) => f.filepath === msg.filepath || (!f.filepath && f.name === msg.name && f.status === 'loading'),
      )
      if (existing) {
        existing.content = msg.content
        existing.size = msg.content.length
        existing.status = 'done'
        existing.name = msg.name
        existing.filepath = msg.filepath
      } else {
        attachedFiles.value.push({
          name: msg.name,
          content: msg.content,
          size: msg.content.length,
          status: 'done',
          filepath: msg.filepath,
        })
      }
      postMessage({ type: 'attachFile', name: msg.name, content: msg.content })
    } else if (msg.type === 'fileContentError' && msg.filepath) {
      const idx = attachedFiles.value.findIndex((f) => f.filepath === msg.filepath)
      if (idx >= 0) attachedFiles.value.splice(idx, 1)
    }
  })
})
onUnmounted(() => {
  cleanupFileContent?.()
})

function handleSend() {
  const text = input.value.trim()
  if (!text && attachedImages.value.length === 0 && quotedCodes.value.length === 0) return
  emit('send', text, {
    images: attachedImages.value.length > 0 ? [...attachedImages.value] : undefined,
    files: attachedFiles.value.length > 0 ? [...attachedFiles.value] : undefined,
    quotedCodes: quotedCodes.value.length > 0 ? [...quotedCodes.value] : undefined,
    mode: props.currentMode,
  })
  input.value = ''
  attachedFiles.value = []
  attachedImages.value = []
  quotedCodes.value = []
  expandedChips.value.clear()
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (showAtMention.value) {
    if (['ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) {
      atMentionRef.value?.handleKeydown(e)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      atMentionRef.value?.handleKeydown(e)
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const MAX_TEXTAREA_HEIGHT = 140

function handleInput() {
  const el = textareaRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px'

    const val = el.value
    const cursorPos = el.selectionStart ?? 0
    const beforeCursor = val.slice(0, cursorPos)
    const atIndex = beforeCursor.lastIndexOf('@')

    if (atIndex >= 0 && (atIndex === 0 || beforeCursor[atIndex - 1] === ' ' || beforeCursor[atIndex - 1] === '\n')) {
      showAtMention.value = true
      atMentionQuery.value = beforeCursor.slice(atIndex + 1)
    } else {
      showAtMention.value = false
      atMentionQuery.value = ''
    }
  }
}

function handleAtMentionSelect(item: AtMentionItem) {
  const el = textareaRef.value
  if (el) {
    const val = el.value
    const cursorPos = el.selectionStart ?? 0
    const beforeCursor = val.slice(0, cursorPos)
    const atIndex = beforeCursor.lastIndexOf('@')
    if (atIndex >= 0) {
      input.value = val.slice(0, atIndex) + `@${item.label} ` + val.slice(cursorPos)
    }
  }
  showAtMention.value = false
}

function handleAtMentionClose() {
  showAtMention.value = false
}

function handleFileRemove(index: number) {
  attachedFiles.value.splice(index, 1)
}

function addAttachedFile(file: AttachedFile): void {
  if (file.filepath) {
    const existing = attachedFiles.value.find((f) => f.filepath === file.filepath)
    if (existing) {
      Object.assign(existing, file)
      return
    }
  }
  attachedFiles.value.push(file)
}

function handleImageAdd(img: ImageAttachment) {
  attachedImages.value.push(img)
}

function handleImageRemove(id: string) {
  attachedImages.value = attachedImages.value.filter((i) => i.id !== id)
}

function handlePaste(e: ClipboardEvent) {
  imageUploadRef.value?.handlePaste(e)
}

function setQuotedCode(qc: QuotedCode | string, languageArg?: string) {
  // Backward-compatible: setQuotedCode(code, language) or setQuotedCode(qc)
  const next: QuotedCode = typeof qc === 'string'
    ? { code: qc, language: languageArg ?? 'plaintext' }
    : qc
  // Dedup by filepath + line range
  const key = `${next.filepath ?? ''}:${next.lineStart ?? ''}-${next.lineEnd ?? ''}`
  const exists = quotedCodes.value.find(q =>
    `${q.filepath ?? ''}:${q.lineStart ?? ''}-${q.lineEnd ?? ''}` === key && q.code === next.code,
  )
  if (!exists) {
    quotedCodes.value.push(next)
  }
}

function removeQuotedCode(idx: number) {
  quotedCodes.value.splice(idx, 1)
  expandedChips.value.delete(idx)
  // re-index expanded set after removal
  const rebuilt = new Set<number>()
  for (const i of expandedChips.value) {
    rebuilt.add(i > idx ? i - 1 : i)
  }
  expandedChips.value = rebuilt
}

function toggleChip(idx: number) {
  if (expandedChips.value.has(idx)) {
    expandedChips.value.delete(idx)
  } else {
    expandedChips.value.add(idx)
  }
  // Force reactivity
  expandedChips.value = new Set(expandedChips.value)
}

defineExpose({ setQuotedCode, addAttachedFile })

function getModelDisplayName(modelId?: string): string {
  if (!modelId) return 'Claude Sonnet 4.6'
  const map: Record<string, string> = {
    'claude-sonnet-4-6': 'Claude Sonnet 4.6',
    'claude-opus-4-6': 'Claude Opus 4.6',
    'claude-haiku-4-5-20251001': 'Haiku 4.5',
    'deepseek-r1': 'DeepSeek R1',
    'deepseek-v3': 'DeepSeek V3',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gpt-5': 'GPT-5',
  }
  return map[modelId] ?? modelId
}

function getModelIcon(modelId?: string): string {
  if (!modelId) return 'lucide:cpu'
  if (modelId.startsWith('claude')) return 'lucide:gem'
  if (modelId.startsWith('deepseek')) return 'lucide:waves'
  if (modelId.startsWith('gemini')) return 'lucide:diamond'
  if (modelId.startsWith('gpt')) return 'lucide:zap'
  return 'lucide:cpu'
}

function formatLineRange(qc: QuotedCode): string {
  if (qc.lineStart != null && qc.lineEnd != null) {
    return qc.lineStart === qc.lineEnd ? `${qc.lineStart}` : `${qc.lineStart}-${qc.lineEnd}`
  }
  return ''
}

function chipIconFor(language: string): string {
  const lang = language.toLowerCase()
  if (['typescript', 'ts', 'tsx'].includes(lang)) return 'lucide:file-code-2'
  if (['javascript', 'js', 'jsx'].includes(lang)) return 'lucide:file-code'
  if (['vue'].includes(lang)) return 'lucide:box'
  if (['python', 'py'].includes(lang)) return 'lucide:file-code'
  if (['json', 'yaml', 'yml', 'toml'].includes(lang)) return 'lucide:braces'
  if (['markdown', 'md'].includes(lang)) return 'lucide:file-text'
  if (['css', 'scss', 'less'].includes(lang)) return 'lucide:paintbrush'
  return 'lucide:code'
}

function chipPreviewLines(code: string, max = 6): string[] {
  return code.split('\n').slice(0, max)
}

const hasAttachments = computed(
  () => quotedCodes.value.length + attachedFiles.value.length + attachedImages.value.length > 0,
)
</script>

<template>
  <div class="input-c" @paste="handlePaste">
    <div class="input-c__wrapper">
      <AtMention
        ref="atMentionRef"
        :visible="showAtMention"
        :query="atMentionQuery"
        @select="handleAtMentionSelect"
        @close="handleAtMentionClose"
      />

      <div
        class="input-c__box"
        :class="{
          'is-disabled': disabled,
          'has-attachments': hasAttachments,
        }"
      >
        <!-- Always-mounted attach area so ImageUpload/FileDragDrop refs stay alive.
             Visible only when there is at least one attachment (styled via .has-attachments). -->
        <div class="input-c__attach">
          <TransitionGroup v-if="quotedCodes.length" name="quote" tag="div" class="input-c__chips">
            <div
              v-for="(qc, idx) in quotedCodes"
              :key="`${qc.filepath ?? qc.language}-${qc.lineStart ?? idx}-${qc.lineEnd ?? idx}`"
              class="quote-chip"
              :class="{ 'quote-chip--expanded': expandedChips.has(idx) }"
            >
              <button
                class="quote-chip__head"
                type="button"
                :title="qc.filepath || qc.language"
                @click="toggleChip(idx)"
              >
                <Icon
                  :icon="chipIconFor(qc.language)"
                  :width="12"
                  :height="12"
                  class="quote-chip__icon"
                />
                <span class="quote-chip__name">{{ qc.filename ?? qc.language }}</span>
                <span v-if="formatLineRange(qc)" class="quote-chip__range">
                  · {{ formatLineRange(qc) }}
                </span>
                <Icon
                  :icon="expandedChips.has(idx) ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                  :width="11"
                  :height="11"
                  class="quote-chip__chevron"
                />
              </button>
              <button
                class="quote-chip__remove"
                type="button"
                title="移除引用"
                @click.stop="removeQuotedCode(idx)"
              >
                <Icon icon="lucide:x" :width="11" :height="11" />
              </button>
              <div v-if="expandedChips.has(idx)" class="quote-chip__body">
                <pre class="quote-chip__preview"><code>{{
                  chipPreviewLines(qc.code).join('\n')
                }}</code></pre>
                <div v-if="qc.code.split('\n').length > 6" class="quote-chip__more">
                  +{{ qc.code.split('\n').length - 6 }} more lines
                </div>
              </div>
            </div>
          </TransitionGroup>

          <ImageUpload
            ref="imageUploadRef"
            :images="attachedImages"
            @add="handleImageAdd"
            @remove="handleImageRemove"
          />

          <FileDragDrop
            :files="attachedFiles"
            @remove="handleFileRemove"
          />
        </div>

        <div class="input-c__row">
          <textarea
            ref="textareaRef"
            v-model="input"
            :disabled="disabled"
            placeholder="向 LinkCode 提问任何问题，或按 @ 引用文件..."
            rows="1"
            class="input-c__textarea"
            @keydown="handleKeydown"
            @input="handleInput"
          />
          <button
            class="input-c__send"
            :class="{ 'is-ready': !disabled && (input.trim() || attachedImages.length > 0 || quotedCodes.length > 0) }"
            :disabled="disabled || (!input.trim() && attachedImages.length === 0 && quotedCodes.length === 0)"
            title="发送"
            @click="handleSend"
          >
            <Icon v-if="!disabled" icon="lucide:arrow-up" :width="14" :height="14" />
            <Icon v-else icon="lucide:loader-circle" :width="14" :height="14" class="input-c__spin" />
          </button>
        </div>
      </div>
    </div>

    <div class="input-c__toolbar">
      <div class="input-c__toolbar-left">
        <Popover v-model:open="showModeMenu" side="top" align="start" :side-offset="6">
          <template #trigger>
            <button
              type="button"
              class="input-c__mode-chip"
              :aria-expanded="showModeMenu"
              :title="activeMode.hint"
            >
              <Icon :icon="activeMode.icon" :width="12" :height="12" class="input-c__mode-chip-icon" />
              <span class="input-c__mode-chip-label">{{ activeMode.label }}</span>
              <Icon icon="lucide:chevron-down" :width="11" :height="11" class="input-c__mode-chip-caret" />
            </button>
          </template>
          <div class="input-c__mode-menu" role="listbox">
            <button
              v-for="opt in modeOptions"
              :key="opt.id"
              type="button"
              role="option"
              :class="['input-c__mode-item', { 'is-active': opt.id === currentMode }]"
              :aria-selected="opt.id === currentMode"
              @click="pickMode(opt.id)"
            >
              <Icon :icon="opt.icon" :width="14" :height="14" class="input-c__mode-item-icon" />
              <span class="input-c__mode-item-body">
                <span class="input-c__mode-item-label">{{ opt.label }}</span>
                <span class="input-c__mode-item-hint">{{ opt.hint }}</span>
              </span>
              <Icon
                v-if="opt.id === currentMode"
                icon="lucide:check"
                :width="13"
                :height="13"
                class="input-c__mode-item-check"
              />
            </button>
          </div>
        </Popover>
        <button class="input-c__chip" @click="showAtMention = !showAtMention">
          <Icon icon="lucide:at-sign" :width="11" :height="11" />
          <span>引用</span>
        </button>
        <button class="input-c__chip" @click="imageUploadRef?.openFilePicker?.()">
          <Icon icon="lucide:paperclip" :width="11" :height="11" />
          <span>附件</span>
        </button>
      </div>
      <button class="input-c__model" @click="emit('openModelSelector')">
        <span class="input-c__model-dot" />
        <Icon :icon="getModelIcon(currentModel)" :width="12" :height="12" class="input-c__model-icon" />
        <span class="input-c__model-name">{{ getModelDisplayName(currentModel) }}</span>
        <Icon icon="lucide:chevron-down" :width="11" :height="11" class="input-c__model-caret" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.input-c {
  position: relative;
  padding: var(--lcc-space-3) var(--lcc-space-3) var(--lcc-space-2);
  background: var(--lcc-bg-glass);
  backdrop-filter: var(--lcc-blur-md);
  -webkit-backdrop-filter: var(--lcc-blur-md);
  border-top: 1px solid var(--lcc-border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--lcc-space-2);
}

.input-c__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quote-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  background: color-mix(in srgb, var(--lcc-accent) 10%, var(--lcc-bg-elevated));
  border: 1px solid color-mix(in srgb, var(--lcc-accent) 28%, var(--lcc-border-subtle));
  border-radius: 14px;
  padding: 0 6px 0 2px;
  transition: all var(--lcc-duration-fast) var(--lcc-ease-out);
  max-width: 100%;
}

.quote-chip:hover {
  border-color: color-mix(in srgb, var(--lcc-accent) 50%, transparent);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--lcc-accent) 18%, transparent);
}

.quote-chip--expanded {
  border-radius: var(--lcc-radius-md);
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  background: var(--lcc-bg-elevated);
}

.quote-chip__head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 6px 4px 9px;
  background: transparent;
  border: none;
  color: var(--lcc-text);
  font-size: var(--lcc-font-xs);
  cursor: pointer;
  max-width: 100%;
  min-width: 0;
  line-height: 1;
}

.quote-chip--expanded .quote-chip__head {
  width: 100%;
  padding: 8px 10px;
  border-bottom: 1px solid var(--lcc-border-subtle);
  border-radius: var(--lcc-radius-md) var(--lcc-radius-md) 0 0;
  background: color-mix(in srgb, var(--lcc-accent) 8%, transparent);
}

.quote-chip__icon { color: var(--lcc-accent); flex-shrink: 0; }

.quote-chip__name {
  font-family: var(--lcc-font-code);
  font-size: 11px;
  color: var(--lcc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.quote-chip__range {
  color: var(--lcc-text-subtle);
  font-size: 10px;
  font-family: var(--lcc-font-code);
}

.quote-chip__chevron {
  color: var(--lcc-text-subtle);
  margin-left: 2px;
}

.quote-chip__remove {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  display: inline-flex;
  padding: 2px;
  background: transparent;
  border: none;
  color: var(--lcc-text-subtle);
  cursor: pointer;
  border-radius: 50%;
  transition: all var(--lcc-duration-fast) var(--lcc-ease-out);
}
.quote-chip__remove:hover { background: var(--lcc-bg-hover); color: var(--lcc-danger); }
.quote-chip--expanded .quote-chip__remove {
  top: 8px;
  right: 8px;
  transform: none;
}

.quote-chip__body {
  padding: 8px 10px 10px;
  max-height: 240px;
  overflow: auto;
}
.quote-chip__preview {
  margin: 0;
  font-family: var(--lcc-font-code);
  font-size: 11px;
  color: var(--lcc-text-muted);
  line-height: 1.55;
  white-space: pre;
  overflow-x: auto;
}
.quote-chip__more {
  margin-top: 6px;
  font-size: 10px;
  color: var(--lcc-text-subtle);
  font-style: italic;
}

.quote-enter-active, .quote-leave-active {
  transition: all var(--lcc-duration-base) var(--lcc-ease-spring);
}
.quote-enter-from, .quote-leave-to { opacity: 0; transform: translateY(6px) scale(0.96); }

.input-c__wrapper { position: relative; }

.input-c__box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px 8px 12px;
  background: var(--lcc-bg-elevated);
  border: 1px solid var(--lcc-border);
  border-radius: var(--lcc-radius-lg);
  box-shadow: var(--lcc-shadow-sm);
  transition:
    border-color var(--lcc-duration-base) var(--lcc-ease-out),
    box-shadow var(--lcc-duration-base) var(--lcc-ease-out);
}

.input-c__box:focus-within {
  border-color: color-mix(in srgb, var(--lcc-accent) 60%, transparent);
  box-shadow: var(--lcc-accent-ring), var(--lcc-shadow-sm);
}

.input-c__box.is-disabled { opacity: 0.55; pointer-events: none; }

/* Attach area: sits inside the input box, above the textarea. */
.input-c__attach {
  display: none;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}
.input-c__box.has-attachments .input-c__attach {
  display: flex;
}
/* Let FileDragDrop / ImageUpload wrappers disappear in layout when empty so
   the attach area stays flush against the textarea. */
.input-c__attach :deep(.file-drop-zone),
.input-c__attach :deep(.image-upload-area) {
  display: contents;
}
.input-c__attach :deep(.attached-files),
.input-c__attach :deep(.image-previews) {
  padding: 0;
  gap: 6px;
}

/* Row containing the textarea + send button (horizontal). */
.input-c__row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.input-c__textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--lcc-text);
  font-size: var(--lcc-font-md);
  line-height: 1.55;
  min-height: 22px;
  max-height: 140px;
  padding: 2px 0;
}

.input-c__textarea::placeholder { color: var(--lcc-text-subtle); }

.input-c__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: var(--lcc-bg-hover);
  color: var(--lcc-text-subtle);
  border: none;
  border-radius: var(--lcc-radius-md);
  cursor: pointer;
  transition:
    background var(--lcc-duration-base) var(--lcc-ease-out),
    color var(--lcc-duration-base) var(--lcc-ease-out),
    transform var(--lcc-duration-base) var(--lcc-ease-spring),
    box-shadow var(--lcc-duration-base) var(--lcc-ease-out);
}

.input-c__send.is-ready {
  background: var(--lcc-accent-grad);
  color: var(--lcc-accent-fg);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--lcc-accent) 40%, transparent);
}

.input-c__send.is-ready:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--lcc-accent) 55%, transparent);
}

.input-c__send.is-ready:active { transform: translateY(0) scale(0.98); }
.input-c__send:disabled { cursor: not-allowed; }
.input-c__spin { animation: lc-spin 1s linear infinite; }

.input-c__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lcc-space-2);
  padding: 0 2px;
}

.input-c__toolbar-left { display: flex; gap: 4px; }

.input-c__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: transparent;
  color: var(--lcc-text-muted);
  border: 1px solid transparent;
  border-radius: var(--lcc-radius-sm);
  font-size: var(--lcc-font-xs);
  cursor: pointer;
  transition: all var(--lcc-duration-fast) var(--lcc-ease-out);
}

.input-c__chip:hover {
  background: var(--lcc-bg-hover);
  color: var(--lcc-text);
  border-color: var(--lcc-border-subtle);
}

.input-c__mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 9px;
  margin-right: 2px;
  background: var(--lcc-accent-grad);
  color: var(--lcc-accent-fg);
  border: none;
  border-radius: 999px;
  font-size: var(--lcc-font-xs);
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--lcc-accent) 32%, transparent);
  transition: all var(--lcc-duration-base) var(--lcc-ease-out);
  line-height: 1;
}

.input-c__mode-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--lcc-accent) 48%, transparent);
}

.input-c__mode-chip-icon { flex-shrink: 0; }
.input-c__mode-chip-label { font-family: var(--lcc-font-code); }
.input-c__mode-chip-caret { opacity: 0.75; }

.input-c__mode-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 240px;
  padding: 4px;
}

.input-c__mode-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: var(--lcc-radius-sm);
  color: var(--lcc-text);
  text-align: left;
  cursor: pointer;
  transition: background var(--lcc-duration-fast) var(--lcc-ease-out);
}
.input-c__mode-item:hover { background: var(--lcc-bg-hover); }
.input-c__mode-item.is-active {
  background: color-mix(in srgb, var(--lcc-accent) 14%, transparent);
}

.input-c__mode-item-icon {
  color: var(--lcc-accent);
  flex-shrink: 0;
}

.input-c__mode-item-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.input-c__mode-item-label {
  font-size: var(--lcc-font-sm);
  font-weight: 600;
  letter-spacing: -0.005em;
}
.input-c__mode-item-hint {
  font-size: 11px;
  color: var(--lcc-text-muted);
  line-height: 1.4;
}

.input-c__mode-item-check {
  color: var(--lcc-accent);
  flex-shrink: 0;
}

.input-c__model {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 10px;
  background: var(--lcc-bg-elevated);
  color: var(--lcc-text);
  border: 1px solid var(--lcc-border-subtle);
  border-radius: 999px;
  font-size: var(--lcc-font-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--lcc-duration-base) var(--lcc-ease-out);
  box-shadow: var(--lcc-shadow-sm);
}

.input-c__model:hover {
  border-color: color-mix(in srgb, var(--lcc-accent) 40%, transparent);
  transform: translateY(-1px);
  box-shadow: var(--lcc-shadow-md);
}

.input-c__model-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lcc-success);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--lcc-success) 25%, transparent);
}

.input-c__model-icon { color: var(--lcc-accent); }

.input-c__model-name {
  font-family: var(--lcc-font-code);
  letter-spacing: -0.01em;
}

.input-c__model-caret { color: var(--lcc-text-subtle); }
</style>
