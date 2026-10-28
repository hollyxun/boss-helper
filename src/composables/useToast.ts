import { toast as sonnerToast } from 'vue-sonner'

import type { ToastOptions } from '@/types/ui'

function add(options: ToastOptions) {
  const message = options.title ?? options.description ?? ''
  const description = options.title ? options.description : undefined
  const duration =
    options.duration === undefined
      ? undefined
      : options.duration === 0
        ? Infinity
        : options.duration

  const common = {
    description,
    duration,
    action: options.onClick
      ? {
          label: '查看',
          onClick: options.onClick,
        }
      : undefined,
  }

  switch (options.color) {
    case 'success':
      return sonnerToast.success(message, common)
    case 'error':
    case 'danger':
      return sonnerToast.error(message, common)
    case 'warning':
      return sonnerToast.warning(message, common)
    case 'info':
      return sonnerToast.info(message, common)
    default:
      return sonnerToast(message, common)
  }
}

export function useToast() {
  return { add }
}

export { sonnerToast as toast }
