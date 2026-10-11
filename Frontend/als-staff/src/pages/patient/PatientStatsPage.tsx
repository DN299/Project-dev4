import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PatientProgram } from "../../types";
import {
  list,
  addDays,
  mondayOf,
  sameDay,
  dayMonth,
  thaiShort,
  DOWS,
} from "../../lib/clinic";
import {
  fetchSkateSessions,
  skateOnDay,
  totalReps,
  timeRangeTH,
  type SkateSession,
} from "./patientSkate";
import { SIDE_LABEL, type Side } from "./Patientside";

interface Props {
  patientId: string;
}

const WEEKDAY_MON_FIRST = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

// สีของแต่ละแขน ใช้ตรงกันทั้งการ์ด กราฟ และป้ายในรายการ
const SIDE_COLOR: Record<Side, { bar: string; tint: string; ink: string }> = {
  RIGHT: { bar: "#C4532A", tint: "#FBE7DD", ink: "#8A3A0E" },
  LEFT: { bar: "#2C7A8C", tint: "#DDF0F3", ink: "#1C5562" },
};
const SIDES: Side[] = ["RIGHT", "LEFT"];

/** ค่าเฉลี่ยครั้งต่อเซต (ไว้ดูการฟื้นตัว เพราะจำนวนเซตแต่ละวันไม่เท่ากัน) */
const avgPerSet = (ss: SkateSession[]) =>
  ss.length ? totalReps(ss) / ss.length : 0;

export default function PatientStatsPage({ patientId }: Props) {
  const [sessions, setSessions] = useState<SkateSession[]>([]);
  const [programs, setPrograms] = useState<PatientProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [wk, setWk] = useState(0);

  useEffect(() => {
    Promise.all([
      fetchSkateSessions(patientId).then(setSessions),
      list<PatientProgram>(
        `/api/patient-programs?patient_id=${patientId}`,
      ).then(setPrograms),
    ]).finally(() => setLoading(false));
  }, [patientId]);

  if (loading)
    return (
      <div className="py-16 text-center text-[15px] text-pt-muted">
        กำลังโหลด...
      </div>
    );

  const now = new Date();
  const mon = addDays(mondayOf(now), wk * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const prevDays = days.map((d) => addDays(d, -7));

  // แขนที่มีข้อมูล (ผู้ป่วยฝึกข้างเดียวจะเห็นแค่ข้างเดียว)
  const sidesUsed = SIDES.filter((sd) => sessions.some((x) => x.side === sd));
  const showSides = sidesUsed.length > 0;
  const ofSide = (ss: SkateSession[], sd: Side) =>
    ss.filter((x) => x.side === sd);

  // ผลของสัปดาห์ที่ดู / สัปดาห์ก่อนหน้า
  const week = days.flatMap((d) => skateOnDay(sessions, d));
  const prevWeek = prevDays.flatMap((d) => skateOnDay(sessions, d));

  // กราฟ: จำนวนครั้งต่อวัน แยกแขน
  const daily = days.map((d) => {
    const ss = skateOnDay(sessions, d);
    return {
      RIGHT: totalReps(ofSide(ss, "RIGHT")),
      LEFT: totalReps(ofSide(ss, "LEFT")),
      all: totalReps(ss),
    };
  });
  const mx = Math.max(
    1,
    ...daily.flatMap((x) =>
      showSides ? sidesUsed.map((sd) => x[sd]) : [x.all],
    ),
  );

  // รายการแยกตามวัน: วันล่าสุดอยู่บน, ในวันเรียงตามเวลา
  const groups = days
    .map((d) => ({ d, sets: skateOnDay(sessions, d).slice().reverse() }))
    .filter((g) => g.sets.length > 0)
    .reverse();
  /** เลขเซตนับแยกแขน (แขนขวาเซต 1, แขนซ้ายเซต 1) ให้ตรงกับหน้าฝึก */
  const setNumber = (arr: SkateSession[], i: number) => {
    const sd = arr[i].side;
    return sd ? arr.slice(0, i + 1).filter((x) => x.side === sd).length : i + 1;
  };
  const yesterday = addDays(now, -1);
  const dayTitle = (d: Date) =>
    sameDay(d, now)
      ? `วันนี้ · ${dayMonth(d)}`
      : sameDay(d, yesterday)
        ? `เมื่อวาน · ${dayMonth(d)}`
        : `${DOWS[d.getDay()]} ${dayMonth(d)}`;

  const firstDay = [
    ...sessions.map((s) => s.created_at),
    ...programs.map((p) => p.assigned_date),
  ]
    .filter(Boolean)
    .sort()[0];

  /** การ์ดสรุปของแต่ละแขน: รวมครั้ง, เซต, เฉลี่ยต่อเซต, เทียบสัปดาห์ก่อน */
  const sideCard = (sd: Side) => {
    const cur = ofSide(week, sd);
    const prev = ofSide(prevWeek, sd);
    const a = avgPerSet(cur);
    const b = avgPerSet(prev);
    const diff = cur.length && prev.length ? a - b : null;
    const c = SIDE_COLOR[sd];
    return (
      <div
        key={sd}
        className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-3.5"
        style={{ borderTop: `4px solid ${c.bar}` }}
      >
        <span className="text-[15px] font-semibold" style={{ color: c.ink }}>
          {SIDE_LABEL[sd]}
        </span>
        <span className="text-[26px] font-bold leading-tight">
          {totalReps(cur)} ครั้ง
        </span>
        <span className="text-[14px] text-pt-muted">
          {cur.length} เซต · เฉลี่ย {a.toFixed(1)} ครั้ง/เซต
        </span>
        {diff !== null && (
          <span
            className={`text-[14px] font-semibold ${diff > 0 ? "text-[#145C38]" : diff < 0 ? "text-[#B42318]" : "text-pt-muted"}`}
          >
            {diff > 0 ? "▲" : diff < 0 ? "▼" : "•"}{" "}
            {diff === 0
              ? "เท่าสัปดาห์ก่อน"
              : `${Math.abs(diff).toFixed(1)} จากสัปดาห์ก่อน`}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[22px] font-bold">ผลการฝึก</span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="สัปดาห์ก่อน"
          onClick={() => setWk(wk - 1)}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E4E0EC] bg-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="flex-1 text-center text-[16px] font-semibold">
          {wk === 0 ? "สัปดาห์นี้ · " : ""}
          {dayMonth(mon)} – {dayMonth(days[6])}
        </span>
        <button
          type="button"
          aria-label="สัปดาห์ถัดไป"
          disabled={wk >= 0}
          onClick={() => setWk(Math.min(0, wk + 1))}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E4E0EC] bg-white disabled:opacity-40"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* สรุปแยกแขน */}
      {showSides ? (
        <div
          className={`grid gap-2.5 ${sidesUsed.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {sidesUsed.map(sideCard)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-3.5">
            <span className="text-[14px] text-pt-muted">ทำได้รวม</span>
            <span className="text-[24px] font-bold">
              {totalReps(week)} ครั้ง
            </span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-3.5">
            <span className="text-[14px] text-pt-muted">เซตที่ทำ</span>
            <span className="text-[24px] font-bold">{week.length} เซต</span>
          </div>
        </div>
      )}

      {/* กราฟแท่งคู่: แต่ละวันมีแท่งของแต่ละแขน */}
      <div className="flex flex-col gap-2.5 rounded-[18px] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[16px] font-semibold">จำนวนครั้งต่อวัน</span>
          {showSides && (
            <div className="flex gap-3">
              {sidesUsed.map((sd) => (
                <span
                  key={sd}
                  className="flex items-center gap-1.5 text-[13px] text-pt-muted"
                >
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ background: SIDE_COLOR[sd].bar }}
                  />
                  {SIDE_LABEL[sd]}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid h-[140px] grid-cols-7 items-end gap-2 border-b border-pt-line">
          {daily.map((x, i) => (
            <div
              key={i}
              className="flex h-full items-end justify-center gap-[3px]"
            >
              {(showSides ? sidesUsed : [null]).map((sd) => {
                const n = sd ? x[sd] : x.all;
                return (
                  <div
                    key={sd ?? "all"}
                    className="flex flex-1 flex-col items-center justify-end gap-0.5"
                  >
                    <span className="text-[11px] leading-none text-pt-muted">
                      {n || ""}
                    </span>
                    <div
                      className="w-full rounded-t-[4px]"
                      style={{
                        height: Math.round((n / mx) * 108),
                        background: sd ? SIDE_COLOR[sd].bar : "#C4532A",
                      }}
                      aria-label={`${WEEKDAY_MON_FIRST[i]} ${sd ? SIDE_LABEL[sd] : ""} ${n} ครั้ง`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-[14px] text-pt-muted">
          {WEEKDAY_MON_FIRST.map((w, i) => (
            <span
              key={w}
              className={sameDay(days[i], now) ? "font-bold text-pt-ink" : ""}
            >
              {w}
            </span>
          ))}
        </div>
      </div>

      {/* รายการเซตแยกตามวัน */}
      {groups.map((g) => (
        <div key={g.d.toDateString()} className="flex flex-col gap-2">
          <div className="mt-2 flex items-baseline justify-between px-1">
            <span className="text-[17px] font-bold">{dayTitle(g.d)}</span>
            <span className="text-[14px] text-pt-muted">
              {showSides
                ? sidesUsed
                    .map(
                      (sd) =>
                        `${SIDE_LABEL[sd].replace("แขน", "")} ${totalReps(ofSide(g.sets, sd))}`,
                    )
                    .join(" · ") + " ครั้ง"
                : `รวม ${totalReps(g.sets)} ครั้ง`}
            </span>
          </div>
          {g.sets.map((s, k) => {
            const c = s.side ? SIDE_COLOR[s.side] : null;
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
                style={c ? { borderLeft: `4px solid ${c.bar}` } : undefined}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[17px] font-semibold">
                    เซต {setNumber(g.sets, k)} · {s.session_count} ครั้ง
                  </span>
                  <span className="text-[14px] text-pt-muted">
                    {timeRangeTH(s.started_at, s.created_at)}
                  </span>
                </div>
                {s.side && c && (
                  <span
                    className="shrink-0 rounded-full px-3 py-1.5 text-[14px] font-semibold"
                    style={{ background: c.tint, color: c.ink }}
                  >
                    {SIDE_LABEL[s.side]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {groups.length === 0 && (
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-[18px]">
          <span className="text-[16px] font-semibold">
            ยังไม่มีการฝึกในสัปดาห์นี้
          </span>
          {firstDay && (
            <span className="text-[14px] text-pt-muted">
              เริ่มฝึกวันที่ {thaiShort(new Date(firstDay))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
