'use client'

import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import type { ChildLayout } from './container-layout'

/**
 * Inspector controls for a container's child layout (Empilé / Ligne / Grille).
 * Shared by the `section` and `container` blocks. `onChange` accepts a partial
 * of the container's props (a superset of ChildLayout), so both blocks can pass
 * their own `onChange` directly.
 */
export function ChildLayoutFields({
  props,
  onChange,
}: {
  props: ChildLayout
  onChange: (partial: Partial<ChildLayout>) => void
}) {
  const mode = props.layoutMode ?? 'stack'
  return (
    <Group title="Disposition des enfants">
      <Field label="Mode" hint="Comment empiler les blocs enfants">
        <Pills
          value={mode}
          onChange={(v) => onChange({ layoutMode: v as ChildLayout['layoutMode'] })}
          options={[
            { value: 'stack', label: 'Empilé' },
            { value: 'row', label: 'Ligne' },
            { value: 'grid', label: 'Grille' },
            { value: 'autogrid', label: 'Auto' },
            { value: 'masonry', label: 'Masonry' },
          ]}
        />
      </Field>

      <div className="flex items-center justify-between gap-4 py-1">
        <Field
          label="Disposition libre (X/Y)"
          className="flex-1"
          hint="Place les enfants librement (position absolue par bloc)"
        >
          <span className="sr-only">Disposition libre</span>
        </Field>
        <Switch
          checked={props.freeLayout ?? false}
          onCheckedChange={(v) => onChange({ freeLayout: v })}
        />
      </div>

      {mode !== 'stack' && (
        <Field label="Espacement">
          <Pills
            value={props.layoutGap ?? 'md'}
            onChange={(v) => onChange({ layoutGap: v as ChildLayout['layoutGap'] })}
            options={[
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
              { value: 'xl', label: 'XL' },
            ]}
          />
        </Field>
      )}

      {(mode === 'grid' || mode === 'masonry') && (
        <Field label="Colonnes">
          <Pills
            value={props.layoutCols ?? (mode === 'masonry' ? 3 : 2)}
            onChange={(v) => onChange({ layoutCols: v as ChildLayout['layoutCols'] })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
      )}

      {mode === 'autogrid' && (
        <Field label="Taille mini des items" hint="Colonnes ajustées automatiquement">
          <Pills
            value={props.layoutMinItem ?? 'md'}
            onChange={(v) => onChange({ layoutMinItem: v as ChildLayout['layoutMinItem'] })}
            options={[
              { value: 'sm', label: 'Petit' },
              { value: 'md', label: 'Moyen' },
              { value: 'lg', label: 'Grand' },
            ]}
          />
        </Field>
      )}

      {mode === 'row' && (
        <>
          <Field label="Justification">
            <Pills
              value={props.layoutJustify ?? 'start'}
              onChange={(v) =>
                onChange({ layoutJustify: v as ChildLayout['layoutJustify'] })
              }
              options={[
                { value: 'start', label: 'Début' },
                { value: 'center', label: 'Centre' },
                { value: 'end', label: 'Fin' },
                { value: 'between', label: 'Entre' },
                { value: 'around', label: 'Autour' },
              ]}
            />
          </Field>
          <div className="flex items-center justify-between gap-4 py-1">
            <Field label="Retour à la ligne" className="flex-1">
              <span className="sr-only">wrap</span>
            </Field>
            <Switch
              checked={props.layoutWrap ?? true}
              onCheckedChange={(v) => onChange({ layoutWrap: v })}
            />
          </div>
        </>
      )}

      {mode !== 'stack' && mode !== 'masonry' && (
        <Field label="Alignement vertical">
          <Pills
            value={props.layoutAlign ?? (mode === 'row' ? 'start' : 'stretch')}
            onChange={(v) => onChange({ layoutAlign: v as ChildLayout['layoutAlign'] })}
            options={[
              { value: 'start', label: 'Haut' },
              { value: 'center', label: 'Centre' },
              { value: 'end', label: 'Bas' },
              { value: 'stretch', label: 'Étirer' },
            ]}
          />
        </Field>
      )}
    </Group>
  )
}
