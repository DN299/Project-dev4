export const ID_PREFIX = {
  USER: "USR",
  PATIENT: "PAT",
  OT: "OT",
  PATIENT_PROGRAM: "PPG",
  PROGRAM: "PRG",
  APPOINTMENT: "APT",
  CASE: "CS",
  APPOINTMENT_REQUEST: "REQ",
};
export const SEQUENCE = {
  USER: "users_id_seq",
  PATIENT: "patient_id_seq",
  OT: "ot_id_seq",
  PROGRAM: "program_id_seq",
  PATIENT_PROGRAM: "patient_program_id_seq",
  THERAPY_SESSION: "therapy_session_id_seq",
  MOVEMENT_DATA: "movement_data_id_seq",
  DEVICE: "device_id_seq",
  APPOINTMENT: "appointment_id_seq",
  CASE: "case_id_seq",
  APPOINTMENT_REQUEST: "appointment_request_id_seq",
} as const;
