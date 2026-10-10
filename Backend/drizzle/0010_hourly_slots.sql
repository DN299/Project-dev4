-- ช่องนัดเปลี่ยนจาก 20 นาที เป็นช่องละ 1 ชั่วโมง (09:00–12:00, 13:00–16:00 วันละ 6 ช่อง)
-- slot (generated) = appointment_date + duration_min จึงกันนัดชนตามความยาวใหม่ให้เอง · นัดเดิมไม่ถูกแก้
ALTER TABLE "appointments" ALTER COLUMN "duration_min" SET DEFAULT 60;
