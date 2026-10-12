// กล่อง "ผลการฝึกสเก็ตบอร์ด แยกแขน" สำหรับหน้านักกายภาพและเวชระเบียน
// ไฟล์นี้อยู่เดี่ยวๆ ไม่แก้ไฟล์ของคนอื่น วางที่: Frontend/als-staff/src/components/SkateArmProgress.tsx
//
// วิธีใช้ (เพิ่ม 2 บรรทัดในหน้าที่ต้องการ):
//   import SkateArmProgress from '../../components/SkateArmProgress'
//   <SkateArmProgress patientId={patient.patient_id} />

import { useEffect, useState } from "react";
import { list, dayMonth } from "../lib/clinic";

type Side = "RIGHT" | "LEFT";

interface SkateSet {
  id: number;
  session_count: number;
  side?: Side | null;
  started_at?: string | null;
  created_at: string;
}

const SIDES: Side[] = ["RIGHT", "LEFT"];
const SIDE_LABEL: Record<Side, string> = { RIGHT: "ข้างขวา", LEFT: "ข้างซ้าย" }; // คำเดียวกับหน้าเคสของเพื่อน
const SIDE_COLOR: Record<Side, string> = { RIGHT: "#007AFF", LEFT: "#00A5FF" }; // สีเดียวกับกราฟในหน้าเคสของเพื่อน
const DAYS_SHOWN = 8; // จำนวนวันที่มาฝึกล่าสุดที่แสดงในกราฟ
const WINDOW_DAYS = 28; // ช่วงเทียบ: 4 สัปดาห์ล่าสุด vs 4 สัปดาห์ก่อนหน้า

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const dayKey = (iso: string) => new Date(iso).toDateString();
const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

export default function SkateArmProgress({ patientId }: { patientId: string }) {
  const [sets, setSets] = useState<SkateSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    list<SkateSet>(
      `/api/skateboard-sessions?patient_id=${encodeURIComponent(patientId)}`,
    )
      // เซต 0 ครั้ง = กดเริ่มแล้วหยุดทันที/ทดสอบเครื่อง ไม่นับ
      .then((rows) => setSets(rows.filter((s) => (s.session_count ?? 0) > 0)))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [patientId]);

  const box = "flex flex-col gap-3 rx-card px-[18px] py-4";
  if (loading)
    return (
      <div className={box}>
        <span className="text-[14px] text-rx-muted">กำลังโหลดผลการฝึก...</span>
      </div>
    );
  if (error)
    return (
      <div className={box}>
        <span className="text-[14px] text-[#B42318]">
          โหลดผลการฝึกไม่สำเร็จ: {error}
        </span>
      </div>
    );

  const sidesUsed = SIDES.filter((sd) => sets.some((s) => s.side === sd));
  const now = Date.now();
  const inRange = (s: SkateSet, fromDays: number, toDays: number) => {
    const age = (now - new Date(s.created_at).getTime()) / 86400000;
    return age >= fromDays && age < toDays;
  };

  // วันที่มาฝึก (ล่าสุด DAYS_SHOWN วัน) เรียงเก่า → ใหม่
  const dayList = [...new Set(sets.map((s) => dayKey(s.created_at)))]
    .map((k) => new Date(k))
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(-DAYS_SHOWN);
  const perDay = dayList.map((d) => {
    const ss = sets.filter((s) => dayKey(s.created_at) === d.toDateString());
    const bySide = Object.fromEntries(
      SIDES.map((sd) => [
        sd,
        avg(ss.filter((s) => s.side === sd).map((s) => s.session_count)),
      ]),
    ) as Record<Side, number | null>;
    return { d, bySide };
  });
  const mx = Math.max(
    1,
    ...perDay.flatMap((x) => sidesUsed.map((sd) => x.bySide[sd] ?? 0)),
  );

  const recent = [...sets]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 15);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold">
          ผลจากเครื่องฝึก · แยกข้าง
        </span>
        <span className="text-[12px] text-rx-muted">
          ข้อมูลจากเครื่องฝึก (ผู้ป่วยกดเริ่ม/จบเซตเอง)
        </span>
      </div>

      {sets.length === 0 ? (
        <div className={box}>
          <span className="text-[14px] text-rx-muted">
            ยังไม่มีผลการฝึกจากเครื่อง
          </span>
        </div>
      ) : (
        <>
          {/* สรุปแต่ละแขน: ครั้งเฉลี่ยต่อเซต 4 สัปดาห์ล่าสุด เทียบ 4 สัปดาห์ก่อนหน้า */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {sidesUsed.map((sd) => {
              const cur = sets.filter(
                (s) => s.side === sd && inRange(s, 0, WINDOW_DAYS),
              );
              const prev = sets.filter(
                (s) =>
                  s.side === sd && inRange(s, WINDOW_DAYS, WINDOW_DAYS * 2),
              );
              const a = avg(cur.map((s) => s.session_count));
              const b = avg(prev.map((s) => s.session_count));
              const diff = a != null && b != null ? a - b : null;
              const best = cur.length
                ? Math.max(...cur.map((s) => s.session_count))
                : null;
              return (
                <div
                  key={sd}
                  className="flex flex-col gap-1.5 rx-card px-[18px] py-4"
                  style={{ borderTop: `3px solid ${SIDE_COLOR[sd]}` }}
                >
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: SIDE_COLOR[sd] }}
                  >
                    {SIDE_LABEL[sd]}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[28px] font-semibold leading-none">
                      {a != null ? a.toFixed(1) : "–"}
                    </span>
                    <span className="text-[13px] text-rx-muted">
                      ครั้งต่อเซต (4 สัปดาห์)
                    </span>
                  </div>
                  <span className="text-[13px] text-rx-muted">
                    {cur.length} เซต
                    {best != null ? ` · สูงสุด ${best} ครั้ง` : ""}
                  </span>
                  {diff != null && (
                    <span
                      className={`text-[13px] font-semibold ${diff > 0 ? "text-[#145C38]" : diff < 0 ? "text-[#B42318]" : "text-rx-muted"}`}
                    >
                      {diff > 0 ? "▲" : diff < 0 ? "▼" : "•"}{" "}
                      {diff === 0 ? "เท่าเดิม" : `${Math.abs(diff).toFixed(1)}`}{" "}
                      เทียบ 4 สัปดาห์ก่อน ({b!.toFixed(1)})
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* กราฟแท่งคู่: ครั้งเฉลี่ยต่อเซตของแต่ละแขน ในแต่ละวันที่มาฝึก */}
          <div className={box}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-semibold">
                ครั้งเฉลี่ยต่อเซต · รายวัน
              </span>
              <div className="flex gap-3">
                {sidesUsed.map((sd) => (
                  <span
                    key={sd}
                    className="flex items-center gap-1.5 text-[12px] text-rx-muted"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: SIDE_COLOR[sd] }}
                    />
                    {SIDE_LABEL[sd]}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="grid h-[170px] items-end gap-2.5 border-b border-rx-soft"
              style={{
                gridTemplateColumns: `repeat(${perDay.length}, minmax(0,1fr))`,
              }}
            >
              {perDay.map((x) => (
                <div
                  key={x.d.toDateString()}
                  className="flex h-full items-end justify-center gap-[3px]"
                >
                  {sidesUsed.map((sd) => {
                    const v = x.bySide[sd];
                    return (
                      <div
                        key={sd}
                        className="flex flex-1 flex-col items-center justify-end gap-0.5"
                      >
                        <span className="text-[11px] text-rx-muted">
                          {v != null ? Math.round(v * 10) / 10 : ""}
                        </span>
                        <div
                          className="w-full rounded-t-[4px]"
                          style={{
                            height: Math.round(((v ?? 0) / mx) * 140),
                            background: SIDE_COLOR[sd],
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div
              className="grid gap-2.5 text-center text-[12px] text-rx-muted"
              style={{
                gridTemplateColumns: `repeat(${perDay.length}, minmax(0,1fr))`,
              }}
            >
              {perDay.map((x) => (
                <span key={x.d.toDateString()}>{dayMonth(x.d)}</span>
              ))}
            </div>
          </div>

          {/* ตารางเซตล่าสุด */}
          <div className={box}>
            <span className="text-[15px] font-semibold">เซตล่าสุด</span>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-[13px]">
                <thead className="text-rx-muted">
                  <tr className="border-b border-rx-divider">
                    <th className="py-2 font-medium">วันที่</th>
                    <th className="py-2 font-medium">เวลา</th>
                    <th className="py-2 font-medium">แขน</th>
                    <th className="py-2 text-right font-medium">จำนวนครั้ง</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-rx-divider last:border-0"
                    >
                      <td className="py-2">
                        {dayMonth(new Date(s.created_at))}
                      </td>
                      <td className="py-2 text-rx-muted">
                        {s.started_at ? `${hm(s.started_at)}–` : ""}
                        {hm(s.created_at)} น.
                      </td>
                      <td className="py-2">
                        {s.side ? (
                          <span
                            className="font-semibold"
                            style={{ color: SIDE_COLOR[s.side] }}
                          >
                            {SIDE_LABEL[s.side]}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {s.session_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
