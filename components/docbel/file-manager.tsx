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
  Search,
  Grid,
  List as ListIcon,
  MoreVertical,
  ChevronLeft,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: "Root" }]);
  const [searchQuery, setSearchQuery] = useState("");
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
    usage: any[];
  } | null>(null);
  const [newFolderIsPrivate, setNewFolderIsPrivate] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
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
  const [dropZoneFolderId, setDropZoneFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingToFolder, setMovingToFolder] = useState<string | null>(null);

  // Load files
  useEffect(() => {
    fetchFiles();
  }, [currentFolderId, viewMode]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (currentFolderId) query.append("parentId", currentFolderId);

      const res = await fetch(`/api/files?${query}`);
      if (!res.ok) throw new Error("Failed to fetch files");

      const data = await res.json();
      const isPrivateView = viewMode === "private";
      const filtered = data.filter((f: FileItem) =>
        isPrivateView ? f.isPrivate : !f.isPrivate
      );
      setFiles(filtered);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (file: FileItem) => {
    if (file.type === "folder") {
      setCurrentFolderId(file.id);
      setBreadcrumbs([...breadcrumbs, { id: file.id, name: file.name }]);
    }
  };

  const handleBreadcrumb = (id: string | null, index: number) => {
    setCurrentFolderId(id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const getFileUrl = (file: FileItem) => {
    if (file.type === "file") {
      return `/api/files/${file.id}/download`;
    }
    return null;
  };

  const handleDownload = async (file: FileItem) => {
    const url = getFileUrl(file);
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
      toast({
        title: "Succès",
        description: "URL copiée dans le presse-papiers",
      });
    }
  };

  const handleRename = async (file: FileItem) => {
    if (!renamingName.trim()) return;

    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renamingName }),
      });

      if (!res.ok) throw new Error("Failed to rename");
      setRenaming(null);
      toast({
        title: "Succès",
        description: `${file.name} renommé en ${renamingName}`,
      });
      fetchFiles();
    } catch (error) {
      console.error("Error renaming:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de renommer le fichier",
      });
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
        setUsageWarning({
          fileId: deleteConfirmation.fileId,
          usage: data.usage,
        });
        toast({
          variant: "destructive",
          title: "Fichier en cours d'utilisation",
          description: `${deleteConfirmation.fileName} est utilisé sur ${data.usage?.length || 1} page(s)`,
        });
        setDeleteConfirmation(null);
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete");
      }

      const typeText =
        deleteConfirmation.type === "folder" ? "le dossier" : "le fichier";
      toast({
        title: "Suppression réussie",
        description: `${typeText} "${deleteConfirmation.fileName}" a été supprimé avec succès`,
      });
      setDeleteConfirmation(null);
      fetchFiles();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        variant: "destructive",
        title: "Erreur de suppression",
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
    newIsPrivate: boolean
  ) => {
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: newIsPrivate }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast({
          variant: "destructive",
          title: "Erreur",
          description: error.message || "Impossible de changer la visibilité",
        });
        throw new Error(error.message || "Failed to toggle privacy");
      }

      // Si c'est un dossier, changer aussi les enfants récursivement
      if (fileType === "folder") {
        const updateChildrenRes = await fetch(`/api/files/bulk-update`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: fileId, isPrivate: newIsPrivate }),
        });
        if (!updateChildrenRes.ok) {
          console.error("Failed to update children");
          toast({
            variant: "destructive",
            title: "Avertissement",
            description: "Le dossier a été mis à jour mais pas tous les fichiers enfants",
          });
        }
      }

      // Basculer vers le bon tab
      setViewMode(newIsPrivate ? "private" : "public");

      toast({
        title: "Succès",
        description: `${fileName} est maintenant ${newIsPrivate ? "privé" : "public"}`,
      });

      fetchFiles();
    } catch (error) {
      console.error("Error toggling privacy:", error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    try {
      setUploading(true);
      const fileNames: string[] = [];

      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFolderId) formData.append("parentId", currentFolderId);
        formData.append("isPrivate", (viewMode === "private").toString());

        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        fileNames.push(file.name);
      }

      toast({
        title: "Succès",
        description: `${fileNames.length} fichier(s) uploadé(s) avec succès`,
      });

      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      fetchFiles();
    } catch (error) {
      console.error("Error uploading:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'uploader les fichiers",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedFileIds.size > 0) {
      setDropZoneFolderId(currentFolderId);
    } else {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setDropZoneFolderId(null);
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
    setDropZoneFolderId(null);

    if (draggedFileIds.size > 0) {
      await handleMoveFiles(Array.from(draggedFileIds), currentFolderId || "root");
      return;
    }

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    try {
      setUploading(true);
      const fileNames: string[] = [];

      for (const file of droppedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (currentFolderId) formData.append("parentId", currentFolderId);
        formData.append("isPrivate", (viewMode === "private").toString());

        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        fileNames.push(file.name);
      }

      toast({
        title: "Succès",
        description: `${fileNames.length} fichier(s) uploadé(s) avec succès`,
      });

      fetchFiles();
    } catch (error) {
      console.error("Error uploading:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'uploader les fichiers",
      });
    } finally {
      setUploading(false);
    }
  };

  const toggleFileSelection = (fileId: string, e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
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

    try {
      setBatchDeleting(true);
      let successCount = 0;
      let failureCount = 0;

      for (const fileId of selectedFiles) {
        try {
          const res = await fetch(`/api/files/${fileId}`, {
            method: "DELETE",
          });

          if (res.ok) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Suppression réussie",
          description: `${successCount} fichier(s) supprimé(s) avec succès`,
        });
      }

      if (failureCount > 0) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: `${failureCount} fichier(s) n'ont pas pu être supprimés`,
        });
      }

      setSelectedFiles(new Set());
      setDeleteConfirmation(null);
      fetchFiles();
    } catch (error) {
      console.error("Error batch deleting:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer les fichiers",
      });
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

    try {
      let successCount = 0;
      let failureCount = 0;

      for (const fileId of batchPrivacyWarning.fileIds) {
        try {
          const res = await fetch(`/api/files/${fileId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPrivate: batchPrivacyWarning.newPrivacy }),
          });

          if (res.ok) {
            const file = files.find(f => f.id === fileId);
            if (file?.type === "folder") {
              await fetch(`/api/files/bulk-update`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentId: fileId, isPrivate: batchPrivacyWarning.newPrivacy }),
              });
            }
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Succès",
          description: `${successCount} fichier(s) mis à jour`,
        });
      }

      if (failureCount > 0) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: `${failureCount} fichier(s) n'ont pas pu être mis à jour`,
        });
      }

      setViewMode(batchPrivacyWarning.newPrivacy ? "private" : "public");
      setSelectedFiles(new Set());
      setBatchPrivacyWarning(null);
      fetchFiles();
    } catch (error) {
      console.error("Error batch updating privacy:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour les fichiers",
      });
    }
  };

  const handleMoveFiles = async (fileIds: string[], targetFolderId: string | null) => {
    if (fileIds.length === 0) return;

    const sourceFolder = currentFolderId;
    if (sourceFolder === targetFolderId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le fichier est déjà dans ce dossier",
      });
      return;
    }

    try {
      setIsMoving(true);
      let successCount = 0;
      let renamedFiles: string[] = [];

      for (const fileId of fileIds) {
        try {
          const res = await fetch(`/api/files/${fileId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentId: targetFolderId }),
          });

          if (!res.ok) throw new Error("Move failed");

          const updatedFile = await res.json();
          const originalFile = files.find(f => f.id === fileId);

          if (originalFile && updatedFile.name !== originalFile.name) {
            renamedFiles.push(`${originalFile.name} → ${updatedFile.name}`);
          }

          successCount++;
        } catch (error) {
          console.error(`Error moving file ${fileId}:`, error);
        }
      }

      if (successCount > 0) {
        let description = `${successCount} fichier(s) déplacé(s)`;
        if (renamedFiles.length > 0) {
          description += ` (renommage: ${renamedFiles.join(", ")})`;
        }
        toast({
          title: "Succès",
          description,
        });
      }

      setSelectedFiles(new Set());
      setDraggedFileIds(new Set());
      setDropZoneFolderId(null);
      fetchFiles();
    } catch (error) {
      console.error("Error moving files:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de déplacer les fichiers",
      });
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

      toast({
        title: "Succès",
        description: `Le dossier "${newFolderName}" a été créé`,
      });

      setNewFolderName("");
      setShowNewFolder(false);
      setNewFolderIsPrivate(false);
      fetchFiles();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer le dossier",
      });
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        return <File className={`${iconClass} text-gray-500`} />;
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
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      {/* Header with Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "public" | "private")} style={{ width: "100%" }}>
        <TabsList className="m-0 rounded-none" style={{ width: "100%", justifyContent: "flex-start", padding: "0", borderBottom: "1px solid var(--color-border)", height: "auto", backgroundColor: "transparent" }}>
          <TabsTrigger value="public" style={{ borderRadius: 0, borderBottom: viewMode === "public" ? `2px solid #10b981` : "none", color: viewMode === "public" ? "var(--color-text)" : "var(--color-textMuted)" }}>
            🌐 Fichiers publics
          </TabsTrigger>
          <TabsTrigger value="private" style={{ borderRadius: 0, borderBottom: viewMode === "private" ? `2px solid #f97316` : "none", color: viewMode === "private" ? "var(--color-text)" : "var(--color-textMuted)" }}>
            <Lock className="w-3 h-3 mr-2" />
            Fichiers privés
          </TabsTrigger>
        </TabsList>

        <div style={{ padding: "16px 20px", display: "flex", gap: "8px", alignItems: "center" }}>
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

      {/* Breadcrumbs */}
      <div
        style={{
          padding: "8px 20px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          borderBottom: "1px solid var(--color-border)",
          overflow: "auto",
        }}
      >
        {breadcrumbs.map((crumb, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBreadcrumb(crumb.id, idx)}
              className="text-xs h-auto px-2 py-1"
            >
              {crumb.name}
            </Button>
            {idx < breadcrumbs.length - 1 && (
              <ChevronRight className="w-3 h-3" style={{ margin: "0 4px" }} />
            )}
          </div>
        ))}
      </div>

      {/* Batch Actions Bar */}
      {selectedFiles.size > 0 && (
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: "500" }}>
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
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          backgroundColor: dragOver ? "var(--color-surface)" : "transparent",
          border: dragOver ? `2px dashed #3b82f6` : "none",
          transition: "all 0.2s",
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            Chargement...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            Aucun fichier trouvé
          </div>
        ) : layout === "grid" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "12px",
            }}
          >
            {filteredFiles.map((file) => (
              <ContextMenu key={file.id}>
                <ContextMenuTrigger>
                  <div
                    draggable
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: draggedFileIds.has(file.id) ? "#dc2626" : selectedFiles.has(file.id) ? "var(--surface-2)" : "var(--surface)",
                      border: `2px solid ${draggedFileIds.has(file.id) ? "#991b1b" : selectedFiles.has(file.id) ? "#3b82f6" : file.isPrivate ? "#f97316" : "var(--border)"}`,
                      cursor: "grab",
                      transition: "all 0.2s",
                      position: "relative",
                      opacity: draggedFileIds.has(file.id) ? 0.6 : 1,
                    }}
                    onDragStart={(e) => handleFileDragStart(file.id, e)}
                    onDragEnd={() => setDraggedFileIds(new Set())}
                    onMouseEnter={(e) => {
                      if (!selectedFiles.has(file.id) && !draggedFileIds.has(file.id)) {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "var(--surface-2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedFiles.has(file.id) && !draggedFileIds.has(file.id)) {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          colors.surface;
                      }
                    }}
                    onClick={() => {
                      if (file.type === "folder") {
                        handleNavigate(file);
                      } else {
                        setSelectedFileId(file.id);
                      }
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                      }}
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
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                      {file.type === "folder" ? (
                        <Folder className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        getFileIcon(file.fileType)
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "500",
                        marginBottom: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.name}
                    </p>
                    <div style={{ display: "flex", gap: "4px", marginBottom: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <Badge
                        variant={file.isPrivate ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {file.isPrivate ? "🔒 Privé" : "🌐 Public"}
                      </Badge>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        fontSize: "8px",
                        color: "var(--color-textMuted)",
                        lineHeight: "1.3",
                        flexDirection: "column",
                      }}
                    >
                      {file.size && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(file.size)}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
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
                        Copier l'URL
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
                    style={{ color: "#ef4444" }}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Supprimer
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        ) : (
          <div className="rounded-md border" style={{ borderColor: "var(--color-border)" }}>
            <Table>
              <TableHeader style={{ backgroundColor: colors.surface }}>
                <TableRow style={{ borderColor: "var(--color-border)" }}>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={selectedFiles.size > 0 && selectedFiles.size === filteredFiles.length}
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
                    style={{
                      borderColor: "var(--color-border)",
                      borderLeft: `4px solid ${draggedFileIds.has(file.id) ? "#991b1b" : selectedFiles.has(file.id) ? "#3b82f6" : file.isPrivate ? "#f97316" : "#10b981"}`,
                      backgroundColor: draggedFileIds.has(file.id) ? "#dc2626" : selectedFiles.has(file.id) ? "var(--surface-2)" : "transparent",
                      cursor: "grab",
                      opacity: draggedFileIds.has(file.id) ? 0.6 : 1,
                      transition: "all 0.2s",
                    }}
                    onDragStart={(e) => handleFileDragStart(file.id, e)}
                    onDragEnd={() => setDraggedFileIds(new Set())}
                    onClick={() => {
                      if (file.type === "folder") {
                        handleNavigate(file);
                      } else {
                        setSelectedFileId(file.id);
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
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {file.type === "folder" ? (
                          <Folder className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          getFileIcon(file.fileType)
                        )}
                        <ContextMenu>
                          <ContextMenuTrigger>
                            <span>{file.name}</span>
                          </ContextMenuTrigger>
                          <ContextMenuContent style={{ zIndex: 50 }}>
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
                                  Copier l'URL
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
                              style={{ color: "#ef4444" }}
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
                    <TableCell className="text-sm" style={{ color: colors.textMuted }}>
                      {formatFileSize(file.size)}
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: colors.textMuted }}>
                      {formatDate(file.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: colors.textMuted }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Input
              placeholder="Nom du dossier"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "500" }}>Visibilité:</span>
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
            <DialogTitle>Fichier en cours d'utilisation</DialogTitle>
          </DialogHeader>
          <div>
            <p style={{ marginBottom: "12px" }}>
              Ce fichier est utilisé sur les pages suivantes:
            </p>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {usageWarning?.usage?.map((u: any) => (
                <li key={u.id} style={{ padding: "8px 0", fontSize: "14px" }}>
                  <strong>{u.pageSlug}</strong>
                  {u.context && (
                    <p style={{ color: "var(--color-textMuted)", fontSize: "12px" }}>
                      {u.context}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: "12px", fontSize: "12px", color: colors.textMuted }}>
              Vous devez mettre à jour ces pages avant de supprimer ce fichier.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setUsageWarning(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déplacer les fichiers sélectionnés</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflow: "auto" }}>
            <div style={{ fontSize: "13px", fontWeight: "500", paddingBottom: "8px", borderBottom: "1px solid var(--color-border)" }}>
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
            {files
              .filter((f) => f.type === "folder")
              .map((folder) => (
                <Button
                  key={folder.id}
                  variant={movingToFolder === folder.id ? "default" : "outline"}
                  onClick={() => setMovingToFolder(folder.id)}
                  className="justify-start text-xs h-auto py-2"
                >
                  <Folder className="w-3 h-3 mr-2" />
                  {folder.name}
                </Button>
              ))}
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
                await handleMoveFiles(
                  Array.from(selectedFiles),
                  movingToFolder || null
                );
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
        <DialogContent style={{ maxWidth: "900px", maxHeight: "80vh" }}>
          <DialogHeader>
            <DialogTitle>
              {files.find((f) => f.id === previewFileId)?.name || "Aperçu"}
            </DialogTitle>
          </DialogHeader>
          {previewFileId && (
            <div style={{ display: "flex", justifyContent: "center", overflow: "auto", maxHeight: "70vh" }}>
              {(() => {
                const file = files.find((f) => f.id === previewFileId);
                if (!file) return null;

                const url = getFileUrl(file);
                if (!url) return <p>Aperçu non disponible</p>;

                switch (file.fileType) {
                  case "image":
                    return <img src={url} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />;
                  case "pdf":
                    return (
                      <iframe
                        src={url}
                        style={{ width: "100%", height: "600px", border: "none" }}
                        title="PDF Preview"
                      />
                    );
                  case "video":
                    return (
                      <video
                        src={url}
                        controls
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    );
                  case "code":
                    return (
                      <iframe
                        src={url}
                        style={{ width: "100%", height: "600px", border: "none" }}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "14px", lineHeight: "1.5" }}>
              <strong>{privacyWarning?.fileName}</strong> est actuellement dans un dossier{" "}
              <strong>{privacyWarning?.parentPrivacy ? "privé" : "public"}</strong>, mais vous voulez le rendre{" "}
              <strong>{privacyWarning?.newPrivacy ? "privé" : "public"}</strong>.
            </p>
            <p style={{ fontSize: "12px", color: colors.textMuted }}>
              {privacyWarning?.newPrivacy
                ? "Le fichier sera invisible dans l'onglet public, mais accessible via URL directe."
                : "Le fichier sera visible dans l'onglet public, même s'il est dans un dossier privé."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Button
                variant="outline"
                onClick={() => {
                  if (privacyWarning) {
                    applyPrivacyChange(
                      privacyWarning.fileId,
                      privacyWarning.fileName,
                      "file",
                      privacyWarning.newPrivacy
                    );
                  }
                  setPrivacyWarning(null);
                }}
                className="text-sm"
              >
                ✅ Changer UNIQUEMENT ce fichier
              </Button>

              <Button
                variant="default"
                onClick={() => {
                  if (privacyWarning) {
                    // D'abord changer le fichier
                    applyPrivacyChange(
                      privacyWarning.fileId,
                      privacyWarning.fileName,
                      "file",
                      privacyWarning.newPrivacy
                    );
                    // Ensuite changer le dossier courant aussi
                    if (privacyWarning.folderId) {
                      applyPrivacyChange(
                        privacyWarning.folderId,
                        "Dossier courant",
                        "folder",
                        privacyWarning.newPrivacy
                      );
                    }
                  }
                  setPrivacyWarning(null);
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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ color: "var(--color-text)", margin: 0 }}>
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong>
                {deleteConfirmation?.type === "folder" ? "le dossier" : "le fichier"}{" "}
                "{deleteConfirmation?.fileName}"
              </strong>
              ?
            </p>
            {deleteConfirmation?.type === "folder" && (
              <p
                style={{
                  color: "var(--color-textMuted)",
                  margin: 0,
                  fontSize: "14px",
                }}
              >
                ⚠️ Cette action supprimera également tout le contenu du dossier.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ color: "var(--color-text)", margin: 0 }}>
              Êtes-vous sûr de vouloir supprimer{" "}
              <strong>{selectedFiles.size} fichier(s)</strong> ?
            </p>
            <p
              style={{
                color: "var(--color-textMuted)",
                margin: 0,
                fontSize: "14px",
              }}
            >
              ⚠️ Cette action est irréversible.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ color: "var(--color-text)", margin: 0 }}>
              Êtes-vous sûr de vouloir rendre{" "}
              <strong>{batchPrivacyWarning?.newPrivacy ? "privés" : "publics"}</strong>{" "}
              <strong>{selectedFiles.size} fichier(s)</strong> ?
            </p>
            <p
              style={{
                color: "var(--color-textMuted)",
                margin: 0,
                fontSize: "14px",
              }}
            >
              {batchPrivacyWarning?.newPrivacy
                ? "Les fichiers disparaîtront de l'onglet public."
                : "Les fichiers seront visibles dans l'onglet public."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
