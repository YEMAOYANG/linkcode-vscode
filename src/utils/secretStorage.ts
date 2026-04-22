import * as vscode from 'vscode'

const KEY = 'linkcode.apiKey'

export class SecretStore {
  constructor(private secrets: vscode.SecretStorage) {}

  async getApiKey(): Promise<string | undefined> {
    return this.secrets.get(KEY)
  }

  async setApiKey(key: string): Promise<void> {
    return this.secrets.store(KEY, key)
  }

  async deleteApiKey(): Promise<void> {
    return this.secrets.delete(KEY)
  }
}
