"""Inventaire des GUIDES EN PEIGNE imprimes sous les widgets AcroForm.

Un formulaire ONEM imprime souvent, sous une case a remplir, une suite de
petites cases : « __ __ / __ __ / __ __ __ __ » pour une date, onze cases pour
un NISS. Y ecrire la valeur d'un bloc superpose le texte au guide et laisse les
dernieres cases vides a droite -- defaut releve cinq fois entre le 2026-07-27 et
le 2026-08-02, sur cinq champs de trois documents differents.

Aucun garde-fou ne le voyait : `seeds-vs-pdf` verifie qu'un widget EXISTE,
`widget-geometry` que l'ordre declare suit la lecture, la recette qu'une case
est servie. Aucun ne regarde si un GUIDE attend un peigne.

Ce script produit l'inventaire que le test `combs-vs-guides.test.ts` compare au
seed. Il est RE-JOUABLE : les PDF sont versionnes dans private/pdfs/.

    python scripts/detect-comb-guides.py

Ecrit lib/pdf-forms/__tests__/fixtures/comb-guides.json.
"""
import glob
import json
import os

import pdfplumber
from pypdf import PdfReader
from pypdf.generic import IndirectObject

SORTIE = os.path.join("lib", "pdf-forms", "__tests__", "fixtures", "comb-guides.json")

# Un guide est dessine soit avec des soulignes ASCII, soit avec un glyphe de la
# zone a usage prive d'une police symbole (SymbolMT sur le C1A). Les deux se
# rencontrent dans le parc, parfois sur le meme document.
def est_glyphe_guide(texte):
    return texte == "_" or (len(texte) == 1 and ord(texte) >= 0xF000)


# Nombre minimal de glyphes alignes pour parler de PEIGNE. En dessous, on est
# sur une simple ligne pointillee (un seul trait long) ou sur du bruit.
MIN_CASES = 4

# Tolerance verticale : le guide est imprime a la ligne de base de la case, le
# rectangle du widget la deborde de quelques points en haut comme en bas.
TOL_Y = 7.0
# Tolerance horizontale, de part et d'autre du rectangle.
TOL_X = 5.0


def resoudre(o):
    return o.get_object() if isinstance(o, IndirectObject) else o


def widgets(path):
    """[(nom, page, rect), ...] pour TOUS les widgets, kids compris."""
    r = PdfReader(path)
    page_of = {}
    for i, p in enumerate(r.pages):
        for a in (p.get("/Annots") or []):
            if isinstance(a, IndirectObject):
                page_of[a.idnum] = i
    racine = resoudre(r.trailer["/Root"])
    acro = resoudre(racine.get("/AcroForm")) if racine.get("/AcroForm") else None
    if not acro:
        return []
    out = []

    def walk(ref, prefixe=""):
        f = resoudre(ref)
        nom = str(f.get("/T", "")) if f.get("/T") is not None else ""
        complet = (prefixe + "." + nom) if (prefixe and nom) else (prefixe or nom)
        kids = resoudre(f.get("/Kids")) if f.get("/Kids") is not None else None
        # Noeud intermediaire (kids nommes) : on descend sans rien enregistrer.
        if kids and any(resoudre(k).get("/T") is not None for k in kids):
            for k in kids:
                walk(k, complet)
            return
        cibles = kids if kids else [ref]
        for k in cibles:
            kk = resoudre(k)
            if kk.get("/Rect") is None:
                continue
            idnum = k.idnum if isinstance(k, IndirectObject) else None
            x0, y0, x1, y1 = [float(v) for v in kk["/Rect"]]
            out.append((complet, page_of.get(idnum, 0), [x0, y0, x1, y1]))

    for fld in acro.get("/Fields", []):
        walk(fld)
    return out


def guides_par_page(pdf):
    """{page: [char, ...]} des seuls glyphes de guide."""
    out = {}
    for i, page in enumerate(pdf.pages):
        out[i] = [c for c in page.chars if est_glyphe_guide(c["text"])]
    return out


def peigne_sous(rect, glyphes):
    """Les glyphes de guide alignes sous ce rectangle, tries par abscisse."""
    x0, y0, x1, _ = rect
    dedans = [
        c
        for c in glyphes
        if abs(c["y0"] - y0) <= TOL_Y and (x0 - TOL_X) <= c["x0"] <= (x1 + TOL_X)
    ]
    return sorted(dedans, key=lambda c: c["x0"])


def en_cases(glyphes):
    """Regroupe les glyphes COLLES en une seule case.

    Un guide se dessine tantot avec un glyphe par case (SymbolMT du C1A),
    tantot avec deux soulignes accoles (« __ » du C1 et du Regis). Sans ce
    regroupement, une date a huit cases serait annoncee « 16 cases » et le pas
    mesure serait celui de deux soulignes, pas celui d'une case.
    """
    if not glyphes:
        return []
    cases = [[glyphes[0]]]
    for prec, cur in zip(glyphes, glyphes[1:]):
        largeur = prec["x1"] - prec["x0"]
        # Colles : l'ecart n'excede pas la largeur d'un glyphe (plus une marge
        # pour le crenage). Au-dela, c'est une nouvelle case.
        if (cur["x0"] - prec["x0"]) <= largeur * 1.4:
            cases[-1].append(cur)
        else:
            cases.append([cur])
    return cases


def decrire(glyphes):
    """Geometrie directement exploitable : cases, pas, ruptures de groupe."""
    cases = en_cases(glyphes)
    xs = [round(c[0]["x0"], 2) for c in cases]
    fin = round(cases[-1][-1]["x1"], 2)
    ecarts = [round(b - a, 2) for a, b in zip(xs, xs[1:])]
    if not ecarts:
        return {"x": xs, "finX": fin, "pas": None, "ecartGroupe": None, "groupes": [len(xs)]}
    pas = min(ecarts)
    groupes, courant, extras = [], 1, []
    for e in ecarts:
        # Une rupture de groupe est un ecart nettement superieur au pas.
        if e > pas + 1.5:
            groupes.append(courant)
            extras.append(round(e - pas, 2))
            courant = 1
        else:
            courant += 1
    groupes.append(courant)
    return {
        "x": xs,
        "finX": fin,
        "pas": pas,
        # Ecart SUPPLEMENTAIRE aux ruptures (`groupExtra`). Plusieurs valeurs =
        # ruptures inegales : a trancher a la main.
        "ecartGroupe": sorted(set(extras)) or None,
        "groupes": groupes,
    }


def main():
    inventaire = {}
    for path in sorted(glob.glob(os.path.join("private", "pdfs", "*.pdf"))):
        nom_pdf = os.path.basename(path)
        try:
            ws = widgets(path)
            with pdfplumber.open(path) as pdf:
                gp = guides_par_page(pdf)
                trouves = {}
                for nom, page, rect in ws:
                    glyphes = peigne_sous(rect, gp.get(page, []))
                    d = decrire(glyphes) if glyphes else None
                    if d and len(d["x"]) >= MIN_CASES:
                        # Un champ AcroForm peut porter PLUSIEURS widgets, sur
                        # des pages differentes, chacun avec son guide (le NISS
                        # du C1 et du C1C est rappele en en-tete de page 2).
                        # On les empile tous : ecraser en garderait un au
                        # hasard, et c'est justement le multi-widget qui
                        # decide du traitement (peigne ou regle serveur).
                        trouves.setdefault(nom, []).append({
                            "page": page,
                            "cases": len(d["x"]),
                            "groupes": d["groupes"],
                            "pas": d["pas"],
                            "ecartGroupe": d["ecartGroupe"],
                            "premierX": d["x"][0],
                            "finX": d["finX"],
                            "guideY": round(glyphes[0]["y0"], 2),
                            "tailleGuide": round(glyphes[0]["size"], 2),
                            "rect": [round(v, 2) for v in rect],
                        })
        except Exception as e:  # PDF illisible : on le dit, on ne casse pas.
            print("  !! %s illisible : %s" % (nom_pdf, e))
            continue
        if trouves:
            inventaire[nom_pdf] = dict(sorted(trouves.items()))
            n = sum(len(v) for v in trouves.values())
            print("%-28s %d widget(s) sur un peigne (%d champs)" % (nom_pdf, n, len(trouves)))
        else:
            print("%-28s aucun" % nom_pdf)

    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(inventaire, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    total = sum(len(w) for v in inventaire.values() for w in v.values())
    print("\n%d widgets sur un guide en peigne -> %s" % (total, SORTIE))


if __name__ == "__main__":
    main()
