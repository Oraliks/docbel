"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds";
import { evaluateArticle110Verifier, type Article110VerifierInput } from "@/lib/regulatory-decision/article-110-verifier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addVerifierMember, removeVerifierMember, updateVerifierMember, type HouseholdRole, type VerifierMember } from "./form-state";

const roles: HouseholdRole[] = ["spouse", "partner", "child", "father", "mother", "sibling", "grandparent", "friend", "other"];

function id() { return `verifier-${crypto.randomUUID()}`; }
function amount(value: string) { const parsed = Number(value.replace(",", ".")); return Number.isFinite(parsed) && value.trim() !== "" ? parsed : undefined; }

export function FamilySituationVerifierClient({ thresholds }: { thresholds: C1BaremeThresholds }) {
  const t = useTranslations("public.pro");
  const [people, setPeople] = useState<VerifierMember[]>([]);
  const [role, setRole] = useState<HouseholdRole | "">("");
  const [alone, setAlone] = useState(false);
  const [alimony, setAlimony] = useState<boolean>();
  const [alimonyCondition, setAlimonyCondition] = useState<boolean>();
  const [care, setCare] = useState<boolean>();
  const [careDays, setCareDays] = useState<number>();
  const [careCycle, setCareCycle] = useState<"monthly" | "quarterly" | "semiannual" | "annual">();
  const [careAllowances, setCareAllowances] = useState<boolean>();
  const [careRelevantIncome, setCareRelevantIncome] = useState<boolean>();
  const input = useMemo<Article110VerifierInput>(() => ({
    people, thresholds, isAloneExplicit: alone,
    alimony: alimony === undefined ? undefined : { enabled: alimony, legalConditionEstablished: alimonyCondition, beneficiary: "minor_child" },
    alternatingCare: care === undefined ? undefined : { enabled: care, averageDaysPerWeek: careDays, cycle: careCycle, familyAllowances: careAllowances, childHasRelevantIncome: careRelevantIncome },
  }), [people, thresholds, alone, alimony, alimonyCondition, care, careDays, careCycle, careAllowances, careRelevantIncome]);
  const result = useMemo(() => evaluateArticle110Verifier(input), [input]);
  const update = (personId: string, patch: Partial<VerifierMember>) => setPeople((current) => updateVerifierMember(current, personId, patch));
  const add = () => { if (role) { setPeople((current) => addVerifierMember(current, role, id())); setRole(""); setAlone(false); } };

  return <section className="flex w-full flex-col gap-5">
    <header className="border-b pb-4"><h1 className="flex items-center gap-2 text-2xl font-semibold"><UsersRound className="size-6" />{t("article110VerifierTitle")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("article110VerifierIntro")}</p></header>
    <Card><CardHeader><CardTitle>{t("article110VerifierHousehold")}</CardTitle><CardDescription>{t("article110VerifierHouseholdHelp")}</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-end gap-2"><div className="min-w-52 flex-1"><Label>{t("article110VerifierRelation")}</Label><Select value={role} onValueChange={(value) => setRole(value as HouseholdRole)}><SelectTrigger className="mt-2"><SelectValue placeholder={t("article110VerifierChooseRelation")} /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item} value={item}>{t(`article110VerifierRole.${item}`)}</SelectItem>)}</SelectContent></Select></div><Button type="button" onClick={add} disabled={!role}><Plus />{t("article110VerifierAdd")}</Button><Button type="button" variant={alone ? "default" : "outline"} onClick={() => { setAlone(true); setPeople([]); }}>{t("article110VerifierAlone")}</Button></div>
      {people.length > 0 && <div className="space-y-3">{people.map((person) => <Person key={person.id} person={person} t={t} update={update} remove={() => setPeople((current) => removeVerifierMember(current, person.id))} />)}</div>}
    </CardContent></Card>
    {alone && <Card><CardHeader><CardTitle>{t("article110VerifierIsolated")}</CardTitle><CardDescription>{t("article110VerifierTheoreticalOnly")}</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><FactToggle t={t} label="article110VerifierAlimony" value={alimony} onChange={setAlimony} />{alimony && <FactToggle t={t} label="article110VerifierAlimonyCondition" value={alimonyCondition} onChange={setAlimonyCondition} />}<FactToggle t={t} label="article110VerifierAlternatingCare" value={care} onChange={setCare} />{care && <><div><Label htmlFor="care-days">{t("article110VerifierCareDays")}</Label><Input id="care-days" className="mt-2" inputMode="decimal" value={careDays ?? ""} onChange={(event) => setCareDays(amount(event.target.value))} /></div><div><Label>{t("article110VerifierCareCycle")}</Label><Select value={careCycle} onValueChange={(value) => setCareCycle(value as "monthly" | "quarterly" | "semiannual" | "annual")}><SelectTrigger className="mt-2"><SelectValue placeholder={t("article110VerifierCareCyclePlaceholder")} /></SelectTrigger><SelectContent><SelectItem value="monthly">{t("article110VerifierCareCycleMonthly")}</SelectItem><SelectItem value="quarterly">{t("article110VerifierCareCycleQuarterly")}</SelectItem><SelectItem value="semiannual">{t("article110VerifierCareCycleSemiannual")}</SelectItem><SelectItem value="annual">{t("article110VerifierCareCycleAnnual")}</SelectItem></SelectContent></Select></div><FactToggle t={t} label="article110VerifierCareAllowances" value={careAllowances} onChange={setCareAllowances} /><FactToggle t={t} label="article110VerifierCareIncome" value={careRelevantIncome} onChange={setCareRelevantIncome} /></>}</CardContent></Card>}
    <Card><CardHeader><CardTitle>{t("article110VerifierResult")}</CardTitle><CardDescription>{t("article110VerifierTheoreticalOnly")}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border bg-muted/30 p-4"><p className="text-sm font-medium">{t("article110VerifierCategory")}</p><p className="mt-1 text-xl font-semibold">{result.category === "A" ? t("article110VerifierCategoryA") : result.category === "B" ? t("article110VerifierCategoryB") : result.category === "N" ? t("article110VerifierCategoryN") : t("article110VerifierCategoryUndetermined")}</p><p className="mt-2 text-sm text-muted-foreground">{result.reason}</p></div>{result.onemDecisionStatus === "required" && <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{t("article110VerifierOnemReview")}</p></div>}{result.missingFacts.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{result.missingFacts.map((fact) => <li key={fact.factKey}>{fact.label}</li>)}</ul>}<p className="text-xs text-muted-foreground">{result.legalWarning}</p></CardContent></Card>
  </section>;
}

function FactToggle({ t, label, value, onChange }: { t: ReturnType<typeof useTranslations<"public.pro">>; label: string; value?: boolean; onChange: (value: boolean) => void }) {
  return <div><Label>{t(label as never)}</Label><div className="mt-2 flex gap-2"><Button size="sm" type="button" variant={value === true ? "default" : "outline"} onClick={() => onChange(true)}>{t("article110VerifierYes")}</Button><Button size="sm" type="button" variant={value === false ? "default" : "outline"} onClick={() => onChange(false)}>{t("article110VerifierNo")}</Button></div></div>;
}

function Person({ person, t, update, remove }: { person: VerifierMember; t: ReturnType<typeof useTranslations<"public.pro">>; update: (id: string, patch: Partial<VerifierMember>) => void; remove: () => void }) {
  const hasIncome = person.hasProfessionalIncome === true || person.hasReplacementIncome === true;
  return <div className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><Badge variant="secondary">{t(`article110VerifierRole.${person.role}`)}</Badge><Button type="button" variant="ghost" size="icon" aria-label={t("article110VerifierRemove")} onClick={remove}><Trash2 className="size-4" /></Button></div><div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label>{t("article110VerifierIncome")}</Label><Select value={person.hasProfessionalIncome ? "professional" : person.hasReplacementIncome ? "replacement" : hasIncome ? "unknown" : "none"} onValueChange={(value) => update(person.id, value === "professional" ? { hasProfessionalIncome: true, hasReplacementIncome: false } : value === "replacement" ? { hasProfessionalIncome: false, hasReplacementIncome: true } : { hasProfessionalIncome: false, hasReplacementIncome: false })}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t("article110VerifierIncomeNone")}</SelectItem><SelectItem value="professional">{t("article110VerifierIncomeProfessional")}</SelectItem><SelectItem value="replacement">{t("article110VerifierIncomeReplacement")}</SelectItem></SelectContent></Select></div>{person.hasProfessionalIncome && <><div><Label>{t("article110VerifierMonthlyIncome")}</Label><Input className="mt-2" inputMode="decimal" value={person.professionalIncomeAmount ?? ""} onChange={(event) => update(person.id, { professionalIncomeAmount: amount(event.target.value) })} /></div><div><Label>{t("article110VerifierContract")}</Label><Select value={person.professionalIncomeContract} onValueChange={(professionalIncomeContract) => update(person.id, { professionalIncomeContract: professionalIncomeContract as "cdi" | "cdd" | "other" })}><SelectTrigger className="mt-2"><SelectValue placeholder={t("article110VerifierChooseContract")} /></SelectTrigger><SelectContent><SelectItem value="cdi">CDI</SelectItem><SelectItem value="cdd">CDD</SelectItem><SelectItem value="other">{t("article110VerifierOtherContract")}</SelectItem></SelectContent></Select></div><FactToggle t={t} label="article110VerifierVariableIncome" value={person.professionalIncomeVariable} onChange={(professionalIncomeVariable) => update(person.id, { professionalIncomeVariable })} /></>}{person.hasReplacementIncome && <div><Label>{t("article110VerifierMonthlyIncome")}</Label><Input className="mt-2" inputMode="decimal" value={person.replacementIncomeAmount ?? ""} onChange={(event) => update(person.id, { replacementIncomeAmount: amount(event.target.value) })} /></div>}{person.relation === "child" && <FactToggle t={t} label="article110VerifierFamilyAllowances" value={person.receivesFamilyAllowances} onChange={(receivesFamilyAllowances) => update(person.id, { receivesFamilyAllowances })} />}</div></div>;
}
