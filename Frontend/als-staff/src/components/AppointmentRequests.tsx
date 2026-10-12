import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import type { AppointmentRequest } from '../types'
import { list, addDays, sameDay, fromIsoDate, thaiShort, dayMonth, ptName, fullName, isoDate } from '../lib/clinic'
import { Btn } from './ui'

// ช่วงที่เวชระเบียนลงนัดได้ตามข้อความของนักกายภาพ (นับจากวันนี้ เป็นวัน)
const REQUEST_WINDOW = { label: 'ตามข้อความ', from: 1, to: 60 }

/** การนัดครั้งถัดไป: นัด (พร้อมข้อความถึงเวชระเบียน) หรือไม่นัด */
export interface NextVisit { want: boolean; message: string }
export const EMPTY_NEXT_VISIT: NextVisit = { want: true, message: '' }

/** ข้อความนัดครั้งถัดไป → body ของคำขอนัด { label, earliestDate, latestDate, note } */
export function nextVisitBody(v: NextVisit, today = new Date()) {
  const w = REQUEST_WINDOW
  return { label: w.label, earliestDate: isoDate(addDays(today, w.from)), latestDate: isoDate(addDays(today, w.to)), note: v.message.trim() }
}
/** นัด → ต้องมีข้อความ · ไม่นัด → พร้อมเลย */
export const nextVisitReady = (v: NextVisit) => !v.want || !!v.message.trim()

/** การนัดครั้งถัดไป: เลือก นัด / ไม่ แล้วเขียนข้อความถึงเวชระเบียน — เวชระเบียนเป็นคนลงนัดของผู้ป่วย */
export function NextVisitMessage({ value, onChange, id = 'nv', noLabel = 'ไม่' }: { value: NextVisit; onChange: (v: NextVisit) => void; id?: string; noLabel?: string }) {
  const radio = (on: boolean, label: string, want: boolean) => (
    <label className="flex cursor-pointer items-center gap-2.5 text-[16px]">
      <input type="radio" name={`${id}-want`} className="h-6 w-6 accent-[#007AFF]" checked={on} onChange={() => onChange({ ...value, want })} />
      {label}
    </label>
  )
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-8">
        {radio(value.want, 'นัด', true)}
        {radio(!value.want, noLabel, false)}
      </div>
      {value.want && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] font-semibold">ข้อความถึงเวชระเบียน <span className="text-[#A32D2D]">* จำเป็นต้องกรอก</span></label>
          <textarea id={id} rows={3} required className="w-full resize-y rounded-field border border-rx-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-rx-accent"
            placeholder="กรอกข้อความ... เช่น นัดอีก 1 สัปดาห์ ช่วงเช้า" value={value.message} onChange={e => onChange({ ...value, message: e.target.value })} />
        </div>
      )}
    </div>
  )
}

/** ช่วงวันของคำขอ เช่น "17–20 ต.ค. 2569" */
export const requestRange = (r: Pick<AppointmentRequest, 'earliest_date' | 'latest_date'>) => {
  const a = fromIsoDate(r.earliest_date), b = fromIsoDate(r.latest_date)
  return sameDay(a, b) ? thaiShort(a) : `${dayMonth(a)} – ${thaiShort(b)}`
}

/**
 * คำขอนัดจากนักกายภาพ (หน้าตารางนัดของเวชระเบียน)
 * อ่านข้อความ แล้วกดลงนัด → ปฏิทินแสดงวันและช่องที่นักกายภาพคนนั้นว่าง ให้เวชระเบียนเลือกเอง
 */
export default function AppointmentRequests({ onPick, picked }: { onPick: (r: AppointmentRequest) => void; picked?: string | null }) {
  const [reqs, setReqs] = useState<AppointmentRequest[]>([])
  const load = () => list<AppointmentRequest>('/api/appointment-requests?status=PENDING').then(setReqs)
  useEffect(() => { load() }, [])

  if (reqs.length === 0) return null
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[#F2D7AE] bg-white px-[22px] py-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1.5">
        <span className="flex items-center gap-2 text-[16px] font-semibold"><CalendarClock size={18} className="text-[#8C420A]" />คำขอนัดจากนักกายภาพ · รอลงนัด {reqs.length} รายการ</span>
        <span className="text-[12px] text-rx-muted">กดลงนัด แล้วเลือกวันที่นักกายภาพว่างจากปฏิทิน</span>
      </div>
      {reqs.map(r => (
        <div key={r.request_id} className="flex flex-col gap-3 border-t border-rx-divider py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-[1_1_260px] flex-col gap-1.5">
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold">{fullName(r.patient_name, r.patient_lastname)}</span>
                <span className="text-[13px] text-rx-muted">HN {r.patient_id} · ขอโดย {ptName(r.therapist_name)}</span>
              </div>
              {r.note && <div className="self-start rounded-lg rounded-tl-none bg-rx-tint px-3.5 py-2 text-[14px] text-rx-accent-deep">“{r.note}”</div>}
            </div>
            {picked === r.request_id
              ? <span className="rounded-full bg-rx-accent px-3 py-1 text-[12px] font-semibold text-white">กำลังลงนัดในปฏิทิน</span>
              : <Btn size="sm" onClick={() => onPick(r)}>ลงนัด</Btn>}
          </div>
        </div>
      ))}
    </div>
  )
}
