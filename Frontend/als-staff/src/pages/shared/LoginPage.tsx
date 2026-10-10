import { useState } from 'react'
import type { AuthUser } from '../../types'
import { api } from '../../lib/clinic'
import { inputCls } from '../../components/ui'

interface Props { onLogin: (token: string, user: AuthUser) => void }

export default function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { setError('กรุณากรอกเบอร์โทรหรืออีเมล และรหัสผ่าน'); return }
    setLoading(true)
    setError(null)
    try {
      const data = await api<{ token: string; user: AuthUser }>('/api/auth/login', { method: 'POST', body: { username: username.trim(), password } })
      onLogin(data.token, data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-rx-bg p-6 font-rx text-rx-ink">
      <form onSubmit={submit} className="flex w-full max-w-[400px] flex-col gap-[18px] rounded-lg border border-white bg-white px-7 py-8">
        <div className="flex flex-col gap-1 text-center">
          <span className="text-[26px] font-semibold">ALS Rehab</span>
          <span className="text-[14px] text-rx-muted">ระบบติดตามการฝึกและนัดหมาย</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="uid" className="text-[13px] font-semibold">เบอร์โทรหรืออีเมล</label>
          <input id="uid" className={inputCls} value={username} onChange={e => setUsername(e.target.value)} placeholder="08x-xxx-xxxx" autoComplete="username" autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pw" className="text-[13px] font-semibold">รหัสผ่าน</label>
          <input id="pw" className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <a href="#" onClick={e => e.preventDefault()} className="flex min-h-8 items-center self-end text-[13px] text-rx-accent-ink hover:text-rx-accent-deep">ลืมรหัสผ่าน</a>
        {error && <div className="rounded-lg bg-[#FCEBEB] px-3.5 py-2.5 text-[13px] text-[#791F1F]">{error}</div>}
        <button type="submit" disabled={loading} className="flex h-11 items-center justify-center rounded-lg bg-rx-accent px-[18px] text-[14px] font-semibold text-white hover:bg-rx-accent-ink disabled:opacity-60">
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
        <span className="text-center text-[13px] leading-relaxed text-rx-muted">ระบบจะพาไปหน้าตามบทบาทของบัญชี<br />ผู้ป่วยใหม่ลงทะเบียนที่เคาน์เตอร์เวชระเบียน</span>
      </form>
    </div>
  )
}
