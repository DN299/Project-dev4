import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// กุญแจของกระดาน: เก็บในฐานข้อมูลเป็น SHA-256 เท่านั้น ตัวกุญแจจริงแสดงครั้งเดียวตอนออกให้ แล้วใส่ใน firmware
export const hashDeviceKey = (key: string) => createHash('sha256').update(key).digest('hex')
export const newDeviceKey = () => randomBytes(24).toString('base64url')

/** ตรวจกุญแจที่กระดานส่งมา · เครื่องที่ยังไม่ได้ออกกุญแจ (api_key = null) ยังรับได้ เพื่อให้เปลี่ยนผ่านทีละเครื่อง */
export function deviceKeyOk(storedHash: string | null, presented: string | null): boolean {
  if (!storedHash) return true
  if (!presented) return false
  const a = Buffer.from(hashDeviceKey(presented), 'hex'), b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
