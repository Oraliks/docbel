/**
 * Helpers serveur pour les KnowledgeFolder (migration 21).
 *
 * Centralise :
 *   - Calcul de profondeur d'un folder dans l'arborescence (1 = racine).
 *   - Détection de cycle quand on change un `parentId` (un folder ne peut pas
 *     être son propre ancêtre — sinon FK explose au prochain SELECT récursif).
 *   - Expansion d'une liste de folderIds vers leurs descendants (utile pour
 *     filtrer le retrieval RAG quand le user a coché "inclure sous-dossiers").
 *
 * Toutes les fonctions sont best-effort sur les data corrompues (parentId
 * pointant vers un folder supprimé entre-temps) : on s'arrête au max
 * KNOWLEDGE_FOLDER_MAX_DEPTH itérations pour éviter une boucle infinie.
 */

import { prisma } from "@/lib/prisma";
import { KNOWLEDGE_FOLDER_MAX_DEPTH } from "./types";

/**
 * Calcule la profondeur d'un folder dans la hiérarchie.
 *   - Racine (parentId=null) → 1
 *   - Enfant de la racine → 2
 *   - Petit-enfant → 3
 *
 * Limite à KNOWLEDGE_FOLDER_MAX_DEPTH * 2 itérations pour éviter une boucle
 * infinie sur data corrompue (ne devrait jamais arriver vu les contraintes).
 */
export async function getFolderDepth(folderId: string): Promise<number> {
  let depth = 1;
  let currentId: string | null = folderId;
  const seen = new Set<string>();

  while (currentId && depth <= KNOWLEDGE_FOLDER_MAX_DEPTH * 2) {
    if (seen.has(currentId)) {
      // Cycle détecté — impossible en théorie mais on bail out.
      return KNOWLEDGE_FOLDER_MAX_DEPTH + 1;
    }
    seen.add(currentId);
    const parent: { parentId: string | null } | null =
      await prisma.knowledgeFolder.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
    if (!parent || parent.parentId === null) break;
    currentId = parent.parentId;
    depth++;
  }
  return depth;
}

/**
 * Calcule la profondeur RÉSULTANTE si on déplaçait `folderId` sous `newParentId`.
 *   - newParentId=null → la racine → 1
 *   - sinon → getFolderDepth(newParentId) + 1
 *
 * On ajoute aussi la hauteur du sous-arbre sous folderId (profondeur max des
 * descendants par rapport à folderId) pour s'assurer que tout l'arbre tient
 * sous KNOWLEDGE_FOLDER_MAX_DEPTH une fois replacé.
 */
export async function getResultingDepthAfterMove(args: {
  folderId: string;
  newParentId: string | null;
}): Promise<number> {
  const { folderId, newParentId } = args;
  const subtreeHeight = await getSubtreeHeight(folderId);
  if (newParentId === null) {
    return subtreeHeight; // racine = 1 + (hauteur - 1)
  }
  const parentDepth = await getFolderDepth(newParentId);
  // Le folder lui-même prend la profondeur parent+1, et la hauteur du sous-arbre
  // s'ajoute au-dessus de ce nouveau niveau. subtreeHeight=1 → folder seul.
  return parentDepth + subtreeHeight;
}

/**
 * Hauteur du sous-arbre enraciné à `folderId` (1 = folder seul sans enfants).
 *   - Pas d'enfants → 1
 *   - Avec 1 niveau d'enfants → 2
 *   - Avec 2 niveaux d'enfants → 3
 *
 * Implémentation BFS itérative — la KB devrait rester légère donc on accepte
 * le coût SQL d'un findMany par niveau.
 */
export async function getSubtreeHeight(folderId: string): Promise<number> {
  let currentLevel: string[] = [folderId];
  let height = 0;
  while (currentLevel.length > 0 && height < KNOWLEDGE_FOLDER_MAX_DEPTH * 2) {
    height++;
    const children = await prisma.knowledgeFolder.findMany({
      where: { parentId: { in: currentLevel } },
      select: { id: true },
    });
    if (children.length === 0) break;
    currentLevel = children.map((c) => c.id);
  }
  return height;
}

/**
 * Vérifie qu'un déplacement (folder → newParent) ne crée pas de cycle.
 * Un cycle survient si newParentId est égal à folderId OU descendant de folderId.
 *
 * Retourne true si le déplacement est SAFE (pas de cycle), false sinon.
 */
export async function isMoveAcyclic(args: {
  folderId: string;
  newParentId: string | null;
}): Promise<boolean> {
  const { folderId, newParentId } = args;
  if (newParentId === null) return true; // racine ne crée jamais de cycle
  if (newParentId === folderId) return false; // soi-même
  // Remonte la chaîne des ancêtres de newParentId jusqu'à la racine.
  // Si on rencontre folderId, c'est un cycle.
  let currentId: string | null = newParentId;
  const seen = new Set<string>();
  while (currentId && seen.size < KNOWLEDGE_FOLDER_MAX_DEPTH * 4) {
    if (currentId === folderId) return false;
    if (seen.has(currentId)) return false; // safety net
    seen.add(currentId);
    const parent: { parentId: string | null } | null =
      await prisma.knowledgeFolder.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
    if (!parent) return true; // parent introuvable, traité comme racine
    currentId = parent.parentId;
  }
  return true;
}

/**
 * Étend une liste d'IDs de folders pour inclure tous leurs descendants directs
 * et indirects (3 niveaux max). Utile pour le scope chat "inclure sous-dossiers".
 *
 * Si la liste passée est vide, retourne une liste vide (pas de scope).
 */
export async function expandFolderIdsWithDescendants(
  rootIds: string[],
  domain: string,
): Promise<string[]> {
  if (rootIds.length === 0) return [];
  const collected = new Set<string>(rootIds);
  let frontier = [...rootIds];
  for (let i = 0; i < KNOWLEDGE_FOLDER_MAX_DEPTH; i++) {
    if (frontier.length === 0) break;
    const children = await prisma.knowledgeFolder.findMany({
      where: {
        domain,
        parentId: { in: frontier },
      },
      select: { id: true },
    });
    if (children.length === 0) break;
    frontier = [];
    for (const c of children) {
      if (!collected.has(c.id)) {
        collected.add(c.id);
        frontier.push(c.id);
      }
    }
  }
  return Array.from(collected);
}
