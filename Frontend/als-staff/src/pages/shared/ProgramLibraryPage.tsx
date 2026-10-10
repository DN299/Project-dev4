import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { AuthUser, DiseaseStage, Patient, Program } from '../../types'
import { api, list, STAGES, STAGE_LABEL, stageLabel, fullName } from '../../lib/clinic'
import { Badge, Btn, Chip, ErrorText, Field, Loading, inputCls, selectCls, textareaCls } from '../../components/ui'

interface Props { user: AuthUser }

const EMPTY = { programName: '', description: '', targetStage: 'EARLY' as DiseaseStage, sessionPerDay: '2', durationMin: '15' }

export default function ProgramLibraryPage({ user }: Props) {
  const isPt = user.role_id === 'R002'
  const [programs, setPrograms] = useState<Program[]>([])
  const [cases, setCases] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [assign, setAssign] = useState<Program | null>(null)
  const [assignTo, setAssignTo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const load = () => list<Program>(isPt ? `/api/programs?created_by=${user.users_id}` : '/api/programs').then(setPrograms).finally(() => setLoading(false))
  useEffect(() => {
    load()
    if (isPt) list<Patient>('/api/patients?status=ALL').then(ps => setCases(ps.filter(p => p.primary_ot_id === user.ot_id && p.case_status === 'ACTIVE')))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setForm(EMPTY); setError(''); setAssign(null) }

  const save = async () => {
    if (!form) return
    if (!form.programName.trim()) { setError('กรุณาระบุชื่อโปรแกรม'); return }
    setSaving(true); setError('')
    try {
      await api('/api/programs', { method: 'POST', body: { usersId: user.users_id, ...form } })
      setForm(null); setMsg('สร้างโปรแกรมแล้ว'); await load()
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  const doAssign = async () => {
    if (!assign || !assignTo) return
    setSaving(true); setError('')
    try {
      await api('/api/patient-programs', { method: 'POST', body: { patientId: assignTo, programId: assign.program_id, otId: user.ot_id } })
      const p = cases.find(c => c.patient_id === assignTo)
      setMsg(`มอบ "${assign.program_name}" ให้ ${fullName(p?.first_name, p?.last_name)} แล้ว`)
      setAssign(null); setAssignTo(''); await load()
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  if (loading) return <Loading />
  const shown = programs.filter(p => p.status === 'ACTIVE')
  const setF = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm(f => (f ? { ...f, [k]: e.target.value } : f))

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="m-0 text-[30px] font-semibold">{isPt ? 'คลังโปรแกรม' : 'คลังโปรแกรมฝึก'}</h1>
          <span className="text-[13px] text-rx-muted">{isPt ? 'เลือกโปรแกรมแล้วมอบให้ผู้ป่วยในเคสของคุณ' : `โปรแกรมทั้งหมด ${shown.length} รายการ · เนื้อหาโปรแกรมกำหนดโดยนักกายภาพ`}</span>
        </div>
        {isPt && <Btn onClick={openCreate}><Plus size={18} />สร้างโปรแกรม</Btn>}
      </div>

      {msg && <div className="rounded-lg bg-[#E4F5EC] px-4 py-2.5 text-[13px] font-semibold text-[#145C38]">{msg}</div>}
      <ErrorText>{error}</ErrorText>

      {form && (
        <div className="flex flex-col gap-3.5 rounded-lg border-[1.5px] border-rx-tint-2 bg-white px-5 py-[18px]">
          <span className="text-[16px] font-semibold">สร้างโปรแกรมใหม่</span>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="ชื่อโปรแกรม" htmlFor="pn" className="sm:col-span-2"><input id="pn" className={inputCls} value={form.programName} onChange={setF('programName')} /></Field>
            <Field label="วิธีฝึก" htmlFor="pd" className="sm:col-span-2"><textarea id="pd" rows={2} className={textareaCls} value={form.description} onChange={setF('description')} placeholder="เช่น ดันกระดานไปข้างหน้าแล้วดึงกลับ เน้นเคลื่อนให้สุดระยะ" /></Field>
            <Field label="เหมาะกับระยะ" htmlFor="ps">
              <select id="ps" className={selectCls} value={form.targetStage} onChange={setF('targetStage')}>{STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
            </Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="เซต/วัน" htmlFor="pset"><input id="pset" type="number" min={1} className={inputCls} value={form.sessionPerDay} onChange={setF('sessionPerDay')} /></Field>
              <Field label="นาที" htmlFor="pmin"><input id="pmin" type="number" min={1} className={inputCls} value={form.durationMin} onChange={setF('durationMin')} /></Field>
            </div>
          </div>
          <span className="text-[12px] text-rx-muted">ไม่มีจำนวนครั้งขั้นต่ำ ผู้ป่วยทำได้เท่าไหร่บันทึกตามนั้น</span>
          <div className="flex justify-end gap-2.5">
            <Btn variant="outline" onClick={() => setForm(null)}>ยกเลิก</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกโปรแกรม'}</Btn>
          </div>
        </div>
      )}

      {assign && (
        <div className="flex flex-col gap-3 rounded-lg border-[1.5px] border-rx-tint-2 bg-white px-5 py-[18px]">
          <span className="text-[16px] font-semibold">มอบ "{assign.program_name}" ให้ผู้ป่วย</span>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="ผู้ป่วย (เคสของฉัน)" htmlFor="asp" className="flex-[1_1_280px]">
              <select id="asp" className={selectCls} value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                <option value="">เลือกผู้ป่วย</option>
                {cases.map(p => <option key={p.patient_id} value={p.patient_id}>{fullName(p.first_name, p.last_name)} · HN {p.patient_id} · {stageLabel(p.current_stage)}</option>)}
              </select>
            </Field>
            <Btn variant="outline" onClick={() => setAssign(null)}>ยกเลิก</Btn>
            <Btn onClick={doAssign} disabled={!assignTo || saving}>มอบโปรแกรม</Btn>
          </div>
          <span className="text-[12px] text-rx-muted">โปรแกรมนี้จะแทนโปรแกรมเดิมของผู้ป่วย</span>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-4">
        {shown.map(p => (
          <div key={p.program_id} className={`flex min-w-0 flex-col gap-3 rounded-lg border border-white bg-white px-[18px] py-4`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[16px] font-semibold">{p.program_name}</span>
              <Badge label={stageLabel(p.target_stage)} bg="#EDEEFC" fg="#3A40C9" />
            </div>
            {p.description && <span className="text-[13px] leading-relaxed text-rx-muted">{p.description}</span>}
            <div className="flex flex-wrap gap-1.5">
              <Chip>{p.session_per_day} เซต/วัน</Chip>
              <Chip>{Math.round(p.duration_sec / 60)} นาที</Chip>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-rx-divider pt-2.5">
              <span className="text-[12px] text-rx-muted">ใช้กับผู้ป่วย {p.patient_count ?? 0} คน</span>
              {isPt && <Btn variant="outline" size="sm" onClick={() => { setAssign(p); setForm(null); setAssignTo(''); setMsg('') }}>มอบให้ผู้ป่วย</Btn>}
            </div>
          </div>
        ))}
      </div>
      {shown.length === 0 && <div className="rounded-lg bg-white px-5 py-6 text-[14px] text-rx-muted">ยังไม่มีโปรแกรมในคลัง</div>}
    </>
  )
}
