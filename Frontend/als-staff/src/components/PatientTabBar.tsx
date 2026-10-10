import type { ComponentType } from 'react'
import type { PageKey } from '../types'
import { Home, CalendarDays, TrendingUp, MessageCircle, User, type LucideProps } from 'lucide-react'

const TABS: { key: PageKey; label: string; icon: ComponentType<LucideProps> }[] = [
  { key: 'patient-home',         label: 'หน้าหลัก',   icon: Home },
  { key: 'patient-appointments', label: 'นัดหมาย',    icon: CalendarDays },
  { key: 'patient-stats',        label: 'ผลการฝึก',   icon: TrendingUp },
  { key: 'patient-feedback',     label: 'คำแนะนำ',    icon: MessageCircle },
  { key: 'patient-profile',      label: 'ฉัน',        icon: User },
]

interface Props { page: PageKey; onNavigate: (p: PageKey) => void }

export default function PatientTabBar({ page, onNavigate }: Props) {
  return (
    <nav className="grid shrink-0 grid-cols-5 border-t border-pt-line bg-white px-1.5 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
      {TABS.map(t => {
        const active = page === t.key || (t.key === 'patient-home' && page === 'patient-queue')
        return (
          <button
            key={t.key}
            onClick={() => onNavigate(t.key)}
            className={`flex min-h-11 flex-col items-center justify-center gap-[3px] text-[11px] ${active ? 'font-semibold text-pt-accent' : 'text-pt-muted'}`}
          >
            <t.icon size={22} strokeWidth={2} />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
