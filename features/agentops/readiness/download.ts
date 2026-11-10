import { toast } from "sonner"

/** File-name safe slug for exports. */
export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "assessment"
  )
}

/** Client-side download of a text blob; the toast fires after the anchor click. */
export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast("Download started", { description: filename })
}

/** Clipboard write with a truthful outcome toast either way. */
export async function copyText(
  text: string,
  title: string,
  description = "Copied to the clipboard."
) {
  try {
    await navigator.clipboard.writeText(text)
    toast(title, { description })
    return true
  } catch {
    toast.error("Clipboard unavailable", {
      description:
        "Copying needs a secure (https) context. Select the text and copy it manually.",
    })
    return false
  }
}

export function csvCell(v: unknown) {
  const s = v === undefined || v === null ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
