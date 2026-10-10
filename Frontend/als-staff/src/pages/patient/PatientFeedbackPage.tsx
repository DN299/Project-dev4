import { useEffect, useState } from 'react'
import type { SessionFeedback } from '../../types'
import { list, dayMonth, ptName } from '../../lib/clinic'

interface Props { patientId: string }

/** บรรทัดแรกเป็นหัวข้อ ที่เหลือเป็นรายละเอียด */
const split = (text: string) => {
  const [head, ...rest] = text.trim().split('\n')
  return { head, body: rest.join('\n').trim() }
}

export default function PatientFeedbackPage({ patientId }: Props) {
  const [items, setItems] = useState<SessionFeedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    list<SessionFeedback>(`/api/feedback?patient_id=${patientId}`).then(d => setItems(d.filter(f => f.comment))).finally(() => setLoading(false))
  }, [patientId])

  if (loading) return <div className="py-16 text-center text-[13px] text-pt-muted">กำลังโหลด...</div>

  const [latest, ...older] = items
  const meta = (f: SessionFeedback) => `${dayMonth(new Date(f.created_at))} · ${ptName(f.therapist_name)}`

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col">
        <span className="text-[21px] font-bold">คำแนะนำ</span>
        <span className="text-[13px] text-pt-muted">จากนักกายภาพของคุณ</span>
      </div>

      {!latest ? (
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-[18px]">
          <span className="text-[15px] font-semibold">ยังไม่มีคำแนะนำ</span>
          <span className="text-[13px] text-pt-muted">คำแนะนำจากนักกายภาพจะขึ้นที่นี่หลังการฝึกแต่ละครั้ง</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[18px] border-2 border-pt-accent bg-white p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap rounded-full bg-pt-tint px-3 py-[3px] text-[12px] font-semibold text-pt-accent-ink">ล่าสุด</span>
            <span className="text-[12px] text-pt-muted">{meta(latest)}</span>
          </div>
          <span className="text-[18px] font-semibold leading-relaxed">{split(latest.comment!).head}</span>
          {split(latest.comment!).body && <span className="whitespace-pre-line text-[15px] leading-[1.7]">{split(latest.comment!).body}</span>}
        </div>
      )}

      {older.length > 0 && (
        <div className="flex flex-col rounded-2xl bg-white px-4 py-3.5">
          <span className="text-[14px] font-semibold">ก่อนหน้านี้</span>
          {older.map(f => (
            <div key={f.feedback_id} className="flex flex-col gap-0.5 border-t border-pt-divider py-2.5">
              <span className="text-[12px] text-pt-muted">{meta(f)}</span>
              <span className="whitespace-pre-line text-[14px] leading-relaxed">{f.comment}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
