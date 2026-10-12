import { api, addDays, startOfDay, isoDate } from '../lib/clinic'
import { textareaCls } from './ui'

/**
 * การนัดครั้งถัดไป — นักกายภาพระบุแค่ "นัด / ไม่นัด" และหมายเหตุ
 * วันและช่องเวลาเวชระเบียนเป็นคนลงเองที่หน้าตารางนัด (ภายใน 60 วันนับจากพรุ่งนี้)
 */
export interface NextAppt { want: boolean; note: string }
export const emptyNextAppt = (): NextAppt => ({ want: true, note: '' })
/** ไม่มีอะไรบังคับกรอก — หมายเหตุใส่หรือไม่ใส่ก็ได้ */
export const nextApptMissing = (_v: NextAppt) => ''

const BOOK_WINDOW = { from: 1, to: 60 }

/** ส่งนัดครั้งถัดไปให้เวชระเบียนลงวันและเวลา (POST /api/appointment-requests) */
export const bookNextAppt = (v: NextAppt, patientId: string) => {
  const today = startOfDay(new Date())
  return api('/api/appointment-requests', {
    method: 'POST',
    body: { patientId, label: 'นัดครั้งถัดไป', earliestDate: isoDate(addDays(today, BOOK_WINDOW.from)), latestDate: isoDate(addDays(today, BOOK_WINDOW.to)), note: v.note.trim() || null },
  })
}

export function NextApptFields({ value, onChange, id = 'na' }: { value: NextAppt; onChange: (v: NextAppt) => void; id?: string }) {
  const radio = (on: boolean, label: string, want: boolean) => (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
      <input type="radio" name={`${id}-want`} className="h-5 w-5 accent-[#007AFF] outline-none focus-visible:ring-[3px] focus-visible:ring-rx-accent/25" checked={on} onChange={() => onChange({ ...value, want })} />
      {label}
    </label>
  )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-8">
        {radio(value.want, 'นัด', true)}
        {radio(!value.want, 'ไม่นัด', false)}
      </div>
      {value.want && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-note`} className="text-[13px] font-semibold">หมายเหตุ</label>
          <textarea id={`${id}-note`} rows={2} className={textareaCls} placeholder="เช่น นัดอีก 1 สัปดาห์ ช่วงเช้า" value={value.note} onChange={e => onChange({ ...value, note: e.target.value })} />
        </div>
      )}
    </div>
  )
}
