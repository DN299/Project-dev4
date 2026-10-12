-- นัดประเมินไม่ใช้กระดาน → นักกายภาพบันทึกผลประเมิน (COMPLETED) ได้ทั้งจาก SCHEDULED และ CHECKED_IN
-- ไม่ต้องรอเวชระเบียนรับคิว และไม่ต้องเชื่อมต่อกระดานก่อน · นัดฝึกยังต้อง IN_PROGRESS ก่อนจบเหมือนเดิม
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
    if new.appointment_type = 'ASSESSMENT' then
      if old.status not in ('SCHEDULED', 'CHECKED_IN') then
        raise exception 'บันทึกผลประเมินได้เฉพาะนัดประเมินที่ยังไม่จบ';
      end if;
      new.checked_in_at := coalesce(new.checked_in_at, utc_now);
    elsif old.status <> 'IN_PROGRESS' then
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
end $$;
