// แขนข้างที่ฝึก: ใช้ร่วมกันทุกหน้าของผู้ป่วย (หน้าฝึก, หน้าหลัก, จบเซต, ผลการฝึก)

export type Side = "RIGHT" | "LEFT";

export const SIDE_LABEL: Record<Side, string> = {
  RIGHT: "แขนขวา",
  LEFT: "แขนซ้าย",
};

/** ลำดับเมื่อทำเท่ากัน: เริ่มที่ขวาก่อน */
const ORDER: Side[] = ["RIGHT", "LEFT"];

/**
 * จำนวนเซตต่อวันในโปรแกรม (session_per_day) นับ "ต่อข้าง"
 * ถ้าทีมตกลงว่าเป็น "รวมสองข้าง" ให้เปลี่ยนเป็น false บรรทัดเดียว
 */
export const SETS_ARE_PER_SIDE = true;

/** แปลงค่า patients.affected_side เป็นรายการข้างที่ต้องฝึก (ไม่ทราบ = []) */
export function sidesFromAffected(affected: string | null | undefined): Side[] {
  if (!affected) return [];
  const a = affected.toUpperCase();
  if (a.includes("ทั้ง") || a.includes("สอง") || a.includes("BOTH"))
    return ["RIGHT", "LEFT"];
  if (a.includes("ซ้าย") || a.includes("LEFT")) return ["LEFT"];
  if (a.includes("ขวา") || a.includes("RIGHT")) return ["RIGHT"];
  return [];
}

/** นับเซตต่อข้าง จากผลที่มีช่อง side */
export function countBySide(
  sessions: { side?: string | null }[],
): Record<Side, number> {
  const c: Record<Side, number> = { RIGHT: 0, LEFT: 0 };
  for (const s of sessions)
    if (s.side === "RIGHT" || s.side === "LEFT") c[s.side]++;
  return c;
}

/** ข้างที่ควรฝึกต่อ = ข้างที่วันนี้ทำน้อยกว่า (เท่ากันเริ่มที่ขวา) */
export function suggestSide(
  sides: Side[],
  todaySessions: { side?: string | null }[],
): Side | null {
  if (sides.length === 0) return null;
  if (sides.length === 1) return sides[0];
  const c = countBySide(todaySessions);
  return [...sides].sort(
    (x, y) => c[x] - c[y] || ORDER.indexOf(x) - ORDER.indexOf(y),
  )[0];
}
