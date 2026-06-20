'use client'

// =====================================================================
//  Bloc page-builder : eC3.2 — Page interactive
// ---------------------------------------------------------------------
//  Render = l'expérience pédagogique complète (Ec32Experience).
//  Fields = éditeur admin couvrant TOUS les textes importants via
//  Group/Field/RepeaterList. Chaque section met à jour son objet de
//  contenu en bloc (remplacement partiel, pas de merge profond requis).
//
//  Conventions :
//   • tableaux de strings → Textarea (une entrée par ligne) ;
//   • objets répétés → RepeaterList<T> ;
//   • enums (type employeur) → Pills.
// =====================================================================

import type { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { ec32BlockSchema } from '@/lib/ec32/schema'
import { ec32DefaultContent } from '@/lib/ec32/content'
import { EC32_EMPLOYER_TYPES, EC32_SITUATION_TYPES } from '@/lib/ec32/types'
import { Ec32Experience } from '@/components/docbel/ec32/ec32-experience'

// ── Types dérivés du schéma (sous-objets répétés) ──────────────────
type Content = z.infer<typeof ec32BlockSchema>
type LearningMode = Content['learningModes']['modes'][number]
type Step = Content['simulator']['steps'][number]
type Situation = Content['simulator']['situations'][number]
type Employer = Content['simulator']['employers'][number]
type Month = Content['simulator']['months'][number]
type KeyText = Content['simulator']['labels'][number]
type CoachTip = Content['simulator']['coach']['tips'][number]
type Scenario = Content['scenarios']['items'][number]
type Mistake = Content['mistakes']['items'][number]
type Faq = Content['faq']['items'][number]
type Resource = Content['resources']['items'][number]
type Derogation = Content['derogations']['items'][number]

// ── Helpers conversion textarea ↔ string[] ─────────────────────────
const toLines = (arr: string[]): string => arr.join('\n')
const fromLines = (value: string): string[] =>
  value.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)

const EMPLOYER_TYPE_OPTIONS = EC32_EMPLOYER_TYPES.map((value) => ({
  value,
  label: value,
}))

// Petit textarea homogène pour l'inspecteur.
const taClass = 'text-xs resize-y'

export const ec32Page = defineBlock({
  type: 'ec32Page',
  schema: ec32BlockSchema,
  defaults: ec32DefaultContent,
  meta: {
    name: 'eC3.2 — Page interactive',
    description:
      'Page pédagogique interactive sur la carte de contrôle eC3.2 (chômage temporaire)',
    category: 'education',
    icon: 'graduation-cap',
    shortcuts: ['ec32', 'onem'],
  },

  Render: ({ props }) => <Ec32Experience content={props} />,

  Fields: ({ props, onChange }) => (
    <>
      {/* ───────────────────────── SEO ───────────────────────── */}
      <Group title="SEO" defaultOpen={false}>
        <Field label="Titre (balise title)">
          <Textarea
            value={props.seo.title}
            onChange={(e) => onChange({ seo: { ...props.seo, title: e.target.value } })}
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Description (meta description)">
          <Textarea
            value={props.seo.description}
            onChange={(e) =>
              onChange({ seo: { ...props.seo, description: e.target.value } })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <Field label="URL canonique">
          <Input
            value={props.seo.canonical}
            onChange={(e) =>
              onChange({ seo: { ...props.seo, canonical: e.target.value } })
            }
          />
        </Field>
        <Field label="Ne pas indexer (noindex)">
          <Switch
            checked={props.seo.noIndex}
            onCheckedChange={(v) => onChange({ seo: { ...props.seo, noIndex: v } })}
            aria-label="Ne pas indexer la page"
          />
        </Field>
      </Group>

      {/* ─────────────────────── Héros ───────────────────────── */}
      <Group title="Héros" defaultOpen={false}>
        <Field label="Badge">
          <Input
            value={props.hero.badge}
            onChange={(e) => onChange({ hero: { ...props.hero, badge: e.target.value } })}
          />
        </Field>
        <Field label="Titre">
          <Textarea
            value={props.hero.title}
            onChange={(e) => onChange({ hero: { ...props.hero, title: e.target.value } })}
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.hero.subtitle}
            onChange={(e) =>
              onChange({ hero: { ...props.hero, subtitle: e.target.value } })
            }
            rows={4}
            className={taClass}
          />
        </Field>
        <Field label="Bouton principal">
          <Input
            value={props.hero.primaryCta}
            onChange={(e) =>
              onChange({ hero: { ...props.hero, primaryCta: e.target.value } })
            }
          />
        </Field>
        <Field label="Bouton secondaire">
          <Input
            value={props.hero.secondaryCta}
            onChange={(e) =>
              onChange({ hero: { ...props.hero, secondaryCta: e.target.value } })
            }
          />
        </Field>
        <Field label="Mention (petit texte)">
          <Textarea
            value={props.hero.disclaimer}
            onChange={(e) =>
              onChange({ hero: { ...props.hero, disclaimer: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
      </Group>

      {/* ───────────────────── Avertissement ──────────────────── */}
      <Group title="Avertissement" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.disclaimer.title}
            onChange={(e) =>
              onChange({ disclaimer: { ...props.disclaimer, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Points (un par ligne)">
          <Textarea
            value={toLines(props.disclaimer.points)}
            onChange={(e) =>
              onChange({
                disclaimer: { ...props.disclaimer, points: fromLines(e.target.value) },
              })
            }
            rows={5}
            className={taClass}
          />
        </Field>
      </Group>

      {/* ───────────────────────── Alerte ─────────────────────── */}
      <Group title="Alerte « Avant de commencer »" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.alert.title}
            onChange={(e) => onChange({ alert: { ...props.alert, title: e.target.value } })}
          />
        </Field>
        <Field label="Contenu">
          <Textarea
            value={props.alert.content}
            onChange={(e) =>
              onChange({ alert: { ...props.alert, content: e.target.value } })
            }
            rows={4}
            className={taClass}
          />
        </Field>
      </Group>

      {/* ───────────────── Modes d'apprentissage ──────────────── */}
      <Group title={`Modes d'apprentissage (${props.learningModes.modes.length})`} defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.learningModes.title}
            onChange={(e) =>
              onChange({
                learningModes: { ...props.learningModes, title: e.target.value },
              })
            }
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.learningModes.subtitle}
            onChange={(e) =>
              onChange({
                learningModes: { ...props.learningModes, subtitle: e.target.value },
              })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <RepeaterList<LearningMode>
          items={props.learningModes.modes}
          onChange={(modes) =>
            onChange({ learningModes: { ...props.learningModes, modes } })
          }
          render={(it, set) => (
            <>
              <Field label="Clé">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Field label="Icône (compass · layout-list · sparkles)">
                <Input value={it.icon} onChange={(e) => set({ icon: e.target.value })} />
              </Field>
              <Field label="Titre">
                <Input value={it.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Textarea
                value={it.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={3}
                className={taClass}
              />
              <Field label="Lien (CTA) — vide = aucun lien">
                <Input
                  value={it.cta}
                  onChange={(e) => set({ cta: e.target.value })}
                  placeholder="Commencer"
                />
              </Field>
            </>
          )}
          addItem={() => ({ key: '', icon: 'sparkles', title: '', description: '', cta: '' })}
        />
      </Group>

      {/* ──────────────────────── Simulateur ──────────────────── */}
      <Group title="Simulateur — en-tête" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.simulator.title}
            onChange={(e) =>
              onChange({ simulator: { ...props.simulator, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.simulator.subtitle}
            onChange={(e) =>
              onChange({ simulator: { ...props.simulator, subtitle: e.target.value } })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <Field label="Mention « données fictives »">
          <Textarea
            value={props.simulator.fictitiousDataNotice}
            onChange={(e) =>
              onChange({
                simulator: { ...props.simulator, fictitiousDataNotice: e.target.value },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
      </Group>

      <Group title={`Simulateur — étapes (${props.simulator.steps.length})`} defaultOpen={false}>
        <RepeaterList<Step>
          items={props.simulator.steps}
          onChange={(steps) => onChange({ simulator: { ...props.simulator, steps } })}
          render={(it, set) => (
            <>
              <Field label="Clé (login · declaration · …)">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Field label="Titre">
                <Input value={it.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Textarea
                value={it.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={3}
                className={taClass}
              />
            </>
          )}
          addItem={() => ({ key: '', title: '', description: '' })}
        />
      </Group>

      <Group title={`Simulateur — situations (${props.simulator.situations.length})`} defaultOpen={false}>
        <RepeaterList<Situation>
          items={props.simulator.situations}
          onChange={(situations) =>
            onChange({ simulator: { ...props.simulator, situations } })
          }
          render={(it, set) => (
            <>
              <Field label="Type">
                <Input
                  value={it.type}
                  onChange={(e) =>
                    set({ type: e.target.value as Situation['type'] })
                  }
                  placeholder={EC32_SITUATION_TYPES.join(' · ')}
                />
              </Field>
              <Field label="Libellé">
                <Input value={it.label} onChange={(e) => set({ label: e.target.value })} />
              </Field>
              <Field label="Libellé court">
                <Input
                  value={it.shortLabel}
                  onChange={(e) => set({ shortLabel: e.target.value })}
                />
              </Field>
              <Textarea
                value={it.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={3}
                className={taClass}
              />
              <Field label="Exemples (un par ligne)">
                <Textarea
                  value={toLines(it.examples)}
                  onChange={(e) => set({ examples: fromLines(e.target.value) })}
                  rows={3}
                  className={taClass}
                />
              </Field>
              <Textarea
                value={it.warning}
                onChange={(e) => set({ warning: e.target.value })}
                placeholder="Avertissement"
                rows={2}
                className={taClass}
              />
              <Textarea
                value={it.helpDetail}
                onChange={(e) => set({ helpDetail: e.target.value })}
                placeholder="Détail d'aide"
                rows={3}
                className={taClass}
              />
            </>
          )}
          addItem={() => ({
            type: 'temporary_unemployment',
            label: '',
            shortLabel: '',
            description: '',
            examples: [],
            warning: '',
            helpDetail: '',
          })}
        />
      </Group>

      <Group title={`Simulateur — employeurs (${props.simulator.employers.length})`} defaultOpen={false}>
        <RepeaterList<Employer>
          items={props.simulator.employers}
          onChange={(employers) =>
            onChange({ simulator: { ...props.simulator, employers } })
          }
          render={(it, set) => (
            <>
              <Field label="Identifiant (emp-a · emp-b · emp-construction)">
                <Input value={it.id} onChange={(e) => set({ id: e.target.value })} />
              </Field>
              <Field label="Nom">
                <Input value={it.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label="Numéro d'entreprise (fictif)">
                <Input
                  value={it.enterpriseNumber}
                  onChange={(e) => set({ enterpriseNumber: e.target.value })}
                />
              </Field>
              <Field label="Secteur">
                <Input value={it.sector} onChange={(e) => set({ sector: e.target.value })} />
              </Field>
              <Field label="Type">
                <Pills<Employer['type']>
                  value={it.type}
                  onChange={(type) => set({ type })}
                  options={EMPLOYER_TYPE_OPTIONS}
                />
              </Field>
            </>
          )}
          addItem={() => ({
            id: '',
            name: '',
            enterpriseNumber: '',
            sector: '',
            type: 'single',
          })}
        />
      </Group>

      <Group title={`Simulateur — mois (${props.simulator.months.length})`} defaultOpen={false}>
        <RepeaterList<Month>
          items={props.simulator.months}
          onChange={(months) => onChange({ simulator: { ...props.simulator, months } })}
          render={(it, set) => (
            <>
              <Field label="Clé (yyyy-mm)">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Field label="Libellé">
                <Input value={it.label} onChange={(e) => set({ label: e.target.value })} />
              </Field>
              <Field label="Note de statut">
                <Input
                  value={it.statusNote}
                  onChange={(e) => set({ statusNote: e.target.value })}
                />
              </Field>
            </>
          )}
          addItem={() => ({ key: '', label: '', statusNote: '' })}
        />
      </Group>

      <Group title={`Simulateur — libellés (${props.simulator.labels.length})`} defaultOpen={false}>
        <RepeaterList<KeyText>
          items={props.simulator.labels}
          onChange={(labels) => onChange({ simulator: { ...props.simulator, labels } })}
          render={(it, set) => (
            <>
              <Field label="Clé">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Textarea
                value={it.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder="Texte"
                rows={2}
                className={taClass}
              />
            </>
          )}
          addItem={() => ({ key: '', text: '' })}
        />
      </Group>

      <Group title={`Simulateur — notices (${props.simulator.notices.length})`} defaultOpen={false}>
        <RepeaterList<KeyText>
          items={props.simulator.notices}
          onChange={(notices) => onChange({ simulator: { ...props.simulator, notices } })}
          render={(it, set) => (
            <>
              <Field label="Clé">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Textarea
                value={it.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder="Texte"
                rows={3}
                className={taClass}
              />
            </>
          )}
          addItem={() => ({ key: '', text: '' })}
        />
      </Group>

      <Group title={`Simulateur — coach (${props.simulator.coach.tips.length} conseils)`} defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.simulator.coach.title}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  coach: { ...props.simulator.coach, title: e.target.value },
                },
              })
            }
          />
        </Field>
        <Field label="Introduction">
          <Textarea
            value={props.simulator.coach.intro}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  coach: { ...props.simulator.coach, intro: e.target.value },
                },
              })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <RepeaterList<CoachTip>
          items={props.simulator.coach.tips}
          onChange={(tips) =>
            onChange({
              simulator: {
                ...props.simulator,
                coach: { ...props.simulator.coach, tips },
              },
            })
          }
          render={(it, set) => (
            <>
              <Field label="Étape (stepKey)">
                <Input value={it.stepKey} onChange={(e) => set({ stepKey: e.target.value })} />
              </Field>
              <Textarea
                value={it.message}
                onChange={(e) => set({ message: e.target.value })}
                placeholder="Message du coach"
                rows={3}
                className={taClass}
              />
            </>
          )}
          addItem={() => ({ stepKey: '', message: '' })}
        />
      </Group>

      <Group title="Simulateur — modale de correction" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.simulator.correctionModal.title}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    title: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Texte d'aide">
          <Textarea
            value={props.simulator.correctionModal.helpText}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    helpText: e.target.value,
                  },
                },
              })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <Field label="Libellé « jour »">
          <Input
            value={props.simulator.correctionModal.dayLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    dayLabel: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Libellé « ancienne situation »">
          <Input
            value={props.simulator.correctionModal.fromLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    fromLabel: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Libellé « nouvelle situation »">
          <Input
            value={props.simulator.correctionModal.toLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    toLabel: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Libellé « explication »">
          <Input
            value={props.simulator.correctionModal.reasonLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    reasonLabel: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Placeholder « explication »">
          <Input
            value={props.simulator.correctionModal.reasonPlaceholder}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    reasonPlaceholder: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Libellé « sauvegarder »">
          <Input
            value={props.simulator.correctionModal.saveLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    saveLabel: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Message « carte verrouillée »">
          <Textarea
            value={props.simulator.correctionModal.lockedMessage}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    lockedMessage: e.target.value,
                  },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Erreur « explication obligatoire »">
          <Textarea
            value={props.simulator.correctionModal.requiredError}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  correctionModal: {
                    ...props.simulator.correctionModal,
                    requiredError: e.target.value,
                  },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
      </Group>

      <Group title="Simulateur — modale d'envoi" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.simulator.sendModal.title}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: { ...props.simulator.sendModal, title: e.target.value },
                },
              })
            }
          />
        </Field>
        <Field label="Corps">
          <Textarea
            value={props.simulator.sendModal.body}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: { ...props.simulator.sendModal, body: e.target.value },
                },
              })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <Field label="Libellé « annuler »">
          <Input
            value={props.simulator.sendModal.cancelLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: {
                    ...props.simulator.sendModal,
                    cancelLabel: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Libellé « confirmer »">
          <Input
            value={props.simulator.sendModal.confirmLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: {
                    ...props.simulator.sendModal,
                    confirmLabel: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Titre « succès »">
          <Input
            value={props.simulator.sendModal.successTitle}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: {
                    ...props.simulator.sendModal,
                    successTitle: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Corps « succès »">
          <Textarea
            value={props.simulator.sendModal.successBody}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: {
                    ...props.simulator.sendModal,
                    successBody: e.target.value,
                  },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Titre « bloqué »">
          <Input
            value={props.simulator.sendModal.blockedTitle}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: {
                    ...props.simulator.sendModal,
                    blockedTitle: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Corps « bloqué »">
          <Textarea
            value={props.simulator.sendModal.blockedBody}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  sendModal: {
                    ...props.simulator.sendModal,
                    blockedBody: e.target.value,
                  },
                },
              })
            }
            rows={3}
            className={taClass}
          />
        </Field>
      </Group>

      <Group title="Simulateur — aperçu PDF" defaultOpen={false}>
        <Field label="Libellé du bouton">
          <Input
            value={props.simulator.pdf.buttonLabel}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  pdf: { ...props.simulator.pdf, buttonLabel: e.target.value },
                },
              })
            }
          />
        </Field>
        <Field label="Titre du document">
          <Input
            value={props.simulator.pdf.docTitle}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  pdf: { ...props.simulator.pdf, docTitle: e.target.value },
                },
              })
            }
          />
        </Field>
        <Field label="Mention « fiction »">
          <Textarea
            value={props.simulator.pdf.fictionMention}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  pdf: { ...props.simulator.pdf, fictionMention: e.target.value },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Avertissement">
          <Textarea
            value={props.simulator.pdf.warning}
            onChange={(e) =>
              onChange({
                simulator: {
                  ...props.simulator,
                  pdf: { ...props.simulator.pdf, warning: e.target.value },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
      </Group>

      {/* ──────────────────────── Scénarios ───────────────────── */}
      <Group title={`Cas pratiques (${props.scenarios.items.length})`} defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.scenarios.title}
            onChange={(e) =>
              onChange({ scenarios: { ...props.scenarios, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.scenarios.subtitle}
            onChange={(e) =>
              onChange({ scenarios: { ...props.scenarios, subtitle: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <RepeaterList<Scenario>
          items={props.scenarios.items}
          onChange={(items) => onChange({ scenarios: { ...props.scenarios, items } })}
          render={(it, set) => (
            <>
              <Field label="Clé">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Field label="Titre">
                <Input value={it.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Niveau">
                <Input value={it.level} onChange={(e) => set({ level: e.target.value })} />
              </Field>
              <Field label="Durée">
                <Input value={it.duration} onChange={(e) => set({ duration: e.target.value })} />
              </Field>
              <Textarea
                value={it.context}
                onChange={(e) => set({ context: e.target.value })}
                placeholder="Contexte"
                rows={3}
                className={taClass}
              />
              <Textarea
                value={it.objective}
                onChange={(e) => set({ objective: e.target.value })}
                placeholder="Objectif"
                rows={2}
                className={taClass}
              />
              <Textarea
                value={it.expectedAction}
                onChange={(e) => set({ expectedAction: e.target.value })}
                placeholder="Action attendue"
                rows={2}
                className={taClass}
              />
              <Textarea
                value={it.feedbackCorrect}
                onChange={(e) => set({ feedbackCorrect: e.target.value })}
                placeholder="Retour si correct"
                rows={2}
                className={taClass}
              />
              <Textarea
                value={it.feedbackError}
                onChange={(e) => set({ feedbackError: e.target.value })}
                placeholder="Retour si erreur"
                rows={2}
                className={taClass}
              />
              <Field label="Référence de règle">
                <Input value={it.ruleRef} onChange={(e) => set({ ruleRef: e.target.value })} />
              </Field>
            </>
          )}
          addItem={() => ({
            key: '',
            title: '',
            level: '',
            duration: '',
            context: '',
            objective: '',
            expectedAction: '',
            feedbackCorrect: '',
            feedbackError: '',
            ruleRef: '',
          })}
        />
      </Group>

      {/* ───────────────────────── Erreurs ────────────────────── */}
      <Group title={`Erreurs fréquentes (${props.mistakes.items.length})`} defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.mistakes.title}
            onChange={(e) =>
              onChange({ mistakes: { ...props.mistakes, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.mistakes.subtitle}
            onChange={(e) =>
              onChange({ mistakes: { ...props.mistakes, subtitle: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <RepeaterList<Mistake>
          items={props.mistakes.items}
          onChange={(items) => onChange({ mistakes: { ...props.mistakes, items } })}
          render={(it, set) => (
            <>
              <Field label="Clé">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Field label="Titre">
                <Input value={it.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Textarea
                value={it.explanation}
                onChange={(e) => set({ explanation: e.target.value })}
                placeholder="Explication"
                rows={3}
                className={taClass}
              />
              <Textarea
                value={it.advice}
                onChange={(e) => set({ advice: e.target.value })}
                placeholder="Conseil"
                rows={2}
                className={taClass}
              />
              <Field label="Lien (ancre interne ou URL)">
                <Input value={it.link} onChange={(e) => set({ link: e.target.value })} />
              </Field>
            </>
          )}
          addItem={() => ({ key: '', title: '', explanation: '', advice: '', link: '' })}
        />
      </Group>

      {/* ────────────────────────── FAQ ───────────────────────── */}
      <Group title={`FAQ (${props.faq.items.length})`} defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.faq.title}
            onChange={(e) => onChange({ faq: { ...props.faq, title: e.target.value } })}
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.faq.subtitle}
            onChange={(e) =>
              onChange({ faq: { ...props.faq, subtitle: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <RepeaterList<Faq>
          items={props.faq.items}
          onChange={(items) => onChange({ faq: { ...props.faq, items } })}
          render={(it, set) => (
            <>
              <Textarea
                value={it.q}
                onChange={(e) => set({ q: e.target.value })}
                placeholder="Question"
                rows={2}
                className={taClass}
              />
              <Textarea
                value={it.a}
                onChange={(e) => set({ a: e.target.value })}
                placeholder="Réponse"
                rows={4}
                className={taClass}
              />
            </>
          )}
          addItem={() => ({ q: '', a: '' })}
        />
      </Group>

      {/* ──────────────────────── Ressources ──────────────────── */}
      <Group title={`Ressources (${props.resources.items.length})`} defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.resources.title}
            onChange={(e) =>
              onChange({ resources: { ...props.resources, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.resources.subtitle}
            onChange={(e) =>
              onChange({ resources: { ...props.resources, subtitle: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Introduction">
          <Textarea
            value={props.resources.intro}
            onChange={(e) =>
              onChange({ resources: { ...props.resources, intro: e.target.value } })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <Field label="Libellé du bouton officiel">
          <Input
            value={props.resources.officialButtonLabel}
            onChange={(e) =>
              onChange({
                resources: { ...props.resources, officialButtonLabel: e.target.value },
              })
            }
          />
        </Field>
        <Field label="URL officielle">
          <Input
            value={props.resources.officialUrl}
            onChange={(e) =>
              onChange({ resources: { ...props.resources, officialUrl: e.target.value } })
            }
          />
        </Field>
        <Field label="Note">
          <Textarea
            value={props.resources.note}
            onChange={(e) =>
              onChange({ resources: { ...props.resources, note: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <RepeaterList<Resource>
          items={props.resources.items}
          onChange={(items) => onChange({ resources: { ...props.resources, items } })}
          render={(it, set) => (
            <>
              <Field label="Libellé">
                <Input value={it.label} onChange={(e) => set({ label: e.target.value })} />
              </Field>
              <Textarea
                value={it.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={2}
                className={taClass}
              />
              <Field label="URL">
                <Input value={it.url} onChange={(e) => set({ url: e.target.value })} />
              </Field>
            </>
          )}
          addItem={() => ({ label: '', description: '', url: '' })}
        />
      </Group>

      {/* ──────────────────────── Dérogations ─────────────────── */}
      <Group title={`Dérogations (${props.derogations.items.length})`} defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.derogations.title}
            onChange={(e) =>
              onChange({ derogations: { ...props.derogations, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.derogations.subtitle}
            onChange={(e) =>
              onChange({ derogations: { ...props.derogations, subtitle: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Badge">
          <Input
            value={props.derogations.badge}
            onChange={(e) =>
              onChange({ derogations: { ...props.derogations, badge: e.target.value } })
            }
          />
        </Field>
        <Field label="Note de transition">
          <Textarea
            value={props.derogations.transitionNote}
            onChange={(e) =>
              onChange({
                derogations: { ...props.derogations, transitionNote: e.target.value },
              })
            }
            rows={4}
            className={taClass}
          />
        </Field>
        <RepeaterList<Derogation>
          items={props.derogations.items}
          onChange={(items) => onChange({ derogations: { ...props.derogations, items } })}
          render={(it, set) => (
            <>
              <Field label="Clé">
                <Input value={it.key} onChange={(e) => set({ key: e.target.value })} />
              </Field>
              <Field label="Titre">
                <Input value={it.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Textarea
                value={it.summary}
                onChange={(e) => set({ summary: e.target.value })}
                placeholder="Résumé"
                rows={4}
                className={taClass}
              />
              <Field label="Conditions (une par ligne)">
                <Textarea
                  value={toLines(it.conditions)}
                  onChange={(e) => set({ conditions: fromLines(e.target.value) })}
                  rows={4}
                  className={taClass}
                />
              </Field>
            </>
          )}
          addItem={() => ({ key: '', title: '', summary: '', conditions: [] })}
        />
      </Group>

      {/* ───────────────── Infos officielles ──────────────────── */}
      <Group title="Infos officielles — obligations" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.officialInfo.obligation.title}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  obligation: {
                    ...props.officialInfo.obligation,
                    title: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Introduction">
          <Textarea
            value={props.officialInfo.obligation.intro}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  obligation: {
                    ...props.officialInfo.obligation,
                    intro: e.target.value,
                  },
                },
              })
            }
            rows={3}
            className={taClass}
          />
        </Field>
        <Field label="Titre « travailleurs »">
          <Input
            value={props.officialInfo.obligation.workersTitle}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  obligation: {
                    ...props.officialInfo.obligation,
                    workersTitle: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Points « travailleurs » (un par ligne)">
          <Textarea
            value={toLines(props.officialInfo.obligation.workers)}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  obligation: {
                    ...props.officialInfo.obligation,
                    workers: fromLines(e.target.value),
                  },
                },
              })
            }
            rows={5}
            className={taClass}
          />
        </Field>
        <Field label="Titre « employeurs »">
          <Input
            value={props.officialInfo.obligation.employersTitle}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  obligation: {
                    ...props.officialInfo.obligation,
                    employersTitle: e.target.value,
                  },
                },
              })
            }
          />
        </Field>
        <Field label="Points « employeurs » (un par ligne)">
          <Textarea
            value={toLines(props.officialInfo.obligation.employers)}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  obligation: {
                    ...props.officialInfo.obligation,
                    employers: fromLines(e.target.value),
                  },
                },
              })
            }
            rows={4}
            className={taClass}
          />
        </Field>
      </Group>

      <Group title="Infos officielles — pourquoi" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.officialInfo.why.title}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  why: { ...props.officialInfo.why, title: e.target.value },
                },
              })
            }
          />
        </Field>
        <Field label="Sous-titre">
          <Textarea
            value={props.officialInfo.why.subtitle}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  why: { ...props.officialInfo.why, subtitle: e.target.value },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="Items (un par ligne)">
          <Textarea
            value={toLines(props.officialInfo.why.items)}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  why: { ...props.officialInfo.why, items: fromLines(e.target.value) },
                },
              })
            }
            rows={6}
            className={taClass}
          />
        </Field>
        <Field label="Note">
          <Textarea
            value={props.officialInfo.why.note}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  why: { ...props.officialInfo.why, note: e.target.value },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
      </Group>

      <Group title="Infos officielles — aide" defaultOpen={false}>
        <Field label="Titre">
          <Input
            value={props.officialInfo.help.title}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  help: { ...props.officialInfo.help, title: e.target.value },
                },
              })
            }
          />
        </Field>
        <Field label="Paragraphes (un par ligne)">
          <Textarea
            value={toLines(props.officialInfo.help.body)}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  help: { ...props.officialInfo.help, body: fromLines(e.target.value) },
                },
              })
            }
            rows={5}
            className={taClass}
          />
        </Field>
        <Field label="Disclaimer">
          <Textarea
            value={props.officialInfo.help.disclaimer}
            onChange={(e) =>
              onChange({
                officialInfo: {
                  ...props.officialInfo,
                  help: { ...props.officialInfo.help, disclaimer: e.target.value },
                },
              })
            }
            rows={2}
            className={taClass}
          />
        </Field>
      </Group>

      {/* ───────────────────────── Légal ──────────────────────── */}
      <Group title="Légal" defaultOpen={false}>
        <Field label="Libellé « simulation »">
          <Input
            value={props.legal.simulationLabel}
            onChange={(e) =>
              onChange({ legal: { ...props.legal, simulationLabel: e.target.value } })
            }
          />
        </Field>
        <Field label="« Aucune donnée réelle »">
          <Input
            value={props.legal.noRealData}
            onChange={(e) =>
              onChange({ legal: { ...props.legal, noRealData: e.target.value } })
            }
          />
        </Field>
        <Field label="« Aucune transmission »">
          <Input
            value={props.legal.noTransmission}
            onChange={(e) =>
              onChange({ legal: { ...props.legal, noTransmission: e.target.value } })
            }
          />
        </Field>
        <Field label="« Ne remplace pas »">
          <Textarea
            value={props.legal.notReplacement}
            onChange={(e) =>
              onChange({ legal: { ...props.legal, notReplacement: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
        <Field label="« Utiliser l'officiel »">
          <Textarea
            value={props.legal.useOfficial}
            onChange={(e) =>
              onChange({ legal: { ...props.legal, useOfficial: e.target.value } })
            }
            rows={2}
            className={taClass}
          />
        </Field>
      </Group>

      {/* ────────────────────── Métadonnées ───────────────────── */}
      <Group title="Métadonnées" defaultOpen={false}>
        <Field label="Version">
          <Input
            value={props.builderMetadata.version}
            onChange={(e) =>
              onChange({
                builderMetadata: { ...props.builderMetadata, version: e.target.value },
              })
            }
          />
        </Field>
        <Field label="Note de dernière relecture">
          <Textarea
            value={props.builderMetadata.lastReviewedNote}
            onChange={(e) =>
              onChange({
                builderMetadata: {
                  ...props.builderMetadata,
                  lastReviewedNote: e.target.value,
                },
              })
            }
            rows={3}
            className={taClass}
          />
        </Field>
      </Group>
    </>
  ),
})
