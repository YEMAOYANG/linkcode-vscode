/**
 * Offline lucide icon registry.
 *
 * The VSCode WebView CSP blocks Iconify's default CDN fetch
 * (`api.iconify.design`). We ship a pruned JSON containing only the lucide
 * icons used across the app (see `lucide-subset.json`) and register them
 * via `addIcon` at module load.
 *
 * To add a new icon, run this one-liner from the repo root (Windows PowerShell
 * compatible) to regenerate the subset — keep the `names` array in sync with
 * icons actually referenced in `.vue` templates:
 *
 *   node -e "const fs=require('fs');const src=require('./src/webview/node_modules/.pnpm/@iconify-json+lucide@1.2.102/node_modules/@iconify-json/lucide/icons.json');const names=['sparkles','plus','...'];const out={width:src.width,height:src.height,icons:{}};names.forEach(n=>out.icons[n]={body:src.icons[n].body});fs.writeFileSync('./src/webview/src/icons/lucide-subset.json',JSON.stringify(out,null,2))"
 *
 * Note: lucide renamed some icons (`loader-2` -> `loader-circle`,
 * `upload-cloud` -> `cloud-upload`, `code-2` -> `code`). Always check
 * `Object.keys(src.icons)` before assuming a name exists.
 */
import { addIcon } from '@iconify/vue'
import subset from './lucide-subset.json'

type IconBody = { body: string }
const iconSet = subset as { width: number; height: number; icons: Record<string, IconBody> }

let registered = false

export function registerLucideIcons(): void {
  if (registered) return
  for (const [name, icon] of Object.entries(iconSet.icons)) {
    addIcon(`lucide:${name}`, {
      body: icon.body,
      width: iconSet.width,
      height: iconSet.height,
    })
  }
  registered = true
}
