import * as vscode from 'vscode'
import { SECRET_KEY_API } from '../shared/constants'

export class SecretStore {
  constructor(private secrets: vscode.SecretStorage) {}

  async getApiKey(): Promise<string | undefined> {
    return this.secrets.get(SECRET_KEY_API)
  }

  async setApiKey(key: string): Promise<void> {
    return this.secrets.store(SECRET_KEY_API, key)
  }

  async deleteApiKey(): Promise<void> {
    return this.secrets.delete(SECRET_KEY_API)
  }
}
