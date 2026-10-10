// ALS Staff Frontend — Full Setup Script
// วางไว้ที่ D:\PROJECT\Frontend\als-staff\ แล้วรัน: node setup-als-staff.cjs

const fs = require('fs')
const path = require('path')

function write(fp, content) {
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  fs.writeFileSync(fp, content, 'utf8')
  console.log('  ✅ ' + fp)
}

console.log('\n🚀 สร้างไฟล์ ALS Staff Frontend...\n')

// ============================================================
// src/index.css  — Design tokens ตรงตาม als-ui-improved.html
// ============================================================
write('src/index.css', `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai+Looped:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --ink: #1c3145; --ink-2: #3d566b; --muted: #7b90a1;
  --line: #e3eaf0; --canvas: #f4f7f9; --paper: #ffffff;
  --blue: #2c6cd6; --blue-t: #e9f0fc;
  --amber: #dd7318; --amber-t: #fdf2e8;
  --green: #4c8b3c; --green-t: #eef6ec;
  --rose: #dd4f68; --rose-t: #fdeef1;
  --r-s: 10px; --r-m: 16px;
  --sh: 0 1px 2px rgba(28,49,69,.05), 0 8px 24px rgba(28,49,69,.06);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
body { background: var(--canvas); color: var(--ink); font-family: "Noto Sans Thai Looped", system-ui, sans-serif; }
button { font-family: inherit; cursor: pointer; }
input, select, textarea { font-family: inherit; }

/* Layout */
.app-shell { display: flex; height: 100vh; overflow: hidden; }
.topbar { padding: 8px 16px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; background: var(--paper); }
.topbar-right { display: flex; align-items: center; gap: 6px; }
.online-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); }
.main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.content-area { flex: 1; overflow-y: auto; padding: 24px; }

/* Sidebar */
.sidebar { width: 220px; border-right: 1px solid var(--line); background: #fbfcfd; display: flex; flex-direction: column; flex-shrink: 0; }
.sidebar-logo { padding: 16px 18px; border-bottom: 1px solid var(--line); }
.sidebar-logo h2 { font-size: 15px; font-weight: 700; color: var(--blue); }
.sidebar-logo p { font-size: 11px; color: var(--muted); margin-top: 2px; }
.sidebar-nav { flex: 1; padding: 8px 0; overflow-y: auto; }
.nav-btn { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border: none; background: none; width: 100%; text-align: left; font-size: 13px; color: var(--ink-2); transition: .15s; border-left: 3px solid transparent; }
.nav-btn:hover { background: var(--canvas); }
.nav-btn.active { background: var(--blue-t); color: var(--blue); font-weight: 600; border-left-color: var(--blue); }
.nav-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
.sidebar-footer { padding: 14px 18px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 10px; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--blue); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.user-name { font-size: 12px; font-weight: 600; }
.user-role { font-size: 10px; color: var(--muted); }

/* Card & layout helpers */
.card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-m); padding: 20px; margin-bottom: 14px; }
.card-0 { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-m); overflow: hidden; margin-bottom: 14px; }
.h-sec { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.h-sec-title { font-size: 15px; font-weight: 700; }
.page-title { font-size: 19px; font-weight: 700; }
.page-sub { font-size: 12px; color: var(--muted); margin: 4px 0 16px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.eyebrow { font-size: 10.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
.big { font-size: 28px; font-weight: 700; }
.big-unit { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 4px; }
.mono { font-family: "IBM Plex Mono", monospace; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--r-s); border: 1.5px solid var(--blue); background: var(--blue); color: #fff; font-size: 13px; font-weight: 600; transition: .15s; }
.btn:hover { filter: brightness(1.08); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-ghost { background: var(--paper); color: var(--blue); }
.btn-sm { padding: 6px 14px; font-size: 12px; }
.btn-success { background: var(--green); border-color: var(--green); }
.btn-danger { background: var(--rose); border-color: var(--rose); }

/* Badges */
.pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 600; }
.pill-green { background: var(--green-t); color: var(--green); }
.pill-amber { background: var(--amber-t); color: var(--amber); }
.pill-blue { background: var(--blue-t); color: var(--blue); }
.pill-rose { background: var(--rose-t); color: var(--rose); }
.side-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 600; }
.side-badge-left { background: var(--blue-t); color: #1c4d9e; }
.side-badge-right { background: var(--green-t); color: #2d6a0f; }
.side-badge-both { background: var(--amber-t); color: #7a4010; }

/* Forms */
.field { display: block; margin-bottom: 12px; }
.field-label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; }
.req { color: var(--rose); }
.inp { width: 100%; padding: 9px 12px; border: 1.5px solid var(--line); border-radius: var(--r-s); font-size: 13px; background: var(--paper); color: var(--ink); }
.inp:focus { outline: none; border-color: var(--blue); }

/* Table */
.data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.data-table th { text-align: left; padding: 10px 14px; border-bottom: 2px solid var(--line); font-size: 11px; color: var(--muted); font-weight: 600; }
.data-table td { padding: 10px 14px; border-bottom: 1px solid var(--line); }
.data-table tr:hover td { background: var(--canvas); }

/* KV row */
.kv { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 12.5px; }
.kv:last-child { border-bottom: none; }

/* Note box */
.note { background: var(--canvas); border: 1px solid var(--line); border-radius: var(--r-s); padding: 12px; font-size: 11.5px; line-height: 1.55; color: var(--ink-2); }
.note-pdpa { background: var(--blue-t); border-color: var(--blue); color: #1c4d9e; }

/* Stepper */
.stepper { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
.step { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); }
.step-num { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--line); font-weight: 700; font-size: 10px; flex-shrink: 0; }
.step-active { color: var(--blue); font-weight: 600; }
.step-active .step-num { background: var(--blue); color: #fff; }
.step-done .step-num { background: var(--green); color: #fff; }
.stepline { flex: 1; height: 2px; background: var(--line); min-width: 20px; }

/* Toolbar / Search */
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.search-wrap { position: relative; flex: 1; min-width: 200px; }
.search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1.5px solid var(--line); border-radius: var(--r-s); font-size: 13px; background: var(--paper); color: var(--ink); }
.search-input:focus { outline: none; border-color: var(--blue); }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; pointer-events: none; }
.search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: none; color: var(--muted); font-size: 14px; }
.filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-pill { padding: 5px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 600; border: 1.5px solid var(--line); background: var(--paper); color: var(--muted); transition: .15s; }
.filter-pill:hover, .filter-pill.active { border-color: var(--blue); color: var(--blue); background: var(--blue-t); }
.result-count { font-size: 11.5px; color: var(--muted); margin-bottom: 12px; }

/* Side selector */
.side-selector { display: flex; gap: 8px; margin-top: 4px; }
.side-btn { flex: 1; padding: 10px 8px; border-radius: var(--r-s); border: 1.5px solid var(--line); background: var(--paper); color: var(--muted); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: .15s; }
.side-btn:hover, .side-btn.active { border-color: var(--blue); background: var(--blue-t); color: var(--blue); font-weight: 600; }
.side-icon { font-size: 22px; }

/* Area tags */
.area-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.area-tag { padding: 5px 12px; border-radius: 999px; font-size: 12px; border: 1.5px solid var(--line); background: var(--paper); color: var(--muted); transition: .15s; user-select: none; }
.area-tag:hover, .area-tag.active { border-color: var(--blue); background: var(--blue-t); color: var(--blue); font-weight: 600; }

/* Export buttons */
.export-row { display: flex; gap: 8px; flex-wrap: wrap; }
.export-btn { flex: 1; min-width: 90px; padding: 10px; border: 1.5px solid var(--line); border-radius: var(--r-s); background: var(--paper); color: var(--ink-2); font-size: 12px; text-align: center; transition: .15s; }
.export-btn:hover { border-color: var(--blue); background: var(--blue-t); color: var(--blue); }
.export-icon { font-size: 20px; display: block; margin-bottom: 4px; }

/* Patient card */
.patient-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-m); padding: 18px; }
.patient-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.patient-identity { display: flex; gap: 12px; align-items: center; }
.av { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0; }
.patient-name { font-size: 13.5px; font-weight: 700; }
.patient-meta { font-size: 10.5px; color: var(--muted); margin-top: 2px; }
.patient-actions { display: flex; gap: 8px; align-items: center; }

/* Time grid (ตารางนัด) */
.time-grid { display: grid; gap: 1px; background: var(--line); }
.time-header { font-size: 11px; font-weight: 600; text-align: center; padding: 10px 8px; background: #fbfcfd; }
.time-label { font-size: 10.5px; color: var(--muted); padding: 8px 4px; text-align: right; font-family: "IBM Plex Mono", monospace; }
.time-slot { min-height: 60px; background: var(--paper); padding: 6px; cursor: pointer; transition: .1s; }
.time-slot:hover { background: var(--canvas); }
.time-slot-empty { display: grid; place-items: center; color: var(--green); font-size: 11px; font-weight: 600; border: 2px dashed var(--line); }
.time-slot-empty:hover { border-color: var(--green); background: var(--green-t); }
.time-slot-lunch { background: repeating-linear-gradient(45deg, transparent, transparent 5px, var(--canvas) 5px, var(--canvas) 10px) !important; cursor: default; }
.appt-block { border-radius: 8px; padding: 6px 8px; font-size: 10.5px; line-height: 1.4; margin-bottom: 4px; }
.appt-block b { font-size: 11px; }
.device-check { display: flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 9.5px; opacity: .8; }

/* States */
.loading-box { padding: 60px; text-align: center; color: var(--muted); }
.empty-box { padding: 60px; text-align: center; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-title { font-weight: 700; font-size: 15px; margin-bottom: 6px; }
.empty-sub { font-size: 12px; color: var(--muted); }

/* Toast */
.toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: var(--r-s); font-size: 13px; font-weight: 600; z-index: 1000; animation: slideIn .3s ease; }
.toast-success { background: var(--green); color: #fff; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: none; opacity: 1 } }

/* Reg layout */
.reg-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 12px; }

/* Summary card */
.summary-card { background: var(--green-t); border: 1px solid #d9e9d4; border-radius: var(--r-m); padding: 20px; }

@media (max-width: 1024px) { .reg-grid { grid-template-columns: 1fr; } .grid3 { grid-template-columns: 1fr 1fr; } }
@media (max-width: 768px) { .sidebar { display: none; } .grid2, .grid3 { grid-template-columns: 1fr; } }
`)

// ============================================================
// src/main.tsx
// ============================================================
write('src/main.tsx', `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
`)

// ============================================================
// src/types.ts
// ============================================================
write('src/types.ts', `export type PageKey = 'queue' | 'register' | 'therapists' | 'devices' | 'schedule' | 'overview'

export interface QueuePatient {
  id: string; ref: string; name: string; when: string
  step: 1 | 2 | 3 | 4; side: string; sideClass: 'left' | 'right' | 'both' | ''
}

export interface Therapist {
  ot_id: string; users_id?: string; license_number: string
  first_name: string; last_name: string; phone?: string; cases?: number
}

export interface Patient {
  patient_id: string; users_id: string; medical_condition?: string | null
  weight?: string | null; register_date?: string | null; address?: string | null
  affected_side?: string | null
}

export interface Device {
  id: string; user: string; date: string
  status: string; tone: 'green' | 'blue' | 'amber' | 'rose'; battery: string
}

export interface Appointment {
  key: string; name: string; therapist: string; duration: string
  device: string; ok: boolean; bg: string
}
`)

// ============================================================
// src/App.tsx
// ============================================================
write('src/App.tsx', `import { useState } from 'react'
import type { PageKey } from './types'
import Sidebar from './components/Sidebar'
import PatientsPage from './pages/PatientsPage'
import RegisterPage from './pages/RegisterPage'
import TherapistsPage from './pages/TherapistsPage'
import DevicesPage from './pages/DevicesPage'
import SchedulePage from './pages/SchedulePage'
import OverviewPage from './pages/OverviewPage'

export default function App() {
  const [page, setPage] = useState<PageKey>('queue')
  const [regStep, setRegStep] = useState(1)

  const goto = (p: PageKey) => { setPage(p); setRegStep(1) }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={goto} />
      <div className="main-area">
        <div className="topbar">
          <span>als-rehab.psu.ac.th/records</span>
          <div className="topbar-right"><span className="online-dot" /> ระบบพร้อมใช้งาน</div>
        </div>
        <div className="content-area">
          {page === 'queue'      && <PatientsPage   onRegister={() => { setPage('register'); setRegStep(1) }} />}
          {page === 'register'   && <RegisterPage    step={regStep} setStep={setRegStep} onBack={() => goto('queue')} />}
          {page === 'therapists' && <TherapistsPage />}
          {page === 'devices'    && <DevicesPage />}
          {page === 'schedule'   && <SchedulePage />}
          {page === 'overview'   && <OverviewPage />}
        </div>
      </div>
    </div>
  )
}
`)

// ============================================================
// src/components/Sidebar.tsx
// ============================================================
write('src/components/Sidebar.tsx', `import type { PageKey } from '../types'

const NAV: { key: PageKey; label: string; icon: string }[] = [
  { key: 'queue',      label: 'คิวรับผู้ป่วย',        icon: '👥' },
  { key: 'register',   label: 'ลงทะเบียนผู้ป่วยใหม่', icon: '➕' },
  { key: 'therapists', label: 'จัดการนักกายภาพ',      icon: '🩺' },
  { key: 'devices',    label: 'คลังอุปกรณ์',          icon: '📦' },
  { key: 'schedule',   label: 'ตารางนัดรวม',          icon: '📅' },
  { key: 'overview',   label: 'ภาพรวมศูนย์',          icon: '📊' },
]

interface Props { page: PageKey; onNavigate: (p: PageKey) => void }

export default function Sidebar({ page, onNavigate }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h2>ALS Rehab</h2>
        <p>บุคลากร · เวชระเบียน</p>
      </div>
      <div className="sidebar-nav">
        {NAV.map(n => (
          <button key={n.key} className={\`nav-btn \${page === n.key ? 'active' : ''}\`} onClick={() => onNavigate(n.key)}>
            <span style={{ fontSize: 16 }}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="avatar">วร</div>
        <div><div className="user-name">วราภรณ์ ใจดี</div><div className="user-role">นักเวชระเบียน</div></div>
      </div>
    </nav>
  )
}
`)

// ============================================================
// src/components/Stepper.tsx
// ============================================================
write('src/components/Stepper.tsx', `const LABELS = ['รับเรื่อง', 'ลงทะเบียน', 'นัดหมาย', 'จับคู่อุปกรณ์']

export default function Stepper({ current }: { current: number }) {
  return (
    <div className="stepper">
      {LABELS.map((label, i) => {
        const n = i + 1
        const cls = n < current ? 'step step-done' : n === current ? 'step step-active' : 'step'
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div className={cls}>
              <span className="step-num">{n < current ? '✓' : n}</span>
              {label}
            </div>
            {i < 3 && <div className="stepline" />}
          </div>
        )
      })}
    </div>
  )
}
`)

// ============================================================
// src/components/SideBadge.tsx
// ============================================================
write('src/components/SideBadge.tsx', `export default function SideBadge({ side }: { side?: string | null }) {
  if (!side) return null
  const map: Record<string, { cls: string; pre: string }> = {
    'ข้างซ้าย':     { cls: 'side-badge side-badge-left',  pre: '← ' },
    'ข้างขวา':     { cls: 'side-badge side-badge-right', pre: '→ ' },
    'ทั้งสองข้าง': { cls: 'side-badge side-badge-both',  pre: '↔ ' },
  }
  const s = map[side]
  if (!s) return null
  return <span className={s.cls}>{s.pre}{side}</span>
}
`)

// ============================================================
// src/components/SearchBar.tsx
// ============================================================
write('src/components/SearchBar.tsx', `interface Props { value: string; onChange: (v: string) => void; placeholder?: string }

export default function SearchBar({ value, onChange, placeholder = 'ค้นหา...' }: Props) {
  return (
    <div className="search-wrap">
      <span className="search-icon">🔍</span>
      <input className="search-input" type="text" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} />
      {value && <button className="search-clear" onClick={() => onChange('')}>✕</button>}
    </div>
  )
}
`)

// ============================================================
// src/pages/PatientsPage.tsx
// ============================================================
write('src/pages/PatientsPage.tsx', `import { useEffect, useState } from 'react'
import type { Patient } from '../types'
import SearchBar from '../components/SearchBar'
import Stepper from '../components/Stepper'
import SideBadge from '../components/SideBadge'

const FILTER_OPTIONS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'ข้างซ้าย', label: '← ซ้าย' },
  { key: 'ข้างขวา', label: 'ขวา →' },
  { key: 'ทั้งสองข้าง', label: '↔ ทั้งสองข้าง' },
] as const

interface Props { onRegister: () => void }

export default function PatientsPage({ onRegister }: Props) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterSide, setFilterSide] = useState('all')

  useEffect(() => {
    fetch('http://localhost:3000/api/patients')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPatients(d); else setError('โหลดข้อมูลไม่ได้'); setLoading(false) })
      .catch(() => { setError('ไม่สามารถเชื่อมต่อ Backend ได้'); setLoading(false) })
  }, [])

  const filtered = patients
    .filter(p => filterSide === 'all' || p.affected_side === filterSide)
    .filter(p => (p.patient_id + (p.medical_condition ?? '') + (p.address ?? ''))
      .toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="loading-box">กำลังโหลด...</div>
  if (error) return (
    <div className="empty-box">
      <div className="empty-icon">❌</div>
      <div className="empty-title">{error}</div>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>ลองใหม่</button>
    </div>
  )

  return (
    <>
      <div className="h-sec">
        <div>
          <h1 className="page-title">คิวรับผู้ป่วยเข้าระบบ</h1>
          <p className="page-sub">พาผู้ป่วยเดินผ่านครบ 4 ขั้นให้ได้ ก่อนส่งต่อให้นักกิจกรรมบำบัด</p>
        </div>
        <button className="btn btn-sm" onClick={onRegister}>+ รับผู้ป่วยใหม่</button>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาด้วยชื่อ, รหัส, อาการ..." />
        <div className="filter-pills">
          {FILTER_OPTIONS.map(f => (
            <button key={f.key} className={\`filter-pill \${filterSide === f.key ? 'active' : ''}\`}
              onClick={() => setFilterSide(f.key)}>{f.label}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => alert('Export Excel...')}>↓ Export</button>
      </div>

      <div className="result-count">พบ {filtered.length} รายการ{search ? \` สำหรับ "\${search}"\` : ''}</div>

      {filtered.length === 0 ? (
        <div className="empty-box">
          <div className="empty-icon">📋</div>
          <div className="empty-title">ไม่พบผู้ป่วยที่ตรงกับเงื่อนไข</div>
          <div className="empty-sub">ลองเปลี่ยนคำค้นหาหรือ filter</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
            onClick={() => { setSearch(''); setFilterSide('all') }}>ล้างตัวกรอง</button>
        </div>
      ) : (
        <div className="stack">
          {filtered.map((p, i) => (
            <div className="patient-card" key={p.patient_id}>
              <div className="patient-top">
                <div className="patient-identity">
                  <div className="av" style={{ background: 'var(--amber)' }}>{i + 1}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span className="patient-name">{p.patient_id}</span>
                      <SideBadge side={p.affected_side} />
                    </div>
                    <div className="patient-meta">
                      อาการ: {p.medical_condition ?? '—'} · น้ำหนัก: {p.weight ?? '—'} kg · วันที่: {p.register_date ?? '—'}
                    </div>
                  </div>
                </div>
                <div className="patient-actions">
                  <span className="pill pill-amber">ขั้นที่ 2 / 4</span>
                  <button className="btn btn-sm" onClick={onRegister}>ดำเนินการต่อ</button>
                </div>
              </div>
              <Stepper current={2} />
            </div>
          ))}
        </div>
      )}

      <div className="note" style={{ marginTop: 16 }}>
        <b>ทำไมต้องมีคิวนี้</b> — บังคับให้ครบ 4 ขั้น (รับเรื่อง → ลงทะเบียน → นัดหมาย → จับคู่อุปกรณ์) ก่อนถือว่ารับเข้าการรักษา
      </div>
    </>
  )
}
`)

// ============================================================
// src/pages/RegisterPage.tsx  — 4 ขั้นตอน
// ============================================================
write('src/pages/RegisterPage.tsx', `import { useState, useEffect } from 'react'
import type { Therapist } from '../types'
import Stepper from '../components/Stepper'
import SideBadge from '../components/SideBadge'

type Side = 'ข้างซ้าย' | 'ข้างขวา' | 'ทั้งสองข้าง' | ''
const AREAS = ['นิ้วมือ','มือ','ข้อมือ','แขนท่อนล่าง','ข้อศอก','แขนท่อนบน','ไหล่','คอ','ขา']

const Field = ({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) => (
  <div className="field">
    <label className="field-label">{label} {req && <span className="req">*</span>}</label>
    {children}
  </div>
)

interface Props { step: number; setStep: (n: number) => void; onBack?: () => void }

export default function RegisterPage({ step, setStep, onBack }: Props) {
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [selectedOt, setSelectedOt] = useState('')
  const [side, setSide] = useState<Side>('')
  const [areas, setAreas] = useState<string[]>([])
  const [form, setForm] = useState({ firstName:'', lastName:'', birthDate:'', gender:'', address:'', phone:'', email:'', caretaker:'', medicalCondition:'', weight:'' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; patientId?: string } | null>(null)

  useEffect(() => {
    fetch('http://localhost:3000/api/therapists')
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setTherapists(d) }).catch(() => {})
  }, [])

  const ch = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const toggleArea = (a: string) =>
    setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch('http://localhost:3000/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, otId: selectedOt, affectedSide: side, affectedAreas: areas.join(', ') }),
      })
      const data = await res.json()
      setResult(res.ok ? { success: true, message: 'ลงทะเบียนสำเร็จ', patientId: data.patient_id }
        : { success: false, message: data.error ?? 'เกิดข้อผิดพลาด' })
    } catch { setResult({ success: false, message: 'ไม่สามารถเชื่อมต่อ Backend ได้' }) }
    setSaving(false)
  }

  const reset = () => {
    setResult(null); setStep(1); setSide(''); setAreas([]); setSelectedOt('')
    setForm({ firstName:'', lastName:'', birthDate:'', gender:'', address:'', phone:'', email:'', caretaker:'', medicalCondition:'', weight:'' })
  }

  if (result) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{result.success ? '✅' : '❌'}</div>
      <h2 style={{ marginBottom: 8 }}>{result.message}</h2>
      {result.success && (
        <>
          <p style={{ color: 'var(--green)', fontSize: 18, marginBottom: 6 }}>รหัสผู้ป่วย: <strong>{result.patientId}</strong></p>
          {side && <p style={{ fontSize: 13, color: 'var(--muted)' }}>ข้างที่รักษา: <SideBadge side={side} /></p>}
          <div className="export-row" style={{ justifyContent: 'center', marginTop: 16 }}>
            {['📄 PDF','📊 Excel','📋 CSV'].map(t => (
              <button key={t} className="export-btn" onClick={() => alert('Export ' + t + '...')}><span className="export-icon">{t.split(' ')[0]}</span>{t.split(' ')[1]}</button>
            ))}
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={onBack}>กลับหน้าคิว</button>
        <button className="btn" onClick={reset}>ลงทะเบียนคนใหม่</button>
      </div>
    </div>
  )

  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>ผู้ป่วย › <b style={{ color: 'var(--ink)' }}>ลงทะเบียนใหม่</b></div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>ลงทะเบียนผู้ป่วยใหม่</h1>
      <Stepper current={step} />

      {/* ขั้นที่ 1: รับเรื่อง */}
      {step === 1 && (
        <div className="reg-grid">
          <div className="card">
            <div className="h-sec"><span className="h-sec-title">ข้อมูลเบื้องต้น</span></div>
            <div className="grid2">
              <Field label="ชื่อ" req><input className="inp" name="firstName" value={form.firstName} onChange={ch} placeholder="ระบุชื่อ" /></Field>
              <Field label="นามสกุล" req><input className="inp" name="lastName" value={form.lastName} onChange={ch} placeholder="ระบุนามสกุล" /></Field>
              <Field label="เบอร์ติดต่อ" req><input className="inp mono" name="phone" value={form.phone} onChange={ch} placeholder="08X-XXX-XXXX" /></Field>
              <Field label="ที่มาของผู้ป่วย" req>
                <select className="inp"><option>ใบส่งตัวจากโรงพยาบาล</option><option>Walk-in</option><option>ส่งต่อจากศูนย์อื่น</option></select>
              </Field>
              <Field label="สิทธิการรักษา" req>
                <select className="inp"><option>บัตรทอง</option><option>ประกันสังคม</option><option>ข้าราชการ</option><option>ชำระเอง</option></select>
              </Field>
            </div>
            <Field label="แนบเอกสาร (ใบส่งตัว / ผลวินิจฉัย)">
              <div className="inp" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--muted)', padding: 16, cursor: 'pointer' }}>คลิกเพื่ออัปโหลด · PDF, JPG</div>
            </Field>
          </div>
          <div className="stack">
            <div className="card" style={{ background: 'var(--green-t)', borderColor: '#d9e9d4' }}>
              <div className="eyebrow">HN ที่ระบบจะออกให้</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>HN-67019</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>สร้างอัตโนมัติเมื่อบันทึก</div>
            </div>
            <div className="note">รับเรื่องเบื้องต้น — ยืนยันตัวตนและบันทึกเข้าคิวก่อน</div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={onBack}>ยกเลิก</button>
              <button className="btn" onClick={() => setStep(2)}>บันทึกและไปขั้นถัดไป →</button>
            </div>
          </div>
        </div>
      )}

      {/* ขั้นที่ 2: ลงทะเบียนข้อมูลเต็ม + เลือกข้าง */}
      {step === 2 && (
        <div className="reg-grid">
          <div className="card">
            <div className="h-sec"><span className="h-sec-title">ข้อมูลส่วนตัว</span></div>
            <div className="grid2">
              <Field label="ชื่อ" req><input className="inp" name="firstName" value={form.firstName} onChange={ch} placeholder="ระบุชื่อ" /></Field>
              <Field label="นามสกุล" req><input className="inp" name="lastName" value={form.lastName} onChange={ch} placeholder="ระบุนามสกุล" /></Field>
              <Field label="วัน/เดือน/ปีเกิด" req><input className="inp" name="birthDate" type="date" value={form.birthDate} onChange={ch} /></Field>
              <Field label="เพศ" req>
                <select className="inp" name="gender" value={form.gender} onChange={ch}>
                  <option value="">เลือก...</option><option value="ชาย">ชาย</option><option value="หญิง">หญิง</option><option value="ไม่ระบุ">ไม่ระบุ</option>
                </select>
              </Field>
            </div>
            <Field label="ที่อยู่ปัจจุบัน" req><textarea className="inp" name="address" value={form.address} onChange={ch} rows={2} placeholder="บ้านเลขที่ ตำบล อำเภอ จังหวัด" /></Field>
            <div className="grid2">
              <Field label="เบอร์ติดต่อ" req><input className="inp mono" name="phone" value={form.phone} onChange={ch} placeholder="08X-XXX-XXXX" /></Field>
              <Field label="อีเมล"><input className="inp" name="email" value={form.email} onChange={ch} placeholder="example@mail.com" /></Field>
              <Field label="น้ำหนัก (kg)"><input className="inp" name="weight" type="number" step="0.01" value={form.weight} onChange={ch} placeholder="65.50" /></Field>
              <Field label="ผู้ดูแลหลัก" req><input className="inp" name="caretaker" value={form.caretaker} onChange={ch} placeholder="ชื่อ · เบอร์โทร" /></Field>
            </div>
            <div className="h-sec" style={{ marginTop: 8 }}><span className="h-sec-title">ข้อมูลทางการแพทย์</span></div>
            <div className="grid2">
              <Field label="ระยะ ALS" req>
                <select className="inp"><option>ระยะแรก (Flaccid)</option><option>ระยะเกร็ง (Spastic)</option><option>ระยะฟื้นตัว (Recovery)</option></select>
              </Field>
              <Field label="ความรุนแรง">
                <select className="inp"><option>เล็กน้อย</option><option>ปานกลาง</option><option>รุนแรง</option></select>
              </Field>
            </div>
            <Field label="ข้างที่รักษา" req>
              <div className="side-selector">
                {(['ข้างซ้าย', 'ข้างขวา', 'ทั้งสองข้าง'] as Side[]).map(s => (
                  <button key={s} className={\`side-btn \${side === s ? 'active' : ''}\`} onClick={() => setSide(s)}>
                    <span className="side-icon">{s === 'ข้างซ้าย' ? '🫲' : s === 'ข้างขวา' ? '🫱' : '🤲'}</span>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={<>บริเวณที่ได้รับผลกระทบ <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>(เลือกได้หลายข้อ)</span></>}>
              <div className="area-tags">
                {AREAS.map(a => (
                  <button key={a} className={\`area-tag \${areas.includes(a) ? 'active' : ''}\`} onClick={() => toggleArea(a)}>
                    {areas.includes(a) ? '✓ ' : ''}{a}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="หมายเหตุเพิ่มเติม">
              <textarea className="inp" name="medicalCondition" value={form.medicalCondition} onChange={ch} rows={2} placeholder="อาการเพิ่มเติม ประวัติอื่นๆ" />
            </Field>
          </div>
          <div className="stack">
            <div className="card">
              <div className="h-sec"><span className="h-sec-title">มอบหมายผู้ดูแลเคส</span></div>
              <Field label="นักกิจกรรมบำบัด" req>
                <select className="inp" value={selectedOt} onChange={e => setSelectedOt(e.target.value)}>
                  <option value="">เลือกนักกายภาพ...</option>
                  {therapists.map(t => <option key={t.ot_id} value={t.ot_id}>กภ. {t.first_name} {t.last_name} — {t.license_number}</option>)}
                </select>
              </Field>
            </div>
            {side && (
              <div className="summary-card">
                <div className="h-sec"><span className="h-sec-title">สรุปข้อมูลการรักษา</span></div>
                <div className="kv"><span>ข้างที่รักษา</span><SideBadge side={side} /></div>
                {areas.length > 0 && <div className="kv"><span>บริเวณ</span><span style={{ fontSize: 11.5 }}>{areas.join(', ')}</span></div>}
              </div>
            )}
            <div className="note note-pdpa"><b>PDPA</b> — ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว ต้องบันทึกความยินยอมก่อนกดบันทึก</div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← ย้อนกลับ</button>
              <button className="btn" onClick={() => { if (!side) { alert('กรุณาเลือกข้างที่รักษาก่อน'); return }; setStep(3) }}>บันทึกและไปขั้นถัดไป →</button>
            </div>
          </div>
        </div>
      )}

      {/* ขั้นที่ 3: นัดหมาย */}
      {step === 3 && (
        <>
          <div className="card">
            <div className="h-sec"><span className="h-sec-title">เลือกวันและเวลานัดหมายครั้งแรก</span></div>
            <p className="page-sub">เลือกช่องว่างจากตาราง — ระบบตรวจสอบนักกายภาพว่างและอุปกรณ์พร้อมหรือไม่</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button className="btn btn-ghost btn-sm">← สัปดาห์ก่อน</button>
              <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, padding: 6 }}>21 – 25 ก.ค. 2569</div>
              <button className="btn btn-ghost btn-sm">สัปดาห์ถัดไป →</button>
            </div>
            <div className="time-grid" style={{ gridTemplateColumns: '70px repeat(5,1fr)' }}>
              <div className="time-header" />{['จ 21','อ 22','พ 23','พฤ 24','ศ 25'].map(d=><div key={d} className="time-header">{d}</div>)}
              {[['08','วิภาวรรณ','กภ. อิน','1 ชม.','DEV-0142',true,'var(--blue-t)'],['09','ประยูร','กภ. อิน','1 ชม.','DEV-0149',false,'var(--blue-t)'],['10','กัลยา','กภ. วิไล','1 ชม.','DEV-0158',false,'var(--amber-t)'],['13','สมศักดิ์','กภ. นภา','1 ชม.','DEV-0161',true,'var(--green-t)'],['14','มานะ','กภ. นภา','1.5 ชม.','DEV-0155',true,'var(--green-t)']].map(([h,n,t,d,dev,ok,bg])=>(
                <>
                  <div key={h+'-label'} className="time-label mono">{h}:00<br/><small>–{String(Number(h)+1).padStart(2,'0')}:00</small></div>
                  <div className="time-slot"><div className="appt-block" style={{background:bg as string}}><b>{n}</b><br/><span style={{color:'var(--muted)'}}>{t} · {d}</span><div className="device-check">🔧 {dev} {ok?'✓':'⚠ ไม่ส่งข้อมูล'}</div></div></div>
                  <div key={h+'-empty'} className="time-slot time-slot-empty">+ ว่าง</div>
                  <div className="time-slot" /><div className="time-slot" /><div className="time-slot" />
                </>
              ))}
            </div>
            <div className="note" style={{ marginTop: 16 }}><b>🔧 สถานะ:</b> ✓ = พร้อม · ⚠ = ไม่ส่งข้อมูล · ⛔ = ส่งซ่อม</div>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← ย้อนกลับ</button>
            <button className="btn" onClick={() => setStep(4)}>ยืนยันนัดหมาย →</button>
          </div>
        </>
      )}

      {/* ขั้นที่ 4: จับคู่อุปกรณ์ + สรุป */}
      {step === 4 && (
        <div className="reg-grid">
          <div className="card">
            <div className="h-sec"><span className="h-sec-title">จ่ายอุปกรณ์</span></div>
            <Field label="เลือกอุปกรณ์ว่าง" req>
              <select className="inp"><option>DEV-0155 — พร้อมจ่าย · แบต 100%</option><option>DEV-0161 — พร้อมจ่าย · แบต 92%</option></select>
            </Field>
            {[['สถานะอุปกรณ์','✓ พร้อมใช้งาน','var(--green)'],['แบตเตอรี่','100%',''],['Firmware','v1.2.3',''],['เซนเซอร์','IMU ✓ · Encoder ✓','var(--green)'],['ส่งรหัสผ่านทาง','SMS','var(--blue)']].map(([k,v,c])=>(
              <div key={k} className="kv"><span>{k}</span><b style={c?{color:c}:{}}>{v}</b></div>
            ))}
            <div className="h-sec" style={{ marginTop: 16 }}><span className="h-sec-title">Export ผลการรักษา</span></div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>ดาวน์โหลดข้อมูลการรักษาได้ที่นี่</p>
            <div className="export-row">
              {[['📄','PDF'],['📊','Excel'],['📋','CSV']].map(([icon,label])=>(
                <button key={label} className="export-btn" onClick={() => alert('Export ' + label + '...')}><span className="export-icon">{icon}</span>{label}</button>
              ))}
            </div>
          </div>
          <div className="stack">
            <div className="summary-card">
              <div className="h-sec"><span className="h-sec-title">สรุปการลงทะเบียน</span></div>
              <div className="kv"><span>HN</span><b className="mono" style={{ color: 'var(--green)' }}>HN-67019</b></div>
              <div className="kv"><span>ชื่อ-นามสกุล</span><b>{form.firstName} {form.lastName}</b></div>
              <div className="kv"><span>ข้างที่รักษา</span><SideBadge side={side} /></div>
              {areas.length > 0 && <div className="kv"><span>บริเวณ</span><span style={{ fontSize: 11.5 }}>{areas.join(', ')}</span></div>}
              <div className="kv"><span>นักกายภาพ</span><b>{selectedOt || 'ยังไม่ได้เลือก'}</b></div>
              <div className="kv"><span>นัดครั้งแรก</span><b>อ 22 ก.ค. · 08:00 (1 ชม.)</b></div>
              <div className="kv"><span>อุปกรณ์</span><b className="mono">DEV-0155</b></div>
            </div>
            <div className="note note-pdpa"><b>PDPA</b> — ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว ต้องบันทึกความยินยอมก่อน</div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setStep(3)}>← ย้อนกลับ</button>
              <button className="btn btn-success" onClick={submit} disabled={saving}>{saving ? 'กำลังบันทึก...' : '✓ ยืนยันและเสร็จสิ้น'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
`)

// ============================================================
// src/pages/TherapistsPage.tsx
// ============================================================
write('src/pages/TherapistsPage.tsx', `import { useEffect, useState } from 'react'
import type { Therapist } from '../types'
import SearchBar from '../components/SearchBar'

interface FormData { firstName: string; lastName: string; licenseNumber: string; phone: string; email: string; gender: string }
const emptyForm: FormData = { firstName:'', lastName:'', licenseNumber:'', phone:'', email:'', gender:'' }
const Field = ({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) => (
  <div className="field"><label className="field-label">{label} {req && <span className="req">*</span>}</label>{children}</div>
)

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = () => {
    fetch('http://localhost:3000/api/therapists')
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setTherapists(d); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(load, [])

  const ch = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const save = async () => {
    if (!form.firstName || !form.lastName || !form.licenseNumber || !form.phone) { alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบ'); return }
    setSaving(true)
    const res = await fetch('http://localhost:3000/api/therapists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    }).catch(() => null)
    if (res?.ok) { setToast('เพิ่มนักกายภาพสำเร็จ!'); setForm(emptyForm); setShowForm(false); load(); setTimeout(() => setToast(null), 3000) }
    else alert('เกิดข้อผิดพลาด')
    setSaving(false)
  }

  const filtered = therapists.filter(t =>
    (t.first_name + t.last_name + t.license_number + t.ot_id).toLowerCase().includes(search.toLowerCase()))
  const total = therapists.length
  const caseTotal = therapists.reduce((s, t) => s + (t.cases ?? 0), 0)

  if (loading) return <div className="loading-box">กำลังโหลด...</div>

  return (
    <>
      {toast && <div className="toast toast-success">{toast}</div>}
      <div className="h-sec">
        <div><h1 className="page-title">จัดการนักกิจกรรมบำบัด</h1><p className="page-sub">เพิ่ม แก้ไข และดูภาระงานของนักกิจกรรมบำบัดทั้งหมดในศูนย์</p></div>
        <button className="btn btn-sm" onClick={() => setShowForm(!showForm)}>{showForm ? '✕ ปิดฟอร์ม' : '+ เพิ่มนักกายภาพ'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ borderColor: 'var(--blue)' }}>
          <div className="h-sec"><span className="h-sec-title">เพิ่มนักกิจกรรมบำบัดใหม่</span></div>
          <div className="grid2">
            <Field label="ชื่อ" req><input className="inp" name="firstName" value={form.firstName} onChange={ch} placeholder="ระบุชื่อ" /></Field>
            <Field label="นามสกุล" req><input className="inp" name="lastName" value={form.lastName} onChange={ch} placeholder="ระบุนามสกุล" /></Field>
            <Field label="เลขใบอนุญาต" req><input className="inp mono" name="licenseNumber" value={form.licenseNumber} onChange={ch} placeholder="กภ.XXXXX" /></Field>
            <Field label="เบอร์ติดต่อ" req><input className="inp mono" name="phone" value={form.phone} onChange={ch} placeholder="08X-XXX-XXXX" /></Field>
            <Field label="อีเมล"><input className="inp" name="email" value={form.email} onChange={ch} placeholder="example@mail.com" /></Field>
            <Field label="เพศ"><select className="inp" name="gender" value={form.gender} onChange={ch}><option value="">เลือก...</option><option value="ชาย">ชาย</option><option value="หญิง">หญิง</option></select></Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setForm(emptyForm) }}>ยกเลิก</button>
            <button className="btn btn-sm" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
      )}

      <div className="grid3">
        <div className="card"><div className="eyebrow">ทั้งหมด</div><div className="big">{total}<span className="big-unit">คน</span></div></div>
        <div className="card" style={{ background: 'var(--green-t)', borderColor: '#d9e9d4' }}><div className="eyebrow">ปฏิบัติงาน</div><div className="big" style={{ color: 'var(--green)' }}>{total}<span className="big-unit">คน</span></div></div>
        <div className="card"><div className="eyebrow">เคสรวม</div><div className="big">{caseTotal}<span className="big-unit">เคส</span></div></div>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาด้วยชื่อ, เลขใบอนุญาต..." />
        <button className="btn btn-ghost btn-sm" onClick={() => alert('Export Excel...')}>↓ Export</button>
      </div>

      <div className="card-0">
        <table className="data-table">
          <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>เลขใบอนุญาต</th><th>เบอร์โทร</th><th>เคส</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>ไม่พบข้อมูล</td></tr>
              : filtered.map(t => (
                  <tr key={t.ot_id}>
                    <td className="mono">{t.ot_id}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="av" style={{ background: 'var(--blue)', width: 28, height: 28, fontSize: 10 }}>{(t.first_name[0] ?? '') + (t.last_name[0] ?? '')}</div><b>กภ. {t.first_name} {t.last_name}</b></div></td>
                    <td className="mono">{t.license_number}</td>
                    <td className="mono">{t.phone ?? '—'}</td>
                    <td><b>{t.cases ?? '—'}</b> เคส</td>
                    <td><span className="pill pill-green">ปฏิบัติงาน</span></td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm">แก้ไข</button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </>
  )
}
`)

// ============================================================
// src/pages/DevicesPage.tsx
// ============================================================
write('src/pages/DevicesPage.tsx', `import { useState } from 'react'
import type { Device } from '../types'
import SearchBar from '../components/SearchBar'

const DEVICES: Device[] = [
  { id: 'DEV-0142', user: 'สมหมาย ส่ายหัว',      date: '3 มี.ค. 2569',  status: 'ใช้งานอยู่',        tone: 'green', battery: '78%' },
  { id: 'DEV-0143', user: 'วิภาวรรณ ขยันเรียน',   date: '12 มี.ค. 2569', status: 'ใช้งานอยู่',        tone: 'green', battery: '54%' },
  { id: 'DEV-0149', user: 'มานะ อดทน',            date: '2 พ.ค. 2569',   status: 'ไม่ส่งข้อมูล 5 วัน', tone: 'rose',  battery: '—'   },
  { id: 'DEV-0155', user: '—',                    date: '—',             status: 'พร้อมจ่าย',          tone: 'blue',  battery: '100%'},
  { id: 'DEV-0158', user: '—',                    date: '—',             status: 'ส่งซ่อม',            tone: 'amber', battery: '—'   },
]

const PILL_CLS: Record<string, string> = { green: 'pill-green', blue: 'pill-blue', amber: 'pill-amber', rose: 'pill-rose' }
const KPI_BG: Record<string, string> = { blue: 'var(--blue-t)', rose: 'var(--rose-t)' }

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'green', label: 'ใช้งานอยู่' },
  { key: 'blue', label: 'พร้อมจ่าย' },
  { key: 'rose', label: 'ผิดปกติ' },
  { key: 'amber', label: 'ส่งซ่อม' },
] as const

export default function DevicesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = DEVICES
    .filter(d => filter === 'all' || d.tone === filter)
    .filter(d => (d.id + d.user + d.status).toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="h-sec">
        <div><h1 className="page-title">คลังอุปกรณ์ IoT</h1><p className="page-sub">อุปกรณ์เป็นทรัพย์สินของศูนย์ที่ต้องยืม–คืน–ซ่อม ต้องรู้ว่าเครื่องไหนอยู่กับใคร</p></div>
        <button className="btn btn-sm">+ เพิ่มอุปกรณ์</button>
      </div>

      <div className="grid3">
        <div className="card"><div className="eyebrow">ทั้งหมด</div><div className="big">12<span className="big-unit">เครื่อง</span></div></div>
        <div className="card" style={{ background: KPI_BG.blue, borderColor: '#d5e2f7' }}><div className="eyebrow" style={{ color: 'var(--blue)' }}>พร้อมจ่าย</div><div className="big" style={{ color: 'var(--blue)' }}>3<span className="big-unit">เครื่อง</span></div></div>
        <div className="card" style={{ background: KPI_BG.rose, borderColor: '#f5d5dc' }}><div className="eyebrow" style={{ color: 'var(--rose)' }}>ผิดปกติ / ส่งซ่อม</div><div className="big" style={{ color: 'var(--rose)' }}>2<span className="big-unit">เครื่อง</span></div></div>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="ค้นหารหัสอุปกรณ์, ชื่อผู้ถือครอง..." />
        <div className="filter-pills">
          {FILTERS.map(f => <button key={f.key} className={\`filter-pill \${filter === f.key ? 'active' : ''}\`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => alert('Export Excel...')}>↓ Export</button>
      </div>

      <div className="card-0">
        <table className="data-table">
          <thead><tr><th>รหัสอุปกรณ์</th><th>ผู้ถือครอง</th><th>วันที่จ่าย</th><th>แบตเตอรี่</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>ไม่พบข้อมูล</td></tr>
              : filtered.map(d => (
                  <tr key={d.id}>
                    <td className="mono"><b>{d.id}</b></td>
                    <td>{d.user}</td>
                    <td style={{ color: 'var(--muted)' }}>{d.date}</td>
                    <td className="mono">{d.battery}</td>
                    <td><span className={\`pill \${PILL_CLS[d.tone]}\`}>{d.status}</span></td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm">จัดการ</button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </>
  )
}
`)

// ============================================================
// src/pages/SchedulePage.tsx
// ============================================================
write('src/pages/SchedulePage.tsx', `import { useState } from 'react'
import type { Appointment } from '../types'

const APPTS: Record<string, Appointment> = {
  '08-0': { key:'08-0', name:'วิภาวรรณ', therapist:'กภ. อิน',  duration:'1 ชม.',   device:'DEV-0142', ok:true,  bg:'var(--blue-t)'  },
  '08-2': { key:'08-2', name:'สมหมาย',   therapist:'กภ. วิไล', duration:'1.5 ชม.', device:'DEV-0143', ok:true,  bg:'var(--amber-t)' },
  '09-1': { key:'09-1', name:'ประยูร',   therapist:'กภ. อิน',  duration:'1 ชม.',   device:'DEV-0149', ok:false, bg:'var(--blue-t)'  },
  '09-3': { key:'09-3', name:'มานะ',     therapist:'กภ. นภา',  duration:'1 ชม.',   device:'DEV-0155', ok:true,  bg:'var(--green-t)' },
  '10-0': { key:'10-0', name:'กัลยา',   therapist:'กภ. วิไล', duration:'1 ชม.',   device:'DEV-0158', ok:false, bg:'var(--amber-t)' },
  '10-2': { key:'10-2', name:'วิภาวรรณ', therapist:'กภ. อิน',  duration:'1.5 ชม.', device:'DEV-0142', ok:true,  bg:'var(--blue-t)'  },
  '13-0': { key:'13-0', name:'สมศักดิ์', therapist:'กภ. นภา',  duration:'1 ชม.',   device:'DEV-0161', ok:true,  bg:'var(--green-t)' },
  '13-3': { key:'13-3', name:'ประยูร',   therapist:'กภ. อิน',  duration:'1.5 ชม.', device:'DEV-0149', ok:false, bg:'var(--amber-t)' },
  '14-2': { key:'14-2', name:'มานะ',     therapist:'กภ. นภา',  duration:'1 ชม.',   device:'DEV-0155', ok:true,  bg:'var(--blue-t)'  },
  '15-1': { key:'15-1', name:'กัลยา',   therapist:'กภ. วิไล', duration:'1 ชม.',   device:'DEV-0143', ok:true,  bg:'var(--green-t)' },
}

const TIMES = ['08','09','10','11','12','13','14','15','16']
const DAYS  = ['จ 21','อ 22','พ 23','พฤ 24','ศ 25']

export default function SchedulePage() {
  const [filterOt, setFilterOt] = useState('all')

  return (
    <>
      <div className="h-sec">
        <div><h1 className="page-title">ตารางนัดรวมของศูนย์</h1><p className="page-sub">ธุรการเห็นทุกคน ทุกนักกิจกรรมบำบัด — ใช้หาช่องว่างและกันนัดชนกัน · 🔧 = สถานะเครื่องกายภาพ</p></div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm">← สัปดาห์ก่อน</button>
          <span style={{ padding:'6px 12px', fontWeight:600 }}>21–25 ก.ค. 2569</span>
          <button className="btn btn-ghost btn-sm">สัปดาห์ถัดไป →</button>
          <button className="btn btn-sm">+ เพิ่มนัด</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[['all','ทุกนักกายภาพ'],['กภ. อิน','กภ. อิน'],['กภ. วิไล','กภ. วิไล'],['กภ. นภา','กภ. นภา']].map(([k,l])=>(
          <button key={k} className={\`filter-pill \${filterOt===k?'active':''}\`} onClick={()=>setFilterOt(k)}>{l}</button>
        ))}
      </div>

      <div className="card-0" style={{ overflowX:'auto' }}>
        <div className="time-grid" style={{ gridTemplateColumns:'70px repeat(5,1fr)' }}>
          <div className="time-header" />
          {DAYS.map(d => <div key={d} className="time-header">{d}</div>)}
          {TIMES.map(h => {
            const isLunch = h === '12'
            return (
              <>
                <div key={h+'-label'} className="time-label mono" style={isLunch?{color:'var(--rose)'}:{}}>
                  {h}:00{isLunch ? <><br/><small>พักเที่ยง</small></> : <><br/><small>–{String(Number(h)+1).padStart(2,'0')}:00</small></>}
                </div>
                {[0,1,2,3,4].map(ci => {
                  if (isLunch) return <div key={ci} className="time-slot time-slot-lunch" />
                  const a = APPTS[h+'-'+ci]
                  if (a && (filterOt === 'all' || a.therapist === filterOt)) {
                    return (
                      <div key={ci} className="time-slot">
                        <div className="appt-block" style={{ background: a.bg }}>
                          <b>{a.name}</b><br/>
                          <span style={{ color:'var(--muted)' }}>{a.therapist} · {a.duration}</span>
                          <div className="device-check">🔧 {a.device} {a.ok ? '✓' : '⚠ ไม่ส่งข้อมูล'}</div>
                        </div>
                      </div>
                    )
                  }
                  return <div key={ci} className="time-slot time-slot-empty">+ ว่าง</div>
                })}
              </>
            )
          })}
        </div>
      </div>

      <div className="note" style={{ marginTop:14 }}>
        <b>สัญลักษณ์:</b> 🔧✓ = อุปกรณ์พร้อม · 🔧⚠ = ไม่ส่งข้อมูล (ต้องตรวจ) · 🔧⛔ = ส่งซ่อม (ต้องเปลี่ยนเครื่อง)
      </div>
    </>
  )
}
`)

// ============================================================
// src/pages/OverviewPage.tsx
// ============================================================
write('src/pages/OverviewPage.tsx', `import { useState } from 'react'
import type { Therapist } from '../types'

const THERAPISTS: Therapist[] = [
  { ot_id:'OT001', first_name:'อิน',  last_name:'กนิน',   license_number:'กภ.12345', cases:4 },
  { ot_id:'OT002', first_name:'วิไล', last_name:'มั่นคง', license_number:'กภ.23456', cases:6 },
  { ot_id:'OT003', first_name:'นภา',  last_name:'ใจงาม',  license_number:'กภ.34567', cases:3 },
]

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.']
const VALUES = [112, 118, 124, 120, 131, 128, 135]
const MAX_VAL = Math.max(...VALUES)

export default function OverviewPage() {
  const [from, setFrom] = useState('01/07/2569')
  const [to, setTo] = useState('31/07/2569')

  return (
    <>
      <div className="h-sec">
        <div><h1 className="page-title">ภาพรวมศูนย์</h1><p className="page-sub">ใช้รายงานผลต่อผู้บริหารศูนย์</p></div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input className="inp" style={{ width:110 }} value={from} onChange={e=>setFrom(e.target.value)} />
          <input className="inp" style={{ width:110 }} value={to} onChange={e=>setTo(e.target.value)} />
          <button className="btn btn-ghost btn-sm" onClick={() => alert('Export PDF...')}>↓ PDF</button>
        </div>
      </div>

      <div className="grid3">
        <div className="card"><div className="eyebrow">ผู้ป่วยในระบบ</div><div className="big">128<span className="big-unit">คน</span></div></div>
        <div className="card">
          <div className="eyebrow">รับใหม่เดือนนี้</div>
          <div className="big">12<span className="big-unit">คน</span></div>
          <div style={{ fontSize:10.5, color:'var(--green)', marginTop:3 }}>▲ 12% จากเดือนก่อน</div>
        </div>
        <div className="card">
          <div className="eyebrow">อัตราฝึกต่อเนื่อง</div>
          <div className="big">78<span className="big-unit">%</span></div>
          <div style={{ fontSize:10.5, color:'var(--muted)', marginTop:3 }}>ฝึก ≥ 5 วัน/สัปดาห์</div>
        </div>
      </div>

      <div className="overview-grid">
        <div className="card">
          <div className="h-sec"><span className="h-sec-title">จำนวนผู้ป่วยรายเดือน (ปี 2569)</span></div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:160, paddingTop:20 }}>
            {MONTHS.map((m, i) => (
              <div key={m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:10, color:'var(--muted)', fontFamily:'monospace' }}>{VALUES[i]}</span>
                <div style={{ background:'var(--green)', borderRadius:'4px 4px 0 0', width:'100%', height: (VALUES[i] / MAX_VAL) * 120 }} />
                <span style={{ fontSize:10, color:'var(--muted)' }}>{m}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="h-sec"><span className="h-sec-title">แยกตามผู้ดูแลเคส</span></div>
            {THERAPISTS.map(t => (
              <div key={t.ot_id} className="kv"><span>กภ. {t.first_name} {t.last_name}</span><b>{t.cases} เคส</b></div>
            ))}
            <div className="kv"><span>ยังไม่มอบหมาย</span><b style={{ color:'var(--rose)' }}>2 เคส</b></div>
            <div className="note" style={{ marginTop:10, fontSize:11 }}>ตัวเลข "ยังไม่มอบหมาย" คือ KPI จริงของธุรการ — ควรเป็น 0</div>
          </div>
          <div className="card">
            <div className="h-sec"><span className="h-sec-title">สถานะอุปกรณ์รวม</span></div>
            {[['ใช้งานอยู่','7 เครื่อง','var(--green)'],['พร้อมจ่าย','3 เครื่อง','var(--blue)'],['ไม่ส่งข้อมูล','1 เครื่อง','var(--amber)'],['ส่งซ่อม','1 เครื่อง','var(--rose)']].map(([k,v,c])=>(
              <div key={k} className="kv"><span>{k}</span><b style={{ color:c }}>{v}</b></div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
`)

// ============================================================
// Update index.html to use Vite properly
// ============================================================
if (!require('fs').existsSync('index.html')) {
  write('index.html', `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ALS Rehabilitation — ธุรการ</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`)
}

// Clean up default Vite files
;['src/App.css','src/assets/react.svg'].forEach(f => {
  if (require('fs').existsSync(f)) { require('fs').unlinkSync(f); console.log('  🗑️  ' + f) }
})

console.log('\n========================================')
console.log('  ✅ สร้างไฟล์ครบทั้งหมด!')
console.log('  Run: npm run dev')
console.log('  Open: http://localhost:5173/')
console.log('========================================\n')
console.log('📁 ไฟล์ที่สร้าง:')
console.log('  src/index.css                ← Design tokens')
console.log('  src/main.tsx')
console.log('  src/types.ts')
console.log('  src/App.tsx')
console.log('  src/components/Sidebar.tsx')
console.log('  src/components/Stepper.tsx')
console.log('  src/components/SideBadge.tsx')
console.log('  src/components/SearchBar.tsx')
console.log('  src/pages/PatientsPage.tsx   ← คิวผู้ป่วย + Search + Filter')
console.log('  src/pages/RegisterPage.tsx   ← ลงทะเบียน 4 ขั้น + เลือกข้าง + Export')
console.log('  src/pages/TherapistsPage.tsx ← จัดการนักกายภาพ')
console.log('  src/pages/DevicesPage.tsx    ← คลังอุปกรณ์')
console.log('  src/pages/SchedulePage.tsx   ← ตารางนัดรายชั่วโมง')
console.log('  src/pages/OverviewPage.tsx   ← ภาพรวมศูนย์ + Bar chart')
