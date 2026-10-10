// ALS Rehabilitation System - Setup Script (Node.js)
// Run: node setup.js

const fs = require('fs');
const path = require('path');

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✅ ${filePath}`);
}

console.log('\n🚀 Setting up ALS Rehabilitation System...\n');

// ===== src/data/types.ts =====
writeFile('src/data/types.ts', `export interface Patient {
  id: string
  name: string
  fullName: string
  age: number
  initials: string
}

export interface Program {
  name: string
  desc: string
  progress: number
  currentDay: number
  totalDays: number
  endDate: string
}

export interface StatItem {
  value: number | string
  trend: string
  up: boolean
}

export interface Stats {
  latestReps: StatItem
  avgSpeed: StatItem
  adherence: StatItem
  weekCount: StatItem
}

export interface WeekDay {
  label: string
  num: number
  status: string
  done: boolean
  today: boolean
}

export interface Session {
  id: string
  name: string
  date: string
  reps: number
  speed: number
  done: boolean
}

export interface Feedback {
  id: string
  from: string
  initials: string
  date: string
  msg: string
}

export interface Appointment {
  date: string
  time: string
  location: string
}

export interface Device {
  name: string
  online: boolean
  battery: number
  firmware: string
  signal: string
  sensors: string
  lastSync: string
}

export interface Therapist {
  name: string
  initials: string
  role: string
}

export interface PersonalRecord {
  label: string
  value: string
  color: string
}
`);

// ===== src/data/mockData.ts =====
writeFile('src/data/mockData.ts', `import type {
  Patient, Program, Stats, WeekDay, Session,
  Feedback, Appointment, Device, Therapist, PersonalRecord
} from './types'

export const patient: Patient = {
  id: 'P-001',
  name: 'สมชาย',
  fullName: 'สมชาย ใจดี',
  age: 65,
  initials: 'สช',
}

export const program: Program = {
  name: 'โปรแกรม A',
  desc: 'โปรแกรมการฝึกแขนระยะแรก · Passive ROM',
  progress: 40,
  currentDay: 8,
  totalDays: 20,
  endDate: '15 ส.ค.',
}

export const stats: Stats = {
  latestReps: { value: 45,    trend: '↑ 12%',    up: true },
  avgSpeed:   { value: 3.8,   trend: '↑ 5%',     up: true },
  adherence:  { value: '85%', trend: '↑ 3%',     up: true },
  weekCount:  { value: 4,     trend: 'on track',  up: true },
}

export const weekDays: WeekDay[] = [
  { label: 'จ',  num: 8,  status: '—',       done: false, today: false },
  { label: 'อ',  num: 9,  status: '45 reps', done: true,  today: false },
  { label: 'พ',  num: 10, status: '42 reps', done: true,  today: false },
  { label: 'พฤ', num: 11, status: '40 reps', done: true,  today: false },
  { label: 'ศ',  num: 12, status: '45 reps', done: true,  today: false },
  { label: 'ส',  num: 13, status: 'วันนี้',   done: false, today: true },
  { label: 'อา', num: 14, status: '—',       done: false, today: false },
]

export const sessions: Session[] = [
  { id: 'S-001', name: 'โปรแกรม A · Set 1', date: '12 ก.ค. 2568 · 14:30', reps: 45, speed: 3.8, done: true },
  { id: 'S-002', name: 'โปรแกรม A · Set 1', date: '11 ก.ค. 2568 · 14:15', reps: 42, speed: 3.7, done: true },
  { id: 'S-003', name: 'โปรแกรม A · Set 1', date: '10 ก.ค. 2568 · 14:00', reps: 40, speed: 3.6, done: true },
  { id: 'S-004', name: 'โปรแกรม A · Set 1', date: '9 ก.ค. 2568 · 13:45',  reps: 28, speed: 3.2, done: false },
]

export const feedbacks: Feedback[] = [
  { id: 'FB-001', from: 'นาย สิทธิ์ชัย', initials: 'สช', date: '5 ก.ค. · 14:30', msg: 'ทำได้ดีครับ! ลองเพิ่มจำนวนรอบขึ้นอีก 5 รอบ ท่าทางดีขึ้นมาก' },
  { id: 'FB-002', from: 'นาย สิทธิ์ชัย', initials: 'สช', date: '3 ก.ค. · 10:15', msg: 'ความเร็วเพิ่มขึ้น 5% จากสัปดาห์ที่แล้ว ดีมาก' },
]

export const appointment: Appointment = {
  date: 'พรุ่งนี้ (13 ก.ค. 2568)',
  time: '15:00 น.',
  location: 'สถาบันศูนย์กลาง ชั้น 3',
}

export const device: Device = {
  name: 'Skateboard DEV-001',
  online: true,
  battery: 85,
  firmware: 'v1.2.3',
  signal: '▂▄▆█ Strong',
  sensors: 'IMU ✓ · Encoder ✓',
  lastSync: '2 นาทีที่แล้ว',
}

export const therapist: Therapist = {
  name: 'นาย สิทธิ์ชัย',
  initials: 'สช',
  role: 'neuromuscular rehab · T-001',
}

export const records: PersonalRecord[] = [
  { label: 'Best reps (single session)', value: '52',       color: 'var(--cyan)' },
  { label: 'Highest speed',              value: '4.5 r/s',  color: 'var(--lime)' },
  { label: 'Longest session',            value: '25 min',   color: 'var(--amber)' },
  { label: 'Current streak',             value: '6 days 🔥', color: 'var(--violet)' },
]
`);

// ===== src/styles/global.css =====
writeFile('src/styles/global.css', `:root{--ink:#0e1720;--panel:#131e29;--surface:#1a2836;--line:#25384a;--paper:#e8eef2;--dim:#7d93a6;--cyan:#31d0e0;--cyan-dim:rgba(49,208,224,.12);--amber:#f5a623;--amber-dim:rgba(245,166,35,.12);--lime:#9fe870;--lime-dim:rgba(159,232,112,.12);--violet:#a98cff;--violet-dim:rgba(169,140,255,.12);--rose:#ff7a90;--rose-dim:rgba(255,122,144,.12)}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
body{background:var(--ink);color:var(--paper);font-family:"IBM Plex Sans Thai",system-ui,sans-serif;overflow-x:hidden}
.app-layout{display:flex;height:100vh;width:100vw}
.sidebar{width:72px;flex:none;background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:16px 0;gap:4px}
.sidebar-logo{width:40px;height:40px;background:var(--cyan);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#06222a;margin-bottom:24px;cursor:pointer;text-decoration:none}
.nav-item{width:48px;height:48px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.18s;color:var(--dim);border:none;background:transparent;font-size:20px;text-decoration:none}
.nav-item:hover{background:var(--surface);color:var(--paper)}
.nav-item.active{background:var(--cyan-dim);color:var(--cyan)}
.sidebar-spacer{flex:1}
.sidebar-avatar{width:36px;height:36px;border-radius:50%;background:var(--violet);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#1a1230;cursor:pointer}
.main-area{flex:1;overflow-y:auto;display:flex;flex-direction:column}
.topbar{padding:20px 28px 16px;border-bottom:1px solid var(--line);background:linear-gradient(to bottom,rgba(19,30,41,.95),var(--ink));position:sticky;top:0;z-index:10}
.topbar-greeting{font-size:22px;font-weight:600}
.topbar-greeting span{color:var(--cyan)}
.topbar-sub{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--dim);margin-top:4px}
.content{padding:20px 28px 40px;flex:1}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px;transition:border-color .18s}
.card:hover{border-color:#3a5068}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.14em;color:var(--dim);text-transform:uppercase;margin-bottom:10px}
.card h3{font-size:15px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.stat-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;text-align:center;transition:.18s}
.stat-card:hover{border-color:#3a5068;transform:translateY(-2px)}
.stat-value{font-size:28px;font-weight:700;font-family:"IBM Plex Mono",monospace}
.stat-label{font-size:11px;color:var(--dim);margin-top:4px}
.stat-trend{font-family:"IBM Plex Mono",monospace;font-size:10.5px;margin-top:6px;padding:2px 6px;border-radius:4px;display:inline-block}
.trend-up{background:var(--lime-dim);color:var(--lime)}
.trend-down{background:var(--rose-dim);color:var(--rose)}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.progress-track{width:100%;height:6px;background:var(--surface);border-radius:3px;overflow:hidden;margin-bottom:8px}
.progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--cyan),var(--lime));transition:width .6s ease}
.progress-meta{display:flex;justify-content:space-between;font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--dim)}
.week-strip{display:flex;gap:8px;justify-content:space-between}
.week-day{flex:1;text-align:center;cursor:pointer;padding:10px 4px;border-radius:8px;transition:.18s}
.week-day:hover{background:var(--surface)}
.week-day-label{font-size:11px;color:var(--dim);margin-bottom:6px;font-family:"IBM Plex Mono",monospace}
.week-day-num{width:36px;height:36px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;background:var(--surface);color:var(--dim);transition:.18s}
.week-day.done .week-day-num{background:var(--lime-dim);color:var(--lime)}
.week-day.today .week-day-num{background:var(--cyan);color:#06222a;box-shadow:0 0 12px rgba(49,208,224,.3)}
.week-day-status{font-size:10px;color:var(--dim);font-family:"IBM Plex Mono",monospace}
.session-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);transition:.12s;cursor:pointer}
.session-row:hover{background:var(--surface);margin:0 -12px;padding:12px}
.session-row:last-child{border-bottom:none}
.session-dot{width:8px;height:8px;border-radius:50%;flex:none}
.session-info{flex:1}
.session-name{font-size:13px;font-weight:500}
.session-date{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--dim);margin-top:2px}
.session-metrics{display:flex;gap:16px;font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--dim)}
.session-metrics strong{color:var(--paper);font-weight:500}
.badge{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:10px;padding:3px 8px;border-radius:4px;letter-spacing:.04em}
.badge-done{background:var(--lime-dim);color:var(--lime)}
.badge-incomplete{background:var(--amber-dim);color:var(--amber)}
.feedback-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}
.feedback-item:last-child{border-bottom:none}
.feedback-avatar{width:32px;height:32px;border-radius:50%;background:var(--lime-dim);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--lime);flex:none}
.feedback-from{font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px}
.feedback-from span{font-weight:400;color:var(--dim);font-family:"IBM Plex Mono",monospace;font-size:10.5px}
.feedback-msg{font-size:13px;line-height:1.6;color:#b9c8d4;margin-top:6px}
.cta-section{position:sticky;bottom:0;padding:16px 28px;background:linear-gradient(to top,var(--ink) 60%,transparent);pointer-events:none}
.cta-btn{pointer-events:all;width:100%;padding:16px;background:var(--cyan);color:#06222a;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:.2s;display:flex;align-items:center;justify-content:center;gap:10px}
.cta-btn:hover{background:#3ee0f0;transform:translateY(-1px);box-shadow:0 6px 24px rgba(49,208,224,.25)}
.right-panel{width:300px;flex:none;border-left:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;overflow-y:auto}
.right-section{padding:20px;border-bottom:1px solid var(--line)}
.right-section:last-child{border-bottom:none}
.right-section h3{font-size:14px;font-weight:600;margin-bottom:12px}
.device-status{display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface);border-radius:8px}
.device-dot{width:10px;height:10px;border-radius:50%}
.device-dot.online{background:var(--lime);box-shadow:0 0 8px var(--lime)}
.device-dot.offline{background:var(--rose)}
.device-name{font-size:13px;font-weight:500}
.device-sub{font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--dim)}
.battery-bar{width:100%;height:4px;background:var(--surface);border-radius:2px;overflow:hidden;margin-top:10px}
.battery-fill{height:100%;border-radius:2px;background:var(--lime);transition:width .4s}
.spec-row{display:flex;justify-content:space-between;font-size:11px;color:var(--dim);font-family:"IBM Plex Mono",monospace;margin-bottom:4px}
.therapist-card{display:flex;gap:12px;align-items:center;padding:12px;background:var(--surface);border-radius:8px}
.therapist-avatar{width:40px;height:40px;border-radius:50%;background:var(--violet-dim);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:var(--violet)}
.exercise-header{background:var(--panel);border-bottom:1px solid var(--line);padding:20px 28px}
.metrics-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px}
.metric-box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:24px;text-align:center}
.metric-value{font-size:48px;font-weight:700;font-family:"IBM Plex Mono",monospace}
.metric-label{font-size:12px;color:var(--dim);margin-top:4px}
.control-buttons{display:flex;gap:12px;justify-content:center;margin-top:20px}
.btn{padding:14px 32px;border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:8px}
.btn:hover{transform:translateY(-1px)}
.btn-start{background:var(--lime);color:#0a2200}
.btn-pause{background:var(--amber);color:#2a1800}
.btn-stop{background:var(--rose);color:#2a0008}
.btn-finish{background:var(--cyan);color:#06222a}
@media(max-width:1100px){.right-panel{display:none}.stats-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:820px){.sidebar{width:56px}.content{padding:16px}.topbar{padding:16px}.two-col{grid-template-columns:1fr}}
@media(max-width:480px){.sidebar{display:none}.stats-row{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--ink)}
::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#3a5068}
`);

// ===== src/components/Sidebar.tsx =====
writeFile('src/components/Sidebar.tsx', `import { Link, useLocation } from 'react-router-dom'
import { patient } from '../data/mockData'

interface NavItem {
  path: string
  icon: string
  title: string
}

const navItems: NavItem[] = [
  { path: '/',         icon: '🏠', title: 'Home' },
  { path: '/exercise', icon: '💪', title: 'Exercise' },
  { path: '/stats',    icon: '📊', title: 'Stats' },
  { path: '/feedback', icon: '💬', title: 'Feedback' },
  { path: '/settings', icon: '⚙️', title: 'Settings' },
]

export default function Sidebar(): JSX.Element {
  const { pathname } = useLocation()
  return (
    <nav className="sidebar">
      <Link to="/" className="sidebar-logo">A</Link>
      {navItems.map((item) => (
        <Link key={item.path} to={item.path}
          className={\`nav-item \${pathname === item.path ? 'active' : ''}\`}
          title={item.title}>
          {item.icon}
        </Link>
      ))}
      <div className="sidebar-spacer" />
      <div className="sidebar-avatar" title="Profile">{patient.initials}</div>
    </nav>
  )
}
`);

// ===== src/components/RightPanel.tsx =====
writeFile('src/components/RightPanel.tsx', `import { appointment, device, therapist, records } from '../data/mockData'

export default function RightPanel(): JSX.Element {
  return (
    <aside className="right-panel">
      <div className="right-section">
        <div className="eyebrow">next appointment</div>
        <h3>📅 นัดหมายครั้งถัดไป</h3>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div><span style={{ fontSize: 11, color: 'var(--dim)' }}>วันที่</span><br />{appointment.date}</div>
          <div style={{ marginTop: 8 }}><span style={{ fontSize: 11, color: 'var(--dim)' }}>เวลา</span><br /><span style={{ color: 'var(--cyan)' }}>{appointment.time}</span></div>
          <div style={{ marginTop: 8 }}><span style={{ fontSize: 11, color: 'var(--dim)' }}>สถานที่</span><br />{appointment.location}</div>
        </div>
      </div>
      <div className="right-section">
        <div className="eyebrow">iot device</div>
        <h3>🔧 สถานะอุปกรณ์</h3>
        <div className="device-status">
          <div className={\`device-dot \${device.online ? 'online' : 'offline'}\`} />
          <div>
            <div className="device-name">{device.name}</div>
            <div className="device-sub">เชื่อมต่อผ่าน WiFi · {device.lastSync}</div>
          </div>
        </div>
        <div className="spec-row" style={{ marginTop: 12 }}><span>แบตเตอรี่</span><span style={{ color: 'var(--lime)' }}>{device.battery}%</span></div>
        <div className="battery-bar"><div className="battery-fill" style={{ width: \`\${device.battery}%\` }} /></div>
        <div style={{ marginTop: 16 }}>
          <div className="spec-row"><span>Firmware</span><span>{device.firmware}</span></div>
          <div className="spec-row"><span>Signal</span><span style={{ color: 'var(--lime)' }}>{device.signal}</span></div>
          <div className="spec-row"><span>Sensors</span><span style={{ color: 'var(--lime)' }}>{device.sensors}</span></div>
        </div>
      </div>
      <div className="right-section">
        <div className="eyebrow">assigned therapist</div>
        <h3>👨‍⚕️ นักกายภาพบำบัด</h3>
        <div className="therapist-card">
          <div className="therapist-avatar">{therapist.initials}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{therapist.name}</div>
            <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: '"IBM Plex Mono", monospace' }}>{therapist.role}</div>
          </div>
        </div>
      </div>
      <div className="right-section" style={{ background: '#101a24' }}>
        <div className="eyebrow">personal records</div>
        <h3>🏆 สถิติส่วนตัว</h3>
        <div style={{ fontSize: 12, lineHeight: 2, color: '#b9c8d4' }}>
          {records.map((r, i) => (
            <div key={i} className="spec-row"><span>{r.label}</span><span style={{ color: r.color, fontWeight: 500 }}>{r.value}</span></div>
          ))}
        </div>
      </div>
    </aside>
  )
}
`);

// ===== src/pages/PatientHome.tsx =====
writeFile('src/pages/PatientHome.tsx', `import { patient, program, stats, weekDays, sessions, feedbacks } from '../data/mockData'
import type { StatItem } from '../data/types'

export default function PatientHome(): JSX.Element {
  const statCards: { data: StatItem; label: string; color: string }[] = [
    { data: stats.latestReps, label: 'รอบล่าสุด',      color: 'var(--cyan)' },
    { data: stats.avgSpeed,   label: 'ความเร็วเฉลี่ย',  color: 'var(--lime)' },
    { data: stats.adherence,  label: 'ปฏิบัติตามแผน',   color: 'var(--amber)' },
    { data: stats.weekCount,  label: 'ครั้งสัปดาห์นี้',  color: 'var(--violet)' },
  ]
  return (
    <>
      <div className="topbar">
        <div className="topbar-greeting">สวัสดี, <span>{patient.name}</span> 👋</div>
        <div className="topbar-sub">patient-id: {patient.id} · วันนี้เป็นวันที่ดีในการฝึก</div>
      </div>
      <div className="content">
        <div className="stats-row">
          {statCards.map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-value" style={{ color: s.color }}>{s.data.value}</div>
              <div className="stat-label">{s.label}</div>
              <div className={\`stat-trend \${s.data.up ? 'trend-up' : 'trend-down'}\`}>{s.data.trend}</div>
            </div>
          ))}
        </div>
        <div className="two-col">
          <div>
            <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: 'radial-gradient(circle at top right, var(--cyan-dim), transparent 70%)', pointerEvents: 'none' }} />
              <div className="eyebrow">current program</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--cyan)', marginBottom: 4 }}>{program.name}</div>
              <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16 }}>{program.desc}</div>
              <div className="progress-track"><div className="progress-fill" style={{ width: \`\${program.progress}%\` }} /></div>
              <div className="progress-meta"><span>วันที่ {program.currentDay} ของ {program.totalDays}</span><span>สิ้นสุด {program.endDate}</span></div>
            </div>
            <div className="card">
              <div className="eyebrow">this week</div>
              <h3>ปฏิทินสัปดาห์</h3>
              <div className="week-strip">
                {weekDays.map((d, i) => (
                  <div key={i} className={\`week-day \${d.done ? 'done' : ''} \${d.today ? 'today' : ''}\`}>
                    <div className="week-day-label">{d.label}</div>
                    <div className="week-day-num">{d.done ? '✓' : d.num}</div>
                    <div className="week-day-status">{d.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="card">
              <div className="eyebrow">recent sessions</div>
              <h3>ประวัติการออกกำลัง</h3>
              {sessions.map((s) => (
                <div key={s.id} className="session-row">
                  <div className="session-dot" style={{ background: s.done ? 'var(--lime)' : 'var(--amber)' }} />
                  <div className="session-info"><div className="session-name">{s.name}</div><div className="session-date">{s.date}</div></div>
                  <div className="session-metrics"><span><strong>{s.reps}</strong> reps</span><span><strong>{s.speed}</strong> r/s</span></div>
                  <span className={\`badge \${s.done ? 'badge-done' : 'badge-incomplete'}\`}>{s.done ? 'เสร็จ' : 'ไม่ครบ'}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="eyebrow">therapist feedback</div>
              <h3>ความคิดเห็นจากหมอ</h3>
              {feedbacks.map((f) => (
                <div key={f.id} className="feedback-item">
                  <div className="feedback-avatar">{f.initials}</div>
                  <div><div className="feedback-from">{f.from} <span>{f.date}</span></div><div className="feedback-msg">{f.msg}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="cta-section"><button className="cta-btn">▶ เริ่มออกกำลังกาย</button></div>
    </>
  )
}
`);

// ===== src/pages/ExercisePage.tsx =====
writeFile('src/pages/ExercisePage.tsx', `import { useState, useEffect, useRef } from 'react'

export default function ExercisePage(): JSX.Element {
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [reps, setReps] = useState<number>(0)
  const [speed, setSpeed] = useState<number>(0)
  const [elapsed, setElapsed] = useState<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const TARGET = 20

  useEffect(() => {
    if (!isRunning) return
    timerRef.current = setInterval(() => {
      setElapsed((p) => p + 1)
      if (Math.random() > 0.4) setReps((p) => p + 1)
      setSpeed(+(2.5 + Math.random() * 2).toFixed(1))
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRunning])

  const fmt = (s: number) => \`\${String(Math.floor(s/60)).padStart(2,'0')}:\${String(s%60).padStart(2,'0')}\`
  const finish = () => { setIsRunning(false); if(timerRef.current) clearInterval(timerRef.current); alert(\`Session เสร็จ! Reps: \${reps} Speed: \${speed} r/s Duration: \${fmt(elapsed)}\`) }
  const reset = () => { setIsRunning(false); if(timerRef.current) clearInterval(timerRef.current); setReps(0); setSpeed(0); setElapsed(0) }

  return (
    <>
      <div className="exercise-header">
        <div className="eyebrow">exercise session</div>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Exercise 1: Lower Arm Lift</h2>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 4 }}>Set 1 of 3 · Target: {TARGET} reps · ยกแขนขึ้นและลงอย่างช้า ๆ</div>
      </div>
      <div className="content">
        <div className="card" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px' }}>
          <div className="device-dot online"/><span style={{ fontSize:13 }}>Skateboard DEV-001 เชื่อมต่อแล้ว</span>
          <span className="badge badge-done" style={{ marginLeft:'auto' }}>Connected</span>
        </div>
        <div className="metrics-grid">
          <div className="metric-box"><div className="metric-value" style={{ color:'var(--cyan)' }}>{reps}</div><div className="metric-label">รอบ (reps)</div></div>
          <div className="metric-box"><div className="metric-value" style={{ color:'var(--lime)' }}>{isRunning ? speed : '—'}</div><div className="metric-label">ความเร็ว (r/s)</div></div>
          <div className="metric-box"><div className="metric-value" style={{ color:'var(--amber)' }}>{fmt(elapsed)}</div><div className="metric-label">เวลา</div></div>
        </div>
        <div className="card" style={{ textAlign:'center', padding:16, background: isRunning ? (speed > 4 ? 'var(--amber-dim)' : 'var(--lime-dim)') : 'var(--panel)', borderColor: isRunning ? (speed > 4 ? 'var(--amber)' : 'var(--lime)') : 'var(--line)' }}>
          <div style={{ fontSize:14 }}>
            {!isRunning && reps === 0 && 'กดปุ่ม "เริ่ม" เพื่อเริ่มออกกำลังกาย'}
            {!isRunning && reps > 0 && \`Session หยุดชั่วคราว · \${reps} reps\`}
            {isRunning && speed <= 4 && 'ทำได้ดี! ✓ ดำเนินการต่อเนื่อง'}
            {isRunning && speed > 4 && '⚠ ช้าลงนิดนึง — ควบคุมความเร็ว'}
          </div>
        </div>
        <div className="control-buttons">
          {!isRunning
            ? <button className="btn btn-start" onClick={() => setIsRunning(true)}>▶ {reps > 0 ? 'ทำต่อ' : 'เริ่ม'}</button>
            : <button className="btn btn-pause" onClick={() => setIsRunning(false)}>⏸ หยุด</button>}
          <button className="btn btn-finish" onClick={finish} disabled={reps === 0}>✓ จบ Session</button>
          <button className="btn btn-stop" onClick={reset}>✕ รีเซ็ต</button>
        </div>
        <div className="card" style={{ marginTop:16 }}>
          <div className="eyebrow">target progress</div><h3>ความก้าวหน้าเทียบกับเป้าหมาย</h3>
          <div className="progress-track" style={{ height:8 }}><div className="progress-fill" style={{ width: \`\${Math.min(100,(reps/TARGET)*100)}%\` }} /></div>
          <div className="progress-meta"><span>{reps} / {TARGET} reps</span><span>{Math.min(100, Math.round((reps/TARGET)*100))}%</span></div>
        </div>
      </div>
    </>
  )
}
`);

// ===== src/pages/StatsPage.tsx =====
writeFile('src/pages/StatsPage.tsx', `import { useState } from 'react'
import { sessions } from '../data/mockData'

type PeriodKey = 'week' | 'month' | 'all'
const pd: Record<PeriodKey, { sessions: number; reps: number; speed: number; adherence: number }> = {
  week:  { sessions: 4,  reps: 167,  speed: 3.75, adherence: 80 },
  month: { sessions: 16, reps: 680,  speed: 3.72, adherence: 85 },
  all:   { sessions: 32, reps: 1360, speed: 3.7,  adherence: 82 },
}

export default function StatsPage(): JSX.Element {
  const [period, setPeriod] = useState<PeriodKey>('week')
  const d = pd[period]
  const cards = [
    { value: d.sessions, label: 'จำนวน Session', color: 'var(--cyan)' },
    { value: d.reps, label: 'รวมรอบ', color: 'var(--lime)' },
    { value: d.speed, label: 'ความเร็วเฉลี่ย (r/s)', color: 'var(--amber)' },
    { value: \`\${d.adherence}%\`, label: 'ปฏิบัติตามแผน', color: 'var(--violet)' },
  ]
  return (
    <>
      <div className="topbar"><div className="topbar-greeting">📊 สถิติการออกกำลังกาย</div><div className="topbar-sub">ดูแนวโน้มและความก้าวหน้าของคุณ</div></div>
      <div className="content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['week', 'month', 'all'] as PeriodKey[]).map((k) => (
            <button key={k} onClick={() => setPeriod(k)} style={{ padding: '8px 20px', border: '1px solid var(--line)', background: period === k ? 'var(--cyan)' : 'transparent', color: period === k ? '#06222a' : 'var(--dim)', borderRadius: 8, cursor: 'pointer', fontWeight: period === k ? 600 : 400, fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>
              {k === 'week' ? 'สัปดาห์นี้' : k === 'month' ? 'เดือนนี้' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
        <div className="stats-row">
          {cards.map((s, i) => (<div key={i} className="stat-card"><div className="stat-value" style={{ color: s.color }}>{s.value}</div><div className="stat-label">{s.label}</div></div>))}
        </div>
        <div className="card">
          <div className="eyebrow">session history</div><h3>ประวัติ Session ทั้งหมด</h3>
          {sessions.map((s) => (
            <div key={s.id} className="session-row">
              <div className="session-dot" style={{ background: s.done ? 'var(--lime)' : 'var(--amber)' }} />
              <div className="session-info"><div className="session-name">{s.name}</div><div className="session-date">{s.date}</div></div>
              <div className="session-metrics"><span><strong>{s.reps}</strong> reps</span><span><strong>{s.speed}</strong> r/s</span></div>
              <span className={\`badge \${s.done ? 'badge-done' : 'badge-incomplete'}\`}>{s.done ? 'เสร็จ' : 'ไม่ครบ'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
`);

// ===== src/pages/FeedbackPage.tsx =====
writeFile('src/pages/FeedbackPage.tsx', `import { feedbacks } from '../data/mockData'

export default function FeedbackPage(): JSX.Element {
  return (
    <>
      <div className="topbar"><div className="topbar-greeting">💬 ความคิดเห็นจากหมอ</div><div className="topbar-sub">คำแนะนำและ Feedback จากนักกายภาพบำบัด</div></div>
      <div className="content">
        <div className="card">
          <div className="eyebrow">all feedback</div><h3>ข้อความทั้งหมด</h3>
          {feedbacks.map((f) => (
            <div key={f.id} className="feedback-item">
              <div className="feedback-avatar">{f.initials}</div>
              <div><div className="feedback-from">{f.from} <span>{f.date}</span></div><div className="feedback-msg">{f.msg}</div></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
`);

// ===== src/pages/SettingsPage.tsx =====
writeFile('src/pages/SettingsPage.tsx', `import { useState } from 'react'
import { patient } from '../data/mockData'

interface ToggleProps { on: boolean; onClick: () => void }
function Toggle({ on, onClick }: ToggleProps): JSX.Element {
  return (
    <div onClick={onClick} style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', background: on ? 'var(--cyan)' : 'var(--surface)', border: \`1px solid \${on ? 'var(--cyan)' : 'var(--line)'}\`, position: 'relative', transition: '.2s' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--paper)', position: 'absolute', top: 2, left: on ? 22 : 2, transition: '.2s' }} />
    </div>
  )
}

export default function SettingsPage(): JSX.Element {
  const [notif, setNotif] = useState(true)
  const [remind, setRemind] = useState(true)
  return (
    <>
      <div className="topbar"><div className="topbar-greeting">⚙️ การตั้งค่า</div><div className="topbar-sub">จัดการข้อมูลส่วนตัวและการตั้งค่า</div></div>
      <div className="content">
        <div className="card"><div className="eyebrow">profile</div><h3>ข้อมูลส่วนตัว</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
            <div><span style={{ fontSize: 11, color: 'var(--dim)' }}>ชื่อ</span><br />{patient.fullName}</div>
            <div><span style={{ fontSize: 11, color: 'var(--dim)' }}>อายุ</span><br />{patient.age} ปี</div>
            <div><span style={{ fontSize: 11, color: 'var(--dim)' }}>รหัสผู้ป่วย</span><br /><span style={{ fontFamily: '"IBM Plex Mono", monospace' }}>{patient.id}</span></div>
            <div><span style={{ fontSize: 11, color: 'var(--dim)' }}>การวินิจฉัย</span><br />ALS - Early Stage</div>
          </div>
        </div>
        <div className="card"><div className="eyebrow">notifications</div><h3>การแจ้งเตือน</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div><div style={{ fontSize: 13, fontWeight: 500 }}>Feedback notifications</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>แจ้งเตือนเมื่อหมอส่งความคิดเห็น</div></div>
            <Toggle on={notif} onClick={() => setNotif(!notif)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div><div style={{ fontSize: 13, fontWeight: 500 }}>Appointment reminders</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>แจ้งเตือนก่อนนัดหมาย 1 ชั่วโมง</div></div>
            <Toggle on={remind} onClick={() => setRemind(!remind)} />
          </div>
        </div>
        <button className="btn btn-stop" style={{ width: '100%', marginTop: 8 }} onClick={() => alert('Logout')}>ออกจากระบบ</button>
      </div>
    </>
  )
}
`);

// ===== src/main.tsx =====
writeFile('src/main.tsx', `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`);

// ===== src/App.tsx =====
writeFile('src/App.tsx', `import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import RightPanel from './components/RightPanel'
import PatientHome from './pages/PatientHome'
import ExercisePage from './pages/ExercisePage'
import StatsPage from './pages/StatsPage'
import FeedbackPage from './pages/FeedbackPage'
import SettingsPage from './pages/SettingsPage'

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <div className="main-area">
          <Routes>
            <Route path="/"         element={<PatientHome />} />
            <Route path="/exercise" element={<ExercisePage />} />
            <Route path="/stats"    element={<StatsPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
        <RightPanel />
      </div>
    </BrowserRouter>
  )
}
`);

// ===== Update index.html with Google Fonts =====
const htmlPath = 'index.html';
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes('IBM Plex')) {
    html = html.replace('</head>',
      '    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">\n  </head>');
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('  ✅ index.html (Google Fonts added)');
  }
}

// ===== Delete default Vite files =====
const toDelete = ['src/App.css', 'src/index.css', 'src/assets/react.svg'];
toDelete.forEach(f => {
  if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  🗑️  Deleted ${f}`); }
});

console.log('\n========================================');
console.log('  ✅ Setup complete!');
console.log('  Run: npm run dev');
console.log('  Open: http://localhost:5173/');
console.log('========================================\n');

