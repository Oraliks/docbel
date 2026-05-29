/// Conversions de coordonnées PDF user-space (origine en bas-gauche, en points)
/// vs HTML overlay (origine en haut-gauche, en pixels CSS).
///
/// Source de vérité côté serveur : `page.getCropBox()` de pdf-lib — c'est la
/// boîte que pdfjs utilise pour le rendu (et donc pour positionner les overlays
/// HTML). `getMediaBox()` peut être plus grand et fausser l'alignement.
///
/// IMPORTANT v1 : on n'accepte que les pages sans rotation. Le call-site doit
/// vérifier `page.getRotation().angle === 0` AVANT d'utiliser ces helpers ; les
/// conversions ci-dessous ne tiennent pas compte de la rotation.

export interface PageGeometry {
  /// Largeur de la CropBox en points PDF.
  width: number;
  /// Hauteur de la CropBox en points PDF.
  height: number;
  /// Offset x de la CropBox dans le user-space (souvent 0 mais peut être > 0).
  offsetX: number;
  /// Offset y de la CropBox dans le user-space.
  offsetY: number;
}

export interface HtmlRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfRect {
  /// x en points dans le user-space (incluant offset CropBox).
  x: number;
  /// y en points dans le user-space.
  y: number;
  w: number;
  h: number;
}

/// Convertit un rect PDF user-space en rect HTML overlay (pixels CSS).
/// On soustrait l'offset de la CropBox pour avoir des coords relatives à la
/// page rendue par pdfjs.
export function pdfToHtml(rect: PdfRect, geo: PageGeometry, scale: number): HtmlRect {
  const localX = rect.x - geo.offsetX;
  const localY = rect.y - geo.offsetY;
  return {
    x: localX * scale,
    y: (geo.height - localY - rect.h) * scale,
    w: rect.w * scale,
    h: rect.h * scale,
  };
}

/// Convertit un rect HTML overlay en rect PDF user-space (en points).
export function htmlToPdf(rect: HtmlRect, geo: PageGeometry, scale: number): PdfRect {
  const localX = rect.x / scale;
  const localY = geo.height - rect.y / scale - rect.h / scale;
  return {
    x: localX + geo.offsetX,
    y: localY + geo.offsetY,
    w: rect.w / scale,
    h: rect.h / scale,
  };
}

/// Type minimal d'une page pdf-lib pour le calcul de géométrie côté serveur.
interface PageLike {
  getCropBox: () => { x: number; y: number; width: number; height: number };
}

/// Extrait la géométrie de la page depuis l'objet PDFPage de pdf-lib (serveur)
/// ou depuis un objet équivalent. Toujours basé sur la CropBox.
export function getPageGeometry(page: PageLike): PageGeometry {
  const box = page.getCropBox();
  return {
    width: box.width,
    height: box.height,
    offsetX: box.x,
    offsetY: box.y,
  };
}
