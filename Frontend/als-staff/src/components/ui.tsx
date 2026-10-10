import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { BADGE, DOWS, MON, type QueueState } from '../lib/clinic'

/* ส่วนประกอบหน้าเว็บเวชระเบียน/นักกายภาพ ตามดีไซน์ ALS Rehab (โทน rx-*) */

export const inputCls = 'h-11 w-full rounded-[10px] border border-rx-line bg-white px-3 text-[14px] text-rx-ink outline-none focus:border-rx-accent'
export const selectCls = 'h-11 w-full rounded-[10px] border border-rx-line bg-white px-2.5 text-[14px] text-rx-ink outline-none focus:border-rx-accent'
export const textareaCls = 'w-full resize-y rounded-[10px] border border-rx-line bg-white px-3 py-2.5 text-[14px] text-rx-ink outline-none focus:border-rx-accent'
export const readonlyCls = 'h-11 w-full rounded-[10px] border border-white bg-rx-bg px-3 text-[14px] text-rx-ink outline-none'

export function PageHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col">
        <h1 className="m-0 text-[30px] font-semibold text-rx-ink">{title}</h1>
        {sub && <span className="text-[13px] text-rx-muted">{sub}</span>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-col gap-3 rounded-lg border border-white bg-white px-[18px] py-4 ${className}`}>{children}</div>
}

export function CardTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[16px] font-semibold text-rx-ink">{children}</span>
      {sub && <span className="text-[13px] text-rx-muted">{sub}</span>}
    </div>
  )
}

export function Badge({ state, label, bg, fg, className = '' }: { state?: QueueState; label?: ReactNode; bg?: string; fg?: string; className?: string }) {
  const [t, b, f] = state ? BADGE[state] : ['', '#EEF1F6', '#4A5B6E']
  return (
    <span className={`inline-block self-start whitespace-nowrap rounded-full px-3 py-[3px] text-[12px] font-semibold ${className}`} style={{ background: bg ?? b, color: fg ?? f }}>
      {label ?? t}
    </span>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-lg bg-rx-bg px-2.5 py-[3px] text-[12px] text-rx-ink">{children}</span>
}

type BtnVariant = 'primary' | 'outline' | 'accent-outline' | 'dark' | 'disabled'
const BTN: Record<BtnVariant, string> = {
  primary: 'border-none bg-rx-accent text-white hover:bg-rx-accent-ink',
  outline: 'border border-rx-line bg-white text-rx-ink hover:border-rx-tint-2',
  'accent-outline': 'border-[1.5px] border-rx-accent bg-white text-rx-accent-ink',
  dark: 'border-none bg-rx-ink text-white',
  disabled: 'border-none bg-rx-soft text-rx-muted',
}

export function Btn({ variant = 'primary', size = 'md', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 'h-10 px-3.5 text-[13px]' : size === 'lg' ? 'h-12 px-5 text-[15px]' : 'h-11 px-[18px] text-[14px]'
  const v = p.disabled ? BTN.disabled : BTN[variant]
  return <button type="button" {...p} className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${h} ${v} ${className}`} />
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
    <div className="flex flex-col gap-0.5 rounded-lg bg-white px-4 py-3.5">
      <span className="text-[12px] text-rx-muted">{label}</span>
      <span className="text-[26px] font-semibold" style={{ color }}>{value}</span>
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
    <div className="flex items-start gap-2.5 rounded-lg bg-rx-tint px-4 py-3 text-[13px] leading-relaxed text-rx-accent-deep">
      <Info size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function Loading({ text = 'กำลังโหลด...' }: { text?: string }) {
  return <div className="py-16 text-center text-[13px] text-rx-muted">{text}</div>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <div className="rounded-lg bg-[#FCEBEB] px-4 py-2.5 text-[13px] text-[#791F1F]">{children}</div> : null
}

export function Segmented<T extends string>({ value, options, onChange, small }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="flex gap-1 self-start rounded-lg bg-white p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${small ? 'h-[34px]' : 'h-[38px]'} rounded-md px-4 text-[13px] font-semibold ${value === o.value ? 'bg-rx-accent text-white' : 'bg-transparent text-rx-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function IconBtn({ label, onClick, dir }: { label: string; onClick: () => void; dir: 'prev' | 'next' }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rx-line bg-white text-rx-ink">
      {dir === 'prev' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  )
}

export function BackLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-9 items-center gap-1.5 self-start text-[13px] font-medium text-rx-accent-ink hover:text-rx-accent-deep">
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
    <div className="overflow-x-auto rounded-lg border border-white bg-white">
      <div style={{ minWidth }}>
        <div className="grid items-center gap-2.5 px-[18px] py-3 text-[12px] text-rx-muted" style={{ gridTemplateColumns: cols }}>
          {head.map((h, i) => <span key={i}>{h}</span>)}
        </div>
        {children}
      </div>
    </div>
  )
}

export function GridRow({ cols, children, muted }: { cols: string; children: ReactNode; muted?: boolean }) {
  return (
    <div className={`grid items-center gap-2.5 border-t border-rx-divider px-[18px] py-3 text-[14px] ${muted ? 'bg-rx-bg' : ''}`} style={{ gridTemplateColumns: cols }}>
      {children}
    </div>
  )
}
