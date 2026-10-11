// หน้ารายละเอียดโปรแกรม (เปิดจากหน้า "ฉัน")
// แสดงเฉพาะข้อมูลที่มีจริงในตาราง programs / patient_programs ถ้าช่องไหนว่างจะซ่อนไว้

import { ChevronLeft } from "lucide-react";
import type { PatientProgram } from "../../types";
import { thaiShort } from "../../lib/clinic";

// คอลัมน์จากตาราง programs + patient_programs (บางช่องอาจยังไม่มีใน type ของเพื่อน)
export type ProgramFull = PatientProgram & {
  patient_program_id?: string;
  program_id?: string;
  description?: string | null;
  program_type?: string | null;
  target_stage?: string | null; // โปรแกรมนี้ออกแบบให้ผู้ป่วยระยะไหน
  session_per_day?: number | null;
  repeat_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
};

const dateTH = (d?: string | null) => (d ? thaiShort(new Date(d)) : "");

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3 border-t border-pt-divider py-3 text-[16px]">
      <span className="text-pt-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

export default function PatientProgramDetail({
  program,
  onBack,
}: {
  program: ProgramFull;
  onBack: () => void;
}) {
  const p = program;
  const minutes = p.duration_sec ? Math.round(p.duration_sec / 60) : 0;
  const period =
    p.start_date && p.end_date
      ? `${dateTH(p.start_date)} – ${dateTH(p.end_date)}`
      : p.start_date
        ? `ตั้งแต่ ${dateTH(p.start_date)}`
        : "";

  return (
    <div className="flex min-h-full flex-col gap-3.5">
      <button
        type="button"
        onClick={onBack}
        className="flex h-12 items-center gap-1 self-start pr-3 text-[16px] font-semibold text-pt-accent-ink"
      >
        <ChevronLeft size={22} /> กลับ
      </button>

      <div className="flex flex-col gap-1 px-1">
        {p.program_type && (
          <span className="text-[14px] text-pt-muted">{p.program_type}</span>
        )}
        <span className="text-[22px] font-bold leading-snug">
          {p.program_name}
        </span>
      </div>

      {/* เป้าหมาย: ตัวเลขใหญ่ อ่านง่าย */}
      <div className="grid grid-cols-2 gap-2.5">
        {minutes > 0 && (
          <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-3.5">
            <span className="text-[14px] text-pt-muted">เวลาต่อเซต</span>
            <span className="text-[24px] font-bold">{minutes} นาที</span>
          </div>
        )}
        {!!p.session_per_day && (
          <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-3.5">
            <span className="text-[14px] text-pt-muted">ฝึกวันละ</span>
            <span className="text-[24px] font-bold">
              {p.session_per_day} ครั้ง
            </span>
          </div>
        )}
      </div>

      {p.description && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-3.5">
          <span className="text-[16px] font-semibold">วิธีทำ</span>
          <p className="whitespace-pre-line text-[16px] leading-relaxed">
            {p.description}
          </p>
        </div>
      )}

      <div className="flex flex-col rounded-2xl bg-white px-4 py-3.5">
        <span className="text-[16px] font-semibold">รายละเอียด</span>
        <Row k="ทำซ้ำ" v={p.repeat_count ? `${p.repeat_count} ครั้ง` : ""} />
        <Row k="ช่วงโปรแกรม" v={period} />
        <Row k="สั่งเมื่อ" v={dateTH(p.assigned_date)} />
      </div>
    </div>
  );
}
