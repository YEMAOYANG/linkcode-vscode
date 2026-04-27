import { ref, onMounted, onUnmounted } from 'vue'
import type { AttachedFile } from '../components/FileDragDrop.vue'
import { useVSCode } from './useVSCode'

export interface DragDropOptions {
  /** Called when the user attaches one or more files (from OS or VS Code explorer). */
  onAttach: (file: AttachedFile) => void
}

/**
 * Global drag-and-drop manager.
 *
 * Per VS Code security model, files dropped from the Explorer have
 * `event.dataTransfer.files` empty — they come through `text/uri-list`.
 * Files dropped from the OS file manager have real `File` objects (read via FileReader).
 *
 * Users must hold **Shift** when dragging from VS Code's Explorer, otherwise
 * VS Code opens the file instead of firing drop in the webview.
 */
export function useDragDrop(options: DragDropOptions) {
  const { postMessage } = useVSCode()
  const isDragging = ref(false)

  let dragCounter = 0

  function normalizeUri(line: string): string {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return ''
    return trimmed
  }

  function pathFromUri(uri: string): { filepath: string; name: string } {
    const filepath = uri.startsWith('file:')
      ? decodeURIComponent(uri.replace(/^file:\/\/\/?/, ''))
      : uri
    const name = filepath.split(/[\\/]/).pop() || filepath
    return { filepath, name }
  }

  function readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    e.stopPropagation()
    dragCounter = 0
    isDragging.value = false
    if (!e.dataTransfer) return

    // Case 1: VS Code Explorer drag — URIs
    const uriList = e.dataTransfer.getData('text/uri-list')
      || e.dataTransfer.getData('text/plain')
      || e.dataTransfer.getData('text')
    if (uriList) {
      const uris = uriList.split(/\r?\n/).map(normalizeUri).filter(Boolean)
      if (uris.length > 0) {
        for (const uri of uris) {
          const { filepath, name } = pathFromUri(uri)
          const attached: AttachedFile = { name, size: 0, status: 'loading', filepath }
          options.onAttach(attached)
          postMessage({ type: 'getFileContent', filepath })
        }
        return
      }
    }

    // Case 2: OS file manager drag — real File objects
    const files = Array.from(e.dataTransfer.files ?? [])
    for (const f of files) {
      const attached: AttachedFile = { name: f.name, size: f.size, status: 'loading' }
      options.onAttach(attached)
      try {
        const content = await readAsText(f)
        attached.content = content
        attached.status = 'done'
        postMessage({ type: 'attachFile', name: f.name, content })
      } catch {
        attached.status = 'done'
      }
    }
  }

  function handleDragEnter(e: DragEvent): void {
    e.preventDefault()
    if (!e.dataTransfer) return
    const hasFiles = Array.from(e.dataTransfer.types).some(
      (t) => t === 'Files' || t === 'text/uri-list',
    )
    if (!hasFiles) return
    dragCounter++
    isDragging.value = true
  }

  function handleDragOver(e: DragEvent): void {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  function handleDragLeave(e: DragEvent): void {
    e.preventDefault()
    dragCounter = Math.max(0, dragCounter - 1)
    if (dragCounter === 0) {
      isDragging.value = false
    }
  }

  function attachGlobalListeners(): void {
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
  }

  function detachGlobalListeners(): void {
    window.removeEventListener('dragenter', handleDragEnter)
    window.removeEventListener('dragover', handleDragOver)
    window.removeEventListener('dragleave', handleDragLeave)
    window.removeEventListener('drop', handleDrop)
  }

  onMounted(attachGlobalListeners)
  onUnmounted(detachGlobalListeners)

  return { isDragging }
}
