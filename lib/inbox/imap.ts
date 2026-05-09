import { ImapFlow, FetchMessageObject } from "imapflow";
import { simpleParser, ParsedMail, AddressObject } from "mailparser";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

function readImapConfig(): ImapConfig | null {
  const host = process.env.CONTACT_IMAP_HOST;
  const portStr = process.env.CONTACT_IMAP_PORT;
  const user = process.env.CONTACT_IMAP_USER;
  const password = process.env.CONTACT_IMAP_PASSWORD;
  if (!host || !portStr || !user || !password) return null;
  const port = Number.parseInt(portStr, 10);
  if (!Number.isFinite(port)) return null;
  return { host, port, user, password };
}

export interface SyncResult {
  imported: number;
  skipped: number;
  errors: number;
}

function flattenAddress(addr: AddressObject | AddressObject[] | undefined): { name: string | null; address: string } | null {
  if (!addr) return null;
  const arr = Array.isArray(addr) ? addr : [addr];
  const first = arr[0]?.value?.[0];
  if (!first?.address) return null;
  return { name: first.name || null, address: first.address.toLowerCase() };
}

function flattenAddressList(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return [];
  const arr = Array.isArray(addr) ? addr : [addr];
  const result: string[] = [];
  for (const a of arr) {
    for (const v of a.value || []) {
      if (v.address) result.push(v.address.toLowerCase());
    }
  }
  return result;
}

interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

function extractAttachmentMeta(parsed: ParsedMail): AttachmentMeta[] {
  return (parsed.attachments || []).map((a) => ({
    filename: a.filename || "untitled",
    contentType: a.contentType || "application/octet-stream",
    size: a.size || 0,
  }));
}

/**
 * Connect to IMAP, fetch all unseen messages from INBOX, store new ones in DB.
 * Idempotent — uses (mailbox, uid) unique constraint to dedupe.
 * Marks messages as \Seen on the server only after successful DB insert,
 * so a failed sync can be retried safely.
 */
export async function syncInbox(): Promise<SyncResult> {
  const cfg = readImapConfig();
  if (!cfg) {
    throw new Error("IMAP non configuré (CONTACT_IMAP_* manquants)");
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  });

  const result: SyncResult = { imported: 0, skipped: 0, errors: 0 };

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      const uidValidity =
        mailbox && typeof mailbox === "object" && "uidValidity" in mailbox
          ? String(mailbox.uidValidity)
          : null;

      const messages: FetchMessageObject[] = [];
      for await (const msg of client.fetch(
        { seen: false },
        { uid: true, source: true, internalDate: true, envelope: true, flags: true }
      )) {
        messages.push(msg);
      }

      for (const msg of messages) {
        try {
          const existing = await prisma.inboxEmail.findUnique({
            where: { mailbox_uid: { mailbox: "INBOX", uid: msg.uid } },
          });
          if (existing) {
            result.skipped++;
            continue;
          }

          const parsed = await simpleParser(msg.source as Buffer);
          const from = flattenAddress(parsed.from);
          const to = flattenAddressList(parsed.to);
          const cc = flattenAddressList(parsed.cc);
          const attachments = extractAttachmentMeta(parsed);

          await prisma.inboxEmail.create({
            data: {
              mailbox: "INBOX",
              uid: msg.uid,
              uidValidity,
              messageId: parsed.messageId || null,
              inReplyTo: parsed.inReplyTo || null,
              fromAddress: from?.address || "unknown@unknown",
              fromName: from?.name || null,
              toAddresses: JSON.stringify(to),
              ccAddresses: JSON.stringify(cc),
              subject: parsed.subject || "",
              textBody: parsed.text || "",
              htmlBody: typeof parsed.html === "string" ? parsed.html : null,
              attachments: attachments as unknown as Prisma.InputJsonValue,
              receivedAt: parsed.date || msg.internalDate || new Date(),
              isRead: false,
            },
          });
          result.imported++;
        } catch (err) {
          console.error(`[inbox] Failed to import UID ${msg.uid}:`, err);
          result.errors++;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return result;
}

/**
 * Fetch the full source of one email by UID — used when displaying detail view
 * if we need attachments or original HTML beyond what's cached in DB.
 * For v1 we serve everything from DB cache, so this is unused. Kept for future use.
 */
export async function fetchOriginalSource(uid: number): Promise<Buffer | null> {
  const cfg = readImapConfig();
  if (!cfg) return null;
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      return msg?.source ? (msg.source as Buffer) : null;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
