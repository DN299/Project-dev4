import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/* shadcn/ui Toaster (sonner) — ป้ายแจ้งเตือนมุมขวาบน เรียกใช้ด้วย toast.success('...') จาก 'sonner' */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      toastOptions={{ className: 'font-rx !rounded-lg !text-[14px]' }}
      style={{ '--normal-bg': '#fff', '--normal-text': 'var(--color-rx-ink)', '--normal-border': 'var(--color-rx-line)' } as CSSProperties}
      {...props}
    />
  )
}
