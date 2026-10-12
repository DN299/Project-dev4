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
  { key: 'patients',  label: 'ผู้ป่วยทั้งหมด',    icon: Users, also: ['rec-patient'] },
  { key: 'register',  label: 'ลงทะเบียนผู้ป่วย', icon: UserPlus },
  { key: 'queue',     label: 'คิวผู้ป่วย',        icon: ListOrdered },
  { key: 'status',    label: 'สถานะ',            icon: Activity },
  { key: 'schedule',  label: 'ตารางนัด',          icon: CalendarDays },
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
        className={`flex min-h-[42px] w-full items-center gap-3 rounded-full px-3.5 text-left text-[15px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-rx-accent/30 ${
          active
            ? 'bg-rx-accent font-semibold text-white'
            : 'text-rx-ink hover:bg-rx-fill [&_svg]:text-rx-accent'
        }`}
      >
        <n.icon size={18} strokeWidth={1.8} />
        <span>{n.label}</span>
      </button>
    )
  }

  return (
    <aside className="z-10 flex shrink-0 flex-col border-black/[0.08] bg-white/90 backdrop-blur-xl max-md:w-full max-md:border-b md:sticky md:top-0 md:h-screen md:w-[240px] md:border-r">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-rx-accent text-white">
          <Activity size={18} strokeWidth={2.2} />
        </div>
        <span className="text-[17px] font-semibold text-rx-ink">ALS REHAB</span>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
        <span className="mb-1.5 px-3 text-[13px] font-semibold text-rx-muted">{isTherapist ? 'นักกายภาพบำบัด' : 'เวชระเบียน'}</span>
        <nav className="flex flex-col gap-0.5 max-md:flex-row max-md:flex-wrap">{nav.map(item)}</nav>
      </div>

      <div className="border-t border-black/5 p-3">
        <div className="group flex items-center gap-3 p-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rx-tint text-[13px] font-semibold text-rx-accent">
            {initials(user.first_name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-semibold text-rx-ink">
              {isTherapist ? ptName(user.first_name) : `${user.first_name} ${user.last_name.trim().charAt(0)}.`}
            </span>
            <span className="truncate text-[12px] text-rx-muted">{isTherapist ? 'นักกายภาพบำบัด' : 'เจ้าหน้าที่เวชระเบียน'}</span>
          </div>
          <button type="button" onClick={onLogout} aria-label="ออกจากระบบ" title="ออกจากระบบ" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rx-faint transition-colors hover:bg-white hover:text-[#A32D2D]">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}
