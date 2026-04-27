<script setup lang="ts">
/**
 * Preview harness for the internal UI library.
 * Mount in place of <App /> via main.ts for quick visual regression.
 * Not imported anywhere by default — safe to keep in production bundle.
 */
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import {
  Button, Combobox, ComboboxGroup, ComboboxItem, Dialog, Input, Popover,
  Select, Separator, Slider, Switch, Tabs, Textarea, Tooltip,
} from './index'

const dialogOpen = ref(false)
const popoverOpen = ref(false)
const switchOn = ref(true)
const sliderVal = ref(40)
const text = ref('')
const selectVal = ref('32K')
const tab = ref('a')
const search = ref('')
const chosen = ref('')

const ctxOptions = [
  { label: '8K', value: '8K' }, { label: '32K', value: '32K' },
  { label: '64K', value: '64K' }, { label: '128K', value: '128K' },
]
const tabs = [
  { label: '基础', value: 'a' }, { label: '高级', value: 'b' }, { label: '模型', value: 'c' },
]
const items = [
  { label: 'claude-sonnet-4-5', value: 'claude-sonnet-4-5' },
  { label: 'gpt-5.3-codex', value: 'gpt-5.3-codex' },
  { label: 'deepseek-v3.2', value: 'deepseek-v3.2' },
]
</script>

<template>
  <div style="padding: 24px; display: flex; flex-direction: column; gap: 18px; max-width: 640px; margin: 0 auto;">
    <h2 style="margin: 0;">UI Preview</h2>

    <section>
      <h4>Button</h4>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <Button variant="primary">Primary</Button>
        <Button variant="default">Default</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="icon"><Icon icon="lucide:settings" :width="14" :height="14" /></Button>
        <Button variant="primary" loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </div>
    </section>

    <section>
      <h4>Input / Textarea</h4>
      <Input v-model="text" placeholder="输入..." />
      <Textarea v-model="text" placeholder="多行..." :rows="3" style="margin-top: 8px;" />
    </section>

    <section>
      <h4>Select / Switch / Slider</h4>
      <div style="display: flex; align-items: center; gap: 12px;">
        <Select v-model="selectVal" :options="ctxOptions" />
        <Switch v-model="switchOn" />
        <span style="flex: 1;"><Slider v-model="sliderVal" :min="0" :max="100" /></span>
        <span>{{ sliderVal }}</span>
      </div>
    </section>

    <section><h4>Separator</h4><Separator /></section>

    <section>
      <h4>Tabs</h4>
      <Tabs v-model="tab" :tabs="tabs">
        <template #a>Tab A 内容</template>
        <template #b>Tab B 内容</template>
        <template #c>Tab C 内容</template>
      </Tabs>
    </section>

    <section>
      <h4>Dialog</h4>
      <Button @click="dialogOpen = true">打开 Dialog</Button>
      <Dialog v-model:open="dialogOpen" title="示例弹窗" description="reka-ui 驱动">
        <p>这是内容区域。按 Esc 或点遮罩关闭。</p>
        <template #footer>
          <Button variant="ghost" @click="dialogOpen = false">取消</Button>
          <Button variant="primary" @click="dialogOpen = false">确认</Button>
        </template>
      </Dialog>
    </section>

    <section>
      <h4>Popover + Tooltip</h4>
      <Popover v-model:open="popoverOpen">
        <template #trigger>
          <Button>Popover 触发</Button>
        </template>
        <div>这是 Popover 内容</div>
      </Popover>
      <Tooltip content="这是 Tooltip" style="margin-left: 12px;">
        <Button variant="ghost">悬停试试</Button>
      </Tooltip>
    </section>

    <section>
      <h4>Combobox</h4>
      <div style="height: 240px; border: 1px solid var(--lcc-border); border-radius: var(--lcc-radius-md); overflow: hidden;">
        <Combobox v-model="chosen" v-model:search-term="search" placeholder="搜索模型...">
          <ComboboxGroup label="热门">
            <ComboboxItem v-for="it in items" :key="it.value" :value="it.value">{{ it.label }}</ComboboxItem>
          </ComboboxGroup>
        </Combobox>
      </div>
      <p style="font-size: 12px; color: var(--lcc-text-muted);">selected: {{ chosen }} / search: {{ search }}</p>
    </section>
  </div>
</template>
