export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type AccordionItem = {
  label?: string
  value?: string
  icon?: string
  content?: string
  disabled?: boolean
  items?: any[]
  [key: string]: any
}

export type FormFieldProps = Record<string, any>
export type InputNumberProps = Record<string, any>
export type InputProps = Record<string, any>
export type InputMenuProps = Record<string, any>
export type SwitchProps = Record<string, any>
export type SliderProps = Record<string, any>
export type SelectMenuProps = Record<string, any>
export type SelectMenuItem = Record<string, any>
export type InputMenuItem = Record<string, any>
export type TabsItem = Record<string, any>

export type DropdownMenuItem = {
  label?: string
  value?: any
  type?: string
  checked?: boolean
  disabled?: boolean
  color?: string
  icon?: string
  onSelect?: (...args: any[]) => void
  onClick?: (...args: any[]) => void
  onUpdateChecked?: (checked: boolean) => void
  [key: string]: any
}

export type TableColumn<T = any> = {
  id?: string
  header?: string
  accessorKey?: string
  accessorFn?: (row: T) => any
  cell?: (ctx: any) => any
  [key: string]: any
}

export type ToastOptions = {
  title?: string
  description?: string
  color?: string
  duration?: number
  onClick?: () => void
  [key: string]: any
}

export type AlertProps = {
  title?: string
  description?: string
  color?: string
  variant?: string
  icon?: string
  close?: boolean
  actions?: any[]
  [key: string]: any
}

export type ChatMessageProps = {
  id: string
  role: 'system' | 'user' | 'assistant'
  side?: string
  parts: any[]
  avatar?: { src?: string; alt?: string }
  [key: string]: any
}
