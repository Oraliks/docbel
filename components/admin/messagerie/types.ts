export type Folder = "INBOX" | "SENT" | "SPAM" | "ARCHIVE" | "TRASH";

export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailListItem {
  id: string;
  folder: Folder;
  uid: number;
  fromAddress: string;
  fromName: string | null;
  replyToAddress: string | null;
  toAddresses: string;
  subject: string;
  textBody: string;
  isRead: boolean;
  isFlagged: boolean;
  receivedAt: string;
  attachments: AttachmentMeta[];
  messageId: string | null;
  inReplyTo?: string | null;
  isReplied: boolean;
  threadSize?: number;
}

export interface EmailFull extends EmailListItem {
  htmlBody: string | null;
  inReplyTo: string | null;
  replyToName: string | null;
  ccAddresses: string;
  thread?: ThreadEmail[];
}

export interface ThreadEmail {
  id: string;
  folder: Folder;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string;
  subject: string;
  textBody: string;
  htmlBody: string | null;
  receivedAt: string;
  attachments: AttachmentMeta[];
  messageId: string | null;
  inReplyTo: string | null;
  isRead: boolean;
  isFlagged: boolean;
}

export interface FolderStats {
  counts: Record<Folder, number>;
  unreadInbox: number;
}

export interface SyncResult {
  imported: number;
  updated: number;
  deleted: number;
  errors: number;
  perFolder: Record<Folder, { imported: number; updated: number; deleted: number; errors: number; skipped?: boolean }>;
}
