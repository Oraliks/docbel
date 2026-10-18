"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, Check, CircleHelp, FileText, Info, Pencil, Plus, Trash2, UsersRound } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/i18n/format"
import { GLASS_CARD, GLASS_INPUT } from "@/lib/glass-classes"
import type { C1BaremeThresholds } from "@/lib/baremes/c1-thresholds"
import { evaluateArticle110Verifier, type Article110VerifierInput } from "@/lib/regulatory-decision/article-110-verifier"

export type Intent = "current" | "changed" | "unknown"
export type Relation = "spouse" | "partner" | "child" | "parent" | "family" | "unrelated"
type Step =
  | "intent" | "date" | "household" | "confirm" | "aloneSituation" | "alimonyDocument"
  | "partnerSituation" | "partnerSalary" | "partnerFixed" | "partnerContract" | "partnerDates" | "partnerOther"
  | "childrenAllowance" | "childrenIncome" | "childFirstWorkChoice" | "childFirstWork" | "relativeIncome"
  | "relativeIncomeKind" | "relativePension" | "relativeSpf" | "unrelatedIncome" | "unrelatedDetail" | "unrelatedHousehold" | "particular" | "summary"
export type Person = { id: string; name: string; relation: Relation }
export type Answers = Partial<Record<"aloneSituation" | "alimonyDocument" | "partnerSituation" | "partnerFixed" | "partnerContract" | "childrenAllowance" | "childrenIncome" | "childFirstWork" | "relativeIncome" | "relativeIncomeKind" | "relativePension" | "relativeSpf" | "unrelatedIncome" | "unrelatedHousehold", string>>
type DetailKey = "partnerAmount" | "partnerDetail" | "relativeAmount" | "studiesEndedAt" | "workStartedAt" | "contractStartAt" | "contractEndAt" | "unrelatedDetail"
type SummaryDetail = { label: string; value: string }

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `person-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function namedPensionAmounts(value: string, people: Person[]) {
  const amounts = new Map<string, number>()
  const invalidPersonIds = new Set<string>()
  for (const entry of value.split(/[;\n]/)) {
    const match = entry.match(/^\s*([^:]+):\s*(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s*(?:€|EUR)?\s*$/i)
    if (!match) continue
    const candidates = people.filter((candidate) => (candidate.relation === "parent" || candidate.relation === "family") && candidate.name.trim().toLocaleLowerCase("fr-BE") === match[1].trim().toLocaleLowerCase("fr-BE"))
    if (candidates.length !== 1 || invalidPersonIds.has(candidates[0]?.id ?? "")) continue
    if (amounts.has(candidates[0].id)) {
      amounts.delete(candidates[0].id)
      invalidPersonIds.add(candidates[0].id)
      continue
    }
    amounts.set(candidates[0].id, Number(match[2].replace(/[\s\u00a0]/g, "").replace(",", ".")))
  }
  return amounts
}

export function buildFamilySituationEvaluationInput({ thresholds, date, intent, livesAlone, people, answers, partnerAmount, relativeAmount }: {
  thresholds: C1BaremeThresholds
  date: string
  intent?: Intent
  livesAlone: boolean
  people: Person[]
  answers: Answers
  partnerAmount: string
  relativeAmount: string
}): Article110VerifierInput {
  const composition = {
    children: people.some((person) => person.relation === "child"),
    family: people.some((person) => person.relation === "parent" || person.relation === "family"),
    unrelated: people.some((person) => person.relation === "unrelated"),
    partner: people.some((person) => person.relation === "spouse" || person.relation === "partner"),
  }
  const pensionAmounts = namedPensionAmounts(relativeAmount, people)
  const askRelativeSpf = !composition.children
    && thresholds.ascendantPensionMonthly !== null
    && thresholds.ascendantDisabledPensionMonthly !== null
    && thresholds.ascendantPensionMonthly !== thresholds.ascendantDisabledPensionMonthly
  return {
    thresholds,
    asOf: /^\d{2}\/\d{2}\/\d{4}$/.test(date) ? `${date.slice(6)}-${date.slice(3, 5)}-${date.slice(0, 2)}` : date,
    isAloneExplicit: livesAlone,
    multiPersonHouseholdSelected: intent === "unknown" ? true : !livesAlone && people.length > 0,
    anyChildReceivesFamilyAllowances: answers.childrenAllowance === "yes" ? true : answers.childrenAllowance === "no" ? false : undefined,
    cohousing: composition.unrelated && !composition.partner && !composition.children && !composition.family
      ? answers.unrelatedHousehold === "separate" ? true : answers.unrelatedHousehold === "shared" ? false : undefined : undefined,
    cohousingAutonomousLiving: answers.unrelatedHousehold === "separate" ? true : answers.unrelatedHousehold === "shared" ? false : undefined,
    isolatedDeclaration: answers.aloneSituation === "alimony" ? "alimony" : answers.aloneSituation === "alternating" ? "alternating_care" : undefined,
    // The public journey does not collect payment or beneficiary facts. A judgment
    // remains visible in the recap, while the shared engine keeps the category to confirm.
    alimony: answers.aloneSituation === "alimony" ? { enabled: true, legalConditionEstablished: answers.alimonyDocument === "judgment" ? true : ["pending", "none"].includes(answers.alimonyDocument ?? "") ? false : undefined } : undefined,
    people: people.map((person) => {
      const isPartner = person.relation === "spouse" || person.relation === "partner"
      const noIncome = isPartner && answers.partnerSituation === "noIncome"
      const childNoIncome = person.relation === "child" && answers.childrenIncome === "no"
      const relativeNoIncome = (person.relation === "parent" || person.relation === "family") && answers.relativeIncome === "no"
      const unrelatedNoIncome = person.relation === "unrelated" && answers.unrelatedIncome === "no"
      const partnerEmployee = isPartner && answers.partnerSituation === "employee"
      const partnerReplacement = isPartner && ["unemployment", "mutual", "pension", "disability", "cpas"].includes(answers.partnerSituation ?? "")
      const partnerAmountNumber = /^\s*\d+(?:[.,]\d+)?\s*$/.test(partnerAmount) ? Number(partnerAmount.replace(",", ".")) : undefined
      const familyPension = (person.relation === "parent" || person.relation === "family") && answers.relativeIncomeKind === "pension" && pensionAmounts.has(person.id)
      return {
        id: person.id,
        relation: person.relation === "parent" || person.relation === "family" ? "relative" as const : person.relation === "unrelated" ? "third_party" as const : person.relation,
        isAscendant: person.relation === "parent" ? true : undefined,
        disabilityRelevant: familyPension && askRelativeSpf ? answers.relativeSpf === "yes" ? true : answers.relativeSpf === "no" ? false : undefined : undefined,
        receivesFamilyAllowances: person.relation === "child" && answers.childrenAllowance === "yes" ? true : person.relation === "child" && answers.childrenAllowance === "no" ? false : undefined,
        hasProfessionalIncome: noIncome || childNoIncome || relativeNoIncome || unrelatedNoIncome ? false : partnerEmployee ? true : partnerReplacement ? false : undefined,
        professionalIncomeAmount: partnerEmployee ? partnerAmountNumber : undefined,
        professionalIncomeType: partnerEmployee ? "employee" as const : undefined,
        professionalIncomeContract: answers.partnerContract === "cdi" ? "cdi" : answers.partnerContract === "temporary" ? "cdd" : answers.partnerContract === "other" ? "other" : undefined,
        professionalIncomeVariable: answers.partnerFixed === "fixed" ? false : answers.partnerFixed === "variable" ? true : undefined,
        hasReplacementIncome: noIncome || childNoIncome || relativeNoIncome || unrelatedNoIncome ? false : partnerEmployee ? false : familyPension || partnerReplacement ? true : undefined,
        replacementIncomeType: familyPension || answers.partnerSituation === "pension" ? "pension" as const : answers.partnerSituation === "disability" ? "disability_allowance" as const : partnerReplacement ? "other" as const : undefined,
        replacementIncomeAmount: pensionAmounts.get(person.id),
      }
    }),
  }
}

export function FamilySituationClient({ thresholds }: { thresholds: C1BaremeThresholds }) {
  const t = useTranslations("public.familySituation")
  const locale = useLocale()
  const [step, setStep] = useState<Step>("intent")
  const [history, setHistory] = useState<Step[]>([])
  const [intent, setIntent] = useState<Intent>()
  const [date, setDate] = useState(() => formatDate(new Date(), locale))
  const [savedDate, setSavedDate] = useState(date)
  const [people, setPeople] = useState<Person[]>([])
  const [savedPeople, setSavedPeople] = useState<Person[]>([])
  const [livesAlone, setLivesAlone] = useState(false)
  const [savedLivesAlone, setSavedLivesAlone] = useState(false)
  const [answers, setAnswers] = useState<Answers>({})
  const [partnerAmount, setPartnerAmount] = useState("")
  const [partnerDetail, setPartnerDetail] = useState("")
  const [relativeAmount, setRelativeAmount] = useState("")
  const [studiesEndedAt, setStudiesEndedAt] = useState("")
  const [workStartedAt, setWorkStartedAt] = useState("")
  const [contractStartAt, setContractStartAt] = useState("")
  const [contractEndAt, setContractEndAt] = useState("")
  const [unrelatedDetail, setUnrelatedDetail] = useState("")
  const [unknownDetails, setUnknownDetails] = useState<DetailKey[]>([])
  const [particular, setParticular] = useState<string[]>([])
  const [name, setName] = useState("")
  const [relation, setRelation] = useState<Relation>("spouse")
  const [editingId, setEditingId] = useState<string>()

  const composition = useMemo(() => ({
    children: people.some((person) => person.relation === "child"),
    family: people.some((person) => person.relation === "parent" || person.relation === "family"),
    unrelated: people.some((person) => person.relation === "unrelated"),
    partner: people.some((person) => person.relation === "spouse" || person.relation === "partner"),
  }), [people])
  const childrenOnly = composition.children && !composition.family && !composition.unrelated && !composition.partner
  const shouldAskRelativeSpf = !composition.children
    && thresholds.ascendantPensionMonthly !== null
    && thresholds.ascendantDisabledPensionMonthly !== null
    && thresholds.ascendantPensionMonthly !== thresholds.ascendantDisabledPensionMonthly
  const householdChanged = useMemo(() => JSON.stringify({ people, livesAlone }) !== JSON.stringify({ people: savedPeople, livesAlone: savedLivesAlone }), [livesAlone, people, savedLivesAlone, savedPeople])
  const householdAnswersExist = Object.values(answers).some((value) => value !== undefined) || [partnerAmount, partnerDetail, relativeAmount, studiesEndedAt, workStartedAt, contractStartAt, contractEndAt, unrelatedDetail].some(Boolean) || unknownDetails.length > 0 || particular.length > 0
  const relationLabel = (value: Relation) => value === "spouse" ? t("relationSpouse") : value === "partner" ? t("relationPartner") : value === "child" ? t("relationChild") : value === "parent" ? t("relationParent") : value === "family" ? t("relationFamily") : t("relationUnrelated")
  const firstPartner = people.find((person) => person.relation === "spouse" || person.relation === "partner")
  const evaluationInput = useMemo(() => buildFamilySituationEvaluationInput({ thresholds, date, intent, livesAlone, people, answers, partnerAmount, relativeAmount }), [answers, date, intent, livesAlone, partnerAmount, people, relativeAmount, thresholds])
  const evaluation = useMemo(() => evaluateArticle110Verifier(evaluationInput), [evaluationInput])
  const canShowCategory = intent !== "unknown" && unknownDetails.length === 0 && particular.length === 0
    && evaluation.category !== null && evaluation.missingFacts.length === 0 && evaluation.onemDecisionStatus === "not_required"
  const publicEvaluation = canShowCategory ? evaluation : {
    ...evaluation,
    category: null,
    reason: t("summaryNoCategoryBody"),
  }

  const go = (next: Step) => {
    setHistory((current) => [...current, step])
    setStep(next)
  }
  const back = () => {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    setStep(previous)
  }
  const updateAnswer = (key: keyof Answers, value: string) => setAnswers((current) => ({ ...current, [key]: value }))
  const clearAnswerKeys = (...keys: (keyof Answers)[]) => setAnswers((current) => {
    const next = { ...current }
    keys.forEach((key) => { delete next[key] })
    return next
  })
  const clearDetails = (...keys: DetailKey[]) => {
    keys.forEach((key) => {
      if (key === "partnerAmount") setPartnerAmount("")
      if (key === "partnerDetail") setPartnerDetail("")
      if (key === "relativeAmount") setRelativeAmount("")
      if (key === "studiesEndedAt") setStudiesEndedAt("")
      if (key === "workStartedAt") setWorkStartedAt("")
      if (key === "contractStartAt") setContractStartAt("")
      if (key === "contractEndAt") setContractEndAt("")
      if (key === "unrelatedDetail") setUnrelatedDetail("")
    })
    setUnknownDetails((current) => current.filter((key) => !keys.includes(key)))
  }
  const updateDetail = (key: DetailKey, setValue: (value: string) => void) => (value: string) => {
    setValue(value)
    if (value) setUnknownDetails((current) => current.filter((item) => item !== key))
  }
  const markDetailUnknown = (key: DetailKey) => setUnknownDetails((current) => current.includes(key) ? current : [...current, key])
  const clearHouseholdAnswers = () => {
    setAnswers({})
    clearDetails("partnerAmount", "partnerDetail", "relativeAmount", "studiesEndedAt", "workStartedAt", "contractStartAt", "contractEndAt", "unrelatedDetail")
    setParticular([])
  }
  const startForHousehold = (): Step => {
    if (livesAlone) return "aloneSituation"
    if (composition.partner) return "partnerSituation"
    if (composition.children) return "childrenAllowance"
    if (composition.family) return "relativeIncome"
    if (composition.unrelated) return "unrelatedHousehold"
    return "summary"
  }
  const addOrUpdatePerson = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (editingId) setPeople((current) => current.map((person) => person.id === editingId ? { ...person, name: trimmed, relation } : person))
    else setPeople((current) => [...current, { id: makeId(), name: trimmed, relation }])
    setLivesAlone(false)
    setName("")
    setRelation("spouse")
    setEditingId(undefined)
  }
  const continueHousehold = () => {
    if (householdChanged && householdAnswersExist) return go("confirm")
    setSavedPeople(people)
    setSavedLivesAlone(livesAlone)
    go(startForHousehold())
  }
  const continueDate = () => {
    if (date !== savedDate && householdAnswersExist) return go("confirm")
    setSavedDate(date)
    go("household")
  }
  const chooseIntent = (value: Intent) => {
    if (value === "current") {
      const today = formatDate(new Date(), locale)
      setDate(today)
      setSavedDate(today)
    }
    setIntent(value)
  }
  const continueIntent = () => {
    if (!intent) return
    setHistory([])
    setStep(intent === "changed" ? "date" : intent === "unknown" ? "particular" : "household")
  }
  const close = () => go("particular")
  const afterPartner = (): Step => composition.children ? "childrenAllowance" : composition.family ? "relativeIncome" : composition.unrelated ? "unrelatedIncome" : "particular"
  const afterFamily = (): Step => composition.unrelated ? "unrelatedIncome" : "particular"
  const afterChildren = (): Step => composition.family ? "relativeIncome" : composition.unrelated ? "unrelatedIncome" : "particular"
  const topic = t(`topic${step[0].toUpperCase()}${step.slice(1)}` as never)

  return (
    <section className="glass-root flex w-full flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 lg:px-8" aria-labelledby="family-situation-title">
      <header className="glass-surface flex flex-col gap-3 p-5 sm:p-7">
        <div className="flex items-start gap-3"><span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden><UsersRound className="size-6" /></span><div><p className="text-sm font-semibold text-[color:var(--glass-ink-soft)]">{t("eyebrow")}</p><h1 id="family-situation-title" className="glass-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("intro")}</p></div></div>
        <details className="glass-feedback px-4 py-3" data-tone="info"><summary className="cursor-pointer font-semibold">{t("helpSummary")}</summary><p className="mt-2 text-sm leading-relaxed">{t("helpBody")}</p></details>
      </header>
      <Card className={`${GLASS_CARD} p-1`}><CardContent className="space-y-6 p-4 sm:p-7">
        {step !== "intent" ? <div className="flex items-center justify-between gap-3 text-sm">{history.length ? <Button type="button" variant="ghost" onClick={back}><ArrowLeft data-icon="inline-start" />{t("back")}</Button> : <span />}<span className="font-semibold text-[color:var(--glass-ink-soft)]">{topic}</span></div> : null}
        {step === "intent" ? <IntentStep t={t} value={intent} onChoose={chooseIntent} onContinue={continueIntent} /> : null}
        {step === "date" ? <DateStep t={t} value={date} onChange={setDate} onContinue={continueDate} /> : null}
        {step === "household" ? <HouseholdStep t={t} people={people} livesAlone={livesAlone} name={name} relation={relation} editingId={editingId} relationLabel={relationLabel} onNameChange={setName} onRelationChange={setRelation} onAdd={addOrUpdatePerson} onEdit={(person) => { setName(person.name); setRelation(person.relation); setEditingId(person.id) }} onRemove={(id) => setPeople((current) => current.filter((person) => person.id !== id))} onAlone={() => { setPeople([]); setLivesAlone(true); setEditingId(undefined); setName("") }} onUnknown={() => { setPeople([]); setLivesAlone(false); setEditingId(undefined); clearHouseholdAnswers(); go("particular") }} onContinue={continueHousehold} /> : null}
        {step === "confirm" ? <ConfirmStep t={t} onConfirm={() => { clearHouseholdAnswers(); setSavedDate(date); setSavedPeople(people); setSavedLivesAlone(livesAlone); go(startForHousehold()) }} /> : null}
        {step === "aloneSituation" ? <ChoiceStep t={t} titleKey="aloneQuestion" choices={["none", "alimony", "alternating", "unknown"]} labelKey="aloneSituation" value={answers.aloneSituation} onChoose={(value) => { updateAnswer("aloneSituation", value); if (value !== "alimony") clearAnswerKeys("alimonyDocument"); if (value === "alimony") go("alimonyDocument"); else close() }} /> : null}
        {step === "alimonyDocument" ? <ChoiceStep t={t} titleKey="alimonyDocumentQuestion" choices={["judgment", "pending", "none", "unknown"]} labelKey="alimonyDocument" value={answers.alimonyDocument} notice={answers.alimonyDocument === "pending" ? t("judgmentPendingNotice") : t("alimonyPaymentNotice")} onChoose={(value) => { updateAnswer("alimonyDocument", value); close() }} /> : null}
        {step === "partnerSituation" ? <ChoiceStep t={t} titleKey="partnerSituationQuestion" values={{ name: firstPartner?.name ?? t("partnerFallback") }} choices={["noIncome", "employee", "selfEmployed", "unemployment", "mutual", "pension", "disability", "cpas", "other", "unknown"]} labelKey="partnerSituation" value={answers.partnerSituation} onChoose={(value) => { updateAnswer("partnerSituation", value); clearAnswerKeys("partnerFixed", "partnerContract"); clearDetails("partnerAmount", "partnerDetail", "contractStartAt", "contractEndAt"); if (value === "employee") go("partnerSalary"); else if (value !== "noIncome" && value !== "unknown") go("partnerOther"); else go(afterPartner()) }} /> : null}
        {step === "partnerSalary" ? <AmountStep t={t} titleKey="partnerSalaryQuestion" bodyKey="partnerSalaryBody" value={partnerAmount} onChange={updateDetail("partnerAmount", setPartnerAmount)} onUnknown={() => { markDetailUnknown("partnerAmount"); go("partnerFixed") }} onContinue={() => go("partnerFixed")} /> : null}
        {step === "partnerFixed" ? <ChoiceStep t={t} titleKey="partnerFixedQuestion" choices={["fixed", "variable", "unknown"]} labelKey="partnerFixed" value={answers.partnerFixed} onChoose={(value) => { updateAnswer("partnerFixed", value); clearAnswerKeys("partnerContract"); clearDetails("contractStartAt", "contractEndAt"); go("partnerContract") }} /> : null}
        {step === "partnerContract" ? <ChoiceStep t={t} titleKey="partnerContractQuestion" choices={["cdi", "temporary", "other", "unknown"]} labelKey="partnerContract" value={answers.partnerContract} onChoose={(value) => { updateAnswer("partnerContract", value); if (value !== "temporary") clearDetails("contractStartAt", "contractEndAt"); go(value === "temporary" ? "partnerDates" : afterPartner()) }} /> : null}
        {step === "partnerDates" ? <DatesStep t={t} titleKey="partnerDatesQuestion" bodyKey="partnerDatesBody" firstLabelKey="contractStartLabel" secondLabelKey="contractEndLabel" valueA={contractStartAt} valueB={contractEndAt} onChangeA={updateDetail("contractStartAt", setContractStartAt)} onChangeB={updateDetail("contractEndAt", setContractEndAt)} onUnknown={() => { markDetailUnknown("contractStartAt"); markDetailUnknown("contractEndAt"); go(afterPartner()) }} onContinue={() => go(afterPartner())} /> : null}
        {step === "partnerOther" ? <TextStep t={t} titleKey="partnerOtherQuestion" bodyKey="partnerOtherBody" value={partnerDetail} onChange={updateDetail("partnerDetail", setPartnerDetail)} onUnknown={() => { markDetailUnknown("partnerDetail"); go(afterPartner()) }} onContinue={() => go(afterPartner())} /> : null}
        {step === "childrenAllowance" ? <ChoiceStep t={t} titleKey="childrenQuestion" bodyKey="childrenBody" choices={["yes", "no", "unknown"]} labelKey="childrenAllowance" value={answers.childrenAllowance} onChoose={(value) => { updateAnswer("childrenAllowance", value); if (value !== "no") { clearAnswerKeys("childrenIncome", "childFirstWork"); clearDetails("studiesEndedAt", "workStartedAt") } if (childrenOnly) go(value === "no" ? "childrenIncome" : "particular"); else go(afterChildren()) }} /> : null}
        {step === "childrenIncome" ? <ChoiceStep t={t} titleKey="childrenIncomeQuestion" choices={["yes", "no", "unknown"]} labelKey="childrenIncome" value={answers.childrenIncome} onChoose={(value) => { updateAnswer("childrenIncome", value); if (value !== "yes") { clearAnswerKeys("childFirstWork"); clearDetails("studiesEndedAt", "workStartedAt") } if (value === "yes") go("childFirstWorkChoice"); else close() }} /> : null}
        {step === "childFirstWorkChoice" ? <ChoiceStep t={t} titleKey="childFirstWorkChoiceQuestion" choices={["yes", "no", "unknown"]} labelKey="childFirstWork" value={answers.childFirstWork} onChoose={(value) => { updateAnswer("childFirstWork", value); if (value !== "yes") clearDetails("studiesEndedAt", "workStartedAt"); if (value === "yes") go("childFirstWork"); else close() }} /> : null}
        {step === "childFirstWork" ? <DatesStep t={t} titleKey="childFirstWorkQuestion" bodyKey="childFirstWorkBody" firstLabelKey="studiesEndedLabel" secondLabelKey="workStartedLabel" valueA={studiesEndedAt} valueB={workStartedAt} onChangeA={updateDetail("studiesEndedAt", setStudiesEndedAt)} onChangeB={updateDetail("workStartedAt", setWorkStartedAt)} onUnknown={() => { markDetailUnknown("studiesEndedAt"); markDetailUnknown("workStartedAt"); close() }} onContinue={close} /> : null}
        {step === "relativeIncome" ? <ChoiceStep t={t} titleKey="relativeIncomeQuestion" bodyKey={composition.children ? "relativeIncomeChildrenBody" : undefined} choices={["yes", "no", "unknown"]} labelKey="relativeIncome" value={answers.relativeIncome} onChoose={(value) => { updateAnswer("relativeIncome", value); if (value !== "yes") { clearAnswerKeys("relativeIncomeKind", "relativeSpf"); clearDetails("relativeAmount") } if (value === "yes") go("relativeIncomeKind"); else go(afterFamily()) }} /> : null}
        {step === "relativeIncomeKind" ? <ChoiceStep t={t} titleKey="relativeIncomeKindQuestion" choices={["salary", "pension", "disability", "other", "unknown"]} labelKey="relativeIncomeKind" value={answers.relativeIncomeKind} onChoose={(value) => { updateAnswer("relativeIncomeKind", value); if (value !== "pension") { clearDetails("relativeAmount"); clearAnswerKeys("relativeSpf") } if (value === "pension") go("relativePension"); else go(afterFamily()) }} /> : null}
        {step === "relativePension" ? <TextStep t={t} titleKey="relativePensionQuestion" bodyKey="relativePensionBody" labelKey="relativePensionLabel" placeholderKey="relativePensionPlaceholder" value={relativeAmount} onChange={updateDetail("relativeAmount", setRelativeAmount)} onUnknown={() => { markDetailUnknown("relativeAmount"); go(shouldAskRelativeSpf ? "relativeSpf" : afterFamily()) }} onContinue={() => go(shouldAskRelativeSpf ? "relativeSpf" : afterFamily())} /> : null}
        {step === "relativeSpf" ? <ChoiceStep t={t} titleKey="relativeSpfQuestion" bodyKey="relativeSpfBody" choices={["yes", "no", "unknown"]} labelKey="relativeSpf" value={answers.relativeSpf} onChoose={(value) => { updateAnswer("relativeSpf", value); go(afterFamily()) }} /> : null}
        {step === "unrelatedIncome" ? <ChoiceStep t={t} titleKey="unrelatedIncomeQuestion" choices={["yes", "no", "unknown"]} labelKey="unrelatedIncome" value={answers.unrelatedIncome} onChoose={(value) => { updateAnswer("unrelatedIncome", value); if (value !== "yes") clearDetails("unrelatedDetail"); if (value === "yes") go("unrelatedDetail"); else close() }} /> : null}
        {step === "unrelatedDetail" ? <TextStep t={t} titleKey="unrelatedDetailQuestion" bodyKey="unrelatedDetailBody" value={unrelatedDetail} onChange={updateDetail("unrelatedDetail", setUnrelatedDetail)} onUnknown={() => { markDetailUnknown("unrelatedDetail"); close() }} onContinue={close} /> : null}
        {step === "unrelatedHousehold" ? <ChoiceStep t={t} titleKey="unrelatedQuestion" bodyKey="unrelatedBody" choices={["shared", "separate", "unknown"]} labelKey="unrelatedHousehold" value={answers.unrelatedHousehold} notice={answers.unrelatedHousehold === "separate" ? t("unrelatedSeparateNotice") : undefined} onChoose={(value) => { updateAnswer("unrelatedHousehold", value); go("unrelatedIncome") }} /> : null}
        {step === "particular" ? <ParticularStep t={t} value={particular} onChange={setParticular} onContinue={() => go("summary")} /> : null}
        {step === "summary" ? <SummaryStep t={t} evaluation={publicEvaluation} intent={intent} date={date} people={people} livesAlone={livesAlone} answers={answers} particular={particular} relationLabel={relationLabel} details={[
          { label: t("summary.category"), value: publicEvaluation.category === "A" ? t("categoryA") : publicEvaluation.category === "N" ? t("categoryN") : publicEvaluation.category === "B" ? t("categoryB") : t("summaryNoCategoryTitle") },
          { label: t("summary.assessment"), value: publicEvaluation.reason },
          answers.alimonyDocument === "pending" ? { label: t("alimonyDocumentQuestion"), value: t("judgmentPendingNotice") } : null,
          answers.partnerSituation === "employee" ? { label: t("summary.partnerAmount"), value: unknownDetails.includes("partnerAmount") ? t("unknown") : partnerAmount || t("notAnswered") } : null,
          answers.partnerSituation && !["employee", "noIncome", "unknown"].includes(answers.partnerSituation) ? { label: t("summary.partnerDetail"), value: unknownDetails.includes("partnerDetail") ? t("unknown") : partnerDetail || t("notAnswered") } : null,
          answers.partnerContract === "temporary" ? { label: t("summary.contractStart"), value: unknownDetails.includes("contractStartAt") ? t("unknown") : contractStartAt || t("notAnswered") } : null,
          answers.partnerContract === "temporary" ? { label: t("summary.contractEnd"), value: unknownDetails.includes("contractEndAt") ? t("unknown") : contractEndAt || t("notAnswered") } : null,
          answers.childFirstWork === "yes" ? { label: t("summary.studiesEndedAt"), value: unknownDetails.includes("studiesEndedAt") ? t("unknown") : studiesEndedAt || t("notAnswered") } : null,
          answers.childFirstWork === "yes" ? { label: t("summary.workStartedAt"), value: unknownDetails.includes("workStartedAt") ? t("unknown") : workStartedAt || t("notAnswered") } : null,
          answers.relativeIncomeKind === "pension" ? { label: t("summary.relativeAmount"), value: unknownDetails.includes("relativeAmount") ? t("unknown") : relativeAmount || t("notAnswered") } : null,
          answers.unrelatedIncome === "yes" ? { label: t("summary.unrelatedDetail"), value: unknownDetails.includes("unrelatedDetail") ? t("unknown") : unrelatedDetail || t("notAnswered") } : null,
        ].filter((detail): detail is SummaryDetail => detail !== null)} onEdit={() => { setHistory([]); setStep("intent") }} /> : null}
      </CardContent></Card>
    </section>
  )
}

type Translation = ReturnType<typeof useTranslations>

function IntentStep({ t, value, onChoose, onContinue }: { t: Translation; value?: Intent; onChoose: (value: Intent) => void; onContinue: () => void }) {
  const choices: { value: Intent; title: string; body: string }[] = [
    { value: "current", title: t("intentCurrentTitle"), body: t("intentCurrentBody") },
    { value: "changed", title: t("intentChangedTitle"), body: t("intentChangedBody") },
    { value: "unknown", title: t("unknown"), body: t("intentUnknownBody") },
  ]

  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("intentQuestion")}</h2><div className="mt-6 grid gap-3 sm:grid-cols-3">{choices.map((choice) => {
    const selected = value === choice.value
    return <button key={choice.value} type="button" aria-pressed={selected} onClick={() => onChoose(choice.value)} className="glass-surface glass-interactive relative flex min-h-36 flex-col rounded-2xl p-4 text-left aria-pressed:!border-primary aria-pressed:!bg-primary/15 aria-pressed:!ring-2 aria-pressed:!ring-primary/25"><span className="pr-24 text-base font-semibold leading-snug">{choice.title}</span><span className="mt-2 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{choice.body}</span>{selected ? <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" aria-hidden />{t("choiceSelected")}</span> : null}</button>
  })}</div>{value ? <div className="glass-feedback mt-4 flex items-center gap-3 px-4 py-3" data-tone="info" role="status"><Check className="size-5 shrink-0" aria-hidden /><p className="text-sm">{t("intentSelected")}</p></div> : null}<ContinueButton t={t} onClick={onContinue} disabled={!value} /></div>
}

function DateStep({ t, value, onChange, onContinue }: { t: Translation; value: string; onChange: (value: string) => void; onContinue: () => void }) {
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("dateQuestion")}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("dateBody")}</p><div className="mt-6 max-w-md"><Label htmlFor="family-date">{t("dateLabel")}</Label><Input id="family-date" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("datePlaceholder")} className={`mt-2 h-12 ${GLASS_INPUT}`} /></div><ContinueButton t={t} onClick={onContinue} /></div>
}

function HouseholdStep({ t, people, livesAlone, name, relation, editingId, relationLabel, onNameChange, onRelationChange, onAdd, onEdit, onRemove, onAlone, onUnknown, onContinue }: { t: Translation; people: Person[]; livesAlone: boolean; name: string; relation: Relation; editingId?: string; relationLabel: (value: Relation) => string; onNameChange: (value: string) => void; onRelationChange: (value: Relation) => void; onAdd: () => void; onEdit: (person: Person) => void; onRemove: (id: string) => void; onAlone: () => void; onUnknown: () => void; onContinue: () => void }) {
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("householdQuestion")}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("householdBody")}</p>{livesAlone ? <div className="glass-feedback mt-5 flex gap-3 px-4 py-4" data-tone="info"><UsersRound className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm">{t("liveAlone")}</p></div> : null}<div className="mt-6 grid gap-3">{people.map((person) => <div key={person.id} className="glass-surface flex items-center gap-3 rounded-2xl px-4 py-3"><span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary" aria-hidden>{person.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{person.name}</p><p className="text-sm text-[color:var(--glass-ink-soft)]">{relationLabel(person.relation)}</p></div><Button type="button" variant="ghost" size="icon" aria-label={t("editPerson", { name: person.name })} onClick={() => onEdit(person)}><Pencil /></Button><Button type="button" variant="ghost" size="icon" aria-label={t("removePerson", { name: person.name })} onClick={() => onRemove(person.id)}><Trash2 /></Button></div>)}</div><div className="glass-surface mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_13rem_auto] sm:items-end"><div><Label htmlFor="person-name">{t("personName")}</Label><Input id="person-name" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={t("personNamePlaceholder")} className={`mt-2 h-11 ${GLASS_INPUT}`} /></div><div><Label htmlFor="person-relation">{t("personRelation")}</Label><select id="person-relation" value={relation} onChange={(event) => onRelationChange(event.target.value as Relation)} className={`mt-2 h-11 w-full px-3 ${GLASS_INPUT}`}><option value="spouse">{relationLabel("spouse")}</option><option value="partner">{relationLabel("partner")}</option><option value="child">{relationLabel("child")}</option><option value="parent">{relationLabel("parent")}</option><option value="family">{relationLabel("family")}</option><option value="unrelated">{relationLabel("unrelated")}</option></select></div><Button type="button" variant="outline" className="h-11" onClick={onAdd} disabled={!name.trim()}><Plus data-icon="inline-start" />{editingId ? t("savePerson") : t("addPerson")}</Button></div><div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={onAlone}>{t("liveAlone")}</Button><Button type="button" variant="ghost" onClick={onUnknown}><CircleHelp data-icon="inline-start" />{t("unknown")}</Button></div><p className="mt-3 text-sm text-[color:var(--glass-ink-soft)]">{t("householdNote")}</p><ContinueButton t={t} onClick={onContinue} disabled={people.length === 0 && !livesAlone} /></div>
}

function ConfirmStep({ t, onConfirm }: { t: Translation; onConfirm: () => void }) {
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("confirmQuestion")}</h2><div className="glass-feedback mt-5 flex gap-3 px-4 py-4" data-tone="attention"><CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm leading-relaxed">{t("confirmBody")}</p></div><ContinueButton t={t} label={t("confirmContinue")} onClick={onConfirm} /></div>
}

function ChoiceStep({ t, titleKey, bodyKey, values, choices, labelKey, value, notice, onChoose }: { t: Translation; titleKey: string; bodyKey?: string; values?: Record<string, string>; choices: string[]; labelKey: string; value?: string; notice?: string; onChoose: (value: string) => void }) {
  const title = values ? t(titleKey as never, values as never) : t(titleKey as never)
  return <ChoiceCards t={t} title={title} body={bodyKey ? t(bodyKey as never) : undefined} notice={notice} choices={choices.map((choice) => ({ value: choice, title: t(`${labelKey}.${choice}` as never), body: t(`${labelKey}.${choice}Body` as never) }))} value={value} onChoose={onChoose} />
}

function ChoiceCards({ t, title, body, notice, choices, value, onChoose }: { t: Translation; title: string; body?: string; notice?: string; choices: { value: string; title: string; body: string }[]; value?: string; onChoose: (value: string) => void }) {
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>{body ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{body}</p> : null}{notice ? <div className="glass-feedback mt-5 flex gap-3 px-4 py-4" data-tone="info"><Info className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm leading-relaxed">{notice}</p></div> : null}<div className="mt-6 grid gap-3">{choices.map((choice) => {
    const selected = value === choice.value
    return <button key={choice.value} type="button" aria-pressed={selected} onClick={() => onChoose(choice.value)} className="glass-surface glass-interactive relative w-full rounded-2xl p-4 text-left sm:p-5 aria-pressed:!border-primary aria-pressed:!bg-primary/15 aria-pressed:!ring-2 aria-pressed:!ring-primary/30"><span className="block pr-24 text-lg font-semibold">{choice.title}</span><span className="mt-1 block text-sm text-[color:var(--glass-ink-soft)]">{choice.body}</span>{selected ? <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" aria-hidden />{t("choiceSelected")}</span> : null}</button>
  })}</div></div>
}

function AmountStep({ t, titleKey, bodyKey, value, onChange, onUnknown, onContinue }: { t: Translation; titleKey: string; bodyKey: string; value: string; onChange: (value: string) => void; onUnknown: () => void; onContinue: () => void }) {
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t(titleKey as never)}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t(bodyKey as never)}</p><div className="mt-6 max-w-md"><Label htmlFor="family-amount">{t("amountLabel")}</Label><Input id="family-amount" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("amountPlaceholder")} className={`mt-2 h-12 ${GLASS_INPUT}`} /><p className="mt-2 text-sm text-[color:var(--glass-ink-soft)]">{t("amountHelp")}</p></div><div className="mt-5"><Button type="button" variant="ghost" onClick={onUnknown}><CircleHelp data-icon="inline-start" />{t("unknown")}</Button></div><ContinueButton t={t} onClick={onContinue} /></div>
}

function TextStep({ t, titleKey, bodyKey, labelKey = "detailsLabel", placeholderKey = "detailsPlaceholder", value, onChange, onUnknown, onContinue }: { t: Translation; titleKey: string; bodyKey: string; labelKey?: string; placeholderKey?: string; value: string; onChange: (value: string) => void; onUnknown: () => void; onContinue: () => void }) {
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t(titleKey as never)}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t(bodyKey as never)}</p><div className="mt-6 max-w-xl"><Label htmlFor="family-detail">{t(labelKey as never)}</Label><textarea id="family-detail" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t(placeholderKey as never)} className={`mt-2 min-h-28 w-full p-3 ${GLASS_INPUT}`} /></div><div className="mt-5"><Button type="button" variant="ghost" onClick={onUnknown}><CircleHelp data-icon="inline-start" />{t("unknown")}</Button></div><ContinueButton t={t} onClick={onContinue} /></div>
}

function DatesStep({ t, titleKey, bodyKey, firstLabelKey, secondLabelKey, valueA, valueB, onChangeA, onChangeB, onUnknown, onContinue }: { t: Translation; titleKey: string; bodyKey: string; firstLabelKey: string; secondLabelKey: string; valueA: string; valueB: string; onChangeA: (value: string) => void; onChangeB: (value: string) => void; onUnknown: () => void; onContinue: () => void }) {
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t(titleKey as never)}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t(bodyKey as never)}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="first-date">{t(firstLabelKey as never)}</Label><Input id="first-date" value={valueA} onChange={(event) => onChangeA(event.target.value)} placeholder={t("datePlaceholder")} className={`mt-2 h-12 ${GLASS_INPUT}`} /></div><div><Label htmlFor="second-date">{t(secondLabelKey as never)}</Label><Input id="second-date" value={valueB} onChange={(event) => onChangeB(event.target.value)} placeholder={t("datePlaceholder")} className={`mt-2 h-12 ${GLASS_INPUT}`} /></div></div><div className="mt-5"><Button type="button" variant="ghost" onClick={onUnknown}><CircleHelp data-icon="inline-start" />{t("unknown")}</Button></div><ContinueButton t={t} onClick={onContinue} /></div>
}

function ParticularStep({ t, value, onChange, onContinue }: { t: Translation; value: string[]; onChange: (value: string[]) => void; onContinue: () => void }) {
  const choices = ["separatedIncome", "nightWork", "portFishing"]
  const toggle = (choice: string) => onChange(value.includes(choice) ? value.filter((item) => item !== choice) : [...value, choice])
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("particularQuestion")}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("particularBody")}</p><div className="mt-6 grid gap-3">{choices.map((choice) => {
    const selected = value.includes(choice)
    return <button key={choice} type="button" aria-pressed={selected} onClick={() => toggle(choice)} className="glass-surface glass-interactive relative w-full rounded-2xl p-4 text-left sm:p-5 aria-pressed:!border-primary aria-pressed:!bg-primary/15 aria-pressed:!ring-2 aria-pressed:!ring-primary/30"><span className="block pr-24 text-lg font-semibold">{t(`particular.${choice}` as never)}</span><span className="mt-1 block text-sm text-[color:var(--glass-ink-soft)]">{t(`particular.${choice}Body` as never)}</span>{selected ? <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" aria-hidden />{t("choiceSelected")}</span> : null}</button>
  })}</div><ContinueButton t={t} onClick={onContinue} /></div>
}

function SummaryStep({ t, intent, date, people, livesAlone, answers, particular, relationLabel, details, onEdit }: { t: Translation; evaluation: ReturnType<typeof evaluateArticle110Verifier>; intent?: Intent; date: string; people: Person[]; livesAlone: boolean; answers: Answers; particular: string[]; relationLabel: (value: Relation) => string; details: SummaryDetail[]; onEdit: () => void }) {
  // The owner-approved children-and-family scenario is evaluated as cohabitant;
  // it is no longer presented as a blocked or reserved citizen case.
  const reservedCase = false
  const documents = [answers.aloneSituation === "alternating" ? t("documentAlternating") : null, answers.alimonyDocument === "judgment" ? t("documentAlimony") : null, answers.unrelatedHousehold === "separate" ? t("documentRegis") : null].filter((item): item is string => !!item)
  return <div><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("summaryTitle")}</h2><div className="glass-feedback mt-5 flex gap-3 px-4 py-4" data-tone="info"><CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden /><div><p className="font-semibold">{t("summaryNoCategoryTitle")}</p><p className="mt-1 text-sm leading-relaxed">{t("summaryNoCategoryBody")}</p></div></div>{reservedCase ? <div className="glass-feedback mt-4 flex gap-3 px-4 py-4" data-tone="attention"><Info className="mt-0.5 size-5 shrink-0" aria-hidden /><p className="text-sm leading-relaxed">{t("reservedCaseNotice")}</p></div> : null}<dl className="mt-6 grid gap-3"><SummaryRow icon={<CalendarDays />} label={t("summaryDate")} value={date || t("notAnswered")} /><SummaryRow icon={<UsersRound />} label={t("summaryHousehold")} value={people.length ? people.map((person) => `${person.name} — ${relationLabel(person.relation)}`).join(", ") : livesAlone ? t("liveAlone") : t("notAnswered")} /><SummaryRow icon={<FileText />} label={t("summaryRequest")} value={intent === "changed" ? t("intentChangedTitle") : intent === "current" ? t("intentCurrentTitle") : t("unknown")} />{Object.entries(answers).filter(([, value]) => value).map(([key, value]) => <SummaryRow key={key} icon={<FileText />} label={t(`summary.${key}` as never)} value={t(`${key}.${value}` as never)} />)}{details.map((detail) => <SummaryRow key={detail.label} icon={<FileText />} label={detail.label} value={detail.value} />)}{particular.length ? <SummaryRow icon={<FileText />} label={t("summaryParticular")} value={particular.map((item) => t(`particular.${item}` as never)).join(", ")} /> : null}</dl><div className="glass-surface mt-6 p-4"><h3 className="font-semibold">{t("documentsTitle")}</h3>{documents.length ? <ul className="mt-2 space-y-2 text-sm text-[color:var(--glass-ink-soft)]">{documents.map((document) => <li key={document} className="flex gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{document}</li>)}</ul> : <p className="mt-1 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("documentsBody")}</p>}<p className="mt-3 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("documentsNoCheck")}</p></div><div className="mt-6"><Button type="button" variant="outline" size="lg" onClick={onEdit}><Pencil data-icon="inline-start" />{t("editAnswers")}</Button></div><p className="mt-5 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("disclaimer")}</p></div>
}

function ContinueButton({ t, onClick, disabled, label }: { t: Translation; onClick: () => void; disabled?: boolean; label?: string }) {
  return <div className="mt-6"><Button type="button" size="lg" onClick={onClick} disabled={disabled}>{label ?? t("continue")}<ArrowRight data-icon="inline-end" /></Button></div>
}

function SummaryRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="glass-surface flex items-start gap-3 rounded-2xl p-4"><span className="mt-0.5 text-primary" aria-hidden>{icon}</span><div className="min-w-0"><dt className="text-sm text-[color:var(--glass-ink-soft)]">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div></div>
}
