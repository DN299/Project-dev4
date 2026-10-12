import { useEffect, useState } from "react";
import { Check, PlayCircle, Clock } from "lucide-react";
import type { PatientAppointment, PatientProgram } from "../../types";
import {
  api,
  list,
  rangeQuery,
  addDays,
  startOfDay,
  sameDay,
  thaiDate,
  hhmm,
  apptSlot,
  slotEnd,
  isTraining,
  ptName,
} from "../../lib/clinic";
import {
  fetchSkateSessions,
  skateOnDay,
  type SkateSession,
} from "./patientSkate";
import {
  SETS_ARE_PER_SIDE,
  sidesFromAffected,
  countBySide,
  type Side,
} from "./Patientside";

interface Props {
  patientId: string;
  onTrain: () => void;
}

const POLL_MS = 10000;

/** "10:00" ของวันนี้ → Date */
function todayAt(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export default function PatientQueuePage({ patientId, onTrain }: Props) {
  const today = startOfDay(new Date());
  const [mine, setMine] = useState<PatientAppointment[]>([]);
  const [dayAll, setDayAll] = useState<PatientAppointment[]>([]);
  const [program, setProgram] = useState<PatientProgram | null>(null);
  const [todaySets, setTodaySets] = useState<SkateSession[]>([]);
  const [sides, setSides] = useState<Side[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      Promise.all([
        list<PatientAppointment>(
          `/api/appointments?patient_id=${patientId}`,
        ).then(setMine),
        list<PatientAppointment>(
          `/api/appointments?${rangeQuery(today, addDays(today, 1))}`,
        ).then(setDayAll),
        list<PatientProgram>(
          `/api/patient-programs?patient_id=${patientId}`,
        ).then((pp) =>
          setProgram(pp.find((p) => p.status === "ACTIVE") ?? null),
        ),
        fetchSkateSessions(patientId)
          .then((s) => setTodaySets(skateOnDay(s, new Date())))
          .catch(() => {}),
        api<{ affected_side?: string | null }[]>(
          `/api/patients?patient_id=${patientId}`,
        )
          .then((r) => setSides(sidesFromAffected(r[0]?.affected_side)))
          .catch(() => {}),
      ]).finally(() => setLoading(false));
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // นักกายภาพเริ่มฝึกให้แล้ว → เข้าหน้าฝึกให้อัตโนมัติ (ผู้ป่วยกดปุ่ม "ไปที่เครื่องฝึก" เองก็ได้)
  const inProgress = mine.some(
    (a) =>
      a.status === "IN_PROGRESS" &&
      isTraining(a) &&
      sameDay(new Date(a.appointment_date), today),
  );
  useEffect(() => {
    if (inProgress) onTrain();
  }, [inProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = (
    <div className="flex flex-col">
      <span className="text-[22px] font-bold">คิวของคุณวันนี้</span>
      <span className="text-[15px] text-pt-muted">{thaiDate(today)}</span>
    </div>
  );
  if (loading)
    return (
      <div className="flex flex-col gap-3.5">
        {title}
        <div className="py-16 text-center text-[15px] text-pt-muted">
          กำลังโหลด...
        </div>
      </div>
    );

  const appt = mine.find(
    (a) =>
      a.status !== "CANCELLED" && sameDay(new Date(a.appointment_date), today),
  );
  if (!appt) {
    const next = mine
      .filter(
        (a) => a.status === "SCHEDULED" && new Date(a.appointment_date) > today,
      )
      .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0];
    return (
      <div className="flex flex-col gap-3.5">
        {title}
        <div className="flex flex-col gap-1 rounded-[20px] bg-white px-5 py-[22px]">
          <span className="text-[18px] font-semibold">วันนี้ไม่มีนัด</span>
          <span className="text-[15px] text-pt-muted">
            {next
              ? `นัดถัดไป ${thaiDate(new Date(next.appointment_date))} ${hhmm(new Date(next.appointment_date))} น. · ${ptName(next.therapist_name)}`
              : "ยังไม่มีนัดครั้งถัดไป"}
          </span>
        </div>
      </div>
    );
  }

  const s = apptSlot(appt);
  const assess = !isTraining(appt);
  const ahead = dayAll.filter(
    (a) =>
      isTraining(a) &&
      a.patient_id !== patientId &&
      ["CHECKED_IN", "IN_PROGRESS"].includes(a.status) &&
      apptSlot(a) < s,
  ).length;
  const st = appt.status;
  const setsToday = todaySets.length;
  const trained = !assess && setsToday > 0; // ฝึกกับสเก็ตบอร์ดไปแล้วอย่างน้อย 1 เซต

  // ทำครบตามโปรแกรมแล้วหรือยัง (นับแยกแขน: ทุกแขนต้องครบ session_per_day เซต)
  const perDay = program?.session_per_day ?? 0;
  const bySide = countBySide(todaySets);
  const sidesToDo: Side[] = sides.length
    ? sides
    : (["RIGHT", "LEFT"] as Side[]).filter((sd) => bySide[sd] > 0);
  const allDone =
    !assess &&
    perDay > 0 &&
    (SETS_ARE_PER_SIDE && sidesToDo.length
      ? sidesToDo.every((sd) => bySide[sd] >= perDay)
      : setsToday >= perDay);

  // เวลานัด: ฝึกได้เฉพาะช่วงนัด (ถึงเวลาจบนัด) ถ้าเลยแล้วต้องให้เคาน์เตอร์เลื่อนนัดก่อน
  const now = new Date();
  const reached = now >= todayAt(s) || !!appt.called_at; // ถึงเวลานัด หรือถูกเรียกคิวแล้ว
  const expired = st !== "COMPLETED" && now > todayAt(slotEnd(s));
  const checkedIn = st === "CHECKED_IN" || st === "IN_PROGRESS";

  const badge =
    st === "COMPLETED"
      ? ["เสร็จสิ้นแล้ว", "#E4F5EC", "#145C38"]
      : expired
        ? [
            trained
              ? `ฝึกแล้ว ${setsToday} เซต · หมดเวลานัด`
              : "เลยเวลานัดแล้ว",
            "#EEECF2",
            "#5A566A",
          ]
        : allDone
          ? ["ฝึกครบแล้ววันนี้", "#E4F5EC", "#145C38"]
          : trained
            ? [`ฝึกแล้ว ${setsToday} เซต`, "#E4F5EC", "#145C38"]
            : st === "IN_PROGRESS"
              ? ["กำลังฝึก", "#E3EEF9", "#1F5573"]
              : st === "CHECKED_IN" && appt.called_at
                ? ["ถึงคิวแล้ว · เริ่มฝึกได้เลย", "#FFF0D9", "#8C420A"]
                : st === "CHECKED_IN" && reached
                  ? ["รอเจ้าหน้าที่เรียกคิว", "#FFF0D9", "#8C420A"]
                  : st === "CHECKED_IN"
                    ? [`ก่อนหน้าคุณ ${ahead} คน`, "#E4F5EC", "#145C38"]
                    : ["ยังไม่ได้รับคิว", "#FFF0D9", "#8C420A"];

  const steps = [
    {
      t: "รับคิว",
      sub: appt.checked_in_at
        ? `${hhmm(new Date(appt.checked_in_at))} น.`
        : "แจ้งชื่อที่เคาน์เตอร์",
    },
    { t: "รอถึงเวลา", sub: "" },
    {
      t: assess ? "พบนักกายภาพ" : "ฝึก",
      sub: trained ? `ทำแล้ว ${setsToday} เซต` : "",
    },
    { t: "เสร็จสิ้น", sub: "" },
  ];
  // จำนวนขั้นที่เสร็จแล้ว (ติ๊กเขียว) และขั้นที่กำลังทำ (วงกลมส้ม)
  const doneUpTo =
    st === "COMPLETED" || allDone
      ? 4
      : trained
        ? 3
        : st === "IN_PROGRESS"
          ? 2
          : checkedIn && reached
            ? 2
            : checkedIn
              ? 1
              : 0;
  const current = st === "COMPLETED" || allDone || expired ? -1 : doneUpTo;

  // ปุ่มฝึก: ต้องรับคิวแล้ว (หรือเคยฝึกวันนี้แล้ว) และยังไม่หมดเวลานัด
  // ครบเซตตามโปรแกรมแล้ว = ฝึกต่อไม่ได้ (กันฝึกเกินขนาดที่นักกายภาพสั่ง)
  const called =
    st === "IN_PROGRESS" || (st === "CHECKED_IN" && !!appt.called_at); // เวชเรียกคิวแล้ว
  const canTrain =
    !assess && st !== "COMPLETED" && !expired && !allDone && called;

  return (
    <div className="flex flex-col gap-3.5">
      {title}
      <div className="flex flex-col items-center gap-1.5 rounded-[20px] bg-white px-5 py-[22px] shadow-[0_1px_3px_rgba(31,29,43,0.06)]">
        <span className="text-[15px] text-pt-muted">เวลานัดของคุณ</span>
        <span className="text-[64px] font-bold leading-none text-pt-accent-ink">
          {s}
        </span>
        <span className="text-[15px] text-pt-muted">
          ถึง {slotEnd(s)} น.
          {program && !assess
            ? ` · ฝึก ${Math.round(program.duration_sec / 60)} นาที`
            : assess
              ? " · ประเมินแรกรับ"
              : ""}
        </span>
        <span
          className="mt-1.5 whitespace-nowrap rounded-full px-3.5 py-1 text-[14px] font-semibold"
          style={{ background: badge[1], color: badge[2] }}
        >
          {badge[0]}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-4">
        {steps.map((x, i) => {
          const done = i < doneUpTo;
          const cur = i === current;
          return (
            <div key={x.t}>
              {i > 0 && <div className="ml-[15px] h-3 w-0.5 bg-pt-line" />}
              <div className="flex items-center gap-3">
                {done ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F9D5C] text-white">
                    <Check size={18} strokeWidth={2.6} />
                  </div>
                ) : cur ? (
                  <div className="h-8 w-8 rounded-full border-[3px] border-pt-accent bg-white" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-pt-line" />
                )}
                <div className="flex flex-col">
                  <span
                    className={`text-[17px] font-semibold ${done ? "text-pt-ink" : cur ? "text-pt-accent-ink" : "text-pt-muted"}`}
                  >
                    {x.t}
                  </span>
                  {x.sub && (
                    <span className="text-[14px] text-pt-muted">{x.sub}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {expired && (
        <div className="flex items-start gap-3 rounded-2xl bg-white px-4 py-4">
          <Clock size={22} className="mt-0.5 shrink-0 text-pt-muted" />
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold">หมดเวลานัดแล้ว</span>
            <span className="text-[15px] text-pt-muted">
              ถ้าต้องการฝึกต่อ ติดต่อเคาน์เตอร์เพื่อเลื่อนนัด
            </span>
          </div>
        </div>
      )}

      {allDone && (
        <div className="flex items-start gap-3 rounded-2xl bg-[#E4F5EC] px-4 py-4">
          <Check
            size={22}
            className="mt-0.5 shrink-0 text-[#1F9D5C]"
            strokeWidth={2.6}
          />
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold text-[#145C38]">
              ฝึกครบตามโปรแกรมแล้ววันนี้
            </span>
            <span className="text-[15px] text-[#2E6B1A]">
              พักได้เลย ฝึกเกินกว่าที่นักกายภาพกำหนดอาจทำให้กล้ามเนื้อล้า
            </span>
          </div>
        </div>
      )}

      {canTrain && (
        <button
          type="button"
          onClick={onTrain}
          className="flex h-[60px] items-center justify-center gap-2 rounded-[16px] bg-pt-accent text-[18px] font-bold text-white active:scale-[.98]"
        >
          <PlayCircle size={22} /> {trained ? "ฝึกเซตถัดไป" : "ไปที่เครื่องฝึก"}
        </button>
      )}
    </div>
  );
}
