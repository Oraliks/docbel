import { rename, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { dirname, join } from "path"

const PUBLIC_UPLOAD_PREFIX = "public/uploads"
const PRIVATE_UPLOAD_PREFIX = "private/uploads"

export function getUploadDirectory(isPrivate: boolean) {
  return isPrivate
    ? {
        relativeDir: PRIVATE_UPLOAD_PREFIX,
        absoluteDir: join(/* turbopackIgnore: true */ process.cwd(), "private", "uploads"),
      }
    : {
        relativeDir: PUBLIC_UPLOAD_PREFIX,
        absoluteDir: join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads"),
      }
}

export function buildStoredFilePath(relativeDir: string, fileName: string) {
  return `${relativeDir}/${fileName}`.replace(/\\/g, "/")
}

export function isPrivateStoredPath(filePath: string | null | undefined): boolean {
  if (!filePath) return false
  return filePath.replace(/\\/g, "/").startsWith(`${PRIVATE_UPLOAD_PREFIX}/`)
}

export function isLocalStoredPath(filePath: string | null | undefined): boolean {
  if (!filePath) return false
  const p = filePath.replace(/\\/g, "/")
  return (
    p.startsWith(`${PRIVATE_UPLOAD_PREFIX}/`) ||
    p.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`)
  )
}

export function resolveStoredFilePath(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/")

  if (normalizedPath.startsWith(`${PRIVATE_UPLOAD_PREFIX}/`)) {
    return join(
      /* turbopackIgnore: true */ process.cwd(),
      "private",
      "uploads",
      normalizedPath.slice(PRIVATE_UPLOAD_PREFIX.length + 1)
    )
  }

  if (normalizedPath.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`)) {
    return join(
      /* turbopackIgnore: true */ process.cwd(),
      "public",
      "uploads",
      normalizedPath.slice(PUBLIC_UPLOAD_PREFIX.length + 1)
    )
  }

  return null
}

/**
 * Move a stored file between public/ and private/ when its privacy flag changes.
 * Returns the new relative filePath, or the original if no move is needed.
 * Throws on real I/O failures.
 */
export async function moveStoredFile(
  currentPath: string,
  targetIsPrivate: boolean
): Promise<string> {
  const normalized = currentPath.replace(/\\/g, "/")
  const currentlyPrivate = normalized.startsWith(`${PRIVATE_UPLOAD_PREFIX}/`)
  const currentlyPublic = normalized.startsWith(`${PUBLIC_UPLOAD_PREFIX}/`)

  if (!currentlyPrivate && !currentlyPublic) {
    return currentPath
  }
  if (currentlyPrivate === targetIsPrivate) {
    return currentPath
  }

  const fileName = normalized.split("/").pop()!
  const { relativeDir, absoluteDir } = getUploadDirectory(targetIsPrivate)
  const newRelative = buildStoredFilePath(relativeDir, fileName)
  const oldAbsolute = resolveStoredFilePath(normalized)
  const newAbsolute = join(absoluteDir, fileName)

  if (!oldAbsolute || !existsSync(oldAbsolute)) {
    return newRelative
  }
  if (!existsSync(dirname(newAbsolute))) {
    await mkdir(dirname(newAbsolute), { recursive: true })
  }

  await rename(oldAbsolute, newAbsolute)
  return newRelative
}
