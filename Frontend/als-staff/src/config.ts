// Empty string = same origin (dev server proxies /api to the backend, see vite.config.ts)
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// เบอร์ติดต่อศูนย์ที่แสดงในแอปผู้ป่วย (หน้า "ฉัน")
export const CENTER_PHONE: string = import.meta.env.VITE_CENTER_PHONE ?? ''
