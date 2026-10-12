import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { BADGE, DOWS, MON, MONTH, type QueueState } from '../lib/clinic'
import { Button } from './shadcn/button'
import { Hint } from './shadcn/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from './shadcn/popover'
import { Skeleton } from './shadcn/skeleton'
import { ToggleGroup, ToggleGroupItem } from './shadcn/toggle-group'
import { cn } from '../lib/utils'

/* ส่วนประกอบหน้าเว็บเวชระเบียน/นักกายภาพ ตามดีไซน์ ALS Rehab (โทน rx-*) */

export const inputCls = 'h-11 w-full rounded-field border border-[#C7C7CC] bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] px-3 text-[15px] text-rx-ink outline-none transition-shadow placeholder:text-rx-faint hover:border-rx-faint focus:border-rx-accent focus:ring-4 focus:ring-rx-accent/15'
export const selectCls = 'h-11 w-full rounded-field border border-[#C7C7CC] bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] px-2.5 text-[15px] text-rx-ink outline-none transition-shadow placeholder:text-rx-faint hover:border-rx-faint focus:border-rx-accent focus:ring-4 focus:ring-rx-accent/15'
export const textareaCls = 'w-full resize-y rounded-field border border-[#C7C7CC] bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] px-3 py-2.5 text-[15px] text-rx-ink outline-none transition-shadow placeholder:text-rx-faint hover:border-rx-faint focus:border-rx-accent focus:ring-4 focus:ring-rx-accent/15'
export const readonlyCls = 'h-11 w-full rounded-field border border-rx-divider bg-rx-bg px-3 text-[15px] text-rx-ink outline-none'

export function PageHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[28px] font-bold leading-tight text-rx-ink">{title}</h1>
        {sub && <span className="text-[13px] text-rx-muted">{sub}</span>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-col gap-3 rx-card px-5 py-4 ${className}`}>{children}</div>
}

export function CardTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[15px] font-semibold text-rx-ink">{children}</span>
      {sub && <span className="text-[13px] text-rx-muted">{sub}</span>}
    </div>
  )
}

export function Badge({ state, label, bg, fg, className = '' }: { state?: QueueState; label?: ReactNode; bg?: string; fg?: string; className?: string }) {
  const [t, b, f] = state ? BADGE[state] : ['', '#EEF1F6', '#4A5B6E']
  return (
    <span className={`inline-block self-start whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${className}`} style={{ background: bg ?? b, color: fg ?? f }}>
      {label ?? t}
    </span>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-lg bg-rx-bg px-2.5 py-[3px] text-[12px] text-rx-ink">{children}</span>
}

type BtnVariant = 'primary' | 'outline' | 'accent-outline' | 'dark' | 'ghost' | 'disabled'

/** ปุ่มหลักของเว็บ — ใช้ shadcn/ui Button ข้างใน (className ที่ส่งมาชนะคลาสเดิมเสมอ) */
export function Btn({ variant = 'primary', size = 'md', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return <Button type="button" {...p} variant={p.disabled ? 'disabled' : variant} size={size} className={className} />
}

export function Field({ label, htmlFor, children, className = '', hint }: { label: ReactNode; htmlFor?: string; children: ReactNode; className?: string; hint?: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-rx-ink">
        {label}{hint && <span className="font-medium text-rx-accent-ink"> · {hint}</span>}
      </label>
      {children}
    </div>
  )
}

export function Stat({ label, value, color = '#16365F' }: { label: ReactNode; value: ReactNode; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rx-card px-5 py-4">
      <span className="text-[13px] text-rx-muted">{label}</span>
      <span className="text-[24px] font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

export function Avatar({ text, size = 48, solid = false }: { text: string; size?: number; solid?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${solid ? 'bg-rx-accent text-white' : 'bg-rx-tint text-rx-accent-ink'}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
    >
      {text}
    </div>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-rx-tint px-4 py-3 text-[13px] leading-relaxed text-rx-accent-deep">
      <Info size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/** ระหว่างโหลด — โครงการ์ดเทากะพริบ (shadcn/ui Skeleton) แทนข้อความเปล่า */
export function Loading({ text = 'กำลังโหลด...' }: { text?: string }) {
  return (
    <div role="status" aria-label={text} className="flex flex-col gap-5">
      <span className="sr-only">{text}</span>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-3 rx-card p-6">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rx-card p-6">
        <Skeleton className="h-5 w-1/4" />
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <div className="rounded-xl bg-[#FFEBEA] px-4 py-2.5 text-[13px] text-[#C4271B] text-[#791F1F]">{children}</div> : null
}

/** ตัวเลือกแบบแท็บ (shadcn/ui ToggleGroup) — กดลูกศรซ้าย/ขวาเลื่อนได้, กดตัวที่เลือกอยู่ซ้ำไม่ทำให้หลุดการเลือก */
export function Segmented<T extends string>({ value, options, onChange, small }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={v => { if (v) onChange(v as T) }}>
      {options.map(o => (
        <ToggleGroupItem key={o.value} value={o.value} className={small ? 'h-[34px]' : undefined}>{o.label}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** ปุ่มลูกศรเลื่อนช่วง — มี tooltip บอกว่ากดแล้วไปไหน */
export function IconBtn({ label, onClick, dir }: { label: string; onClick: () => void; dir: 'prev' | 'next' }) {
  return (
    <Hint label={label}>
      <Button variant="soft" size="icon" aria-label={label} onClick={onClick}>
        {dir === 'prev' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </Button>
    </Hint>
  )
}

export function BackLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-9 items-center gap-1.5 self-start text-[13px] font-medium text-rx-accent-ink hover:underline">
      <ChevronLeft size={16} /> <span>{children}</span>
    </button>
  )
}

/** แถบเลือกวัน 7 วัน (หน้าแรกนักกายภาพ) */
export function DayStrip({ days, selected, today, meta, onPick, onPrev, onNext }: {
  days: Date[]; selected: Date; today: Date; meta: (d: Date) => string
  onPick: (d: Date) => void; onPrev: () => void; onNext: () => void
}) {
  return (
    <div className="flex items-stretch gap-2">
      <IconBtn label="ย้อนหลัง 7 วัน" onClick={onPrev} dir="prev" />
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1.5">
        {days.map(d => {
          const on = d.toDateString() === selected.toDateString()
          const isT = d.toDateString() === today.toDateString()
          const past = d < today && !isT
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPick(d)}
              className={`flex min-h-16 flex-col items-center justify-center gap-px rounded-lg px-0.5 py-1 text-rx-ink ${
                on ? 'border-[1.5px] border-rx-accent bg-rx-tint' : isT ? 'border border-rx-tint-2 bg-white' : `border border-rx-line ${past ? 'bg-rx-bg' : 'bg-white'}`
              }`}
            >
              <span className={`text-[12px] ${on ? 'text-rx-accent-ink' : 'text-rx-muted'}`}>{DOWS[d.getDay()]}{isT ? ' · วันนี้' : ''}</span>
              <span className="text-[15px] font-semibold">{d.getDate()} {MON[d.getMonth()]}</span>
              <span className={`text-[11px] ${on ? 'text-rx-accent-ink' : 'text-rx-muted'}`}>{meta(d)}</span>
            </button>
          )
        })}
      </div>
      <IconBtn label="ถัดไป 7 วัน" onClick={onNext} dir="next" />
    </div>
  )
}

/** ปุ่มเลือกวัน (ทึบเมื่อเลือก) สำหรับลงนัด */
export function DayPicker({ days, selected, meta, onPick }: { days: Date[]; selected: Date | null; meta: (d: Date) => string; onPick: (d: Date) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
      {days.map(d => {
        const on = !!selected && d.toDateString() === selected.toDateString()
        return (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onPick(d)}
            className={`flex min-h-[62px] flex-col items-center justify-center gap-px rounded-lg ${on ? 'border-[1.5px] border-rx-accent bg-rx-accent text-white' : 'border border-rx-line bg-white text-rx-ink'}`}
          >
            <span className="text-[12px]">{DOWS[d.getDay()]}</span>
            <span className="text-[15px] font-semibold">{d.getDate()} {MON[d.getMonth()]}</span>
            <span className="text-[11px]">{meta(d)}</span>
          </button>
        )
      })}
    </div>
  )
}

export interface SlotCell { s: string; label: string; meta: string; free: boolean }

/** ตารางช่องเวลา: ว่าง (เขียว) / ไม่ว่าง (เทา) / ที่เลือก (น้ำเงิน) */
export function SlotGrid({ slots, selected, onPick, min = 140 }: { slots: SlotCell[]; selected: string; onPick: (s: string) => void; min?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {slots.map(x => {
        const on = selected === x.s && x.free
        return (
          <button
            key={x.s}
            type="button"
            disabled={!x.free}
            onClick={() => onPick(x.s)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 ${
              !x.free ? 'cursor-default border-none bg-rx-bg text-[#8A97A6]' : on ? 'border-[1.5px] border-rx-accent bg-rx-accent text-white' : 'border border-[#A7DDB1] bg-[#E4F5EC] text-[#145C38]'
            }`}
          >
            <span className="text-[14px] font-semibold">{x.label}</span>
            <span className="max-w-full truncate text-[11px]">{on ? 'เลือกแล้ว' : x.meta}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SlotLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[12px] text-rx-muted">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] border border-[#A7DDB1] bg-[#E4F5EC]" />ว่าง</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-rx-bg" />มีนัดแล้ว ลงซ้ำไม่ได้</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-rx-accent" />ที่เลือก</span>
    </div>
  )
}

/** ตารางแบบแถว (หัวคอลัมน์ + แถว) เลื่อนแนวนอนได้บนจอแคบ */
export function GridTable({ cols, head, minWidth, children }: { cols: string; head: ReactNode[]; minWidth: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rx-card">
      <div style={{ minWidth }}>
        <div className="grid items-center gap-2.5 px-5 pb-2.5 pt-4 text-[13px] text-rx-muted" style={{ gridTemplateColumns: cols }}>
          {head.map((h, i) => <span key={i}>{h}</span>)}
        </div>
        {children}
      </div>
    </div>
  )
}

export function GridRow({ cols, children, muted }: { cols: string; children: ReactNode; muted?: boolean }) {
  return (
    <div className={`grid items-center gap-2.5 border-t border-rx-divider px-5 py-3 text-[14px] transition-colors ${muted ? 'bg-rx-bg' : 'hover:bg-black/[0.02]'}`} style={{ gridTemplateColumns: cols }}>
      {children}
    </div>
  )
}

/**
 * ช่องกรอกวันที่แบบ พ.ศ. (วว/ดด/ปปปป เช่น 04/01/2531) แทน <input type="date"> ที่เบราว์เซอร์แสดงเป็น ค.ศ. เสมอ
 * พิมพ์ตัวเลขอย่างเดียว ระบบใส่ / ให้เอง · value / onChange เป็น 'YYYY-MM-DD' (ค.ศ.) · ค่าว่าง = ยังไม่กรอก
 */
export function ThaiDateInput({ id, value, onChange, fromYear, toYear, min, max, size = 'md' }: {
  id?: string; value: string; onChange: (iso: string) => void
  fromYear: number; toYear: number; min?: string; max?: string; size?: 'sm' | 'md'
}) {
  const toText = (v: string) => { if (!v) return ''; const [y, m, d] = v.split('-'); return `${d}/${m}/${Number(y) + 543}` }
  const [text, setText] = useState(toText(value))
  const [bad, setBad] = useState('')
  useEffect(() => { setText(toText(value)); setBad('') }, [value])

  const type = (raw: string) => {
    const dg = raw.replace(/\D/g, '').slice(0, 8)
    const t = [dg.slice(0, 2), dg.slice(2, 4), dg.slice(4, 8)].filter(Boolean).join('/')
    setText(t); setBad('')
    if (dg.length < 8) return
    const d = Number(dg.slice(0, 2)), m = Number(dg.slice(2, 4)), y = Number(dg.slice(4, 8)) - 543
    const ok = m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate()
    if (!ok) { setBad('วันที่ไม่ถูกต้อง'); return }
    if (y < fromYear || y > toYear) { setBad(`ปี พ.ศ. ต้องอยู่ระหว่าง ${fromYear + 543}–${toYear + 543}`); return }
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if ((min && iso < min) || (max && iso > max)) { setBad('อยู่นอกช่วงวันที่ที่เลือกได้'); return }
    onChange(iso)
  }

  return (
    <span className="inline-flex min-w-0 flex-col gap-1">
      <input
        id={id} inputMode="numeric" autoComplete="off" placeholder="วว/ดด/ปปปป (พ.ศ.)" value={text}
        onChange={e => type(e.target.value)}
        onBlur={() => { if (text && text.replace(/\D/g, '').length < 8) setBad('กรอกให้ครบ วว/ดด/ปปปป') }}
        aria-invalid={!!bad}
        className={`${size === 'sm' ? 'h-10 w-[150px]' : 'h-11 w-full'} rounded-field border bg-white px-3 text-[15px] tabular-nums shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] text-rx-ink outline-none transition-shadow focus:border-rx-accent focus:ring-4 focus:ring-rx-accent/15-2/50 ${bad ? 'border-[#E24B4A]' : 'border-[#C7C7CC]'}`}
      />
      {bad && <span className="text-[12px] text-[#A32D2D]">{bad}</span>}
    </span>
  )
}

/**
 * ปุ่มเลือกวันจากปฏิทิน แสดงเดือนไทยและปี พ.ศ. (ใช้กับช่องเลือกวันดูข้อมูล ไม่ใช่ช่องกรอกข้อมูล)
 * value / onChange เป็น 'YYYY-MM-DD' (ค.ศ.)
 */
export function ThaiCalendarPicker({ id, value, onChange, min, max, className }: {
  id?: string; value: string; onChange: (iso: string) => void; min?: string; max?: string; className?: string
}) {
  const toDate = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d) }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const sel = value ? toDate(value) : new Date()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(new Date(sel.getFullYear(), sel.getMonth(), 1))

  useEffect(() => { if (open) setView(new Date(sel.getFullYear(), sel.getMonth(), 1)) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayIso = iso(new Date())
  const lead = view.getDay()
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))]
  const shift = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1))
  const off = (k: string) => (!!min && k < min) || (!!max && k > max)
  const pick = (k: string) => { onChange(k); setOpen(false) }

  // shadcn/ui Popover: วางตำแหน่งเองไม่ล้นจอ, ปิดด้วย Esc/คลิกนอกกรอบ แล้วคืนโฟกัสให้ปุ่ม
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button"
          className={cn('rx-glass-control flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[14px] text-rx-ink outline-none hover:bg-rx-bg focus-visible:ring-[3px] focus-visible:ring-rx-accent/25 data-[state=open]:ring-[3px] data-[state=open]:ring-rx-accent/20', className)}>
          <CalendarDays size={16} className="text-rx-muted" />
          {sel.getDate()} {MON[sel.getMonth()]} {sel.getFullYear() + 543}
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="เลือกวันที่" className="w-[288px]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" aria-label="เดือนก่อน" onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-rx-bg"><ChevronLeft size={18} /></button>
          <span className="text-[14px] font-semibold">{MONTH[view.getMonth()]} {view.getFullYear() + 543}</span>
          <button type="button" aria-label="เดือนถัดไป" onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-rx-bg"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {DOWS.map(d => <span key={d} className="py-1 text-[12px] text-rx-muted">{d}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />
            const k = iso(d), on = k === value, now = k === todayIso, dis = off(k)
            return (
              <button key={k} type="button" disabled={dis} onClick={() => pick(k)} aria-pressed={on}
                className={`h-9 rounded-md text-[13px] ${on ? 'bg-rx-accent font-semibold text-white' : now ? 'font-semibold text-rx-accent-ink ring-1 ring-inset ring-rx-tint-2' : 'text-rx-ink hover:bg-rx-bg'} disabled:cursor-not-allowed disabled:opacity-30`}>
                {d.getDate()}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between border-t border-rx-divider pt-2">
          <button type="button" disabled={off(todayIso)} onClick={() => pick(todayIso)} className="h-8 rounded-md px-2.5 text-[13px] font-semibold text-rx-accent-ink hover:bg-rx-bg disabled:opacity-30">วันนี้</button>
          <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-2.5 text-[13px] text-rx-muted hover:bg-rx-bg">ปิด</button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
