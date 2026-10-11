// ผลการฝึกจากสเก็ตบอร์ด (ตาราง skateboard_sessions)
// ใช้ร่วมกันทุกหน้าของผู้ป่วย ตัวเลขจะได้ตรงกันทุกหน้า

import { list } from "../../lib/clinic";
import type { Side } from "./Patientside";

export interface SkateSession {
  id: number;
  session_count: number; // จำนวนครั้งที่ทำได้ในเซตนั้น
  patient_id: string | null;
  side?: Side | null; // RIGHT | LEFT | null (เซตเก่าก่อนมีระบบแขนจะเป็น null)
  started_at?: string | null; // เวลาที่เริ่มเซต (เซตเก่าจะเป็น null)
  created_at: string; // เวลาที่จบเซต
}

/** ผลทั้งหมดของผู้ป่วย (ใหม่สุดก่อน)
 *  ไม่เอาเซตที่ได้ 0 ครั้ง (กดเริ่มแล้วหยุดเลย / ทดสอบเครื่อง) ทุกหน้าจะได้นับตรงกัน
 *  ข้อมูลยังอยู่ในฐานข้อมูลครบ นักกายภาพยังดูได้ */
export const fetchSkateSessions = (patientId: string) =>
  list<SkateSession>(
    `/api/skateboard-sessions?patient_id=${encodeURIComponent(patientId)}`,
  ).then((rows) => rows.filter((s) => (s.session_count ?? 0) > 0));

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** เซตที่ทำในวันที่กำหนด */
export const skateOnDay = (sessions: SkateSession[], day: Date) =>
  sessions.filter((s) => sameDay(new Date(s.created_at), day));

/** รวมจำนวนครั้ง */
export const totalReps = (sessions: SkateSession[]) =>
  sessions.reduce((sum, s) => sum + (s.session_count ?? 0), 0);

/** วันจันทร์ 00:00 ของสัปดาห์ที่มีวันที่กำหนด */
export function weekStart(day: Date) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** เซตในสัปดาห์ (จันทร์–อาทิตย์) ที่เริ่มจาก start */
export function skateInWeek(sessions: SkateSession[], start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return sessions.filter((s) => {
    const t = new Date(s.created_at);
    return t >= start && t < end;
  });
}

/** จำนวนครั้งรายวัน จ–อา (7 ช่อง) ใช้กับกราฟแท่ง */
export function repsByWeekday(sessions: SkateSession[], start: Date) {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const s of skateInWeek(sessions, start)) {
    out[(new Date(s.created_at).getDay() + 6) % 7] += s.session_count ?? 0;
  }
  return out;
}

/** เวลาไทยแบบสั้น เช่น "10:24 น." */
export const timeTH = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }) + " น.";

/** ช่วงเวลา เช่น "10:24 – 10:29 น." ถ้าไม่มีเวลาเริ่ม (เซตเก่า) แสดง "จบ 10:29 น." */
export function timeRangeTH(start: string | null | undefined, end: string) {
  const hm = (iso: string) =>
    new Date(iso).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Bangkok",
    });
  return start ? `${hm(start)} – ${hm(end)} น.` : `จบ ${hm(end)} น.`;
}
