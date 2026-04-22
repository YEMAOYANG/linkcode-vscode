import * as vscode from 'vscode'

export class Logger {
  private static instance: Logger
  private outputChannel: vscode.OutputChannel

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('LinkCode')
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  public info(message: string): void {
    this.log('INFO', message)
  }

  public warn(message: string): void {
    this.log('WARN', message)
  }

  public error(message: string, error?: unknown): void {
    this.log('ERROR', message)
    if (error instanceof Error) {
      this.outputChannel.appendLine(`  ${error.message}`)
      if (error.stack) {
        this.outputChannel.appendLine(`  ${error.stack}`)
      }
    }
  }

  public show(): void {
    this.outputChannel.show()
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString()
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`)
  }
}
