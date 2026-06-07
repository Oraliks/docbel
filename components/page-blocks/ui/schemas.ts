import { z } from 'zod'
import { actionSchema } from '@/lib/page-builder/action-schema'

const accordionItemSchema = z.object({
  title: z.string().max(500),
  content: z.string().max(5000),
})

export const accordionSchema = z.object({
  items: z.array(accordionItemSchema).max(50),
  type: z.enum(['single', 'multiple']).optional(),
  variant: z.enum(['default', 'bordered', 'separated']).optional(),
})

const tabItemSchema = z.object({
  label: z.string().max(120),
  content: z.string().max(20000),
})

export const tabsSchema = z.object({
  items: z.array(tabItemSchema).max(20),
  variant: z.enum(['default', 'pills', 'underline']).optional(),
  controlId: z.string().max(60).optional(),
})

export const alertSchema = z.object({
  title: z.string().max(200).optional(),
  message: z.string().max(2000).default(''),
  variant: z.enum(['info', 'success', 'warning', 'destructive']).optional(),
  dismissible: z.boolean().optional(),
  icon: z.string().max(40).optional(),
})

const badgesItemSchema = z.object({
  label: z.string().max(120),
  variant: z.enum(['default', 'secondary', 'outline', 'destructive']).optional(),
  color: z.string().optional(),
})

export const badgesSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(badgesItemSchema).max(50),
  align: z.enum(['left', 'center']).optional(),
})

const buttonGroupItemSchema = z.object({
  text: z.string().max(120),
  link: z.string().max(4096),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).optional(),
  icon: z.string().max(40).optional(),
  action: actionSchema.optional(),
})

export const buttonGroupSchema = z.object({
  items: z.array(buttonGroupItemSchema).max(20),
  align: z.enum(['left', 'center', 'right']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
})

export const cardSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  body: z.string().max(20000).optional(),
  image: z.string().max(4096).optional(),
  ctaText: z.string().max(120).optional(),
  ctaLink: z.string().max(4096).optional(),
  ctaAction: actionSchema.optional(),
  variant: z.enum(['default', 'bordered', 'elevated', 'gradient']).optional(),
})

export const progressSchema = z.object({
  label: z.string().max(200).optional(),
  value: z.number().min(0).max(100).default(0),
  showValue: z.boolean().optional(),
  color: z.string().optional(),
  variant: z.enum(['default', 'segmented', 'circular']).optional(),
})

export const modalSchema = z.object({
  triggerText: z.string().max(120).default('Ouvrir'),
  triggerVariant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']).optional(),
  triggerSize: z.enum(['sm', 'md', 'lg']).optional(),
  hideTrigger: z.boolean().optional(),
  modalId: z.string().max(60).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  content: z.string().max(20000).optional(),
  size: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
})

export const drawerSchema = z.object({
  triggerText: z.string().max(120).default('Ouvrir'),
  triggerVariant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']).optional(),
  triggerSize: z.enum(['sm', 'md', 'lg']).optional(),
  hideTrigger: z.boolean().optional(),
  drawerId: z.string().max(60).optional(),
  side: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  content: z.string().max(20000).optional(),
})

export const popoverSchema = z.object({
  triggerText: z.string().max(120).default('Plus d’infos'),
  triggerVariant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']).optional(),
  triggerSize: z.enum(['sm', 'md', 'lg']).optional(),
  align: z.enum(['start', 'center', 'end']).optional(),
  title: z.string().max(200).optional(),
  content: z.string().max(10000).optional(),
})

export const dataTableSchema = z.object({
  columns: z.string().max(2000).optional(),
  rows: z.string().max(20000).optional(),
  searchable: z.boolean().optional(),
  sortable: z.boolean().optional(),
  pageSize: z.number().min(0).max(200).optional(),
  striped: z.boolean().optional(),
  compact: z.boolean().optional(),
})

export const uiSchemas = {
  accordion: accordionSchema,
  tabs: tabsSchema,
  alert: alertSchema,
  badges: badgesSchema,
  buttonGroup: buttonGroupSchema,
  card: cardSchema,
  progress: progressSchema,
  modal: modalSchema,
  drawer: drawerSchema,
  popover: popoverSchema,
  dataTable: dataTableSchema,
} as const
