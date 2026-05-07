"use client";

import { useState, useEffect } from "react";
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
  FileCode,
  Archive,
  Download,
  Trash2,
  Edit,
  ChevronRight,
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
    usage: { id: string; pageSlug: string; context?: string | null }[];
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
  const [batchPrivacyWarning, setBatchPrivacyWarning] = useState<{
    fileIds: string[];
    newPrivacy: boolean;
  } | null>(null);
  const [draggedFileIds, setDraggedFileIds] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingToFolder, setMovingToFolder] = useState<string | null>(null);

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
      toast.success("URL copiée dans le presse-papiers");
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
      toast.success(`${oldName} renommé en ${trimmed}`);
    } catch (error) {
      console.error("Error renaming:", error);
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, name: oldName } : f))
      );
      toast.error("Impossible de renommer le fichier");
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
          setUsageWarning({
            fileId: deleteConfirmation.fileId,
            usage: data.usage,
          });
          toast.error("Fichier en cours d'utilisation", {
            description: `${deleteConfirmation.fileName} est utilisé sur ${data.usage?.length || 1} page(s)`,
          });
        } else {
          toast.error("Dossier non vide", {
            description: data.message || "Le dossier doit être vide avant suppression",
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
        deleteConfirmation.type === "folder" ? "le dossier" : "le fichier";
      toast.success("Suppression réussie", {
        description: `${typeText} "${deleteConfirmation.fileName}" a été supprimé avec succès`,
      });
      setDeleteConfirmation(null);
      fetchFiles();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erreur de suppression", {
        description:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer cet élément",
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
        toast.error(error.message || "Impossible de changer la visibilité");
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
          toast.warning("Avertissement", {
            description: "Le dossier a été mis à jour mais pas tous les fichiers enfants",
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
          `${fileName} est maintenant ${newIsPrivate ? "privé" : "public"}`,
          willLeaveView
            ? {
                action: {
                  label: targetView === "private" ? "Voir privés" : "Voir publics",
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
        toast.success(`${successCount} fichier(s) uploadé(s) avec succès`);
      }
      if (failureCount > 0) {
        const firstError = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        toast.error(`${failureCount} fichier(s) en échec`, {
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
      toast.error("Impossible de déposer un dossier sur lui-même");
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
      fileName: `${selectedFiles.size} fichier(s)`,
      type: selectedFiles.size === 1 && files.find(f => f.id === Array.from(selectedFiles)[0])?.type === "folder" ? "folder" : "file",
    });
  };

  const confirmBatchDelete = async () => {
    if (selectedFiles.size === 0) return;

    setBatchDeleting(true);
    try {
      const ids = Array.from(selectedFiles);
      const results = await Promise.allSettled(
        ids.map((fileId) =>
          fetch(`/api/files/${fileId}`, { method: "DELETE" }).then((res) => {
            if (!res.ok) throw new Error(`Failed to delete ${fileId}`);
            return fileId;
          })
        )
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        toast.success("Suppression réussie", {
          description: `${successCount} fichier(s) supprimé(s) avec succès`,
        });
      }
      if (failureCount > 0) {
        toast.error(`${failureCount} fichier(s) n'ont pas pu être supprimés`);
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

    const results = await Promise.allSettled(
      fileIds.map(async (fileId) => {
        const res = await fetch(`/api/files/${fileId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPrivate: newPrivacy }),
        });
        if (!res.ok) throw new Error(`Failed for ${fileId}`);
        const file = filesById.get(fileId);
        if (file?.type === "folder") {
          await fetch(`/api/files/bulk-update`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentId: fileId, isPrivate: newPrivacy }),
          });
        }
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      const targetView = newPrivacy ? "private" : "public";
      toast.success(`${successCount} fichier(s) mis à jour`, {
        action: {
          label: targetView === "private" ? "Voir privés" : "Voir publics",
          onClick: () => setViewMode(targetView),
        },
      });
    }
    if (failureCount > 0) {
      toast.error(`${failureCount} fichier(s) n'ont pas pu être mis à jour`);
    }

    setSelectedFiles(new Set());
    setBatchPrivacyWarning(null);
    await fetchFiles();
  };

  const handleMoveFiles = async (fileIds: string[], targetFolderId: string | null) => {
    if (fileIds.length === 0) return;

    if (currentFolderId === targetFolderId) {
      toast.error("Les fichiers sont déjà dans ce dossier");
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
        const description = `${fulfilled.length} fichier(s) déplacé(s)${
          renamed.length > 0 ? ` (renommage: ${renamed.join(", ")})` : ""
        }`;
        toast.success(description);
      }
      if (failureCount > 0) {
        toast.error(`${failureCount} fichier(s) n'ont pas pu être déplacés`);
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

      toast.success(`Le dossier "${newFolderName}" a été créé`);

      setNewFolderName("");
      setShowNewFolder(false);
      setNewFolderIsPrivate(false);
      fetchFiles();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Impossible de créer le dossier");
    }
  };

  const filteredFiles = searchMode
    ? files
    : files.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
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
      case "code":
        return <FileCode className={`${iconClass} text-orange-500`} />;
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
            🌐 Fichiers publics
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
            Fichiers privés
          </TabsTrigger>
        </TabsList>

        <div className="px-5 py-4 flex gap-2 items-center">
          <Input
            placeholder="Rechercher..."
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
            {uploading ? "Upload..." : "Upload"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewFolder(true)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Dossier
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
        </div>
      </Tabs>

      {/* Breadcrumbs / Search context */}
      <div className="px-5 py-2 flex items-center gap-1 border-b border-border overflow-auto">
        {searchMode ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Résultats pour</span>
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
              Effacer
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
                {crumb.name}
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
            {selectedFiles.size} sélectionné(s)
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBatchPrivacy(viewMode === "private" ? false : true)}
            className="text-xs"
          >
            <Lock className="w-3 h-3 mr-1" />
            {viewMode === "private" ? "Rendre public" : "Rendre privé"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowMoveDialog(true)}
            disabled={isMoving}
            className="text-xs"
          >
            <ChevronRight className="w-3 h-3 mr-1" />
            Déplacer vers...
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            className="text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Supprimer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedFiles(new Set())}
            className="text-xs ml-auto"
          >
            Désélectionner tout
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
          <div className="text-center p-10">Chargement...</div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center p-10">Aucun fichier trouvé</div>
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
                        {file.isPrivate ? "🔒 Privé" : "🌐 Public"}
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
                        Télécharger
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => setPreviewFileId(file.id)}>
                        👁️
                        Aperçu
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleCopyUrl(file)}>
                        🔗
                        Copier l&apos;URL
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
                    Renommer
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleTogglePrivacy(file)}>
                    <Lock className="w-3 h-3 mr-2" />
                    {file.isPrivate ? "Rendre public" : "Rendre privé"}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => handleDelete(file)}
                    className="text-red-500"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Supprimer
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
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-0 hover:bg-transparent">
                      Nom
                      <ChevronRight className="ml-1 w-4 h-4 opacity-50" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-0 hover:bg-transparent">
                      Visibilité
                      <ChevronRight className="ml-1 w-4 h-4 opacity-50" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-0 hover:bg-transparent">
                      Type
                      <ChevronRight className="ml-1 w-4 h-4 opacity-50" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-0 hover:bg-transparent">
                      Taille
                      <ChevronRight className="ml-1 w-4 h-4 opacity-50" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-0 hover:bg-transparent">
                      Créé
                      <ChevronRight className="ml-1 w-4 h-4 opacity-50" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-0 hover:bg-transparent">
                      Modifié
                      <ChevronRight className="ml-1 w-4 h-4 opacity-50" />
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
                                  Télécharger
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => setPreviewFileId(file.id)}>
                                  👁️
                                  Aperçu
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => handleCopyUrl(file)}>
                                  🔗
                                  Copier l&apos;URL
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
                              Renommer
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleTogglePrivacy(file)}>
                              <Lock className="w-3 h-3 mr-2" />
                              {file.isPrivate ? "Rendre public" : "Rendre privé"}
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => handleDelete(file)}
                              className="text-red-500"
                            >
                              <Trash2 className="w-3 h-3 mr-2" />
                              Supprimer
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
                        {file.isPrivate ? "🔒 Privé" : "🌐 Public"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {file.type === "folder" ? "Dossier" : file.fileType || "Fichier"}
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
            <DialogTitle>Renommer</DialogTitle>
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
              Annuler
            </Button>
            <Button
              onClick={() =>
                renaming && handleRename(files.find((f) => f.id === renaming)!)
              }
            >
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Nom du dossier"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 items-center">
              <span className="text-[13px] font-medium">Visibilité:</span>
              <Button
                size="sm"
                variant={!newFolderIsPrivate ? "default" : "outline"}
                onClick={() => setNewFolderIsPrivate(false)}
                className="text-xs"
              >
                🌐 Public
              </Button>
              <Button
                size="sm"
                variant={newFolderIsPrivate ? "default" : "outline"}
                onClick={() => setNewFolderIsPrivate(true)}
                className="text-xs"
              >
                <Lock className="w-3 h-3 mr-1" />
                Privé
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateFolder}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageWarning} onOpenChange={() => setUsageWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fichier en cours d&apos;utilisation</DialogTitle>
          </DialogHeader>
          <div>
            <p className="mb-3">
              Ce fichier est utilisé sur les pages suivantes:
            </p>
            <ul className="list-none p-0">
              {usageWarning?.usage?.map((u) => (
                <li key={u.id} className="py-2 text-sm">
                  <strong>{u.pageSlug}</strong>
                  {u.context && (
                    <p className="text-xs text-muted-foreground">{u.context}</p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Vous devez mettre à jour ces pages avant de supprimer ce fichier.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setUsageWarning(null)}>Fermer</Button>
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
            <DialogTitle>Déplacer les fichiers sélectionnés</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[400px] overflow-auto">
            <div className="text-[13px] font-medium pb-2 border-b border-border">
              Destination:
            </div>
            <Button
              variant={!movingToFolder ? "default" : "outline"}
              onClick={() => setMovingToFolder(null)}
              className="justify-start text-xs h-auto py-2"
            >
              <Folder className="w-3 h-3 mr-2" />
              Root
            </Button>
            {loadingFolders ? (
              <div className="text-xs text-muted-foreground">
                Chargement des dossiers...
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
              Annuler
            </Button>
            <Button
              onClick={async () => {
                await handleMoveFiles(Array.from(selectedFiles), movingToFolder);
                setShowMoveDialog(false);
                setMovingToFolder(null);
              }}
              disabled={isMoving}
            >
              Déplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewFileId} onOpenChange={() => setPreviewFileId(null)}>
        <DialogContent className="max-w-[900px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {files.find((f) => f.id === previewFileId)?.name || "Aperçu"}
            </DialogTitle>
          </DialogHeader>
          {previewFileId && (
            <div className="flex justify-center overflow-auto max-h-[70vh]">
              {(() => {
                const file = files.find((f) => f.id === previewFileId);
                if (!file) return null;

                const url = getFileUrl(file);
                if (!url) return <p>Aperçu non disponible</p>;

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
                  case "code":
                    return (
                      <iframe
                        src={url}
                        className="w-full h-[600px] border-0"
                        title="Code Preview"
                      />
                    );
                  default:
                    return <p>Aperçu non disponible pour ce type de fichier</p>;
                }
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!privacyWarning} onOpenChange={() => setPrivacyWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Avertissement de visibilité</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-normal">
              <strong>{privacyWarning?.fileName}</strong> est actuellement dans un dossier{" "}
              <strong>{privacyWarning?.parentPrivacy ? "privé" : "public"}</strong>, mais vous voulez le rendre{" "}
              <strong>{privacyWarning?.newPrivacy ? "privé" : "public"}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              {privacyWarning?.newPrivacy
                ? "Le fichier sera invisible dans l'onglet public, mais accessible via URL directe."
                : "Le fichier sera visible dans l'onglet public, même s'il est dans un dossier privé."}
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
                ✅ Changer UNIQUEMENT ce fichier
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
                      "Dossier courant",
                      "folder",
                      warning.newPrivacy
                    );
                  } else if (fileOk) {
                    await fetchFiles();
                  }
                }}
                className="text-sm"
              >
                📁 Changer ce fichier + dossier courant
              </Button>

              <Button
                variant="ghost"
                onClick={() => setPrivacyWarning(null)}
                className="text-sm"
              >
                ❌ Annuler
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
            <DialogTitle>⚠️ Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="m-0">
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong>
                {deleteConfirmation?.type === "folder" ? "le dossier" : "le fichier"}{" "}
                &quot;{deleteConfirmation?.fileName}&quot;
              </strong>
              ?
            </p>
            {deleteConfirmation?.type === "folder" && (
              <p className="m-0 text-sm text-muted-foreground">
                ⚠️ Le dossier doit être vide. Videz son contenu avant de le supprimer.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleting !== null}
                className="text-sm"
              >
                {deleting ? "Suppression..." : "🗑️ Supprimer définitivement"}
              </Button>

              <Button
                variant="outline"
                onClick={() => setDeleteConfirmation(null)}
                disabled={deleting !== null}
                className="text-sm"
              >
                ❌ Annuler
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
            <DialogTitle>⚠️ Confirmer la suppression multiple</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="m-0">
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong>{selectedFiles.size} fichier(s)</strong> ?
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              ⚠️ Cette action est irréversible.
            </p>

            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                onClick={confirmBatchDelete}
                disabled={batchDeleting}
                className="text-sm"
              >
                {batchDeleting ? "Suppression..." : "🗑️ Supprimer définitivement"}
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
                ❌ Annuler
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
            <DialogTitle>⚠️ Modifier la visibilité</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="m-0">
              Êtes-vous sûr de vouloir rendre{" "}
              <strong>{batchPrivacyWarning?.newPrivacy ? "privés" : "publics"}</strong>{" "}
              <strong>{selectedFiles.size} fichier(s)</strong> ?
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              {batchPrivacyWarning?.newPrivacy
                ? "Les fichiers disparaîtront de l'onglet public."
                : "Les fichiers seront visibles dans l'onglet public."}
            </p>

            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                onClick={confirmBatchPrivacy}
                className="text-sm"
              >
                ✅ Confirmer
              </Button>

              <Button
                variant="outline"
                onClick={() => setBatchPrivacyWarning(null)}
                className="text-sm"
              >
                ❌ Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
