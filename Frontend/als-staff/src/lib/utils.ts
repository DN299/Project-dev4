import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** รวม className แบบ shadcn/ui — คลาส Tailwind ที่ชนกัน ตัวหลังชนะ */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
