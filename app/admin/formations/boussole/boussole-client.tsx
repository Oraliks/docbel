"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Compass, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  AdminOrientationQuestion,
  AdminOrientationBranch,
} from "@/lib/formations/admin-queries";

interface Props {
  questions: AdminOrientationQuestion[];
  branches: AdminOrientationBranch[];
}

export function BoussoleClient({ questions, branches }: Props) {
  const activeCount = questions.filter((q) => q.isActive).length;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Boussole d'orientation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount}/{questions.length} question
            {questions.length > 1 ? "s" : ""} active{activeCount > 1 ? "s" : ""} ·{" "}
            {branches.length} branche{branches.length > 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">
            Questions ({questions.length})
          </TabsTrigger>
          <TabsTrigger value="branches">
            Branches ({branches.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <div className="flex flex-col gap-3">
            {questions.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Aucune question. Elles sont définies au seed de la Boussole.
                </CardContent>
              </Card>
            )}
            {questions.map((q, i) => (
              <QuestionCard key={q.id} question={q} index={i} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {branches.map((b) => (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      <Layers className="size-4" style={{ color: b.color }} />
                      {b.name}
                    </span>
                    <Badge
                      variant={b.isActive ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {b.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {b.description && (
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {b.description}
                    </p>
                  )}
                  {b.possibleJobs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.possibleJobs.slice(0, 8).map((job) => (
                        <Badge key={job} variant="outline" className="text-[10px]">
                          {job}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuestionCard({
  question,
  index,
}: {
  question: AdminOrientationQuestion;
  index: number;
}) {
  const router = useRouter();
  const [active, setActive] = useState(question.isActive);
  const [busy, setBusy] = useState(false);

  const toggle = async (value: boolean) => {
    setActive(value);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/formations/boussole/questions/${question.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: value }),
        },
      );
      if (!res.ok) throw new Error("Échec");
      toast.success(value ? "Question activée." : "Question désactivée.");
      router.refresh();
    } catch {
      setActive(!value);
      toast.error("Impossible de modifier la question.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={active ? "" : "opacity-70"}>
      <CardContent className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              Q{index + 1}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {question.type === "multi" ? "Choix multiple" : "Choix unique"}
            </Badge>
          </div>
          <p className="font-medium mt-1">{question.text}</p>
          {question.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {question.description}
            </p>
          )}
          {question.options.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {question.options.map((opt) => (
                <Badge key={opt.id} variant="secondary" className="text-[10px]">
                  {opt.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <Switch checked={active} onCheckedChange={toggle} disabled={busy} />
          <span className="text-[10px] text-muted-foreground">
            {active ? "Active" : "Inactive"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
