import { join } from "path"

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
