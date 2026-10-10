import type { ComponentType } from 'react'
import type { AuthUser, PageKey } from '../types'
import {
  LayoutDashboard, UserPlus, ListOrdered, Activity, CalendarDays, ClipboardList,
  Home, Users, LogOut, type LucideProps,
} from 'lucide-react'
import { initials, ptName } from '../lib/clinic'

type NavItem = { key: PageKey; label: string; icon: ComponentType<LucideProps>; also?: PageKey[] }

const STAFF_NAV: NavItem[] = [
  { key: 'dashboard', label: 'แดชบอร์ด',         icon: LayoutDashboard },
  { key: 'register',  label: 'ลงทะเบียนผู้ป่วย', icon: UserPlus },
  { key: 'queue',     label: 'คิวผู้ป่วย',        icon: ListOrdered, also: ['rec-patient'] },
  { key: 'status',    label: 'ติดตามการรักษา',    icon: Activity },
  { key: 'schedule',  label: 'ตารางนัด',          icon: CalendarDays },
  { key: 'programs',  label: 'คลังโปรแกรม',       icon: ClipboardList },
]
const THERAPIST_NAV: NavItem[] = [
  { key: 'my-home',     label: 'หน้าแรก',     icon: Home, also: ['assess'] },
  { key: 'my-cases',    label: 'เคสของฉัน',   icon: Users, also: ['case'] },
  { key: 'my-schedule', label: 'ตารางนัด',    icon: CalendarDays },
  { key: 'programs',    label: 'คลังโปรแกรม', icon: ClipboardList },
]

interface Props { page: PageKey; onNavigate: (p: PageKey) => void; user: AuthUser; onLogout: () => void }

export default function Sidebar({ page, onNavigate, user, onLogout }: Props) {
  const isTherapist = user.role_id === 'R002'
  const nav = isTherapist ? THERAPIST_NAV : STAFF_NAV

  const item = (n: NavItem) => {
    const active = page === n.key || !!n.also?.includes(page)
    return (
      <button
        key={n.key}
        type="button"
        onClick={() => onNavigate(n.key)}
        className={`flex min-h-[46px] w-full items-center gap-2.5 rounded px-4 text-left text-[15px] font-semibold transition-colors ${
          active ? 'bg-rx-accent text-white' : 'text-rx-ink hover:bg-rx-bg'
        }`}
      >
        <n.icon size={20} strokeWidth={2} />
        <span>{n.label}</span>
      </button>
    )
  }

  return (
    <aside className="flex shrink-0 flex-col gap-1 bg-white p-4 max-md:w-full md:sticky md:top-0 md:h-screen md:w-[240px]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rx-accent text-white">
          <Activity size={20} strokeWidth={2.2} />
        </div>
        <span className="text-[20px] font-semibold tracking-[0.02em] text-rx-ink">ALS REHAB</span>
      </div>

      <span className="mb-2 mt-3 text-[13px] uppercase tracking-[0.04em] text-rx-muted">{isTherapist ? 'นักกายภาพบำบัด' : 'เวชระเบียน'}</span>
      <nav className="flex flex-col gap-1 max-md:flex-row max-md:flex-wrap">{nav.map(item)}</nav>


      <div className="flex-1" />
      <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-rx-bg px-2 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rx-tint text-[13px] font-semibold text-rx-accent-deep">
          {initials(user.first_name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold text-rx-ink">
            {isTherapist ? ptName(user.first_name) : `${user.first_name} ${user.last_name.trim().charAt(0)}.`}
          </span>
          <span className="truncate text-[12px] text-rx-muted">{isTherapist ? 'นักกายภาพบำบัด' : 'เจ้าหน้าที่เวชระเบียน'}</span>
        </div>
        <button type="button" onClick={onLogout} aria-label="ออกจากระบบ" title="ออกจากระบบ" className="flex h-9 w-9 items-center justify-center rounded-lg text-rx-muted hover:bg-white hover:text-[#A32D2D]">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}
