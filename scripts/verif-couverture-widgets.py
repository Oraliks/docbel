"""Couverture des widgets d'un formulaire ONEM par les scenarios generes.

Deux sources, parce qu'aucune ne suffit seule :
  - PDF NON aplati : la valeur de chaque champ AcroForm et l'etat de chaque
    case a cocher se lisent directement ;
  - PDF APLATI : les ecritures POSITIONNELLES (drawAt : n BCE, nom de societe,
    signature) ne sont pas des valeurs de champ. On les detecte en comparant
    l'encre a celle du PDF vierge, puis en rattachant chaque caractere neuf au
    widget dont il occupe le rectangle.
"""
import os, sys, glob
import pdfplumber
from pypdf import PdfReader
from pypdf.generic import IndirectObject

# Generique : n'importe quel formulaire ONEM.
#   python scripts/verif-couverture-widgets.py <dossier-scenarios> [<pdf-vierge>]
DOSSIER = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ["TEMP"], "c1c-scenarios")
BASE = sys.argv[2] if len(sys.argv) > 2 else "private/pdfs/C1C_FR.pdf"


def resoudre(o):
    return o.get_object() if isinstance(o, IndirectObject) else o


def widgets(path):
    """{nom: [(page, rect), ...]} pour tous les champs de l'AcroForm."""
    r = PdfReader(path)
    page_of = {}
    for i, p in enumerate(r.pages):
        for a in (p.get("/Annots") or []):
            if isinstance(a, IndirectObject):
                page_of[a.idnum] = i
    out = {}

    def walk(ref, prefix=""):
        f = resoudre(ref)
        name = str(f.get("/T", "")) if f.get("/T") is not None else ""
        full = (prefix + "." + name) if (prefix and name) else (prefix or name)
        kids = resoudre(f.get("/Kids")) if f.get("/Kids") is not None else None
        enfants = [k for k in (kids or []) if resoudre(k).get("/T") is not None]
        widgets_kids = [k for k in (kids or []) if resoudre(k).get("/T") is None]
        if enfants:
            for k in enfants:
                walk(k, full)
            if not widgets_kids:
                return
        cibles = widgets_kids or [ref]
        geo = []
        for k in cibles:
            ko = resoudre(k)
            rect = [float(v) for v in (ko.get("/Rect") or [])]
            pg = page_of.get(k.idnum if isinstance(k, IndirectObject) else -1)
            if pg is None:
                p = ko.get("/P")
                pg = page_of.get(p.idnum) if isinstance(p, IndirectObject) else None
            geo.append((pg, rect))
        out[full] = geo

    acro = resoudre(r.trailer["/Root"]["/AcroForm"])
    for ref in acro.get("/Fields") or []:
        walk(ref)
    return out


def valeurs_et_etats(path):
    """Champs REMPLIS d'un PDF non aplati : texte non vide, ou case cochee."""
    r = PdfReader(path)
    remplis = set()
    fields = r.get_fields() or {}
    for nom, f in fields.items():
        v = f.get("/V")
        if v is None:
            continue
        s = str(v).strip()
        if s and s not in ("/Off", "Off", ""):
            remplis.add(nom)
    return remplis


def encre(path):
    """{(page, x0 arrondi, y arrondi, caractere)} — empreinte de l'encre."""
    pts = set()
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            for c in page.chars:
                pts.add((i, round(c["x0"], 1), round(c["top"], 1), c["text"]))
    return pts


def dans(rect, x, y, marge=3.0):
    x0, y0, x1, y1 = rect
    return (min(x0, x1) - marge) <= x <= (max(x0, x1) + marge) and (min(y0, y1) - marge) <= y <= (
        max(y0, y1) + marge
    )


def main():
    geo = widgets(BASE)
    total_widgets = sum(len(v) for v in geo.values())
    base_encre = encre(BASE)
    with pdfplumber.open(BASE) as pdf:
        hauteurs = [p.height for p in pdf.pages]

    couverts = {}          # nom -> set d'indices de widget couverts
    par_scenario = {}
    for path in sorted(glob.glob(os.path.join(DOSSIER, "*.pdf"))):
        cle = os.path.basename(path)[:-4]
        ctrl = os.path.join(DOSSIER, "_controle", os.path.basename(path))
        vus = set()

        # 1. valeurs de champs (PDF non aplati)
        if os.path.exists(ctrl):
            for nom in valeurs_et_etats(ctrl):
                if nom in geo:
                    vus.add(nom)
                    couverts.setdefault(nom, set()).update(range(len(geo[nom])))

        # 2. encre neuve (PDF aplati) rattachee au widget qui la contient
        neuve = encre(path) - base_encre
        for (pg, x, top, _ch) in neuve:
            y = hauteurs[pg] - top          # repere PDF, origine en bas
            for nom, cibles in geo.items():
                for idx, (wpg, rect) in enumerate(cibles):
                    if wpg == pg and rect and dans(rect, x, y):
                        vus.add(nom)
                        couverts.setdefault(nom, set()).add(idx)
        par_scenario[cle] = vus

    print(f"AcroForm {os.path.basename(BASE)} : {len(geo)} champs / {total_widgets} widgets\n")
    for cle, vus in par_scenario.items():
        print(f"  {cle:<34} {len(vus):>2} champs servis")

    manquants = [n for n in geo if n not in couverts]
    partiels = {n: (len(couverts[n]), len(geo[n])) for n in couverts if len(couverts[n]) < len(geo[n])}

    print(f"\nCouverture cumulee : {len(couverts)}/{len(geo)} champs, "
          f"{sum(len(v) for v in couverts.values())}/{total_widgets} widgets")
    if manquants:
        print("\n!! JAMAIS SERVIS :")
        for n in manquants:
            print(f"   - {n!r}  (pages/rect : {geo[n]})")
    if partiels:
        print("\n!! PARTIELS (champ multi-widgets) :")
        for n, (a, b) in partiels.items():
            print(f"   - {n!r} : {a}/{b} widgets")
    if not manquants and not partiels:
        print("\nOK — tous les widgets du PDF ont recu quelque chose.")


main()
