import { useEffect, useState } from 'react'
import { Search, Pencil, Trash2 } from 'lucide-react'
import type { Patient } from '../../types'
import { api, list, ageFrom, fullName, stageLabel } from '../../lib/clinic'
import { EMPTY_PROFILE, PersonFields, fullAddress, profileOf, profileBody, type PersonKey } from '../../components/PatientForm'
import { Btn, ErrorText, Loading } from '../../components/ui'
import { Hint } from '../../components/shadcn/tooltip'

interface Props { onOpenHistory: (patientId: string) => void }

const PAGE = 20

/** ผู้ป่วยทั้งหมดของศูนย์ (เวชระเบียน) — ค้นหา แก้ไขข้อมูล ลบ และดูประวัติการรักษา */
export default function PatientsPage({ onOpenHistory }: Props) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [show, setShow] = useState(PAGE)
  const [editing, setEditing] = useState<string | null>(null)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const load = () => list<Patient>('/api/patients?status=ALL').then(setPatients).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  if (loading) return <Loading />

  const term = q.trim().toLowerCase()
  const rows = patients
    .filter(p => !term || fullName(p.first_name, p.last_name).toLowerCase().includes(term) || p.patient_id.toLowerCase().includes(term) || (p.phone ?? '').includes(term))
    .sort((a, b) => b.patient_id.localeCompare(a.patient_id))
  const shown = rows.slice(0, show)

  const setP = (k: PersonKey) => (e: { target: { value: string } }) => setProfile(f => ({ ...f, [k]: e.target.value }))
  const startEdit = (p: Patient) => { setEditing(p.patient_id); setDeleting(null); setProfile(profileOf(p)); setError(''); setMsg('') }

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true); setError(''); setMsg('')
    try { await fn(); await load(); setEditing(null); setDeleting(null); setMsg(done) }
    catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  const save = (p: Patient) => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) { setError('กรอกชื่อและนามสกุลของผู้ป่วย'); return }
    run(() => api('/api/register', { method: 'PATCH', body: profileBody(p, profile) }), `บันทึกข้อมูล ${fullName(profile.firstName, profile.lastName)} แล้ว`)
  }
  const remove = (p: Patient) =>
    run(() => api('/api/register', { method: 'DELETE', body: { patientId: p.patient_id } }), `ลบ ${fullName(p.first_name, p.last_name)} ออกจากรายชื่อแล้ว`)

  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-full border transition-colors'

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] font-bold leading-tight">ผู้ป่วยทั้งหมด</h1>
          <span className="text-[13px] text-rx-muted">ผู้ป่วยทุกคนของศูนย์ {patients.length} คน</span>
        </div>
        <div className="group flex h-10 min-w-[260px] flex-[0_1_420px] items-center gap-3 rounded-field border border-[#C7C7CC] bg-white px-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-colors focus-within:border-rx-accent focus-within:ring-4 focus-within:ring-rx-accent/15">
          <Search size={17} className="text-rx-muted" />
          <input aria-label="ค้นหาผู้ป่วย" value={q} onChange={e => { setQ(e.target.value); setShow(PAGE) }} placeholder="ค้นหาชื่อ, HN หรือเบอร์โทร" className="min-w-0 flex-1 border-none bg-transparent text-[15px] outline-none placeholder:text-rx-muted" />
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {msg && <div className="rounded-lg bg-[#E8F8EC] px-4 py-2.5 text-[13px] font-medium text-[#1E7B34]">{msg}</div>}

      {/* รายชื่อแบบการ์ดกระจกแยกคนละใบ */}
      <div className="flex flex-col gap-3">
        {shown.length === 0 && (
          <div className="rx-card px-5 py-4 text-[15px] text-rx-muted">{term ? `ไม่พบ "${q}"` : 'ยังไม่มีผู้ป่วยในระบบ'}</div>
        )}
        {shown.map(p => {
          const age = ageFrom(p.birth_date)
          const open = editing === p.patient_id || deleting === p.patient_id
          return (
            <div key={p.patient_id} className={`rx-card group overflow-hidden ${open ? 'border-rx-tint-2' : 'rx-lift'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                {/* คลิกที่รายชื่อเพื่อดูประวัติการรักษา */}
                <button type="button" onClick={() => onOpenHistory(p.patient_id)} title="ดูประวัติการรักษา" className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[16px] font-semibold text-rx-ink">{p.title_name ?? ''}{fullName(p.first_name, p.last_name)}</span>
                      <StageBadge stage={p.current_stage} />
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-rx-muted">
                      <span>HN {p.patient_id}</span>
                      {p.gender && <span>{p.gender}</span>}
                      {age != null && <span>{age} ปี</span>}
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Hint label="แก้ไข">
                    <button type="button" aria-label="แก้ไข" aria-pressed={editing === p.patient_id} onClick={() => (editing === p.patient_id ? setEditing(null) : startEdit(p))} className={`${iconBtn} ${editing === p.patient_id ? 'border-transparent bg-rx-accent text-white' : 'border-black/[0.08] bg-white text-rx-accent hover:bg-rx-bg'}`}><Pencil size={16} /></button>
                  </Hint>
                  <Hint label="ลบ">
                    <button type="button" aria-label="ลบ" onClick={() => { setDeleting(p.patient_id); setEditing(null); setError(''); setMsg('') }} className={`${iconBtn} ${deleting === p.patient_id ? 'border-transparent bg-[#FF3B30] text-white' : 'border-black/[0.08] bg-white text-[#FF3B30] hover:bg-[#FFEBEA]'}`}><Trash2 size={16} /></button>
                  </Hint>
                </div>
              </div>

              {editing === p.patient_id && (
                <div className="flex flex-col gap-3.5 border-t border-rx-divider px-5 py-4">
                  <span className="text-[14px] font-semibold">แก้ไขข้อมูล · HN {p.patient_id}</span>
                  <PersonFields v={profile} set={setP} id={`p${p.patient_id}`} />
                  <div className="flex flex-wrap justify-end gap-2.5">
                    <Btn variant="outline" onClick={() => setEditing(null)} disabled={busy}>ยกเลิก</Btn>
                    <Btn onClick={() => save(p)} disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึกข้อมูลผู้ป่วย'}</Btn>
                  </div>
                </div>
              )}

              {deleting === p.patient_id && (
                <div className="flex flex-wrap items-center gap-3 border-t border-rx-divider bg-[#FFEBEA] px-5 py-3.5">
                  <div className="flex flex-[1_1_320px] flex-col gap-0.5 text-[13px] text-[#791F1F]">
                    <span className="text-[14px] font-semibold">ลบ {fullName(p.first_name, p.last_name)} ออกจากรายชื่อ?</span>
                    <span>บัญชีจะถูกปิด เข้าสู่ระบบไม่ได้ และนัดที่ยังไม่ถึงจะถูกยกเลิก · ประวัติการรักษายังเก็บไว้ตามข้อกำหนดเวชระเบียน</span>
                    {fullAddress(p) && <span className="text-[12px]">ที่อยู่ {fullAddress(p)}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="outline" size="sm" onClick={() => setDeleting(null)} disabled={busy}>ยกเลิก</Btn>
                    <button type="button" disabled={busy} onClick={() => remove(p)} className="h-10 rounded-full bg-[#FF3B30] px-4 text-[13px] font-semibold text-white hover:bg-[#E0352B] disabled:opacity-60">{busy ? 'กำลังลบ...' : 'ยืนยันลบ'}</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {rows.length > show && (
        <div className="flex justify-center">
          <Btn variant="outline" onClick={() => setShow(s => s + PAGE)}>แสดงเพิ่ม ({rows.length - show} คน)</Btn>
        </div>
      )}
    </>
  )
}

/* ป้ายระยะอาการ — แรก = เขียว · กลาง = ส้ม · ท้าย = แดง · ยังไม่ประเมิน = เทา */
const STAGE_TONE: Record<string, string> = {
  EARLY: 'bg-[#E8F8EC] text-[#1E7B34]',
  MIDDLE: 'bg-[#FFF4E5] text-[#B35C00]',
  LATE: 'bg-[#FFEBEA] text-[#C4271B]',
}

function StageBadge({ stage }: { stage?: string | null }) {
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${(stage && STAGE_TONE[stage]) || 'bg-rx-fill text-rx-muted'}`}>
      {stageLabel(stage)}
    </span>
  )
}
