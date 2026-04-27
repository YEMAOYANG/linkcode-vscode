<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useVSCode } from '../composables/useVSCode'
import { Button, Dialog, Input, Tabs, type TabItem } from '../ui'

const emit = defineEmits<{ complete: []; skip: [] }>()

const { postMessage } = useVSCode()

const dialogOpen = ref(true)
watch(dialogOpen, (v) => { if (!v) emit('skip') })

const activeTab = ref<'apikey' | 'github'>('apikey')
const apiKeyInput = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')

const tabs: TabItem[] = [
  { label: 'API Key', value: 'apikey' },
  { label: 'GitHub', value: 'github' },
]

const tabValue = computed({
  get: () => activeTab.value as string,
  set: (v: string) => { activeTab.value = v as typeof activeTab.value },
})

function handleApiKeyLogin() {
  const key = apiKeyInput.value.trim()
  if (!key) return
  isSubmitting.value = true
  errorMsg.value = ''
  postMessage({ type: 'setApiKey', key })
  postMessage({ type: 'validateApiKey', key })
  setTimeout(() => {
    isSubmitting.value = false
    emit('complete')
  }, 1000)
}

function handleGithubLogin() {
  postMessage({ type: 'githubLogin' })
}
</script>

<template>
  <Dialog v-model:open="dialogOpen" size="sm" hide-close>
    <template #header>
      <div class="login-header">
        <div class="login-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lcc-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
        </div>
        <h2 class="login-title">登录 LinkCode</h2>
        <p class="login-desc">连接你的账户，开始使用 AI 编程助手</p>
      </div>
    </template>

    <Tabs v-model="tabValue" :tabs="tabs">
      <template #apikey>
        <div class="login-form">
          <div class="form-field">
            <label class="form-label">API Key</label>
            <Input v-model="apiKeyInput" type="password" placeholder="sk-..." />
          </div>
          <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
          <Button
            variant="primary"
            block
            :disabled="!apiKeyInput.trim() || isSubmitting"
            :loading="isSubmitting"
            @click="handleApiKeyLogin"
          >
            {{ isSubmitting ? '验证中...' : '连接' }}
          </Button>
          <p class="form-hint">
            在 <a href="https://smoothlink.ai" class="form-link">smoothlink.ai</a> 获取 API Key
          </p>
        </div>
      </template>
      <template #github>
        <div class="login-form">
          <button class="github-btn" @click="handleGithubLogin">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            使用 GitHub 登录
          </button>
          <p class="form-hint">将使用 VS Code 的 GitHub 认证</p>
        </div>
      </template>
    </Tabs>

    <template #footer>
      <Button variant="ghost" block @click="emit('skip')">跳过，稍后设置</Button>
    </template>
  </Dialog>
</template>

<style scoped>
.login-header { text-align: center; flex: 1; min-width: 0; }
.login-logo { margin-bottom: 12px; }
.login-title {
  font-size: var(--lcc-font-md);
  font-weight: 600;
  color: var(--lcc-text);
  margin: 0 0 4px;
}
.login-desc { font-size: var(--lcc-font-xs); color: var(--lcc-text-subtle); margin: 0; }

.login-form { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 11px; color: var(--lcc-text-muted); font-weight: 500; }
.form-error { font-size: 11px; color: var(--lcc-danger); }

.github-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: #24292e;
  border: none;
  border-radius: var(--lcc-radius-md);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--lcc-duration-fast) var(--lcc-ease-out);
  width: 100%;
}
.github-btn:hover { background: #1b1f23; }

.form-hint { font-size: 11px; color: var(--lcc-text-subtle); text-align: center; margin: 0; }
.form-link { color: var(--lcc-accent); text-decoration: none; }
.form-link:hover { text-decoration: underline; }
</style>
