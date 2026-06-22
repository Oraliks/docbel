"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { VisualEditorProvider, useVisualEditor } from "./provider/visual-editor-context";
import { VisualEditorToolbar } from "./visual-editor-toolbar";
import { VisualCanvas } from "./visual-canvas";
import { VisualFieldProperties } from "./visual-field-properties";
import { VisualMaterializeDialog } from "./visual-materialize-dialog";

interface VisualEditorProps {
  formId: string;
  /// Indique au shell si le PDF source contient déjà un AcroForm (cf. GET
  /// /visual-fields). Sert à désactiver la matérialisation côté UI.
  sourceHasAcroForm?: boolean;
  /// Notifié après une matérialisation réussie côté serveur. Le parent en a
  /// besoin pour recharger fields/technicalSchema/issues, que la route
  /// /materialize met à jour mais qui sont détenus dans useFormData
  /// (cf. load + loadIssues passés depuis l'onglet Champs).
  onMaterialized?: () => void;
}

/// Shell de l'éditeur visuel. Sur viewport mobile (md:hidden), bascule en
/// mode read-only avec bannière d'information — l'édition de positions
/// précises n'a pas de sens en dessous de 768px.
export function VisualEditor({ formId, onMaterialized }: VisualEditorProps) {
  const t = useTranslations("admin.pdf");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <VisualEditorProvider formId={formId} readOnly={isMobile} onMaterialized={onMaterialized}>
      {isMobile && (
        <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          {t("visualMobileReadOnly")}
        </div>
      )}
      <VisualEditorShell />
    </VisualEditorProvider>
  );
}

function VisualEditorShell() {
  const t = useTranslations("admin.pdf");
  const ed = useVisualEditor();
  const { serverSnapshot, save, doc } = ed;
  // numPages réel arrive via react-pdf onLoadSuccess ; on initialise au
  // pageCount du serveur si dispo pour éviter un flash "page ? / ?".
  const [numPagesFromPdf, setNumPagesFromPdf] = useState<number | null>(null);
  const numPages = numPagesFromPdf ?? serverSnapshot?.pageCount ?? 0;
  const [matOpen, setMatOpen] = useState(false);

  // Raccourcis clavier (locaux : pas besoin du hook documents qui dépend de DocumentField).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "v" || e.key === "V") ed.setTool("select");
      else if (e.key === "t" || e.key === "T") ed.setTool("text");
      else if (e.key === "c" || e.key === "C") ed.setTool("checkbox");
      else if (e.key === "Escape") ed.selectField(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && ed.ui.selectedId) {
        ed.removeField(ed.ui.selectedId);
        e.preventDefault();
      } else if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ed, save]);

  const onMaterialize = useCallback(() => setMatOpen(true), []);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar sticky : reste visible lors du scroll du PDF. Le shell
          d'édition empile une barre d'action (sticky top-0, ~56px) puis une
          rangée de tabs (sticky top-14, ~46px). On décale donc à ~104px pour
          passer sous les deux sans recouvrement ni gap, à toutes tailles. */}
      <Card
        size="sm"
        className="sticky top-[6.25rem] z-10 gap-0 rounded-md py-0 ring-1 ring-foreground/10 bg-background/95 supports-[backdrop-filter]:bg-background/70 backdrop-blur"
      >
        <VisualEditorToolbar
          numPages={numPages}
          onMaterialize={onMaterialize}
          hasRotatedPages={!!serverSnapshot?.hasRotatedPages}
          sourceHasAcroForm={!!serverSnapshot?.sourceHasAcroForm}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <VisualCanvas formId={ed.formId} onNumPages={setNumPagesFromPdf} />
        <aside className="flex flex-col gap-3">
          <VisualFieldProperties />
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">{t("tipHeading")}</div>
            <p>
              {t.rich("visualTip", {
                kbd: (chunks) => <kbd className="rounded border bg-background px-1">{chunks}</kbd>,
              })}
            </p>
          </div>
          {doc.fields.length > 0 && (
            <div className="rounded-md border p-3 text-xs">
              <div className="mb-1 font-medium">{t("fieldsCount", { count: doc.fields.length })}</div>
              <ul className="flex flex-col gap-1">
                {doc.fields.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className={`flex-1 truncate text-left hover:underline ${ed.ui.selectedId === f.id ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      onClick={() => {
                        ed.selectField(f.id);
                        ed.setPage(f.page);
                      }}
                    >
                      {f.name}
                    </button>
                    <span className="text-[10px] text-muted-foreground">p{f.page + 1}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <VisualMaterializeDialog
        open={matOpen}
        onOpenChange={setMatOpen}
        onApplied={() => {
          /* le provider recharge déjà via reload() */
        }}
      />
    </div>
  );
}
