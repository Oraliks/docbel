// Walks page block content (arbitrary JSON) and collects every `fileId`
// referenced anywhere — direct props (`fileId`) or implicit references inside
// URLs of the form `/api/files/<id>/download`.

const FILE_URL_RE = /\/api\/files\/([a-zA-Z0-9_-]+)\/(?:download|usage)/g

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function harvest(value: unknown, found: Set<string>): void {
  if (typeof value === "string") {
    let m: RegExpExecArray | null
    FILE_URL_RE.lastIndex = 0
    while ((m = FILE_URL_RE.exec(value))) {
      if (m[1]) found.add(m[1])
    }
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) harvest(v, found)
    return
  }
  if (isPlainObject(value)) {
    for (const [key, v] of Object.entries(value)) {
      if (key === "fileId" && typeof v === "string" && v.length > 0) {
        found.add(v)
        continue
      }
      harvest(v, found)
    }
  }
}

export function extractFileIds(content: unknown): string[] {
  const found = new Set<string>()
  harvest(content, found)
  return Array.from(found)
}
