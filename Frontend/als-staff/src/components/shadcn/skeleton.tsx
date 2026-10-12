import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

/* shadcn/ui Skeleton — กล่องเทากะพริบระหว่างรอข้อมูล */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-rx-soft', className)} {...props} />
}
