"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  Archive,
  Download,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Grid,
  List as ListIcon,
  Plus,
  Upload,
  Lock,
  Calendar,
  HardDrive,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TypeToConfirmField, typeToConfirmMatches } from "@/components/ui/type-to-confirm-field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { OfficePreview } from "./office-preview";

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  fileType?: string;
  size?: number;
  parentId?: string;
  isPrivate: boolean;
  filePath?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  children?: FileItem[];
  usage?: { pageSlug: string; context?: string }[];
}

export function FileManager() {
  const t = useTranslations("public.shared");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: "Root" }]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [viewMode, setViewMode] = useState<"public" | "private">("public");

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [usageWarning, setUsageWarning] = useState<{
    fileId: string;
    fileName: string;
    fileType?: string;
    usage: {
      id: string;
      pageId?: string | null;
      pageSlug: string;
      context?: string | null;
      page?: {
        id: string;
        title: string;
        slug: string;
        status: string;
        deleted: boolean;
        ogImage?: string | null;
      } | null;
    }[];
  } | null>(null);
  const [allFolders, setAllFolders] = useState<FileItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderIsPrivate, setNewFolderIsPrivate] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [privacyWarning, setPrivacyWarning] = useState<{
    fileId: string;
    fileName: string;
    currentPrivacy: boolean;
    newPrivacy: boolean;
    parentPrivacy: boolean | null;
    folderId: string | null;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    fileId: string;
    fileName: string;
    type: "file" | "folder";
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  // Reset du champ type-to-confirm à chaque changement de cible de suppression.
  useEffect(() => {
    setDeleteTyped("");
  }, [deleteConfirmation]);
  const [batchPrivacyWarning, setBatchPrivacyWarning] = useState<{
    fileIds: string[];
    newPrivacy: boolean;
  } | null>(null);
  const [draggedFileIds, setDraggedFileIds] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingToFolder, setMovingToFolder] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "size" | "createdAt" | "updatedAt" | "type">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [quota, setQuota] = useState<{ used: number; quota: number } | null>(null);

  const searchMode = debouncedSearch.length >= 2;

  const loadAllFolders = async () => {
    try {
      setLoadingFolders(true);
      const res = await fetch("/api/files?all=true&type=folder");
      if (!res.ok) throw new Error("Failed to fetch folders");
      const data: FileItem[] = await res.json();
      setAllFolders(data);
    } catch (error) {
      console.error("Error fetching folders:", error);
    } finally {
      setLoadingFolders(false);
    }
  };

  const fetchFiles = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.append("isPrivate", viewMode === "private" ? "true" : "false");
      if (searchMode) {
        query.append("q", debouncedSearch);
      } else if (currentFolderId) {
        query.append("parentId", currentFolderId);
      }

      const res = await fetch(`/api/files?${query}`, { signal });
      if (!res.ok) throw new Error("Failed to fetch files");

      const data = await res.json();
      setFiles(data);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce the search query
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Load files
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await fetchFiles(controller.signal);
      if (debouncedSearch.length >= 2) await loadAllFolders();
    };
    void run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, viewMode, debouncedSearch]);

  // Quota indicator. Refreshed on view-change so the bar reflects recent uploads.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/files/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setQuota({ used: d.used, quota: d.quota });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [files]);

  const handleNavigate = (file: FileItem) => {
    if (file.type !== "folder") return;
    if (searchMode) {
      const byId = new Map(allFolders.map((f) => [f.id, f]));
      const chain: FileItem[] = [];
      let cursor: FileItem | undefined = file;
      while (cursor) {
        chain.unshift(cursor);
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
      }
      setSearchQuery("");
      setDebouncedSearch("");
      setBreadcrumbs([
        { id: null, name: "Root" },
        ...chain.map((f) => ({ id: f.id, name: f.name })),
      ]);
      setCurrentFolderId(file.id);
    } else {
      setCurrentFolderId(file.id);
      setBreadcrumbs([...breadcrumbs, { id: file.id, name: file.name }]);
    }
  };

  const handleBreadcrumb = (id: string | null, index: number) => {
    setCurrentFolderId(id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const getFileUrl = (file: FileItem, opts?: { download?: boolean }) => {
    if (file.type !== "file") return null;
    return opts?.download
      ? `/api/files/${file.id}/download?download=1`
      : `/api/files/${file.id}/download`;
  };

  const handleDownload = async (file: FileItem) => {
    const url = getFileUrl(file, { download: true });
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyUrl = async (file: FileItem) => {
    const url = getFileUrl(file);
    if (url) {
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      toast.success(t("fmUrlCopied"));
    }
  };

  const handleRename = async (file: FileItem) => {
    const trimmed = renamingName.trim();
    if (!trimmed || trimmed === file.name) {
      setRenaming(null);
      return;
    }

    const oldName = file.name;
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, name: trimmed } : f))
    );
    setRenaming(null);

    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      toast.success(t("fmRenamed", { from: oldName, to: trimmed }));
    } catch (error) {
      console.error("Error renaming:", error);
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, name: oldName } : f))
      );
      toast.error(t("fmRenameFailed"));
    }
  };

  const handleDelete = (file: FileItem) => {
    setDeleteConfirmation({
      fileId: file.id,
      fileName: file.name,
      type: file.type,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      setDeleting(deleteConfirmation.fileId);
      const res = await fetch(`/api/files/${deleteConfirmation.fileId}`, {
        method: "DELETE",
      });

      if (res.status === 409) {
        const data = await res.json();
        if (data.usage) {
          const fileMeta = files.find((f) => f.id === deleteConfirmation.fileId);
          setUsageWarning({
            fileId: deleteConfirmation.fileId,
            fileName: deleteConfirmation.fileName,
            fileType: fileMeta?.fileType,
            usage: data.usage,
          });
          toast.error(t("fmFileInUse"), {
            description: t("fmFileInUseDesc", {
              name: deleteConfirmation.fileName,
              count: data.usage?.length || 1,
            }),
          });
        } else {
          toast.error(t("fmFolderNotEmpty"), {
            description: data.message || t("fmFolderNotEmptyDesc"),
          });
        }
        setDeleteConfirmation(null);
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete");
      }

      const typeText =
        deleteConfirmation.type === "folder" ? t("fmTheFolder") : t("fmTheFile");
      toast.success(t("fmDeleteSuccess"), {
        description: t("fmDeleteSuccessDesc", {
          type: typeText,
          name: deleteConfirmation.fileName,
        }),
      });
      setDeleteConfirmation(null);
      fetchFiles();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(t("fmDeleteError"), {
        description:
          error instanceof Error
            ? error.message
            : t("fmDeleteErrorDesc"),
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleTogglePrivacy = async (file: FileItem) => {
    const newIsPrivate = !file.isPrivate;

    // Trouver le dossier parent
    const parentFile = currentFolderId ? files.find(f => f.id === currentFolderId) : null;
    const parentPrivacy = parentFile?.isPrivate ?? null;

    // Vérifier s'il y a une différence de privacy entre le fichier et son dossier parent
    if (parentPrivacy !== null && parentPrivacy !== newIsPrivate) {
      setPrivacyWarning({
        fileId: file.id,
        fileName: file.name,
        currentPrivacy: file.isPrivate,
        newPrivacy: newIsPrivate,
        parentPrivacy,
        folderId: currentFolderId,
      });
      return;
    }

    // Sinon, appliquer le changement directement
    await applyPrivacyChange(file.id, file.name, file.type, newIsPrivate);
  };

  const applyPrivacyChange = async (
    fileId: string,
    fileName: string,
    fileType: string,
    newIsPrivate: boolean,
    options?: { silent?: boolean; refetch?: boolean }
  ): Promise<boolean> => {
    const targetView = newIsPrivate ? "private" : "public";
    const willLeaveView = viewMode !== targetView;
    const removed = fileType === "file" && willLeaveView
      ? files.find((f) => f.id === fileId)
      : null;

    if (removed) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    }

    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: newIsPrivate }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || t("fmVisibilityFailed"));
        if (removed) setFiles((prev) => [...prev, removed]);
        return false;
      }

      if (fileType === "folder") {
        const updateChildrenRes = await fetch(`/api/files/bulk-update`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: fileId, isPrivate: newIsPrivate }),
        });
        if (!updateChildrenRes.ok) {
          toast.warning(t("fmWarning"), {
            description: t("fmChildrenNotUpdated"),
          });
        }
      } else if (!willLeaveView) {
        // File stays in view; reflect new privacy locally
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, isPrivate: newIsPrivate } : f))
        );
      }

      if (!options?.silent) {
        toast.success(
          newIsPrivate
            ? t("fmNowPrivate", { name: fileName })
            : t("fmNowPublic", { name: fileName }),
          willLeaveView
            ? {
                action: {
                  label: targetView === "private" ? t("fmSeePrivate") : t("fmSeePublic"),
                  onClick: () => setViewMode(targetView),
                },
              }
            : undefined
        );
      }

      if (fileType === "folder" && options?.refetch !== false) {
        await fetchFiles();
      }
      return true;
    } catch (error) {
      console.error("Error toggling privacy:", error);
      if (removed) setFiles((prev) => [...prev, removed]);
      return false;
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    try {
      const results = await Promise.allSettled(
        list.map((file) => {
          const formData = new FormData();
          formData.append("file", file);
          if (currentFolderId) formData.append("parentId", currentFolderId);
          formData.append("isPrivate", (viewMode === "private").toString());
          return fetch("/api/files/upload", { method: "POST", body: formData }).then(
            async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Upload failed for ${file.name}`);
              }
              return file.name;
            }
          );
        })
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(t("fmUploadSuccess", { count: successCount }));
      }
      if (failureCount > 0) {
        const firstError = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        toast.error(t("fmUploadFailure", { count: failureCount }), {
          description: firstError?.reason instanceof Error ? firstError.reason.message : undefined,
        });
      }

      await fetchFiles();
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;
    try {
      await uploadFiles(uploadedFiles);
    } finally {
      const fileInput = document.getElementById("file-upload") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedFileIds.size === 0) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleFileDragStart = (fileId: string, e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (selectedFiles.has(fileId)) {
      setDraggedFileIds(new Set(selectedFiles));
    } else {
      setDraggedFileIds(new Set([fileId]));
    }
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (draggedFileIds.size > 0) {
      await handleMoveFiles(Array.from(draggedFileIds), currentFolderId);
      return;
    }

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    await uploadFiles(droppedFiles);
  };

  const handleFolderDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (draggedFileIds.size === 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleFolderDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    folderId: string
  ) => {
    if (draggedFileIds.size === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (draggedFileIds.has(folderId)) {
      toast.error(t("fmCannotDropOnItself"));
      return;
    }
    await handleMoveFiles(Array.from(draggedFileIds), folderId);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedFiles.size === 0) return;
    setDeleteConfirmation({
      fileId: Array.from(selectedFiles)[0],
      fileName: t("fmNFiles", { count: selectedFiles.size }),
      type: selectedFiles.size === 1 && files.find(f => f.id === Array.from(selectedFiles)[0])?.type === "folder" ? "folder" : "file",
    });
  };

  const confirmBatchDelete = async () => {
    if (selectedFiles.size === 0) return;

    setBatchDeleting(true);
    try {
      const ids = Array.from(selectedFiles);
      const res = await fetch("/api/files/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));

      const deleted: number = data?.deleted ?? 0;
      const blocked: { name: string; reason: string }[] = data?.blocked ?? [];

      if (deleted > 0) {
        toast.success(t("fmDeleteSuccess"), {
          description: t("fmDeletedCount", { count: deleted }),
        });
      }
      if (blocked.length > 0) {
        toast.error(t("fmNotDeletedCount", { count: blocked.length }), {
          description: blocked
            .slice(0, 3)
            .map((b) => `${b.name}: ${b.reason}`)
            .join(" · "),
        });
      }

      setSelectedFiles(new Set());
      setDeleteConfirmation(null);
      await fetchFiles();
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleBatchPrivacy = (newIsPrivate: boolean) => {
    if (selectedFiles.size === 0) return;
    setBatchPrivacyWarning({
      fileIds: Array.from(selectedFiles),
      newPrivacy: newIsPrivate,
    });
  };

  const confirmBatchPrivacy = async () => {
    if (!batchPrivacyWarning) return;
    const { fileIds, newPrivacy } = batchPrivacyWarning;
    const filesById = new Map(files.map((f) => [f.id, f]));

    try {
      const res = await fetch("/api/files/bulk-privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fileIds, isPrivate: newPrivacy }),
      });
      if (!res.ok) {
        toast.error(t("fmBulkVisibilityFailed"));
        return;
      }

      // Folders selected: also recurse into their content.
      const folderIds = fileIds.filter(
        (id) => filesById.get(id)?.type === "folder"
      );
      await Promise.all(
        folderIds.map((fid) =>
          fetch("/api/files/bulk-update", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentId: fid, isPrivate: newPrivacy }),
          })
        )
      );

      const targetView = newPrivacy ? "private" : "public";
      toast.success(t("fmFilesUpdated", { count: fileIds.length }), {
        action: {
          label: targetView === "private" ? t("fmSeePrivate") : t("fmSeePublic"),
          onClick: () => setViewMode(targetView),
        },
      });
    } finally {
      setSelectedFiles(new Set());
      setBatchPrivacyWarning(null);
      await fetchFiles();
    }
  };

  const handleMoveFiles = async (fileIds: string[], targetFolderId: string | null) => {
    if (fileIds.length === 0) return;

    if (currentFolderId === targetFolderId) {
      toast.error(t("fmAlreadyInFolder"));
      return;
    }

    const filesById = new Map(files.map((f) => [f.id, f]));
    const movingSet = new Set(fileIds);
    const removed = files.filter((f) => movingSet.has(f.id));

    setIsMoving(true);
    setFiles((prev) => prev.filter((f) => !movingSet.has(f.id)));
    setSelectedFiles(new Set());
    setDraggedFileIds(new Set());

    try {
      type MoveOutcome = {
        fileId: string;
        original: FileItem | undefined;
        updatedFile: FileItem;
      };
      const results: PromiseSettledResult<MoveOutcome>[] = await Promise.allSettled(
        fileIds.map(async (fileId): Promise<MoveOutcome> => {
          const res = await fetch(`/api/files/${fileId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentId: targetFolderId }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Move failed");
          }
          const updatedFile: FileItem = await res.json();
          return { fileId, original: filesById.get(fileId), updatedFile };
        })
      );

      const fulfilled = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : []
      );
      const failureCount = results.length - fulfilled.length;
      const renamed = fulfilled
        .filter((r) => r.original && r.original.name !== r.updatedFile.name)
        .map((r) => `${r.original?.name} → ${r.updatedFile.name}`);

      if (fulfilled.length > 0) {
        const description =
          renamed.length > 0
            ? t("fmMovedWithRename", {
                count: fulfilled.length,
                renamed: renamed.join(", "),
              })
            : t("fmMovedCount", { count: fulfilled.length });
        toast.success(description);
      }
      if (failureCount > 0) {
        toast.error(t("fmMoveFailedCount", { count: failureCount }));
        // Restore items that failed to move
        const failedIds = new Set(
          results.flatMap((r, idx) =>
            r.status === "rejected" ? [fileIds[idx]] : []
          )
        );
        const restored = removed.filter((f) => failedIds.has(f.id));
        if (restored.length > 0) {
          setFiles((prev) => [...prev, ...restored]);
        }
      }
    } finally {
      setIsMoving(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch("/api/files/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName,
          parentId: currentFolderId,
          isPrivate: newFolderIsPrivate,
        }),
      });

      if (!res.ok) throw new Error("Failed to create folder");

      toast.success(t("fmFolderCreated", { name: newFolderName }));

      setNewFolderName("");
      setShowNewFolder(false);
      setNewFolderIsPrivate(false);
      fetchFiles();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error(t("fmFolderCreateFailed"));
    }
  };

  const filteredFiles = (() => {
    const base = searchMode
      ? files
      : files.filter((f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    return [...base].sort((a, b) => {
      // Folders always come before files in either direction — matches the
      // server-side default ordering and avoids confusing mixed lists.
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      let cmp = 0;
      switch (sortBy) {
        case "size":
          cmp = (a.size ?? 0) - (b.size ?? 0);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "type":
          cmp = (a.fileType ?? "").localeCompare(b.fileType ?? "");
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  })();

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortIcon = (col: typeof sortBy) =>
    sortBy === col ? (
      sortDir === "asc" ? (
        <ChevronUp className="ml-1 w-4 h-4" />
      ) : (
        <ChevronDown className="ml-1 w-4 h-4" />
      )
    ) : (
      <ChevronDown className="ml-1 w-4 h-4 opacity-30" />
    );

  const folderPathById = (() => {
    const byId = new Map(allFolders.map((f) => [f.id, f]));
    const cache = new Map<string, string>();
    const compute = (id: string | null | undefined): string => {
      if (!id) return "Root";
      const cached = cache.get(id);
      if (cached) return cached;
      const node = byId.get(id);
      if (!node) return "Root";
      const result = `${compute(node.parentId)} / ${node.name}`;
      cache.set(id, result);
      return result;
    };
    return compute;
  })();

  const getFileIcon = (fileType?: string) => {
    const iconClass = "w-5 h-5";
    switch (fileType) {
      case "pdf":
        return <FileText className={`${iconClass} text-red-500`} />;
      case "docx":
        return <FileText className={`${iconClass} text-blue-500`} />;
      case "xlsx":
        return <FileText className={`${iconClass} text-green-500`} />;
      case "image":
        return <FileImage className={`${iconClass} text-purple-500`} />;
      case "video":
        return <FileVideo className={`${iconClass} text-pink-500`} />;
      case "archive":
        return <Archive className={`${iconClass} text-yellow-500`} />;
      default:
        return <File className={`${iconClass} text-muted-foreground`} />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header with Tabs */}
      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as "public" | "private")}
        className="w-full"
      >
        <TabsList className="m-0 rounded-none w-full justify-start p-0 h-auto bg-transparent border-b border-border">
          <TabsTrigger
            value="public"
            className={`rounded-none ${
              viewMode === "public"
                ? "border-b-2 border-emerald-500 text-foreground"
                : "text-muted-foreground"
            }`}
          >
            🌐 {t("fmPublicFiles")}
          </TabsTrigger>
          <TabsTrigger
            value="private"
            className={`rounded-none ${
              viewMode === "private"
                ? "border-b-2 border-orange-500 text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Lock className="w-3 h-3 mr-2" />
            {t("fmPrivateFiles")}
          </TabsTrigger>
        </TabsList>

        <div className="px-5 py-4 flex gap-2 items-center">
          <Input
            placeholder={t("fmSearchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 h-8"
          />

          <input
            id="file-upload"
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />

          <Button
            onClick={() => document.getElementById("file-upload")?.click()}
            size="sm"
            disabled={uploading}
          >
            <Upload className="w-3 h-3 mr-1" />
            {uploading ? t("fmUploading") : t("fmUpload")}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewFolder(true)}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t("fmFolder")}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLayout(layout === "grid" ? "list" : "grid")}
          >
            {layout === "grid" ? (
              <ListIcon className="w-4 h-4" />
            ) : (
              <Grid className="w-4 h-4" />
            )}
          </Button>

          {quota && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {formatFileSize(quota.used)} / {formatFileSize(quota.quota)}
              </span>
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    quota.used / quota.quota > 0.9
                      ? "bg-red-500"
                      : quota.used / quota.quota > 0.7
                      ? "bg-orange-500"
                      : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (quota.used / quota.quota) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Tabs>

      {/* Breadcrumbs / Search context */}
      <div className="px-5 py-2 flex items-center gap-1 border-b border-border overflow-auto">
        {searchMode ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">{t("fmResultsFor")}</span>
            <strong>&quot;{debouncedSearch}&quot;</strong>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
              }}
              className="text-xs h-auto px-2 py-1"
            >
              {t("fmClear")}
            </Button>
          </div>
        ) : (
          breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBreadcrumb(crumb.id, idx)}
                className="text-xs h-auto px-2 py-1"
              >
                {crumb.id === null ? t("fmRoot") : crumb.name}
              </Button>
              {idx < breadcrumbs.length - 1 && (
                <ChevronRight className="w-3 h-3 mx-1" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Batch Actions Bar */}
      {selectedFiles.size > 0 && (
        <div className="px-5 py-3 flex gap-2 items-center bg-card border-b border-border">
          <span className="text-[13px] font-medium">
            {t("fmSelectedCount", { count: selectedFiles.size })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBatchPrivacy(viewMode === "private" ? false : true)}
            className="text-xs"
          >
            <Lock className="w-3 h-3 mr-1" />
            {viewMode === "private" ? t("fmMakePublic") : t("fmMakePrivate")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMoveDialog(true)}
            disabled={isMoving}
            className="text-xs"
          >
            <ChevronRight className="w-3 h-3 mr-1" />
            {t("fmMoveTo")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            className="text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {t("fmDelete")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedFiles(new Set())}
            className="text-xs ml-auto"
          >
            {t("fmDeselectAll")}
          </Button>
        </div>
      )}

      {/* Files Grid/List */}
      <div
        className={`flex-1 overflow-y-auto px-5 py-4 transition-all ${
          dragOver ? "bg-card border-2 border-dashed border-blue-500" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="text-center p-10">{t("fmLoading")}</div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center p-10">{t("fmNoFiles")}</div>
        ) : layout === "grid" ? (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
            {filteredFiles.map((file) => (
              <ContextMenu key={file.id}>
                <ContextMenuTrigger>
                  <div
                    draggable
                    className={`relative p-3 rounded-lg cursor-grab transition-all border-2 ${
                      selectedFiles.has(file.id) ? "bg-muted" : "bg-card hover:bg-muted"
                    } ${
                      draggedFileIds.has(file.id)
                        ? "border-blue-500 opacity-50"
                        : selectedFiles.has(file.id)
                        ? "border-blue-500"
                        : file.isPrivate
                        ? "border-orange-500"
                        : "border-border"
                    }`}
                    onDragStart={(e) => handleFileDragStart(file.id, e)}
                    onDragEnd={() => setDraggedFileIds(new Set())}
                    onDragOver={
                      file.type === "folder" ? handleFolderDragOver : undefined
                    }
                    onDrop={
                      file.type === "folder"
                        ? (e) => handleFolderDrop(e, file.id)
                        : undefined
                    }
                    onClick={() => {
                      if (file.type === "folder") {
                        handleNavigate(file);
                      }
                    }}
                  >
                    <div
                      className="absolute top-2 right-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => {
                          const newSelection = new Set(selectedFiles);
                          if (newSelection.has(file.id)) {
                            newSelection.delete(file.id);
                          } else {
                            newSelection.add(file.id);
                          }
                          setSelectedFiles(newSelection);
                        }}
                      />
                    </div>
                    <div className="flex gap-2 mb-2 items-center">
                      {file.type === "folder" ? (
                        <Folder className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        getFileIcon(file.fileType)
                      )}
                    </div>
                    <p className="text-xs font-medium mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {file.name}
                    </p>
                    {searchMode && (
                      <p
                        className="text-[10px] text-muted-foreground mb-1 overflow-hidden text-ellipsis whitespace-nowrap"
                        title={folderPathById(file.parentId)}
                      >
                        {folderPathById(file.parentId)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2 items-center">
                      <Badge
                        variant={file.isPrivate ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {file.isPrivate ? `🔒 ${t("fmPrivate")}` : `🌐 ${t("fmPublic")}`}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-2 text-[8px] leading-tight text-muted-foreground">
                      {file.size && (
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(file.size)}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(file.createdAt).split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {file.type === "file" && (
                    <>
                      <ContextMenuItem onClick={() => handleDownload(file)}>
                        <Download className="w-3 h-3 mr-2" />
                        {t("fmDownload")}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setPreviewFileId(file.id)}>
                        👁️
                        {t("fmPreview")}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleCopyUrl(file)}>
                        🔗
                        {t("fmCopyUrl")}
                      </ContextMenuItem>
                    </>
                  )}
                  <ContextMenuItem
                    onClick={() => {
                      setRenaming(file.id);
                      setRenamingName(file.name);
                    }}
                  >
                    <Edit className="w-3 h-3 mr-2" />
                    {t("fmRename")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleTogglePrivacy(file)}>
                    <Lock className="w-3 h-3 mr-2" />
                    {file.isPrivate ? t("fmMakePublic") : t("fmMakePrivate")}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => handleDelete(file)}
                    className="text-red-500"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    {t("fmDelete")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader className="bg-card">
                <TableRow className="border-border">
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={
                        filteredFiles.length > 0 &&
                        selectedFiles.size === filteredFiles.length
                      }
                      indeterminate={
                        selectedFiles.size > 0 &&
                        selectedFiles.size < filteredFiles.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("name")}
                      className="h-auto py-1 px-0 hover:bg-transparent"
                    >
                      {t("fmColName")}
                      {sortIcon("name")}
                    </Button>
                  </TableHead>
                  <TableHead>{t("fmColVisibility")}</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("type")}
                      className="h-auto py-1 px-0 hover:bg-transparent"
                    >
                      {t("fmColType")}
                      {sortIcon("type")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("size")}
                      className="h-auto py-1 px-0 hover:bg-transparent"
                    >
                      {t("fmColSize")}
                      {sortIcon("size")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("createdAt")}
                      className="h-auto py-1 px-0 hover:bg-transparent"
                    >
                      {t("fmColCreated")}
                      {sortIcon("createdAt")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort("updatedAt")}
                      className="h-auto py-1 px-0 hover:bg-transparent"
                    >
                      {t("fmColModified")}
                      {sortIcon("updatedAt")}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.map((file) => (
                  <TableRow
                    key={file.id}
                    draggable
                    className={`border-border cursor-grab transition-all ${
                      selectedFiles.has(file.id) ? "bg-muted" : ""
                    } ${draggedFileIds.has(file.id) ? "opacity-50" : ""} border-l-4 ${
                      draggedFileIds.has(file.id) || selectedFiles.has(file.id)
                        ? "border-l-blue-500"
                        : file.isPrivate
                        ? "border-l-orange-500"
                        : "border-l-emerald-500"
                    }`}
                    onDragStart={(e) => handleFileDragStart(file.id, e)}
                    onDragEnd={() => setDraggedFileIds(new Set())}
                    onDragOver={
                      file.type === "folder" ? handleFolderDragOver : undefined
                    }
                    onDrop={
                      file.type === "folder"
                        ? (e) => handleFolderDrop(e, file.id)
                        : undefined
                    }
                    onClick={() => {
                      if (file.type === "folder") {
                        handleNavigate(file);
                      }
                    }}
                  >
                    <TableCell
                      className="w-12 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => {
                          const newSelection = new Set(selectedFiles);
                          if (newSelection.has(file.id)) {
                            newSelection.delete(file.id);
                          } else {
                            newSelection.add(file.id);
                          }
                          setSelectedFiles(newSelection);
                        }}
                      />
                    </TableCell>
                    <TableCell className="flex-1">
                      <div className="flex items-center gap-2">
                        {file.type === "folder" ? (
                          <Folder className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          getFileIcon(file.fileType)
                        )}
                        <ContextMenu>
                          <ContextMenuTrigger>
                            <div className="flex flex-col leading-tight">
                              <span>{file.name}</span>
                              {searchMode && (
                                <span
                                  className="text-[10px] text-muted-foreground"
                                  title={folderPathById(file.parentId)}
                                >
                                  {folderPathById(file.parentId)}
                                </span>
                              )}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="z-50">
                            {file.type === "file" && (
                              <>
                                <ContextMenuItem onClick={() => handleDownload(file)}>
                                  <Download className="w-3 h-3 mr-2" />
                                  {t("fmDownload")}
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => setPreviewFileId(file.id)}>
                                  👁️
                                  {t("fmPreview")}
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => handleCopyUrl(file)}>
                                  🔗
                                  {t("fmCopyUrl")}
                                </ContextMenuItem>
                              </>
                            )}
                            <ContextMenuItem
                              onClick={() => {
                                setRenaming(file.id);
                                setRenamingName(file.name);
                              }}
                            >
                              <Edit className="w-3 h-3 mr-2" />
                              {t("fmRename")}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleTogglePrivacy(file)}>
                              <Lock className="w-3 h-3 mr-2" />
                              {file.isPrivate ? t("fmMakePublic") : t("fmMakePrivate")}
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => handleDelete(file)}
                              className="text-red-500"
                            >
                              <Trash2 className="w-3 h-3 mr-2" />
                              {t("fmDelete")}
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={file.isPrivate ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {file.isPrivate ? `🔒 ${t("fmPrivate")}` : `🌐 ${t("fmPublic")}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {file.type === "folder" ? t("fmTypeFolder") : file.fileType || t("fmTypeFile")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(file.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={!!renaming} onOpenChange={() => setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("fmRename")}</DialogTitle>
          </DialogHeader>
          <Input
            value={renamingName}
            onChange={(e) => setRenamingName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenaming(null)}
            >
              {t("fmCancel")}
            </Button>
            <Button
              onClick={() =>
                renaming && handleRename(files.find((f) => f.id === renaming)!)
              }
            >
              {t("fmRename")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("fmNewFolder")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder={t("fmFolderNamePlaceholder")}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 items-center">
              <span className="text-[13px] font-medium">{t("fmVisibilityLabel")}</span>
              <Button
                size="sm"
                variant={!newFolderIsPrivate ? "default" : "outline"}
                onClick={() => setNewFolderIsPrivate(false)}
                className="text-xs"
              >
                🌐 {t("fmPublic")}
              </Button>
              <Button
                size="sm"
                variant={newFolderIsPrivate ? "default" : "outline"}
                onClick={() => setNewFolderIsPrivate(true)}
                className="text-xs"
              >
                <Lock className="w-3 h-3 mr-1" />
                {t("fmPrivate")}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>
              {t("fmCancel")}
            </Button>
            <Button onClick={handleCreateFolder}>{t("fmCreate")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageWarning} onOpenChange={() => setUsageWarning(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t("fmFileInUse")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {/* File preview header */}
            {usageWarning && (
              <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/40">
                <div className="w-16 h-16 rounded overflow-hidden bg-card border border-border flex items-center justify-center flex-shrink-0">
                  {usageWarning.fileType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${usageWarning.fileId}/download`}
                      alt={usageWarning.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : usageWarning.fileType === "pdf" ? (
                    <FileText className="w-7 h-7 text-red-500" />
                  ) : (
                    getFileIcon(usageWarning.fileType)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{usageWarning.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("fmUsedOnPages", { count: usageWarning.usage.length })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 max-h-[320px] overflow-auto">
              {usageWarning?.usage.map((u) => {
                const page = u.page;
                const title = page?.title ?? u.pageSlug;
                const slug = page?.slug ?? u.pageSlug;
                const status = page?.status ?? "unknown";
                const deleted = page?.deleted ?? false;
                const statusLabel = deleted
                  ? t("fmStatusDeleted")
                  : status === "published"
                  ? t("fmStatusPublished")
                  : status === "draft"
                  ? t("fmStatusDraft")
                  : status;
                const statusClass = deleted
                  ? "bg-red-500/15 text-red-500"
                  : status === "published"
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-orange-500/15 text-orange-600";
                return (
                  <div
                    key={u.id}
                    className="flex items-start gap-3 p-3 rounded-md border border-border bg-card"
                  >
                    {/* Page thumbnail (ogImage) or icon fallback */}
                    {page?.ogImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.ogImage}
                        alt=""
                        className="w-12 h-12 rounded object-cover border border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted border border-border flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <code className="text-[11px] text-muted-foreground block truncate">
                        /{slug}
                      </code>
                      {u.context && (
                        <p className="text-xs text-muted-foreground mt-1">{u.context}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {page?.id && !deleted && (
                        <a
                          href={`/admin/pages/${page.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted text-center"
                        >
                          {t("fmEdit")}
                        </a>
                      )}
                      {page?.status === "published" && !deleted && (
                        <a
                          href={`/${slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted text-center"
                        >
                          {t("fmView")}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {t("fmUsageHint")}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setUsageWarning(null)}>{t("fmClose")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showMoveDialog}
        onOpenChange={(open) => {
          setShowMoveDialog(open);
          if (open) void loadAllFolders();
          else setMovingToFolder(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("fmMoveDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[400px] overflow-auto">
            <div className="text-[13px] font-medium pb-2 border-b border-border">
              {t("fmDestination")}
            </div>
            <Button
              variant={!movingToFolder ? "default" : "outline"}
              onClick={() => setMovingToFolder(null)}
              className="justify-start text-xs h-auto py-2"
            >
              <Folder className="w-3 h-3 mr-2" />
              {t("fmRoot")}
            </Button>
            {loadingFolders ? (
              <div className="text-xs text-muted-foreground">
                {t("fmLoadingFolders")}
              </div>
            ) : (
              (() => {
                const byId = new Map(allFolders.map((f) => [f.id, f]));
                const buildPath = (id: string): string => {
                  const node = byId.get(id);
                  if (!node) return "";
                  const parent = node.parentId ? buildPath(node.parentId) : "";
                  return parent ? `${parent} / ${node.name}` : node.name;
                };
                const excluded = new Set(selectedFiles);
                return allFolders
                  .filter((f) => !excluded.has(f.id))
                  .map((folder) => ({ folder, path: buildPath(folder.id) }))
                  .sort((a, b) => a.path.localeCompare(b.path))
                  .map(({ folder, path }) => (
                    <Button
                      key={folder.id}
                      variant={movingToFolder === folder.id ? "default" : "outline"}
                      onClick={() => setMovingToFolder(folder.id)}
                      className="justify-start text-xs h-auto py-2 whitespace-normal text-left"
                    >
                      <Folder className="w-3 h-3 mr-2 flex-shrink-0" />
                      <span>{path}</span>
                    </Button>
                  ));
              })()
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMoveDialog(false);
                setMovingToFolder(null);
              }}
            >
              {t("fmCancel")}
            </Button>
            <Button
              onClick={async () => {
                await handleMoveFiles(Array.from(selectedFiles), movingToFolder);
                setShowMoveDialog(false);
                setMovingToFolder(null);
              }}
              disabled={isMoving}
            >
              {t("fmMove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewFileId} onOpenChange={() => setPreviewFileId(null)}>
        <DialogContent className="max-h-[80vh] sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>
              {files.find((f) => f.id === previewFileId)?.name || t("fmPreview")}
            </DialogTitle>
          </DialogHeader>
          {previewFileId && (
            <div className="flex justify-center overflow-auto max-h-[70vh]">
              {(() => {
                const file = files.find((f) => f.id === previewFileId);
                if (!file) return null;

                const url = getFileUrl(file);
                if (!url) return <p>{t("fmPreviewUnavailable")}</p>;

                switch (file.fileType) {
                  case "image":
                    return (
                      // This preview URL is served by the file API and not suitable for next/image optimization.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    );
                  case "pdf":
                    return (
                      <iframe
                        src={url}
                        className="w-full h-[600px] border-0"
                        title="PDF Preview"
                      />
                    );
                  case "video":
                    return (
                      <video
                        src={url}
                        controls
                        className="max-w-full max-h-full object-contain"
                      />
                    );
                  case "docx":
                    return <OfficePreview url={url} mode="docx" />;
                  case "xlsx":
                    return <OfficePreview url={url} mode="xlsx" />;
                  case "text":
                    return (
                      <iframe
                        src={url}
                        className="w-full h-[600px] border-0 bg-card"
                        title="Text preview"
                      />
                    );
                  default:
                    return <p>{t("fmPreviewUnsupported")}</p>;
                }
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!privacyWarning} onOpenChange={() => setPrivacyWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ {t("fmVisibilityWarningTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-normal">
              {t.rich("fmVisibilityWarningBody", {
                name: privacyWarning?.fileName ?? "",
                parent: privacyWarning?.parentPrivacy ? t("fmPrivateAdj") : t("fmPublicAdj"),
                target: privacyWarning?.newPrivacy ? t("fmPrivateAdj") : t("fmPublicAdj"),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {privacyWarning?.newPrivacy
                ? t("fmVisibilityWarningPrivateHint")
                : t("fmVisibilityWarningPublicHint")}
            </p>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const warning = privacyWarning;
                  setPrivacyWarning(null);
                  if (warning) {
                    await applyPrivacyChange(
                      warning.fileId,
                      warning.fileName,
                      "file",
                      warning.newPrivacy
                    );
                  }
                }}
                className="text-sm"
              >
                ✅ {t("fmChangeOnlyThisFile")}
              </Button>

              <Button
                variant="default"
                onClick={async () => {
                  const warning = privacyWarning;
                  setPrivacyWarning(null);
                  if (!warning) return;
                  const fileOk = await applyPrivacyChange(
                    warning.fileId,
                    warning.fileName,
                    "file",
                    warning.newPrivacy,
                    { silent: true, refetch: false }
                  );
                  if (fileOk && warning.folderId) {
                    await applyPrivacyChange(
                      warning.folderId,
                      t("fmCurrentFolder"),
                      "folder",
                      warning.newPrivacy
                    );
                  } else if (fileOk) {
                    await fetchFiles();
                  }
                }}
                className="text-sm"
              >
                📁 {t("fmChangeFileAndFolder")}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setPrivacyWarning(null)}
                className="text-sm"
              >
                ❌ {t("fmCancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmation && selectedFiles.size === 0}
        onOpenChange={() => setDeleteConfirmation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ {t("fmConfirmDeleteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="m-0">
              {t.rich("fmConfirmDeleteBody", {
                type:
                  deleteConfirmation?.type === "folder"
                    ? t("fmTheFolder")
                    : t("fmTheFile"),
                name: deleteConfirmation?.fileName ?? "",
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            {deleteConfirmation?.type === "folder" && (
              <p className="m-0 text-sm text-muted-foreground">
                ⚠️ {t("fmFolderMustBeEmpty")}
              </p>
            )}

            <TypeToConfirmField
              requireText={deleteConfirmation?.fileName || t("fmConfirmWord")}
              value={deleteTyped}
              onChange={setDeleteTyped}
              disabled={deleting !== null}
            />

            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={
                  deleting !== null ||
                  !typeToConfirmMatches(deleteTyped, deleteConfirmation?.fileName || t("fmConfirmWord"))
                }
                className="text-sm"
              >
                {deleting ? t("fmDeleting") : `🗑️ ${t("fmDeletePermanently")}`}
              </Button>

              <Button
                variant="outline"
                onClick={() => setDeleteConfirmation(null)}
                disabled={deleting !== null}
                className="text-sm"
              >
                ❌ {t("fmCancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmation && selectedFiles.size > 0}
        onOpenChange={() => setDeleteConfirmation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ {t("fmConfirmBatchDeleteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="m-0">
              {t.rich("fmConfirmBatchDeleteBody", {
                count: selectedFiles.size,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              ⚠️ {t("fmIrreversible")}
            </p>

            <TypeToConfirmField
              requireText={t("fmConfirmWord")}
              value={deleteTyped}
              onChange={setDeleteTyped}
              disabled={batchDeleting}
            />

            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                onClick={confirmBatchDelete}
                disabled={batchDeleting || !typeToConfirmMatches(deleteTyped, t("fmConfirmWord"))}
                className="text-sm"
              >
                {batchDeleting ? t("fmDeleting") : `🗑️ ${t("fmDeletePermanently")}`}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmation(null);
                  setSelectedFiles(new Set());
                }}
                disabled={batchDeleting}
                className="text-sm"
              >
                ❌ {t("fmCancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!batchPrivacyWarning}
        onOpenChange={() => setBatchPrivacyWarning(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ {t("fmChangeVisibilityTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="m-0">
              {t.rich("fmConfirmBatchPrivacyBody", {
                count: selectedFiles.size,
                target: batchPrivacyWarning?.newPrivacy
                  ? t("fmPrivatePlural")
                  : t("fmPublicPlural"),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              {batchPrivacyWarning?.newPrivacy
                ? t("fmBatchPrivacyPrivateHint")
                : t("fmBatchPrivacyPublicHint")}
            </p>

            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                onClick={confirmBatchPrivacy}
                className="text-sm"
              >
                ✅ {t("fmConfirm")}
              </Button>

              <Button
                variant="outline"
                onClick={() => setBatchPrivacyWarning(null)}
                className="text-sm"
              >
                ❌ {t("fmCancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
