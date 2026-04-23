<script setup lang="ts">
import { ref } from 'vue'
import { useVSCode } from '../composables/useVSCode'

const emit = defineEmits<{
  complete: []
  skip: []
}>()

const { postMessage } = useVSCode()

const activeTab = ref<'apikey' | 'github'>('apikey')
const apiKeyInput = ref('')
const isSubmitting = ref(false)
const errorMsg = ref('')

function handleApiKeyLogin() {
  const key = apiKeyInput.value.trim()
  if (!key) return
  isSubmitting.value = true
  errorMsg.value = ''

  postMessage({ type: 'setApiKey', key })
  postMessage({ type: 'validateApiKey', key })

  // Give it a moment, then complete
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
  <div class="login-overlay" @click.self="emit('skip')">
    <div class="login-panel">
      <div class="login-header">
        <div class="login-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lc-accent-text)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
        </div>
        <h2 class="login-title">登录 LinkCode</h2>
        <p class="login-desc">连接你的账户，开始使用 AI 编程助手</p>
      </div>

      <!-- Tab switcher -->
      <div class="login-tabs">
        <button
          class="login-tab"
          :class="{ active: activeTab === 'apikey' }"
          @click="activeTab = 'apikey'"
        >
          API Key
        </button>
        <button
          class="login-tab"
          :class="{ active: activeTab === 'github' }"
          @click="activeTab = 'github'"
        >
          GitHub
        </button>
      </div>

      <!-- API Key tab -->
      <div v-if="activeTab === 'apikey'" class="login-form">
        <div class="form-field">
          <label class="form-label">API Key</label>
          <input
            v-model="apiKeyInput"
            type="password"
            class="form-input"
            placeholder="sk-..."
          >
        </div>
        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
        <button
          class="login-submit"
          :disabled="!apiKeyInput.trim() || isSubmitting"
          @click="handleApiKeyLogin"
        >
          {{ isSubmitting ? '验证中...' : '连接' }}
        </button>
        <p class="form-hint">
          在 <a href="https://smoothlink.ai" class="form-link">smoothlink.ai</a> 获取 API Key
        </p>
      </div>

      <!-- GitHub tab -->
      <div v-if="activeTab === 'github'" class="login-form">
        <button class="github-btn" @click="handleGithubLogin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          使用 GitHub 登录
        </button>
        <p class="form-hint">将使用 VS Code 的 GitHub 认证</p>
      </div>

      <button class="login-skip" @click="emit('skip')">
        跳过，稍后设置
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.login-panel {
  width: 100%;
  max-width: 360px;
  background: var(--lc-surface, var(--color-bg));
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  padding: 24px;
  animation: slideUp 0.2s var(--lc-ease);
}

.login-header {
  text-align: center;
  margin-bottom: 20px;
}

.login-logo {
  margin-bottom: 12px;
}

.login-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--lc-text-primary);
  margin-bottom: 4px;
}

.login-desc {
  font-size: 12px;
  color: var(--lc-text-tertiary);
}

.login-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--lc-elevated);
  border-radius: var(--lc-radius-md);
  padding: 3px;
}

.login-tab {
  flex: 1;
  padding: 6px 0;
  background: transparent;
  border: none;
  border-radius: var(--lc-radius-sm);
  color: var(--lc-text-tertiary);
  font-size: 12px;
  font-family: var(--lc-font-ui);
  cursor: pointer;
  transition: all 120ms;
}

.login-tab.active {
  background: var(--lc-accent);
  color: #fff;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 11px;
  color: var(--lc-text-secondary);
  font-weight: 500;
}

.form-input {
  padding: 8px 12px;
  background: var(--lc-elevated);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-md);
  color: var(--lc-text-primary);
  font-size: 13px;
  font-family: var(--lc-font-code);
  outline: none;
  transition: border-color 120ms;
}

.form-input:focus {
  border-color: var(--lc-accent);
}

.form-error {
  font-size: 11px;
  color: var(--lc-red);
}

.login-submit {
  padding: 8px 0;
  background: var(--lc-accent);
  border: none;
  border-radius: var(--lc-radius-md);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: background 120ms;
}

.login-submit:hover:not(:disabled) {
  background: var(--lc-accent-hover);
}

.login-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.github-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: #24292e;
  border: none;
  border-radius: var(--lc-radius-md);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: background 120ms;
}

.github-btn:hover {
  background: #1b1f23;
}

.form-hint {
  font-size: 11px;
  color: var(--lc-text-tertiary);
  text-align: center;
}

.form-link {
  color: var(--lc-accent-text);
  text-decoration: none;
}

.form-link:hover {
  text-decoration: underline;
}

.login-skip {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--lc-text-tertiary);
  font-size: 11px;
  cursor: pointer;
  font-family: var(--lc-font-ui);
  transition: color 120ms;
}

.login-skip:hover {
  color: var(--lc-text-secondary);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
