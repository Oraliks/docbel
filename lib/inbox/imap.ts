import { ImapFlow, ListResponse } from "imapflow";
import { simpleParser, ParsedMail, AddressObject } from "mailparser";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface ImapConfig {
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

function newClient(cfg: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  });
}

export type Folder = "INBOX" | "SENT" | "SPAM" | "ARCHIVE" | "TRASH";

interface FolderMap {
  INBOX: string;
  SENT: string | null;
  SPAM: string | null;
  ARCHIVE: string | null;
  TRASH: string | null;
}

/**
 * Resolve IMAP folder paths via SPECIAL-USE attributes (RFC 6154).
 * Falls back to common names if SPECIAL-USE is not advertised.
 */
async function resolveFolders(client: ImapFlow): Promise<FolderMap> {
  const list: ListResponse[] = await client.list();
  const bySpecial = (use: string) => list.find((f) => f.specialUse === use)?.path;
  const byName = (...names: string[]) =>
    list.find((f) => names.some((n) => f.path === n || f.name === n))?.path;

  return {
    INBOX: "INBOX",
    SENT:
      bySpecial("\\Sent") ||
      byName(
        "Éléments envoyés", "Eléments envoyés", "Envoyés",
        "Sent", "Sent Items", "INBOX.Sent"
      ) ||
      null,
    SPAM:
      bySpecial("\\Junk") ||
      byName(
        "Courrier indésirable", "Indésirables",
        "Junk", "Spam", "INBOX.Junk", "INBOX.Spam"
      ) ||
      null,
    // OVH Pro Mail doesn't ship an Archive folder by default. We auto-create
    // one the first time the admin archives something (see ensureArchiveFolder).
    ARCHIVE:
      bySpecial("\\Archive") ||
      byName("Archive", "Archives", "INBOX.Archive") ||
      null,
    TRASH:
      bySpecial("\\Trash") ||
      byName(
        "Éléments supprimés", "Eléments supprimés",
        "Corbeille",
        "Trash", "Deleted Items", "INBOX.Trash"
      ) ||
      null,
  };
}

/**
 * Lazily create the Archive folder if the IMAP server doesn't have one
 * (OVH Pro Mail). We pick "Archive" as the canonical name. Returns the
 * created (or already-existing) folder path.
 */
async function ensureArchiveFolder(client: ImapFlow, current: FolderMap): Promise<string> {
  if (current.ARCHIVE) return current.ARCHIVE;
  const path = "Archive";
  try {
    await client.mailboxCreate(path);
  } catch (err) {
    // ALREADYEXISTS or similar — non-fatal
    console.warn("[inbox] mailboxCreate Archive:", err instanceof Error ? err.message : err);
  }
  return path;
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

export interface SyncResult {
  imported: number;
  updated: number;
  deleted: number;
  errors: number;
  perFolder: Record<Folder, { imported: number; updated: number; deleted: number; errors: number; skipped?: boolean }>;
}

/**
 * Sync one IMAP folder into DB.
 *
 * Strategy: server is authoritative.
 *  1. Fetch metadata (uid + flags) for every message in the folder.
 *  2. Compare with DB:
 *     - on server, not in DB: fetch full source, parse, insert.
 *     - in DB, not on server: delete from DB (was deleted server-side).
 *     - in both: reconcile isRead with server's \Seen flag.
 */
async function syncFolder(
  client: ImapFlow,
  folderPath: string,
  dbFolder: Folder
): Promise<SyncResult["perFolder"]["INBOX"]> {
  const result = { imported: 0, updated: 0, deleted: 0, errors: 0 };
  const lock = await client.getMailboxLock(folderPath);
  try {
    const mailbox = client.mailbox;
    const uidValidity =
      mailbox && typeof mailbox === "object" && "uidValidity" in mailbox
        ? String(mailbox.uidValidity)
        : null;

    // 1. Server state — metadata only (cheap)
    const serverMeta = new Map<number, { isSeen: boolean }>();
    const exists =
      mailbox && typeof mailbox === "object" && "exists" in mailbox && typeof mailbox.exists === "number"
        ? mailbox.exists
        : 0;
    if (exists > 0) {
      for await (const msg of client.fetch(
        "1:*",
        { uid: true, flags: true },
        { uid: false }
      )) {
        const isSeen = msg.flags?.has("\\Seen") || false;
        serverMeta.set(msg.uid, { isSeen });
      }
    }

    // 2. DB state
    const dbRows = await prisma.inboxEmail.findMany({
      where: { folder: dbFolder },
      select: { id: true, uid: true, isRead: true },
    });
    const dbByUid = new Map(dbRows.map((r) => [r.uid, r]));

    // 3. Deletions: DB rows whose UID is no longer on server
    const toDelete = dbRows.filter((r) => !serverMeta.has(r.uid)).map((r) => r.id);
    if (toDelete.length > 0) {
      const del = await prisma.inboxEmail.deleteMany({ where: { id: { in: toDelete } } });
      result.deleted = del.count;
    }

    // 4. Reconcile read flags for emails present on both sides
    for (const [uid, srv] of serverMeta) {
      const db = dbByUid.get(uid);
      if (db && db.isRead !== srv.isSeen) {
        await prisma.inboxEmail.update({
          where: { id: db.id },
          data: { isRead: srv.isSeen },
        });
        result.updated++;
      }
    }

    // 5. New emails: on server, not in DB → fetch full source + insert
    const newUids = [...serverMeta.keys()].filter((uid) => !dbByUid.has(uid));
    if (newUids.length > 0) {
      // Fetch in chunks to avoid huge memory spikes
      const chunkSize = 50;
      for (let i = 0; i < newUids.length; i += chunkSize) {
        const chunk = newUids.slice(i, i + chunkSize);
        for await (const msg of client.fetch(
          chunk,
          { uid: true, source: true, internalDate: true, flags: true },
          { uid: true }
        )) {
          try {
            const parsed = await simpleParser(msg.source as Buffer);
            const from = flattenAddress(parsed.from);
            const replyTo = flattenAddress(parsed.replyTo);
            const to = flattenAddressList(parsed.to);
            const cc = flattenAddressList(parsed.cc);
            const attachments = extractAttachmentMeta(parsed);
            const isSeen = msg.flags?.has("\\Seen") || false;

            await prisma.inboxEmail.create({
              data: {
                folder: dbFolder,
                uid: msg.uid,
                uidValidity,
                messageId: parsed.messageId || null,
                inReplyTo: parsed.inReplyTo || null,
                fromAddress: from?.address || "unknown@unknown",
                fromName: from?.name || null,
                replyToAddress: replyTo?.address || null,
                replyToName: replyTo?.name || null,
                toAddresses: JSON.stringify(to),
                ccAddresses: JSON.stringify(cc),
                subject: parsed.subject || "",
                textBody: parsed.text || "",
                htmlBody: typeof parsed.html === "string" ? parsed.html : null,
                attachments: attachments as unknown as Prisma.InputJsonValue,
                receivedAt: parsed.date || msg.internalDate || new Date(),
                isRead: isSeen,
              },
            });
            result.imported++;
          } catch (err) {
            console.error(`[inbox] failed to import ${dbFolder} UID ${msg.uid}:`, err);
            result.errors++;
          }
        }
      }
    }
  } finally {
    lock.release();
  }
  return result;
}

/**
 * Full sync: connect once, sync INBOX + Sent + Spam + Archive + Trash.
 */
export async function syncAllFolders(): Promise<SyncResult> {
  const cfg = readImapConfig();
  if (!cfg) throw new Error("IMAP non configuré (CONTACT_IMAP_* manquants)");

  const empty = { imported: 0, updated: 0, deleted: 0, errors: 0, skipped: true };
  const result: SyncResult = {
    imported: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    perFolder: {
      INBOX: { ...empty, skipped: false },
      SENT: { ...empty },
      SPAM: { ...empty },
      ARCHIVE: { ...empty },
      TRASH: { ...empty },
    },
  };

  const client = newClient(cfg);
  await client.connect();
  try {
    const folders = await resolveFolders(client);

    const order: Array<[Folder, string | null]> = [
      ["INBOX", folders.INBOX],
      ["SENT", folders.SENT],
      ["SPAM", folders.SPAM],
      ["ARCHIVE", folders.ARCHIVE],
      ["TRASH", folders.TRASH],
    ];

    for (const [name, path] of order) {
      if (!path) continue;
      try {
        const r = await syncFolder(client, path, name);
        result.perFolder[name] = { ...r, skipped: false };
        result.imported += r.imported;
        result.updated += r.updated;
        result.deleted += r.deleted;
        result.errors += r.errors;
      } catch (err) {
        console.error(`[inbox] folder ${name} (${path}) failed:`, err);
        result.perFolder[name] = { imported: 0, updated: 0, deleted: 0, errors: 1, skipped: false };
        result.errors++;
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return result;
}

// =============================================================================
// Site → server actions (called from API routes when admin acts in the UI).
// All of these update the IMAP server first; DB is updated by caller after.
// =============================================================================

export async function setReadFlag(folder: Folder, uid: number, isRead: boolean): Promise<void> {
  const cfg = readImapConfig();
  if (!cfg) throw new Error("IMAP non configuré");
  const client = newClient(cfg);
  await client.connect();
  try {
    const folders = await resolveFolders(client);
    const path = folders[folder];
    if (!path) throw new Error(`Dossier ${folder} introuvable`);
    const lock = await client.getMailboxLock(path);
    try {
      if (isRead) {
        await client.messageFlagsAdd({ uid: String(uid) }, ["\\Seen"], { uid: true });
      } else {
        await client.messageFlagsRemove({ uid: String(uid) }, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function moveMessage(fromFolder: Folder, uid: number, toFolder: Folder): Promise<void> {
  const cfg = readImapConfig();
  if (!cfg) throw new Error("IMAP non configuré");
  const client = newClient(cfg);
  await client.connect();
  try {
    const folders = await resolveFolders(client);
    const fromPath = folders[fromFolder];
    if (!fromPath) throw new Error(`Dossier source ${fromFolder} introuvable`);

    let toPath = folders[toFolder];
    // OVH Pro Mail doesn't have Archive by default — auto-create it on demand.
    if (!toPath && toFolder === "ARCHIVE") {
      toPath = await ensureArchiveFolder(client, folders);
    }
    if (!toPath) throw new Error(`Dossier destination ${toFolder} introuvable`);

    const lock = await client.getMailboxLock(fromPath);
    try {
      await client.messageMove({ uid: String(uid) }, toPath, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function deleteMessage(folder: Folder, uid: number): Promise<void> {
  const cfg = readImapConfig();
  if (!cfg) throw new Error("IMAP non configuré");
  const client = newClient(cfg);
  await client.connect();
  try {
    const folders = await resolveFolders(client);
    const path = folders[folder];
    if (!path) throw new Error(`Dossier ${folder} introuvable`);
    const lock = await client.getMailboxLock(path);
    try {
      await client.messageDelete({ uid: String(uid) }, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Append a sent email to the IMAP Sent folder. Used right after Resend send
 * so that replies sent from the website appear in OVH webmail's Sent folder
 * and in /admin/messagerie SENT tab.
 */
export async function appendToSent(rfc822: string): Promise<{ uid: number | null }> {
  const cfg = readImapConfig();
  if (!cfg) throw new Error("IMAP non configuré");
  const client = newClient(cfg);
  await client.connect();
  try {
    const folders = await resolveFolders(client);
    const sent = folders.SENT;
    if (!sent) {
      console.warn("[inbox] no SENT folder detected — skipping APPEND");
      return { uid: null };
    }
    const res = await client.append(sent, rfc822, ["\\Seen"]);
    const uid = res && typeof res === "object" && "uid" in res ? (res.uid as number) : null;
    return { uid };
  } finally {
    await client.logout().catch(() => {});
  }
}
