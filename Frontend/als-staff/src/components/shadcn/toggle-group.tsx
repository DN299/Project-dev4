import type { ComponentProps } from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '../../lib/utils'

/* shadcn/ui ToggleGroup (single) แบบ iOS Segmented Control — รางสีเทาทรงแคปซูล ตัวที่เลือกเป็นเม็ดขาว · ลูกศรซ้าย/ขวาเลื่อนได้ */
export function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root data-slot="toggle-group" className={cn('flex gap-0.5 self-start rounded-full bg-rx-fill p-0.5', className)} {...props} />
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'h-8 rounded-full px-4 text-[13px] font-medium text-rx-ink outline-none transition-[background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-rx-accent/25',
        'data-[state=on]:bg-white data-[state=on]:font-semibold data-[state=on]:shadow-[0_2px_6px_rgba(0,0,0,0.10),0_1px_1px_rgba(0,0,0,0.04)]',
        className,
      )}
      {...props}
    />
  )
}
