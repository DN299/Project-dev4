import { useEffect, useState } from "react";
import type { AuthUser, Patient } from "../../types";
import {
  api,
  list,
  thaiShort,
  stageLabel,
  ptName,
  fullName,
} from "../../lib/clinic";
import { ChevronRight } from "lucide-react";
import { SIDE_LABEL, sidesFromAffected } from "./Patientside";
import PatientProgramDetail, { type ProgramFull } from "./PatientProgramDetail";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

// คอลัมน์ที่เพิ่มในตาราง patients (อาจยังไม่มีใน type ของเพื่อน)
type PatientFull = Patient & {
  medical_condition?: string | null;
  affected_side?: string | null;
  affected_areas?: string | string[] | null;
};

function ageOf(birth?: string | null) {
  if (!birth) return "";
  const b = new Date(birth),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a > 0 ? `${a} ปี` : "";
}

/** แถวที่ไม่มีข้อมูลจะถูกซ่อน ถ้าไม่เหลือแถวเลย ซ่อนทั้งกล่อง */
function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  const shown = rows.filter(([, v]) => v);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col rounded-2xl bg-white px-4 py-3.5">
      <span className="text-[16px] font-semibold">{title}</span>
      {shown.map(([k, v]) => (
        <div
          key={k}
          className="flex justify-between gap-3 border-t border-pt-divider py-3 text-[16px]"
        >
          <span className="text-pt-muted">{k}</span>
          <span className="text-right font-medium">{v}</span>
        </div>
      ))}
    </div>
  );
}

export default function PatientProfilePage({ user, onLogout }: Props) {
  const [patient, setPatient] = useState<PatientFull | null>(null);
  const [programs, setPrograms] = useState<ProgramFull[]>([]);
  const [openProgram, setOpenProgram] = useState<ProgramFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<PatientFull[]>(`/api/patients?patient_id=${user.patient_id}`).then(
        (r) => setPatient(r[0] ?? null),
      ),
      // คนไข้เห็นเฉพาะโปรแกรมที่สั่งให้ตัวเองและยังใช้อยู่
      list<ProgramFull>(
        `/api/patient-programs?patient_id=${user.patient_id}`,
      ).then((pp) => setPrograms(pp.filter((p) => p.status === "ACTIVE"))),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.patient_id]);

  if (openProgram)
    return (
      <PatientProgramDetail
        program={openProgram}
        onBack={() => setOpenProgram(null)}
      />
    );
  if (loading)
    return (
      <div className="py-16 text-center text-[15px] text-pt-muted">
        กำลังโหลด...
      </div>
    );

  const name = fullName(
    patient?.first_name ?? user.first_name,
    patient?.last_name ?? user.last_name,
  );
  // ระยะอาการ: ใช้ค่าที่นักกายภาพบันทึกไว้ในประวัติผู้ป่วยก่อน
  // ถ้ายังไม่มี ใช้ระยะของโปรแกรมที่สั่งให้ (มีโปรแกรมแล้ว = ประเมินแล้ว)
  const stage =
    patient?.current_stage ||
    programs.find((p) => p.target_stage)?.target_stage ||
    null;
  const sides = sidesFromAffected(patient?.affected_side);
  const sideText =
    sides.length > 1
      ? "ทั้งสองข้าง"
      : sides.length === 1
        ? SIDE_LABEL[sides[0]]
        : "";

  return (
    <div className="flex min-h-full flex-col gap-3.5">
      <div className="flex items-center gap-3.5 py-1">
        <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-pt-tint text-[24px] font-bold text-pt-accent-ink">
          {name.slice(0, 2)}
        </div>
        <div className="flex flex-col">
          <span className="text-[22px] font-bold">{name}</span>
          <span className="text-[15px] text-pt-muted">
            HN {user.patient_id}
          </span>
        </div>
      </div>
      <Section
        title="การรักษา"
        rows={[
          // ข้อมูลการรักษาแสดงเสมอ ถ้ายังไม่มีข้อมูลขึ้น "–"
          ["โรค", patient?.medical_condition || "–"],
          ["ระยะอาการ", stage ? stageLabel(stage) : "ยังไม่ประเมินอาการ"],
          ["แขนที่ฝึก", sideText || "–"],
          [
            "นักกายภาพ",
            patient?.primary_ot_name ? ptName(patient.primary_ot_name) : "",
          ],
        ]}
      />
      {programs.length > 0 && (
        <div className="flex flex-col rounded-2xl bg-white px-4 py-3.5">
          <span className="text-[16px] font-semibold">โปรแกรมการฝึก</span>
          {programs.map((p) => (
            <button
              key={p.patient_program_id ?? p.program_id}
              type="button"
              onClick={() => setOpenProgram(p)}
              className="flex items-center gap-3 border-t border-pt-divider py-3 text-left"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-medium">
                  {p.program_name}
                </span>
                {!!p.duration_sec && (
                  <span className="text-[14px] text-pt-muted">
                    เซตละ {Math.round(p.duration_sec / 60)} นาที
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[14px] font-semibold text-pt-accent-ink">
                รายละเอียด
              </span>
              <ChevronRight size={20} className="shrink-0 text-pt-muted" />
            </button>
          ))}
        </div>
      )}
      <Section
        title="ข้อมูลส่วนตัว"
        rows={[
          ["อายุ", ageOf(patient?.birth_date)],
          [
            "วันเกิด",
            patient?.birth_date ? thaiShort(new Date(patient.birth_date)) : "",
          ],
          ["เบอร์โทร", patient?.phone ?? ""],
        ]}
      />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onLogout}
        className="h-14 rounded-[14px] border border-[#F0C9C9] bg-white text-[16px] font-semibold text-[#A32D2D]"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
