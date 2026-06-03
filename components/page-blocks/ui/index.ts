import { card } from './card'
import { accordion } from './accordion'
import { tabs } from './tabs'
import { alert } from './alert'
import { badges } from './badges'
import { progress } from './progress'
import { buttonGroup } from './button-group'
import { modal } from './modal'
import { drawer } from './drawer'
import { popoverBlock } from './popover-block'

export const uiBlocks = {
  card,
  accordion,
  tabs,
  alert,
  badges,
  progress,
  buttonGroup,
  modal,
  drawer,
  popover: popoverBlock,
} as const
