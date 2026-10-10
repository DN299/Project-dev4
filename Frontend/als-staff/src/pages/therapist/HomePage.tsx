import { useEffect, useState } from 'react'
import type { AuthUser, PatientAppointment } from '../../types'
import {
  list, rangeQuery, addDays, startOfDay, sameDay, isoDate, fromIsoDate, thaiDate, slotLabel, apptSlot, isClosedDay,
  isTraining, holdsSlot, queueState, ptName, fullName,
} from '../../lib/clinic'
import { Badge, DayStrip, GridTable, GridRow, Loading, Stat } from '../../components/ui'

interface Props { user: AuthUser; onOpenCase: (patientId: string) => void; onAssess: (appointmentId: string) => void }

const COLS = '120px minmax(0, 1.6fr) 130px 130px'

export default function TherapistHomePage({ user, onOpenCase, onAssess }: Props) {
  const me = user.ot_id ?? ''
  const today = startOfDay(new Date())
  const [sel, setSel] = useState(today)
  const [win, setWin] = useState(addDays(today, -3))
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [loading, setLoading] = useState(true)

  const from = sel < win ? sel : win
  const to = addDays(sel > addDays(win, 6) ? sel : addDays(win, 6), 1)
  useEffect(() => {
    list<PatientAppointment>(`/api/appointments?ot_id=${me}&${rangeQuery(from, to)}`).then(setAppts).finally(() => setLoading(false))
  }, [me, from.getTime(), to.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const mineOn = (d: Date) => appts.filter(a => holdsSlot(a) && sameDay(new Date(a.appointment_date), d))
  const dayRows = mineOn(sel).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
  const trainingRows = dayRows.filter(isTraining)
  const isToday = sameDay(sel, today)
  const now = isToday ? trainingRows.find(a => a.status === 'IN_PROGRESS') : undefined

  return (
    <>
      <h1 className="m-0 text-[30px] font-semibold">สวัสดี {ptName(user.first_name)}</h1>

      <div className="flex flex-col gap-3 rounded-lg border border-white bg-white px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold">{thaiDate(sel)}</span>
            <span className="text-[12px] text-rx-muted">{isToday ? 'วันนี้' : sel < today ? 'ย้อนหลัง · ดูได้อย่างเดียว' : 'ล่วงหน้า'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="jump" className="text-[13px] text-rx-muted">ไปวันที่</label>
            <input id="jump" type="date" value={isoDate(sel)} onChange={e => { if (e.target.value) { const d = fromIsoDate(e.target.value); setSel(d); setWin(addDays(d, -3)) } }} className="h-10 rounded-[10px] border border-rx-line bg-white px-2.5 text-[14px]" />
            <button type="button" onClick={() => { setSel(today); setWin(addDays(today, -3)) }} className="h-10 rounded-[10px] border border-rx-line bg-white px-3.5 text-[13px] font-semibold">วันนี้</button>
          </div>
        </div>
        <DayStrip
          days={Array.from({ length: 7 }, (_, i) => addDays(win, i))}
          selected={sel}
          today={today}
          meta={d => (isClosedDay(d) ? 'ปิด' : `ของฉัน ${mineOn(d).filter(isTraining).length}`)}
          onPick={setSel}
          onPrev={() => setWin(addDays(win, -7))}
          onNext={() => setWin(addDays(win, 7))}
        />
      </div>

      {loading ? <Loading /> : (
        <>
          {isClosedDay(sel) && (
            <div className="flex flex-col gap-3 rounded-lg bg-white px-5 py-[22px]">
              <span className="text-[15px] font-semibold">ศูนย์ปิดวันอาทิตย์</span>
              <span className="text-[13px] text-rx-muted">ไม่มีนัดและไม่มีการใช้กระดานในวันนี้</span>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <Stat label="ช่องของฉัน" value={trainingRows.length} />
            <Stat label="เสร็จแล้ว" value={trainingRows.filter(a => a.status === 'COMPLETED').length} color="#145C38" />
          </div>

          {now && (
            <div className="flex flex-col gap-2 rounded-lg bg-white px-5 py-[18px]">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge state="now" />
                <span className="text-[13px] text-rx-muted">ช่อง {slotLabel(apptSlot(now))}{now.device_name ? ` · กระดาน ${now.device_name}` : ''}</span>
              </div>
              <span className="text-[22px] font-semibold">{fullName(now.patient_name, now.patient_lastname)}</span>
              <span className="text-[13px] text-rx-muted">HN {now.patient_id} · {ptName(now.therapist_name)}</span>
              <button type="button" onClick={() => onOpenCase(now.patient_id)} className="mt-1 h-11 self-start rounded-lg bg-rx-accent px-[18px] text-[14px] font-semibold text-white">รายละเอียด</button>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <span className="px-0.5 pt-1 text-[15px] font-semibold">ช่องของฉัน</span>
            {dayRows.length === 0 ? (
              !isClosedDay(sel) && <span className="px-0.5 text-[13px] text-rx-muted">ไม่มีนัดของคุณในวันนี้</span>
            ) : (
              <GridTable cols={COLS} minWidth={520} head={['ช่องเวลา', 'ผู้ป่วย', 'สถานะ', '']}>
                {dayRows.map(a => {
                  const st = queueState(a, today)
                  const assess = a.appointment_type === 'ASSESSMENT'
                  const name = fullName(a.patient_name, a.patient_lastname)
                  return (
                    <GridRow key={a.appointment_id} cols={COLS}>
                      <span className="font-semibold">{slotLabel(apptSlot(a))}</span>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold">{assess ? `${name} · ผู้ป่วยใหม่` : name}</span>
                        <span className="text-[12px] text-rx-muted">HN {a.patient_id}{assess ? ` · มาครั้งแรก${a.symptoms_today ? ` · อาการที่แจ้ง: ${a.symptoms_today}` : ''}` : ''}</span>
                      </div>
                      <div><Badge state={st} /></div>
                      <div>
                        {assess && st === 'assess' && !(sel < today) ? (
                          <button type="button" onClick={() => onAssess(a.appointment_id)} className="inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-rx-accent px-3.5 text-[13px] font-semibold text-white">ประเมินอาการ</button>
                        ) : (['now', 'called', 'done', 'wait', 'assessed'] as string[]).includes(st) ? (
                          <button type="button" onClick={() => onOpenCase(a.patient_id)} className="inline-flex h-10 items-center whitespace-nowrap rounded-lg border border-rx-line bg-white px-3.5 text-[13px] font-semibold">รายละเอียด</button>
                        ) : null}
                      </div>
                    </GridRow>
                  )
                })}
              </GridTable>
            )}
          </div>
        </>
      )}
    </>
  )
}
