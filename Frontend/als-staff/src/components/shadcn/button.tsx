import type { ComponentProps } from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/* shadcn/ui Button — สไตล์ปุ่ม iOS แบบทางการ: ทรงแคปซูล · ปุ่มหลักพื้นฟ้า · ปุ่มรองพื้นขาวขอบบาง · เงาเบา */
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold outline-none transition-[background-color,color,opacity,box-shadow] focus-visible:ring-[3px] focus-visible:ring-rx-accent/25 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-rx-accent text-white shadow-[0_1px_2px_rgba(0,122,255,0.25)] hover:bg-rx-accent-ink active:opacity-85',
        outline: 'rx-glass-control text-rx-accent hover:bg-rx-bg active:opacity-85',
        'accent-outline': 'bg-rx-tint text-rx-accent hover:bg-rx-tint-2/60 active:opacity-85',
        dark: 'bg-rx-ink text-white hover:bg-black active:opacity-85',
        ghost: 'text-rx-accent hover:bg-rx-fill',
        soft: 'rx-glass-control text-rx-ink hover:bg-rx-bg',
        disabled: 'cursor-not-allowed bg-rx-fill text-rx-faint',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px]',
        md: 'h-10 px-5 text-[14px]',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export function Button({ className, variant, size, asChild = false, ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
