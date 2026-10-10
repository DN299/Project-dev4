import { useEffect, useRef, useState } from "react";
import type { Device, TherapySession, PatientProgram } from "../../types";
import { ChevronLeft } from "lucide-react";
import { api, list } from "../../lib/clinic";
import { fmtDuration } from "./patientUtils";
import {
  SIDE_LABEL,
  SETS_ARE_PER_SIDE,
  sidesFromAffected,
  suggestSide,
  countBySide,
  type Side,
} from "./Patientside";

interface Props {
  patientId: string;
  onBack: () => void;
  /** เรียกเมื่อบอร์ดบันทึกเซตเสร็จ (ตอนนี้ส่ง null: หน้าจบเซตจะอ่านผลจาก skateboard_sessions เอง ในรอบถัดไป) */
  onFinish: (session: TherapySession | null) => void;
}

/** ผลเซตที่บอร์ดบันทึก (ตาราง skateboard_sessions) */
interface SkateSession {
  id: number;
  session_count: number;
  patient_id: string | null;
  side?: Side | null;
  created_at: string;
}

/** ช่องที่ backend ส่งเพิ่มจาก /api/devices แต่ยังไม่มีใน type Device */
type LiveDevice = Device & {
  using_patient_id?: string | null;
  live_angle?: number | string | null;
  live_phase?: string | null;
};

/**
 * none      = ไม่พบเครื่องในระบบ
 * offline   = เครื่องปิดหรือไม่มีเน็ต
 * busy      = ผู้ป่วยคนอื่นกำลังฝึก
 * available = เครื่องว่าง กด "เชื่อมต่อ" ได้
 * ready     = เชื่อมต่อกับเราแล้ว กด "เริ่มเซต" ได้
 * running   = กำลังนับ กด "จบเซต" ได้
 */
type Phase = "none" | "offline" | "busy" | "available" | "ready" | "running";

/** เครื่องจริงที่ใช้ฝึก ต้องตรงกับ DEVICE_ID ในโค้ด Arduino */
const TRAINING_DEVICE_ID = "D001";
const POLL_MS = 800; // บอร์ดส่งค่าทุก 0.5 วิ
const STOP_WAIT_MS = 15000; // กดจบแล้วรอผลจากบอร์ดได้นานสุด
const ONLINE_GRACE_MS = 5000; // last_seen_at นิ่งเกินนี้ = เครื่องออฟไลน์
const TARGET_ANGLE = 90; // ต้องตรงกับ THRESHOLD ในโค้ดบอร์ด

const fetchDevice = () =>
  list<LiveDevice>("/api/devices").then(
    (ds) => ds.find((d) => d.device_id === TRAINING_DEVICE_ID) ?? null,
  );

const fetchSkateSessions = (patientId: string) =>
  list<SkateSession>(
    `/api/skateboard-sessions?patient_id=${encodeURIComponent(patientId)}`,
  );

/** ส่งคำสั่งไป backend คืนข้อความ error (null = สำเร็จ) */
async function post(
  path: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  try {
    await api(path, { method: "POST", body });
    return null;
  } catch (e) {
    return e instanceof Error && e.message
      ? e.message
      : "ติดต่อเซิร์ฟเวอร์ไม่ได้";
  }
}

const isToday = (iso: string) =>
  new Date(iso).toDateString() === new Date().toDateString();
const num = (v: unknown) => (v == null || isNaN(Number(v)) ? null : Number(v));

/** เสียงสั้นๆ + สั่น ทุกครั้งที่นับได้ ผู้ป่วยมองแขนอยู่ ไม่ได้มองจอ */
function cue() {
  try {
    navigator.vibrate?.(80);
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch {
    /* บางเบราว์เซอร์ไม่อนุญาตเสียง ไม่เป็นไร */
  }
}

/** แถบมุม: สีส้มตอนหมุนไป, สีเขียวตอนถึงเป้าแล้วหมุนกลับ */
function AngleBar({ angle, returning }: { angle: number; returning: boolean }) {
  const pct = Math.min(1, Math.max(0, angle / TARGET_ANGLE));
  return (
    <div className="flex w-full flex-col gap-2">
      <span
        className={`text-[16px] font-semibold ${returning ? "text-[#145C38]" : ""}`}
      >
        {returning ? "ถึงแล้ว หมุนกลับ" : "หมุนไปให้ถึงเป้า"}
      </span>
      <div
        className="h-4 w-full overflow-hidden rounded-full bg-pt-divider"
        role="progressbar"
        aria-label="ระยะการหมุน"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${returning ? "bg-[#1F9D5C]" : "bg-pt-accent"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function PatientTrainPage({
  patientId,
  onBack,
  onFinish,
}: Props) {
  const [program, setProgram] = useState<PatientProgram | null>(null);
  const [device, setDevice] = useState<LiveDevice | null>(null);
  const [sides, setSides] = useState<Side[]>([]);
  const [side, setSide] = useState<Side | null>(null);
  const [todaySessions, setTodaySessions] = useState<SkateSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [busyAction, setBusyAction] = useState<
    "claim" | "start" | "stop" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const baseline = useRef<Set<number> | null>(null);
  const runStartedAt = useRef<number | null>(null);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinishRef.current(null);
  };

  // ---------- ออนไลน์ = last_seen_at ยังเปลี่ยนอยู่ ----------
  const lastSeen = useRef<{
    id: string;
    value: string | null;
    at: number;
  } | null>(null);
  useEffect(() => {
    if (!device) return;
    const v = device.last_seen_at != null ? String(device.last_seen_at) : null;
    if (lastSeen.current === null || lastSeen.current.id !== device.device_id) {
      lastSeen.current = { id: device.device_id, value: v, at: 0 }; // ค่าแรกยังไม่นับว่าออนไลน์
    } else if (v !== lastSeen.current.value) {
      lastSeen.current = { id: device.device_id, value: v, at: Date.now() };
    }
  }, [device]);

  const online =
    lastSeen.current !== null &&
    Date.now() - lastSeen.current.at < ONLINE_GRACE_MS;
  const isMine = device?.using_patient_id === patientId;
  const deviceRunning = device?.live_status === "RUNNING";

  const phase: Phase = !device
    ? "none"
    : !online
      ? "offline"
      : !isMine
        ? deviceRunning
          ? "busy"
          : "available"
        : deviceRunning
          ? "running"
          : "ready";

  // ล้างสถานะ "กำลังทำ..." เมื่อบอร์ดตอบสนองแล้ว
  useEffect(() => {
    if (busyAction === "claim" && isMine) setBusyAction(null);
  }, [busyAction, isMine]);
  useEffect(() => {
    if (phase !== "running") return;
    if (busyAction === "start") setBusyAction(null);
    if (runStartedAt.current === null) runStartedAt.current = Date.now();
  }, [phase, busyAction]);

  // ---------- โหลดครั้งแรก ----------
  useEffect(() => {
    Promise.all([
      list<PatientProgram>(`/api/patient-programs?patient_id=${patientId}`),
      fetchDevice(),
      fetchSkateSessions(patientId),
      list<{ patient_id: string; affected_side?: string | null }>(
        "/api/patients?status=ALL",
      ),
    ])
      .then(([pp, d, s, patients]) => {
        setProgram(pp.find((x) => x.status === "ACTIVE") ?? null);
        setDevice(d);
        baseline.current = new Set(s.map((x) => x.id));
        const today = s.filter((x) => isToday(x.created_at));
        setTodaySessions(today);
        const mySides = sidesFromAffected(
          patients.find((p) => p.patient_id === patientId)?.affected_side,
        );
        setSides(mySides);
        setSide(suggestSide(mySides, today));
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ ลองกลับแล้วเข้าใหม่"))
      .finally(() => setLoading(false));
  }, [patientId]);

  // ---------- ตัวจับเวลา + ถามสถานะ ----------
  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed(
        runStartedAt.current ? (Date.now() - runStartedAt.current) / 1000 : 0,
      );
    }, 1000);
    const poll = setInterval(() => {
      fetchDevice()
        .then(setDevice)
        .catch(() => {});
      fetchSkateSessions(patientId)
        .then((s) => {
          if (baseline.current && s.some((x) => !baseline.current!.has(x.id)))
            finish();
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- เสียงเมื่อนับได้ ----------
  const liveReps =
    phase === "running" && typeof device?.live_reps === "number"
      ? device.live_reps
      : null;
  const prevReps = useRef<number | null>(null);
  useEffect(() => {
    if (
      liveReps != null &&
      prevReps.current != null &&
      liveReps > prevReps.current
    )
      cue();
    prevReps.current = liveReps;
  }, [liveReps]);

  // ---------- ปุ่ม ----------
  const connect = async () => {
    if (!device || busyAction) return;
    setError(null);
    setBusyAction("claim");
    const err = await post("/api/devices/claim", {
      deviceId: device.device_id,
      patientId,
    });
    if (err) {
      setError(err);
      setBusyAction(null);
      return;
    }
    fetchDevice()
      .then(setDevice)
      .catch(() => {});
  };

  const startSet = async () => {
    if (!device || busyAction) return;
    setError(null);
    setBusyAction("start");
    const err = await post("/api/devices/command", {
      deviceId: device.device_id,
      patientId,
      command: "START",
      side,
    });
    if (err) {
      setError(err);
      setBusyAction(null);
    }
  };

  const endSet = async () => {
    if (!device || busyAction) return;
    setError(null);
    setBusyAction("stop");
    const err = await post("/api/devices/command", {
      deviceId: device.device_id,
      patientId,
      command: "STOP",
    });
    if (err) {
      setError(err);
      setBusyAction(null);
      return;
    }
    setTimeout(finish, STOP_WAIT_MS); // ปกติเจอผลภายใน 2–3 วิ
  };

  const goBack = () => {
    if (device && phase === "running")
      post("/api/devices/command", {
        deviceId: device.device_id,
        patientId,
        command: "STOP",
      });
    onBack();
  };

  // ---------- ค่าที่แสดง ----------
  const done =
    side && SETS_ARE_PER_SIDE
      ? countBySide(todaySessions)[side]
      : todaySessions.length;
  const setNo = done + 1;
  const totalSets = program?.session_per_day ?? 0;
  const liveAngle = phase === "running" ? num(device?.live_angle) : null;
  const returning = device?.live_phase === "RETURN";
  const imuError = phase === "running" && device?.imu_status === "ERROR";
  const canSwitchSide =
    sides.length > 1 &&
    (phase === "available" || phase === "ready") &&
    !busyAction;

  const status = {
    none: { text: "ไม่พบเครื่องฝึก", tone: "muted" },
    offline: { text: "เครื่องปิดอยู่", tone: "muted" },
    busy: { text: "มีคนใช้อยู่", tone: "muted" },
    available: { text: "เครื่องพร้อม", tone: "warn" },
    ready: { text: "เชื่อมต่อแล้ว", tone: "ok" },
    running: { text: "เชื่อมต่อแล้ว", tone: "ok" },
  }[phase];

  const hint = loading
    ? "กำลังโหลด..."
    : phase === "none"
      ? "แจ้งนักกายภาพ"
      : phase === "offline"
        ? "เปิดเครื่องแล้วรอสักครู่"
        : phase === "busy"
          ? "รอผู้ป่วยท่านก่อนหน้าฝึกเสร็จ"
          : phase === "available"
            ? "กดเชื่อมต่อเพื่อเริ่ม"
            : phase === "ready"
              ? "พร้อมแล้ว กดเริ่มเซต"
              : busyAction === "stop"
                ? "กำลังบันทึกผล..."
                : imuError
                  ? "เซ็นเซอร์มีปัญหา แจ้งนักกายภาพ"
                  : "ทำเท่าที่ไหว";

  const primary =
    phase === "available"
      ? {
          label:
            busyAction === "claim" ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อเครื่อง",
          onClick: connect,
          filled: true,
        }
      : phase === "ready"
        ? {
            label: busyAction === "start" ? "กำลังเริ่ม..." : "เริ่มเซต",
            onClick: startSet,
            filled: true,
          }
        : phase === "running"
          ? {
              label: busyAction === "stop" ? "กำลังบันทึก..." : "จบเซต",
              onClick: endSet,
              filled: false,
            }
          : {
              label: phase === "busy" ? "รอคิว" : "รอเครื่อง",
              onClick: () => {},
              filled: false,
            };
  const primaryDisabled =
    !!busyAction || phase === "none" || phase === "offline" || phase === "busy";

  return (
    <div className="flex min-h-full flex-col gap-4 px-5 pb-7 pt-5">
      {/* หัวหน้า */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="กลับ"
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-pt-line bg-white"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex min-w-0 flex-col">
          <span className="text-[20px] font-bold">
            {phase === "running" ? "กำลังฝึก" : "เตรียมฝึก"} · เซต {setNo}
            {totalSets ? `/${totalSets}` : ""}
          </span>
          <span className="truncate text-[15px] text-pt-muted">
            {program?.program_name ?? ""}
          </span>
        </div>
      </div>

      {/* สถานะเครื่อง + แขน */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-medium ${
            status.tone === "ok"
              ? "bg-[#E4F5EC] text-[#145C38]"
              : status.tone === "warn"
                ? "bg-[#FDF0E8] text-[#8A3A0E]"
                : "bg-pt-divider text-pt-muted"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              status.tone === "ok"
                ? "bg-[#1F9D5C]"
                : status.tone === "warn"
                  ? "bg-pt-accent"
                  : "bg-[#9A95A8]"
            }`}
          />
          {status.text}
        </span>
        {side && (
          <span className="rounded-full bg-pt-divider px-3.5 py-2 text-[15px] font-semibold">
            {SIDE_LABEL[side]}
          </span>
        )}
        {canSwitchSide && side && (
          <button
            type="button"
            onClick={() => setSide(side === "RIGHT" ? "LEFT" : "RIGHT")}
            className="min-h-[44px] px-2 text-[15px] font-semibold text-pt-accent-ink underline underline-offset-4"
          >
            เปลี่ยนข้าง
          </button>
        )}
      </div>

      {/* ตัวเลขหลัก */}
      <div className="flex flex-col items-center gap-5 rounded-[20px] bg-white px-5 pb-6 pt-7 shadow-[0_1px_3px_rgba(31,29,43,0.06)]">
        <span
          className="text-[88px] font-bold leading-none tabular-nums"
          aria-live="polite"
        >
          {liveReps ?? "–"}
        </span>
        <span className="text-center text-[17px] text-pt-muted">{hint}</span>
        {liveAngle != null && (
          <AngleBar angle={liveAngle} returning={returning} />
        )}
        {error && (
          <span role="alert" className="text-center text-[15px] text-[#B42318]">
            {error}
          </span>
        )}
      </div>

      {/* เวลา (แสดงเมื่อเริ่มเซตแล้ว) */}
      {runStartedAt.current !== null && (
        <div className="flex items-baseline justify-between rounded-2xl bg-white px-5 py-4">
          <span className="text-[15px] text-pt-muted">เวลาที่ใช้</span>
          <span className="text-[24px] font-bold tabular-nums">
            {fmtDuration(elapsed)}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* ปุ่มหลัก: เชื่อมต่อ → เริ่มเซต → จบเซต */}
      <button
        type="button"
        onClick={primary.onClick}
        disabled={primaryDisabled}
        className={`h-[60px] rounded-[16px] border-2 border-pt-accent text-[18px] font-bold transition-transform active:scale-[0.98] disabled:opacity-50 ${
          primary.filled
            ? "bg-pt-accent text-white"
            : "bg-white text-pt-accent-ink"
        }`}
      >
        {primary.label}
      </button>
      {phase === "running" && (
        <span className="text-center text-[15px] text-pt-muted">
          เหนื่อยหยุดได้เลย
        </span>
      )}
    </div>
  );
}
