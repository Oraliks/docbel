export const generateUniqueName = (
  baseName: string,
  existingNames: string[]
): string => {
  const lowerExisting = existingNames.map(n => n.toLowerCase());

  if (!lowerExisting.includes(baseName.toLowerCase())) {
    return baseName;
  }

  const lastDotIndex = baseName.lastIndexOf(".");
  let nameWithoutExt: string;
  let ext: string;

  if (lastDotIndex > 0) {
    nameWithoutExt = baseName.substring(0, lastDotIndex);
    ext = baseName.substring(lastDotIndex);
  } else {
    nameWithoutExt = baseName;
    ext = "";
  }

  let counter = 1;
  let newName: string;

  while (true) {
    newName = `${nameWithoutExt} (${counter})${ext}`;
    if (!lowerExisting.includes(newName.toLowerCase())) {
      return newName;
    }
    counter++;
  }
};

export interface FileItem {
  id: string;
  parentId: string | null;
  type: "file" | "folder";
  name: string;
  children?: FileItem[];
}

const getAllChildren = (fileId: string, files: FileItem[]): string[] => {
  const childrenIds: string[] = [];
  const queue = [fileId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const file = files.find(f => f.id === current);
    if (file?.children) {
      file.children.forEach(child => {
        childrenIds.push(child.id);
        queue.push(child.id);
      });
    }
  }

  return childrenIds;
};

export const isValidMove = (
  sourceId: string,
  targetFolderId: string,
  currentFiles: FileItem[]
): boolean => {
  if (sourceId === targetFolderId) {
    return false;
  }

  const sourceFile = currentFiles.find(f => f.id === sourceId);
  if (!sourceFile) {
    return false;
  }

  if (sourceFile.type === "folder") {
    const sourceChildren = getAllChildren(sourceId, currentFiles);
    if (sourceChildren.includes(targetFolderId)) {
      return false;
    }
  }

  return true;
};
