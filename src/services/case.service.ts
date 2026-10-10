import { db } from '@/src/db'
import { treatmentCases } from '@/src/db/schema/treatmentCases'
import { generateId } from '@/src/utils/generate-id'
import { ID_PREFIX, SEQUENCE } from '@/src/constants/id-config'
import { and, eq, ne, desc } from 'drizzle-orm'

export type TreatmentCase = typeof treatmentCases.$inferSelect

/** เคสที่ยังไม่ปิดของผู้ป่วย (มีได้ทีละเคส) */
export async function openCaseOf(patientId: string): Promise<TreatmentCase | null> {
  const [c] = await db.select().from(treatmentCases)
    .where(and(eq(treatmentCases.patient_id, patientId), ne(treatmentCases.status, 'CLOSED')))
    .limit(1)
  return c ?? null
}

/** เคสล่าสุดของผู้ป่วย — เคสที่ยังไม่ปิดก่อน ถ้าไม่มีใช้เคสที่ปิดล่าสุด */
export async function currentCaseOf(patientId: string): Promise<TreatmentCase | null> {
  return (await openCaseOf(patientId)) ?? (await db.select().from(treatmentCases)
    .where(eq(treatmentCases.patient_id, patientId))
    .orderBy(desc(treatmentCases.opened_at)).limit(1))[0] ?? null
}

export const newCaseId = () => generateId(ID_PREFIX.CASE, SEQUENCE.CASE)
