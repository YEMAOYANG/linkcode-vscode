import * as vscode from 'vscode'
import { SECRET_KEY_API, GROUP_TO_MODELS } from '../shared/constants'

const GROUP_TOKEN_PREFIX = 'linkcode.token.'

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

  /** Get a group-specific token */
  async getGroupToken(group: string): Promise<string | undefined> {
    return this.secrets.get(`${GROUP_TOKEN_PREFIX}${group}`)
  }

  /** Store a group-specific token */
  async setGroupToken(group: string, token: string): Promise<void> {
    return this.secrets.store(`${GROUP_TOKEN_PREFIX}${group}`, token)
  }

  /** Delete a group-specific token */
  async deleteGroupToken(group: string): Promise<void> {
    return this.secrets.delete(`${GROUP_TOKEN_PREFIX}${group}`)
  }

  /** Check which groups have tokens configured */
  async getGroupTokenStatus(groups: string[]): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {}
    for (const group of groups) {
      const token = await this.secrets.get(`${GROUP_TOKEN_PREFIX}${group}`)
      status[group] = Boolean(token)
    }
    return status
  }

  /** Get all groups that have a token configured */
  async getConfiguredGroups(): Promise<string[]> {
    const all = Object.keys(GROUP_TO_MODELS)
    const results = await Promise.all(
      all.map(async g => ({ group: g, hasToken: !!(await this.getGroupToken(g)) }))
    )
    return results.filter(r => r.hasToken).map(r => r.group)
  }
}
