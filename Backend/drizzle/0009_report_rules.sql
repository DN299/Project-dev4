-- ปรับฐานข้อมูลให้ครบตามรายงานระบบ ALS Rehab
-- (treatment_cases, soap_amendments, slot, exclusion constraint และ unique index ถูกสร้างไว้แล้วในฐานข้อมูลจริง)
-- ไฟล์นี้เพิ่มเฉพาะกฎที่ยังขาด และแก้ trigger เดิมให้เก็บเวลาเป็น UTC ตามรายงาน

-- เวชระเบียนเรียกคิว (ผู้ป่วยเห็น "รอเชื่อมต่อ") ก่อนนักกายภาพเชื่อมต่อกระดาน
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "called_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "called_by" varchar(10) REFERENCES "users"("users_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

-- รหัสเคสคอร์สใหม่ (CS000001) — เคสเดิมใช้รูปแบบ CASE-<HN>
CREATE SEQUENCE IF NOT EXISTS "case_id_seq";--> statement-breakpoint

-- สถานะนัดเดินทางเดียว ห้ามข้ามขั้น · ไม่รับ walk-in · เวลาเก็บเป็น UTC แต่ตีความวันนัดเป็นเวลาไทย
CREATE OR REPLACE FUNCTION public.appt_status_guard() RETURNS trigger LANGUAGE plpgsql AS $$
declare
  appt_day date := ((new.appointment_date at time zone 'UTC') at time zone 'Asia/Bangkok')::date;
  today    date := (now() at time zone 'Asia/Bangkok')::date;
  utc_now  timestamp := now() at time zone 'UTC';
begin
  if tg_op = 'INSERT' then
    if new.status = 'SCHEDULED' then
      return new;
    end if;
    -- ผู้ป่วยใหม่ที่ลงทะเบียนวันนี้รับเข้าคิวประเมินได้ทันที นอกนั้นต้องเริ่มจากนัดเสมอ
    if new.status = 'CHECKED_IN' and new.appointment_type = 'ASSESSMENT' and appt_day = today then
      new.checked_in_at := coalesce(new.checked_in_at, utc_now);
      return new;
    end if;
    raise exception 'นัดใหม่ต้องเริ่มที่สถานะ SCHEDULED (ไม่รับ walk-in)';
  end if;

  if new.called_at is not null and old.called_at is null and new.status <> 'CHECKED_IN' then
    raise exception 'เรียกคิวได้เฉพาะผู้ป่วยที่รับเข้าคิวแล้ว';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status in ('COMPLETED', 'NO_SHOW', 'CANCELLED') then
    raise exception 'นัดนี้จบไปแล้ว เปลี่ยนสถานะไม่ได้';
  end if;

  if new.status = 'CHECKED_IN' then
    if old.status <> 'SCHEDULED' then
      raise exception 'รับเข้าคิวได้เฉพาะนัดที่ยังไม่เริ่ม';
    end if;
    if appt_day <> today then
      raise exception 'รับเข้าคิวได้เฉพาะวันที่มีนัด (ไม่รับ walk-in)';
    end if;
    new.checked_in_at := coalesce(new.checked_in_at, utc_now);
  elsif new.status = 'IN_PROGRESS' then
    if old.status <> 'CHECKED_IN' or new.appointment_type <> 'TRAINING' then
      raise exception 'ต้องรับเข้าคิวก่อนเชื่อมต่อกระดาน';
    end if;
    new.started_at := coalesce(new.started_at, utc_now);
  elsif new.status = 'COMPLETED' then
    if not (old.status = 'IN_PROGRESS' or (old.status = 'CHECKED_IN' and new.appointment_type = 'ASSESSMENT')) then
      raise exception 'จบการรักษาได้หลังเชื่อมต่อกระดานแล้วเท่านั้น';
    end if;
    new.completed_at := coalesce(new.completed_at, utc_now);
    new.treated_by   := coalesce(new.treated_by, new.ot_id);
  elsif new.status in ('NO_SHOW', 'CANCELLED') then
    if old.status = 'IN_PROGRESS' then
      raise exception 'นัดที่กำลังฝึกอยู่ต้องจบการฝึกก่อน';
    end if;
  end if;
  return new;
end $$;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_appt_status ON public.appointments;--> statement-breakpoint
CREATE TRIGGER trg_appt_status BEFORE INSERT OR UPDATE OF status, called_at ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION appt_status_guard();--> statement-breakpoint

-- ผูกและปล่อยกระดานอัตโนมัติตามสถานะนัด
CREATE OR REPLACE FUNCTION public.appt_bind_device() RETURNS trigger LANGUAGE plpgsql AS $$
begin
  if new.status = 'IN_PROGRESS' and old.status is distinct from 'IN_PROGRESS' then
    update devices set current_appointment_id = new.appointment_id, holder_patient_id = new.patient_id,
      live_reps = 0, live_status = 'IDLE', pending_command = 'START'
    where device_id = new.device_id;
  elsif old.status = 'IN_PROGRESS' and new.status is distinct from 'IN_PROGRESS' then
    update devices set current_appointment_id = null, holder_patient_id = null,
      live_reps = 0, live_status = 'IDLE', pending_command = 'STOP'
    where current_appointment_id = old.appointment_id;
  end if;
  return null;
end $$;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_appt_bind_device ON public.appointments;--> statement-breakpoint
CREATE TRIGGER trg_appt_bind_device AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION appt_bind_device();--> statement-breakpoint

-- บันทึกผลเซตได้เฉพาะนัดที่กำลังฝึก และโปรแกรมต้องเป็นของผู้ป่วยในนัดนั้น · ระบบนับลำดับเซตเอง
CREATE OR REPLACE FUNCTION public.session_guard() RETURNS trigger LANGUAGE plpgsql AS $$
declare
  a record;
  pp_patient varchar;
begin
  if new.appointment_id is null then
    raise exception 'ผลเซตต้องผูกกับนัดที่กำลังฝึก';
  end if;
  select status, patient_id into a from appointments where appointment_id = new.appointment_id;
  if a.status is distinct from 'IN_PROGRESS' then
    raise exception 'บันทึกผลเซตได้เฉพาะเมื่อนัดนั้นกำลังฝึกอยู่';
  end if;
  select patient_id into pp_patient from patient_programs where patient_program_id = new.patient_program_id;
  if pp_patient is distinct from a.patient_id then
    raise exception 'โปรแกรมที่ระบุไม่ใช่ของผู้ป่วยในนัดนี้';
  end if;
  select coalesce(max(set_number), 0) + 1 into new.set_number from therapy_sessions where appointment_id = new.appointment_id;
  return new;
end $$;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_session_guard ON public.therapy_sessions;--> statement-breakpoint
CREATE TRIGGER trg_session_guard BEFORE INSERT ON public.therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION session_guard();
--> statement-breakpoint
-- เวลาในฐานข้อมูลเก็บเป็น UTC (ตามรายงาน) — ค่า default now() และ RPC ของกระดานจะได้เวลาเดียวกับแอป
-- trigger แปลงเป็นเวลาไทยเองด้วย at time zone 'Asia/Bangkok'
ALTER DATABASE postgres SET "TimeZone" TO 'UTC';
--> statement-breakpoint
-- Supabase pooler ใช้ session เดิมซ้ำ จึงไม่พึ่ง TimeZone ของ session: ค่า default เขียนเวลาแบบ UTC ชัดเจน
ALTER TABLE "appointments" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "movement_data" ALTER COLUMN "recorded_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "programs" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "soap_amendments" ALTER COLUMN "amended_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "therapy_sessions" ALTER COLUMN "session_date" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "treatment_cases" ALTER COLUMN "opened_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT (now() at time zone 'utc');--> statement-breakpoint
-- คอลัมน์วันที่ใช้วันตามเวลาไทย
ALTER TABLE "patients" ALTER COLUMN "register_date" SET DEFAULT ((now() at time zone 'Asia/Bangkok')::date);--> statement-breakpoint
ALTER TABLE "patient_programs" ALTER COLUMN "assigned_date" SET DEFAULT ((now() at time zone 'Asia/Bangkok')::date);--> statement-breakpoint

-- RPC ของกระดาน: เวลาที่เห็นล่าสุดเป็น UTC เหมือนส่วนอื่น
CREATE OR REPLACE FUNCTION public.device_heartbeat(p_device_id text, p_live_reps integer, p_live_status text, p_imu_status text DEFAULT 'UNKNOWN'::text, p_live_angle real DEFAULT NULL::real, p_live_phase text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  cmd text;
  bound boolean;
begin
  select pending_command, current_appointment_id is not null into cmd, bound
  from devices where device_id = p_device_id for update;
  if not found then
    return null;
  end if;

  -- ค่าสดรับเฉพาะตอนเครื่องผูกกับนัดที่กำลังฝึก หลังจบการฝึกตัวนับเป็น 0
  update devices set
    live_reps         = case when bound then p_live_reps else 0 end,
    live_status       = case when bound then p_live_status else 'IDLE' end,
    imu_status        = p_imu_status,
    live_angle        = p_live_angle,
    live_phase        = p_live_phase,
    connection_status = 'CONNECTED',
    last_seen_at      = now() at time zone 'utc',
    pending_command   = null
  where device_id = p_device_id;

  return case when cmd = 'START' and not bound then null else cmd end;
end;
$$;
