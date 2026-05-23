import { createHash } from 'crypto'

export function sha256(buffer: ArrayBuffer | Buffer): string {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  return createHash('sha256').update(buf).digest('hex')
}
