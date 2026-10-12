import { useEffect, useRef, useState } from "react";
import type { Device, TherapySession, PatientProgram } from "../../types";
import { ChevronLeft, Check, AlertTriangle } from "lucide-react";
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
  /** ไม่ใช้แล้ว (จบเซตแล้วแสดงผลในหน้านี้เลย) เก็บไว้เพื่อไม่ให้ไฟล์ที่เรียกหน้านี้ error */
  onFinish?: (session: TherapySession | null) => void;
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
  set_started_at?: string | null; // เวลาเริ่มเซตจากฐานข้อมูล
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

/**
 * กระต่ายเก็บแครอท (แทนแถบมุมเดิม)
 * หมุนแขนออก = กระต่ายเดินจากโพรงไปหาแครอท · ถึง 90° = หยิบแครอทแล้วหันกลับ
 * หมุนกลับถึงจุดเริ่ม = บอร์ดนับ 1 ครั้ง = แครอทในตะกร้าเพิ่ม 1
 * ตำแหน่งมาจากมุมจริงของบอร์ด, ขาไป/ขากลับมาจาก live_phase ของบอร์ด
 */
const RABBIT_X0 = 60; // ตำแหน่งที่โพรง (มุม 0°)
const RABBIT_X1 = 262; // ตำแหน่งที่แครอท (มุม 90°)

function RabbitTrack({
  angle,
  returning,
  reps,
}: {
  angle: number;
  returning: boolean;
  reps: number;
}) {
  const pct = Math.min(1, Math.max(0, angle / TARGET_ANGLE));
  const x = RABBIT_X0 + (RABBIT_X1 - RABBIT_X0) * pct;
  const say = returning
    ? "ได้แครอทแล้ว หมุนกลับบ้าน"
    : pct > 0.66
      ? "อีกนิดเดียว"
      : "หมุนไปเก็บแครอท";
  const move = "transform 0.7s ease-out"; // บอร์ดส่งค่าทุก 0.5–0.8 วิ ให้เดินนุ่มๆ ระหว่างค่า
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span
        className={`text-[18px] font-semibold ${returning ? "text-[#145C38]" : ""}`}
        aria-live="polite"
      >
        {say}
      </span>
      <svg
        viewBox="0 0 320 120"
        className="block h-auto w-full"
        role="img"
        aria-label={`แขนหมุนไปแล้ว ${Math.round(pct * 100)} เปอร์เซ็นต์ของเป้า`}
      >
        {/* พื้นหญ้า + โพรง */}
        <rect x="0" y="92" width="320" height="28" rx="14" fill="#CFE8C4" />
        <ellipse cx="34" cy="94" rx="26" ry="10" fill="#8C6A4A" />
        <ellipse cx="34" cy="92" rx="20" ry="7" fill="#5B4330" />
        {/* แครอทที่ปลายทาง (หายไปตอนกระต่ายถืออยู่) */}
        {!returning && (
          <g transform="translate(290 60)">
            <path d="M-9 0 L9 0 L0 32 Z" fill="#F08A24" />
            <path
              d="M-5 8 L3 8 M-3 16 L2 16"
              stroke="#C96A12"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M0 0 C-10 -14 -14 -16 -16 -18 M0 0 C0 -14 2 -18 0 -22 M0 0 C8 -12 12 -14 16 -16"
              stroke="#3E9B3A"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
        {/* กระต่าย */}
        <g style={{ transform: `translate(${x}px, 0px)`, transition: move }}>
          <g
            style={{
              transform: `scaleX(${returning ? -1 : 1})`,
              transition: "transform 0.2s",
            }}
          >
            <ellipse
              cx="6"
              cy="38"
              rx="6"
              ry="20"
              fill="#fff"
              stroke="#BDB6CC"
              strokeWidth="2"
              transform="rotate(-10 6 38)"
            />
            <ellipse
              cx="18"
              cy="38"
              rx="6"
              ry="20"
              fill="#fff"
              stroke="#BDB6CC"
              strokeWidth="2"
              transform="rotate(12 18 38)"
            />
            <ellipse
              cx="6"
              cy="40"
              rx="2.5"
              ry="12"
              fill="#F6B9C6"
              transform="rotate(-10 6 40)"
            />
            <ellipse
              cx="18"
              cy="40"
              rx="2.5"
              ry="12"
              fill="#F6B9C6"
              transform="rotate(12 18 40)"
            />
            <ellipse
              cx="-6"
              cy="78"
              rx="24"
              ry="17"
              fill="#fff"
              stroke="#BDB6CC"
              strokeWidth="2"
            />
            <circle
              cx="-30"
              cy="74"
              r="7"
              fill="#fff"
              stroke="#BDB6CC"
              strokeWidth="2"
            />
            <circle
              cx="12"
              cy="62"
              r="15"
              fill="#fff"
              stroke="#BDB6CC"
              strokeWidth="2"
            />
            <circle cx="18" cy="59" r="2.6" fill="#1F1D2B" />
            <circle cx="26" cy="65" r="2.4" fill="#F28CA3" />
            <ellipse
              cx="4"
              cy="94"
              rx="9"
              ry="4"
              fill="#fff"
              stroke="#BDB6CC"
              strokeWidth="2"
            />
            {returning && (
              <g transform="translate(30 70) rotate(-60)">
                <path d="M-6 0 L6 0 L0 22 Z" fill="#F08A24" />
                <path
                  d="M0 0 C-6 -8 -8 -10 -10 -11 M0 0 C6 -8 8 -9 10 -10"
                  stroke="#3E9B3A"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        </g>
      </svg>
      {/* ตะกร้าแครอท = จำนวนครั้งที่ทำได้ */}
      {reps > 0 && (
        <span
          className="text-center text-[22px] leading-snug"
          aria-label={`เก็บแครอทได้ ${reps} อัน`}
        >
          {"🥕".repeat(Math.min(reps, 10))}
          {reps > 10 && (
            <span className="ml-1 text-[16px] font-semibold text-pt-muted">
              +{reps - 10}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export default function PatientTrainPage({ patientId, onBack }: Props) {
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
  const [lastSet, setLastSet] = useState<SkateSession | null>(null); // เซตที่เพิ่งจบ → แสดงหน้าผล
  const [confirmEnd, setConfirmEnd] = useState(false); // ถามยืนยันเมื่อจบก่อนครบเวลา

  const baseline = useRef<Set<number> | null>(null);
  const runStartedAt = useRef<number | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeUpCued = useRef(false);
  const sidesRef = useRef<Side[]>([]);
  sidesRef.current = sides;

  /** บอร์ดบันทึกเซตใหม่แล้ว → แสดงผลในหน้านี้ แล้วเตรียมเซตถัดไป */
  const onNewSet = (fresh: SkateSession[]) => {
    fresh.forEach((x) => baseline.current?.add(x.id));
    const newest = fresh.reduce((a, b) =>
      a.created_at > b.created_at ? a : b,
    );
    if (stopTimer.current) clearTimeout(stopTimer.current);
    runStartedAt.current = null;
    timeUpCued.current = false;
    setElapsed(0);
    setBusyAction(null);
    setConfirmEnd(false);
    setLastSet(newest);
    setTodaySessions((prev) => {
      // เซตที่ได้ 0 ครั้งไม่นับ (ตรงกับหน้าอื่น)
      const next = [
        ...prev,
        ...fresh.filter((x) => isToday(x.created_at) && x.session_count > 0),
      ];
      setSide(suggestSide(sidesRef.current, next)); // เสนอข้างที่ยังทำน้อยกว่าสำหรับเซตถัดไป
      return next;
    });
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
    // ใช้เวลาเริ่มจากฐานข้อมูลก่อน → รีเฟรชหน้า/เน็ตหลุดแล้วกลับมา เวลายังต่อจากเดิม
    const srv = device?.set_started_at
      ? Date.parse(device.set_started_at)
      : NaN;
    if (!isNaN(srv)) runStartedAt.current = srv;
    else if (runStartedAt.current === null) runStartedAt.current = Date.now();
  }, [phase, busyAction, device?.set_started_at]);

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
        const today = s.filter(
          (x) => isToday(x.created_at) && x.session_count > 0,
        );
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
        runStartedAt.current
          ? Math.max(0, (Date.now() - runStartedAt.current) / 1000)
          : 0,
      );
    }, 1000);
    const poll = setInterval(() => {
      fetchDevice()
        .then(setDevice)
        .catch(() => {});
      fetchSkateSessions(patientId)
        .then((s) => {
          if (!baseline.current) return;
          const fresh = s.filter((x) => !baseline.current!.has(x.id));
          if (fresh.length) onNewSet(fresh);
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

  // กดจบเซต: ถ้ายังไม่ครบเวลา ถามยืนยันก่อน (ไม่ล็อกปุ่ม เพราะผู้ป่วยอาจเหนื่อยหรือปวด)
  const endSet = () => {
    if (!device || busyAction) return;
    if (!timeUp && targetSec > 0) setConfirmEnd(true);
    else doEndSet();
  };

  const doEndSet = async () => {
    if (!device || busyAction) return;
    setConfirmEnd(false);
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
    // ปกติได้ผลภายใน 2–3 วิ ถ้านานเกินให้บอกผู้ป่วย
    stopTimer.current = setTimeout(() => {
      setBusyAction(null);
      setError(
        "ยังไม่ได้รับผลจากเครื่อง ผลจะขึ้นในหน้าผลการฝึกเมื่อเครื่องส่งมา",
      );
    }, STOP_WAIT_MS);
  };

  const backLocked = phase === "running" || busyAction === "stop";

  // กันออกจากหน้าระหว่างฝึก: ปุ่ม Back ของเบราว์เซอร์, ปัดย้อนกลับบนมือถือ, รีเฟรช/ปิดแท็บ
  const [leaveWarn, setLeaveWarn] = useState(false);
  useEffect(() => {
    if (!backLocked) return;
    // ใส่ประวัติหลอกไว้ 1 ชั้น พอกด Back จะเด้งกลับมาหน้านี้แทนการออก
    window.history.pushState({ trainLock: true }, "");
    const onPop = () => {
      window.history.pushState({ trainLock: true }, "");
      setLeaveWarn(true);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // เบราว์เซอร์จะถามยืนยันเองตอนรีเฟรช/ปิดแท็บ
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onUnload);
      if (window.history.state?.trainLock) window.history.back(); // เอาประวัติหลอกออก
    };
  }, [backLocked]);
  useEffect(() => {
    if (!leaveWarn) return;
    const t = setTimeout(() => setLeaveWarn(false), 3000);
    return () => clearTimeout(t);
  }, [leaveWarn]);

  const goBack = () => {
    if (backLocked) return; // กำลังฝึกอยู่ กลับไม่ได้ ต้องกดจบเซตก่อน
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
  // เซ็นเซอร์มีปัญหา (บอร์ดส่ง imu_status = ERROR) ดูเฉพาะตอนเครื่องออนไลน์ ค่าเก่าตอนออฟไลน์ไม่นับ
  const imuError =
    (phase === "available" || phase === "ready" || phase === "running") &&
    device?.imu_status === "ERROR";
  // ข้างที่ทำครบตามโปรแกรมแล้ว เลือกไม่ได้อีก
  const sideFull = (sd: Side) =>
    SETS_ARE_PER_SIDE &&
    totalSets > 0 &&
    countBySide(todaySessions)[sd] >= totalSets;
  const otherSide: Side | null = side
    ? side === "RIGHT"
      ? "LEFT"
      : "RIGHT"
    : null;
  const canSwitchSide =
    sides.length > 1 &&
    !!otherSide &&
    !sideFull(otherSide) &&
    (phase === "available" || phase === "ready") &&
    !busyAction;

  // ข้างที่เลือกอยู่ครบแล้ว แต่อีกข้างยังไม่ครบ → สลับไปข้างที่ยังไม่ครบให้เอง
  useEffect(() => {
    if (phase === "running" || !side || !otherSide) return;
    if (sideFull(side) && sides.includes(otherSide) && !sideFull(otherSide))
      setSide(otherSide);
  }, [side, todaySessions, totalSets, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // นับถอยหลังจากเวลาฝึกในโปรแกรม (ไม่มีเวลาในโปรแกรม = นับเวลาที่ใช้แทน)
  const targetSec = program?.duration_sec ?? 0;
  const started = runStartedAt.current !== null;
  const remainingSec = Math.max(0, targetSec - elapsed);
  const timeUp = targetSec > 0 && started && remainingSec === 0;

  // เตือนด้วยเสียง/สั่น เมื่อเซ็นเซอร์เริ่มมีปัญหาระหว่างฝึก
  const imuCued = useRef(false);
  useEffect(() => {
    if (imuError && phase === "running" && !imuCued.current) {
      imuCued.current = true;
      cue();
      setTimeout(cue, 250);
    }
    if (!imuError) imuCued.current = false;
  }, [imuError, phase]);

  // ส่งเสียงครั้งเดียวเมื่อครบเวลา
  useEffect(() => {
    if (timeUp && !timeUpCued.current) {
      timeUpCued.current = true;
      cue();
    }
  }, [timeUp]);

  // ทำครบทุกข้างตามโปรแกรมแล้วหรือยัง
  const bySide = countBySide(todaySessions);
  const sidesToDo: Side[] = sides.length ? sides : side ? [side] : [];
  const allDone =
    totalSets > 0 &&
    (SETS_ARE_PER_SIDE && sidesToDo.length
      ? sidesToDo.every((sd) => bySide[sd] >= totalSets)
      : todaySessions.length >= totalSets);

  // ครบเซตตามโปรแกรมแล้ว: เริ่มเซตใหม่ไม่ได้ (กันฝึกเกินขนาดที่นักกายภาพสั่ง)
  const lockedDone = allDone && (phase === "available" || phase === "ready");

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
    : lockedDone
      ? "ทำครบตามโปรแกรมแล้ว พักได้เลย"
      : phase === "none"
        ? "แจ้งนักกายภาพ"
        : phase === "offline"
          ? "เปิดเครื่องแล้วรอสักครู่"
          : phase === "busy"
            ? "รอผู้ป่วยท่านก่อนหน้าฝึกเสร็จ"
            : phase === "available"
              ? "กดเชื่อมต่อเพื่อเริ่ม"
              : phase === "ready"
                ? imuError
                  ? "รอเซ็นเซอร์กลับมาปกติ"
                  : "พร้อมแล้ว กดเริ่มเซต"
                : busyAction === "stop"
                  ? "กำลังบันทึกผล..."
                  : imuError
                    ? "เซ็นเซอร์มีปัญหา แจ้งนักกายภาพ"
                    : "ทำเท่าที่ไหว";

  const primary = lockedDone
    ? { label: "ฝึกครบแล้ววันนี้", onClick: () => {}, filled: false }
    : phase === "available"
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
    !!busyAction ||
    phase === "none" ||
    phase === "offline" ||
    phase === "busy" ||
    lockedDone ||
    (imuError && phase === "ready"); // เซ็นเซอร์เสีย ห้ามเริ่มเซต (นับไม่ได้) แต่ยังกดจบเซตได้เสมอ

  // ---------- หน้าผลหลังจบเซต ----------
  if (lastSet) {
    const lastSide = lastSet.side ?? null;
    const lastNo =
      lastSide && SETS_ARE_PER_SIDE ? bySide[lastSide] : todaySessions.length;
    return (
      <div className="flex min-h-full flex-col gap-4 px-5 pb-7 pt-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#E4F5EC] text-[#1F9D5C]">
            <Check size={38} strokeWidth={2.6} />
          </div>
          <span className="text-[22px] font-bold">
            {lastSet.session_count === 0
              ? "เซตนี้ยังไม่ได้นับ"
              : allDone
                ? "ฝึกครบแล้ววันนี้"
                : `เซต ${lastNo} เสร็จแล้ว`}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 rounded-[20px] bg-white px-5 py-6 shadow-[0_1px_3px_rgba(31,29,43,0.06)]">
          <span className="text-[72px] font-bold leading-none tabular-nums">
            {lastSet.session_count}
          </span>
          <span className="text-[17px] text-pt-muted">
            {lastSet.session_count === 0 ? "ไม่นับเป็นเซต · " : ""}ครั้ง
            {lastSide ? ` · ${SIDE_LABEL[lastSide]}` : ""}
          </span>
        </div>

        {totalSets > 0 && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-white px-5 py-4">
            <span className="text-[16px] font-semibold">ความคืบหน้าวันนี้</span>
            {(SETS_ARE_PER_SIDE && sidesToDo.length ? sidesToDo : [null]).map(
              (sd) => {
                const n = sd ? bySide[sd] : todaySessions.length;
                return (
                  <div key={sd ?? "all"} className="flex items-center gap-3">
                    {sd && (
                      <span className="w-[72px] shrink-0 text-[15px] text-pt-muted">
                        {SIDE_LABEL[sd]}
                      </span>
                    )}
                    <div className="flex flex-1 gap-1.5">
                      {Array.from({ length: totalSets }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2.5 flex-1 rounded-full ${i < n ? "bg-pt-accent" : "bg-pt-divider"}`}
                        />
                      ))}
                    </div>
                    <span className="w-[44px] shrink-0 text-right text-[15px] font-semibold tabular-nums">
                      {Math.min(n, totalSets)}/{totalSets}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        )}

        <div className="flex-1" />

        {!allDone && (
          <button
            type="button"
            onClick={() => setLastSet(null)}
            className="h-[60px] rounded-[16px] bg-pt-accent text-[18px] font-bold text-white active:scale-[0.98]"
          >
            ฝึกเซตถัดไป{side ? ` · ${SIDE_LABEL[side]}` : ""}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className={`h-[60px] rounded-[16px] text-[18px] font-bold active:scale-[0.98] ${
            allDone
              ? "bg-pt-accent text-white"
              : "border-2 border-pt-accent bg-white text-pt-accent-ink"
          }`}
        >
          {allDone ? "เสร็จแล้ว" : "พักก่อน"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 px-5 pb-7 pt-5">
      {/* หัวหน้า */}
      <div className="flex items-center gap-3">
        {/* ระหว่างฝึก/กำลังบันทึก ปุ่มกลับเป็นสีเทากดไม่ได้ กันเผลอกด ต้องกด "จบเซต" ก่อน */}
        <button
          type="button"
          onClick={goBack}
          disabled={backLocked}
          aria-label="กลับ"
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-pt-line bg-white disabled:border-transparent disabled:bg-pt-divider disabled:text-[#B9B5C4]"
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

      {/* แจ้งเตือนเซ็นเซอร์มีปัญหา */}
      {imuError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border-2 border-[#F4B4AE] bg-[#FDECEA] px-4 py-3.5"
        >
          <AlertTriangle size={24} className="mt-0.5 shrink-0 text-[#B42318]" />
          <div className="flex flex-col">
            <span className="text-[17px] font-bold text-[#B42318]">
              เซ็นเซอร์มีปัญหา
            </span>
            <span className="text-[15px] text-[#7A271A]">
              {phase === "running"
                ? "เครื่องอาจนับไม่ได้ หยุดพักแล้วแจ้งนักกายภาพ"
                : "ยังเริ่มเซตไม่ได้ แจ้งนักกายภาพให้ตรวจเครื่อง"}
            </span>
          </div>
        </div>
      )}

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
          <RabbitTrack
            angle={liveAngle}
            returning={returning}
            reps={liveReps ?? 0}
          />
        )}
        {error && (
          <span role="alert" className="text-center text-[15px] text-[#B42318]">
            {error}
          </span>
        )}
      </div>

      {/* เวลา: นับถอยหลังจากเวลาฝึกในโปรแกรม */}
      {(targetSec > 0 || started) && (
        <div
          className={`flex items-baseline justify-between rounded-2xl px-5 py-4 ${timeUp ? "bg-[#E4F5EC]" : "bg-white"}`}
        >
          <span
            className={`text-[15px] ${timeUp ? "font-semibold text-[#145C38]" : "text-pt-muted"}`}
          >
            {timeUp
              ? "ครบเวลาแล้ว"
              : targetSec > 0
                ? started
                  ? "เหลือเวลา"
                  : "เวลาฝึก"
                : "เวลาที่ใช้"}
          </span>
          <span
            className={`text-[28px] font-bold tabular-nums ${timeUp ? "text-[#145C38]" : ""}`}
          >
            {targetSec > 0
              ? fmtDuration(started ? remainingSec : targetSec)
              : fmtDuration(elapsed)}
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
          {timeUp ? "กดจบเซตเพื่อบันทึกผล" : "เหนื่อยหยุดได้เลย"}
        </span>
      )}

      {/* เตือนเมื่อพยายามออกระหว่างฝึก */}
      {leaveWarn && (
        <div
          role="alert"
          className="fixed inset-x-4 top-4 z-50 mx-auto max-w-[420px] rounded-2xl bg-[#1F1D2B] px-4 py-3.5 text-center text-[16px] font-semibold text-white shadow-lg"
        >
          กำลังฝึกอยู่ กด "จบเซต" ก่อนออกจากหน้านี้
        </div>
      )}

      {/* ถามยืนยันเมื่อจะจบก่อนครบเวลา */}
      {confirmEnd && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-[20px] bg-white p-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-[20px] font-bold">ยังไม่ครบเวลา</span>
              <span className="text-[16px] text-pt-muted">
                เหลืออีก {fmtDuration(remainingSec)} จะจบเซตเลยไหม
                <br />
                ถ้าเหนื่อยหรือปวด จบได้เลย
              </span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmEnd(false)}
              className="h-[56px] rounded-[14px] bg-pt-accent text-[17px] font-bold text-white"
            >
              ฝึกต่อ
            </button>
            <button
              type="button"
              onClick={doEndSet}
              className="h-[56px] rounded-[14px] border-2 border-pt-accent bg-white text-[17px] font-bold text-pt-accent-ink"
            >
              จบเซต
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
