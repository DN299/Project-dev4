import { useEffect, useState } from "react";
import type {
  Patient,
  PatientAppointment,
  Device,
  PatientProgram,
  PageKey,
} from "../../types";
import {
  PlayCircle,
  Wifi,
  WifiOff,
  CalendarDays,
  Flame,
  Check,
} from "lucide-react";
import {
  api,
  list,
  isTraining,
  sameDay,
  startOfDay,
  thaiDate,
  hhmm,
  ptName,
} from "../../lib/clinic";
import { ProgressRing, SetSegments } from "./patientUi";
import {
  fetchSkateSessions,
  skateOnDay,
  totalReps,
  timeTH,
  type SkateSession,
} from "./patientSkate";
import {
  SIDE_LABEL,
  SETS_ARE_PER_SIDE,
  sidesFromAffected,
  countBySide,
} from "./Patientside";

interface Props {
  patientId: string;
  onNavigate: (p: PageKey) => void;
  onLogout: () => void;
}

/** เครื่องฝึกจริง ต้องตรงกับ DEVICE_ID ในโค้ด Arduino และในหน้าฝึก */
const TRAINING_DEVICE_ID = "D001";
/** บอร์ดส่งค่าทุก 0.5 วิ ถ้า last_seen_at เก่ากว่านี้ถือว่าเครื่องปิด */
const ONLINE_WITHIN_MS = 15000;

type LiveDevice = Device & {
  using_patient_id?: string | null;
  last_seen_at?: string | null;
  live_status?: string | null;
};

export default function PatientHomePage({
  patientId,
  onNavigate,
  onLogout,
}: Props) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appts, setAppts] = useState<PatientAppointment[]>([]);
  const [device, setDevice] = useState<LiveDevice | null>(null);
  const [sessions, setSessions] = useState<SkateSession[]>([]);
  const [programs, setPrograms] = useState<PatientProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Patient[]>(`/api/patients?patient_id=${patientId}`)
        .then((r) => setPatient(r[0] ?? null))
        .catch(() => {}),
      list<PatientAppointment>(
        `/api/appointments?patient_id=${patientId}`,
      ).then(setAppts),
      list<LiveDevice>("/api/devices").then((ds) =>
        setDevice(ds.find((d) => d.device_id === TRAINING_DEVICE_ID) ?? null),
      ),
      fetchSkateSessions(patientId).then(setSessions),
      list<PatientProgram>(
        `/api/patient-programs?patient_id=${patientId}`,
      ).then(setPrograms),
    ]).finally(() => setLoading(false));
  }, [patientId]);

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-[18px] font-bold">ALS Rehab</span>
        <span className="text-[14px] text-pt-muted">
          ระบบติดตามการฝึกและนัดหมาย
        </span>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="h-11 rounded-[10px] border border-[#E4E0EC] bg-white px-4 text-[15px]"
      >
        ออกจากระบบ
      </button>
    </div>
  );

  if (loading)
    return (
      <div className="flex flex-col gap-3">
        {header}
        <div className="py-16 text-center text-[15px] text-pt-muted">
          กำลังโหลด...
        </div>
      </div>
    );
  if (!patient)
    return (
      <div className="flex flex-col gap-3">
        {header}
        <div className="py-16 text-center text-[16px] font-semibold">
          ไม่พบข้อมูลผู้ป่วย
        </div>
      </div>
    );

  const now = new Date();
  const today = startOfDay(now);
  const training = appts.filter(isTraining);
  const todayAppt = training.find(
    (a) =>
      a.status !== "CANCELLED" && sameDay(new Date(a.appointment_date), today),
  );
  const nextAppt = training
    .filter(
      (a) => a.status === "SCHEDULED" && new Date(a.appointment_date) > now,
    )
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0];
  // มาตามนัด: นัดฝึกที่ถึงกำหนดแล้ว (ไม่นับที่ยกเลิก) เทียบกับครั้งที่มาจริง
  const due = training.filter(
    (a) =>
      a.status !== "CANCELLED" &&
      (new Date(a.appointment_date) < today ||
        ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(a.status)),
  );
  const came = due.filter((a) =>
    ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(a.status),
  ).length;
  const firstName = (patient.first_name ?? "").trim() || patient.patient_id;

  // ---------- สถานะเครื่องฝึก (D001) ----------
  const seenAt = device?.last_seen_at
    ? new Date(device.last_seen_at).getTime()
    : 0;
  const online = !!device && Date.now() - seenAt < ONLINE_WITHIN_MS;
  const mine = online && device?.using_patient_id === patientId;
  const busy = online && !mine && device?.live_status === "RUNNING";
  const deviceText = !device
    ? "ไม่พบเครื่อง"
    : !online
      ? "เครื่องปิดอยู่"
      : mine
        ? "เชื่อมต่อกับคุณ"
        : busy
          ? "มีคนใช้อยู่"
          : "เครื่องพร้อม";
  const deviceTone = mine ? "ok" : online && !busy ? "warn" : "muted";

  // ---------- ความคืบหน้าวันนี้ (จากสเก็ตบอร์ด) ----------
  const active = programs.filter((p) => p.status === "ACTIVE");
  const program = active[0];
  const sides = sidesFromAffected(
    (patient as Patient & { affected_side?: string | null }).affected_side,
  );
  const perSide = program?.session_per_day ?? 0;
  const totalSets =
    SETS_ARE_PER_SIDE && sides.length > 1 ? perSide * sides.length : perSide;
  const today_ = skateOnDay(sessions, now).slice().reverse(); // เก่าก่อน → เซต 1, 2, ...
  const setsToday = today_.length;
  const repsToday = totalReps(today_);
  const bySide = countBySide(today_);

  return (
    <div className="flex flex-col gap-3">
      {header}
      <div className="mt-1 flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[22px] font-bold">สวัสดี, {firstName}</span>
          <span className="text-[14px] text-pt-muted">
            รหัสผู้ป่วย: {patient.patient_id}
          </span>
        </div>
        {due.length > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-[#FFF0D9] px-3 py-1.5 text-[14px] font-semibold text-[#8C420A]">
            <Flame size={15} />{" "}
            {came === due.length
              ? "มาตามนัดครบ"
              : `มาตามนัด ${came}/${due.length}`}
          </div>
        )}
      </div>

      {/* วงแหวนเซตวันนี้ */}
      <div className="flex flex-col items-center gap-2">
        <ProgressRing
          size={160}
          stroke={12}
          pct={totalSets ? setsToday / totalSets : 0}
        >
          <span className="text-[34px] font-bold leading-tight">
            {Math.min(setsToday, totalSets || setsToday)}/{totalSets || "–"}
          </span>
          <span className="text-[14px] text-pt-muted">เซตวันนี้</span>
        </ProgressRing>
        <span className="text-[15px] text-pt-muted">
          วันนี้ทำได้ {repsToday} ครั้ง
          {sides.length > 1 &&
            ` · ${SIDE_LABEL.RIGHT} ${bySide.RIGHT}/${perSide} · ${SIDE_LABEL.LEFT} ${bySide.LEFT}/${perSide}`}
        </span>
      </div>

      {/* โปรแกรมวันนี้ */}
      <div className="flex flex-col gap-3 rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(31,29,43,0.06)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] text-pt-muted">โปรแกรมฝึกวันนี้</span>
          {program ? (
            <>
              <span className="text-[18px] font-bold">
                {active.map((p) => p.program_name).join(" · ")}
              </span>
              <span className="text-[14px] text-pt-muted">
                {perSide} เซต{sides.length > 1 ? "ต่อข้าง" : ""} ·{" "}
                {Math.round(program.duration_sec / 60)} นาที · ทำเท่าที่ไหว
              </span>
            </>
          ) : (
            <span className="text-[15px] text-pt-muted">
              ยังไม่มีโปรแกรม นักกายภาพจะกำหนดให้
            </span>
          )}
        </div>
        {program && (
          <>
            <SetSegments done={setsToday} total={totalSets} />
            {today_.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-[10px] bg-pt-bg px-3 py-2.5 text-[15px]"
              >
                <Check size={18} strokeWidth={2.4} className="text-[#1F9D5C]" />
                <span>
                  เซต {i + 1}
                  {s.side ? ` · ${SIDE_LABEL[s.side]}` : ""}:{" "}
                  <span className="font-semibold">{s.session_count} ครั้ง</span>{" "}
                  · {timeTH(s.created_at)}
                </span>
              </div>
            ))}
          </>
        )}
        <button
          type="button"
          onClick={() => onNavigate("patient-queue")}
          className="flex h-[56px] items-center justify-center gap-2 rounded-[14px] bg-pt-accent text-[17px] font-semibold text-white active:scale-[.98]"
        >
          <PlayCircle size={20} /> ดูคิวของฉันวันนี้
        </button>
      </div>

      {/* การ์ดเครื่องฝึก + นัด */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-3.5 py-3">
          {online ? (
            <Wifi
              size={20}
              className={
                deviceTone === "ok" ? "text-[#1F9D5C]" : "text-[#8C420A]"
              }
            />
          ) : (
            <WifiOff size={20} className="text-pt-muted" />
          )}
          <span
            className={`text-[15px] font-semibold ${
              deviceTone === "ok"
                ? "text-[#145C38]"
                : deviceTone === "warn"
                  ? "text-[#8C420A]"
                  : "text-pt-muted"
            }`}
          >
            {deviceText}
          </span>
          <span className="text-[14px] text-pt-muted">
            {device ? device.device_name || device.device_id : "แจ้งนักกายภาพ"}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-3.5 py-3">
          <CalendarDays size={20} className="text-[#2A6F97]" />
          <span className="text-[15px] font-semibold leading-snug text-[#1F5573]">
            {todayAppt
              ? `นัดวันนี้ ${hhmm(new Date(todayAppt.appointment_date))}`
              : nextAppt
                ? thaiDate(new Date(nextAppt.appointment_date))
                : "ยังไม่มีนัด"}
          </span>
          <span className="text-[14px] text-pt-muted">
            {todayAppt
              ? ptName(todayAppt.therapist_name)
              : nextAppt
                ? `${hhmm(new Date(nextAppt.appointment_date))} น. · ${ptName(nextAppt.therapist_name)}`
                : "นัดถัดไปจะแสดงที่นี่"}
          </span>
        </div>
      </div>
    </div>
  );
}
