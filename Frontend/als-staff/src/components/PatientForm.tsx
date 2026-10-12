import type { Patient } from '../types'
import { isoDate } from '../lib/clinic'
import { Field, ThaiDateInput, inputCls, selectCls } from './ui'

const THIS_YEAR = new Date().getFullYear()

/** ข้อมูลประจำตัวผู้ป่วยที่เวชระเบียนแก้ได้ (หน้าลงทะเบียน · หน้าผู้ป่วยทั้งหมด) */
export const EMPTY_PROFILE = {
  titleName: '', firstName: '', lastName: '', birthDate: '', gender: 'ไม่ระบุ', phone: '', email: '',
  address: '', subdistrict: '', district: '', province: '',
}
export type Profile = typeof EMPTY_PROFILE
const TITLES = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง']

export type PersonKey = 'titleName' | 'firstName' | 'lastName' | 'birthDate' | 'gender' | 'phone' | 'address' | 'subdistrict' | 'district' | 'province'
type Setter = (k: PersonKey) => (e: { target: { value: string } }) => void

/** ข้อมูลผู้ป่วยในระบบ → ค่าเริ่มต้นของฟอร์มแก้ไข */
export const profileOf = (p: Patient): Profile => ({
  titleName: p.title_name ?? '', firstName: p.first_name ?? '', lastName: p.last_name ?? '',
  birthDate: p.birth_date ? isoDate(new Date(p.birth_date)) : '', gender: p.gender || 'ไม่ระบุ',
  phone: p.phone ?? '', email: p.email ?? '',
  address: p.address ?? '', subdistrict: p.subdistrict ?? '', district: p.district ?? '', province: p.province ?? '',
})

/** body ของ PATCH /api/register สำหรับบันทึกข้อมูลประจำตัว */
export const profileBody = (p: Patient, f: Profile) => ({
  patientId: p.patient_id, usersId: p.users_id, titleName: f.titleName, firstName: f.firstName.trim(), lastName: f.lastName.trim(),
  birthDate: f.birthDate || undefined, gender: f.gender, phone: f.phone, email: f.email,
  address: f.address, subdistrict: f.subdistrict, district: f.district, province: f.province,
})

/** ช่องข้อมูลประจำตัวผู้ป่วย (ใช้ทั้งลงทะเบียนใหม่และแก้ไขผู้ป่วยเดิม) */
export function PersonFields({ v, set, id }: { v: Record<PersonKey, string>; set: Setter; id: string }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <div className="grid grid-cols-1 gap-3.5 sm:col-span-2 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="คำนำหน้า" htmlFor={`${id}title`}>
          <select id={`${id}title`} className={selectCls} value={v.titleName} onChange={set('titleName')}>
            <option value="">ไม่ระบุ</option>
            {TITLES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="ชื่อ" htmlFor={`${id}fn`}><input id={`${id}fn`} className={inputCls} value={v.firstName} onChange={set('firstName')} /></Field>
        <Field label="นามสกุล" htmlFor={`${id}ln`}><input id={`${id}ln`} className={inputCls} value={v.lastName} onChange={set('lastName')} /></Field>
      </div>
      <Field label="วันเดือนปีเกิด" htmlFor={`${id}dob`}>
        <ThaiDateInput id={`${id}dob`} value={v.birthDate} onChange={iso => set('birthDate')({ target: { value: iso } })} fromYear={THIS_YEAR - 120} toYear={THIS_YEAR} max={isoDate(new Date())} />
      </Field>
      <Field label="เพศ" htmlFor={`${id}sex`}>
        <select id={`${id}sex`} className={selectCls} value={v.gender} onChange={set('gender')}><option>ไม่ระบุ</option><option>ชาย</option><option>หญิง</option></select>
      </Field>
      <Field label="เบอร์โทร" htmlFor={`${id}tel`}><input id={`${id}tel`} className={inputCls} placeholder="08x-xxx-xxxx" value={v.phone} onChange={set('phone')} /></Field>
      <Field label="ที่อยู่ (บ้านเลขที่ หมู่ ถนน)" htmlFor={`${id}addr`} className="sm:col-span-2"><input id={`${id}addr`} className={inputCls} placeholder="เช่น 31/6 ม.2 ถ.กาญจนวนิช" value={v.address} onChange={set('address')} /></Field>
      <div className="grid grid-cols-1 gap-3.5 sm:col-span-2 sm:grid-cols-3">
        <Field label="แขวง/ตำบล" htmlFor={`${id}sub`}><input id={`${id}sub`} className={inputCls} placeholder="เช่น คอหงส์" value={v.subdistrict} onChange={set('subdistrict')} /></Field>
        <Field label="อำเภอ/เขต" htmlFor={`${id}dis`}><input id={`${id}dis`} className={inputCls} placeholder="เช่น หาดใหญ่" value={v.district} onChange={set('district')} /></Field>
        <Field label="จังหวัด" htmlFor={`${id}prov`}><input id={`${id}prov`} className={inputCls} placeholder="เช่น สงขลา" value={v.province} onChange={set('province')} /></Field>
      </div>
    </div>
  )
}

/** ที่อยู่เต็มในบรรทัดเดียว — กรุงเทพฯ ใช้ แขวง/เขต จังหวัดอื่นใช้ ต./อ./จ. */
export function fullAddress(p: { address?: string | null; subdistrict?: string | null; district?: string | null; province?: string | null }) {
  const bkk = /กรุงเทพ/.test(p.province ?? '')
  return [
    p.address,
    p.subdistrict && `${bkk ? 'แขวง' : 'ต.'}${p.subdistrict}`,
    p.district && `${bkk ? 'เขต' : 'อ.'}${p.district}`,
    p.province && (bkk ? p.province : `จ.${p.province}`),
  ].filter(Boolean).join(' ')
}
