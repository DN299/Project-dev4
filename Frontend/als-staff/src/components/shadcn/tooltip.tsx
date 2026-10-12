import type { ComponentProps, ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { cn } from '../../lib/utils'

/* shadcn/ui Tooltip — เนื้อหาถูก portal ไปที่ body จึงใส่ font-rx ให้ได้ฟอนต์/น้ำหนัก/มุมโค้งชุดเดียวกับเว็บ */
export function TooltipProvider({ delayDuration = 200, ...props }: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({ className, sideOffset = 6, children, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'font-rx z-50 w-fit max-w-xs rounded-full bg-rx-ink/90 px-3 py-1.5 text-[12px] text-white shadow-md',
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      >
        {children}
        
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/** ทางลัด: <Hint label="...">ปุ่ม</Hint> */
export function Hint({ label, side, children }: { label: ReactNode; side?: ComponentProps<typeof TooltipPrimitive.Content>['side']; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
