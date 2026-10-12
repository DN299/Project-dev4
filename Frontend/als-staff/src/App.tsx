import { useEffect, useRef, useState } from "react";
import type { AuthUser, PageKey, TherapySession } from "./types";
import Sidebar from "./components/Sidebar";
import PatientTabBar from "./components/PatientTabBar";
import LoginPage from "./pages/shared/LoginPage";
import SchedulePage from "./pages/shared/SchedulePage";
import ProgramLibraryPage from "./pages/shared/ProgramLibraryPage";
import DashboardPage from "./pages/staff/DashboardPage";
import RegisterPage from "./pages/staff/RegisterPage";
import QueuePage from "./pages/staff/QueuePage";
import PatientHistoryPage from "./pages/staff/PatientHistoryPage";
import PatientsPage from "./pages/staff/PatientsPage";
import TreatmentStatusPage from "./pages/staff/TreatmentStatusPage";
import TherapistHomePage from "./pages/therapist/HomePage";
import MyCasesPage from "./pages/therapist/MyCasesPage";
import CasePage from "./pages/therapist/CasePage";
import AssessPage from "./pages/therapist/AssessPage";
import PatientHomePage from "./pages/patient/PatientHomePage";
import PatientQueuePage from "./pages/patient/PatientQueuePage";
import PatientAppointmentsPage from "./pages/patient/PatientAppointmentsPage";
import PatientStatsPage from "./pages/patient/PatientStatsPage";
import PatientFeedbackPage from "./pages/patient/PatientFeedbackPage";
import PatientProfilePage from "./pages/patient/PatientProfilePage";
import PatientTrainPage from "./pages/patient/PatientTrainPage";
import PatientSummaryPage from "./pages/patient/PatientSummaryPage";

interface Session {
  token: string;
  user: AuthUser;
}

const STAFF_PAGES: PageKey[] = [
  "dashboard",
  "register",
  "patients",
  "queue",
  "rec-patient",
  "status",
  "schedule",
];
const THERAPIST_PAGES: PageKey[] = [
  "my-home",
  "my-cases",
  "case",
  "assess",
  "my-schedule",
  "programs",
];
const PATIENT_PAGES: PageKey[] = [
  "patient-home",
  "patient-queue",
  "patient-appointments",
  "patient-stats",
  "patient-feedback",
  "patient-profile",
  "patient-train",
  "patient-summary",
];

const homeOf = (role: string): PageKey =>
  role === "R002" ? "my-home" : role === "R001" ? "patient-home" : "dashboard";

// ---------- URL ของแต่ละโรล / แต่ละหน้า ----------
// เช่น /records/queue · /records/patient/PAT000058 · /therapist/case/PAT000058 · /patient/train
type Prefix = "records" | "therapist" | "patient";
const prefixOf = (role: string): Prefix =>
  role === "R001" ? "patient" : role === "R002" ? "therapist" : "records";
const ROUTES: Record<Prefix, Record<string, PageKey>> = {
  records: {
    dashboard: "dashboard",
    register: "register",
    patients: "patients",
    queue: "queue",
    patient: "rec-patient",
    status: "status",
    schedule: "schedule",
  },
  therapist: {
    home: "my-home",
    cases: "my-cases",
    case: "case",
    assess: "assess",
    schedule: "my-schedule",
    programs: "programs",
  },
  patient: {
    home: "patient-home",
    queue: "patient-queue",
    appointments: "patient-appointments",
    stats: "patient-stats",
    feedback: "patient-feedback",
    profile: "patient-profile",
    train: "patient-train",
    summary: "patient-summary",
  },
};
type CaseTab = "today" | "history";

const pathOf = (
  role: string,
  page: PageKey,
  id: string | null,
  tab: CaseTab,
) => {
  const prefix = prefixOf(role);
  const slug =
    Object.keys(ROUTES[prefix]).find((k) => ROUTES[prefix][k] === page) ?? "";
  let p = `/${prefix}/${slug}`;
  if (id) p += `/${encodeURIComponent(id)}`;
  if (page === "case" && tab === "history") p += "?tab=history";
  return p;
};

const parseUrl = (
  role: string,
): { page: PageKey; id: string | null; tab: CaseTab } | null => {
  const prefix = prefixOf(role);
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== prefix) return null;
  const page = ROUTES[prefix][parts[1] ?? ""];
  if (!page) return null;
  const tab: CaseTab =
    new URLSearchParams(window.location.search).get("tab") === "history"
      ? "history"
      : "today";
  return { page, id: parts[2] ? decodeURIComponent(parts[2]) : null, tab };
};

// เก็บล็อกอินแยกต่อแท็บ → เปิดหลายโรลพร้อมกันได้ ไม่ทับกัน
const loadSession = (): Session | null => {
  const raw = sessionStorage.getItem("als-session");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// หน้าที่แสดงจริง (กันเข้าหน้าที่โรลนี้ไม่มีสิทธิ์ / หน้าที่ต้องมีผู้ป่วยแต่ไม่มี)
const resolvePage = (
  role: string,
  page: PageKey,
  patientTarget: string | null,
  assessTarget: string | null,
): PageKey => {
  const isTherapist = role === "R002";
  const allowed =
    role === "R001"
      ? PATIENT_PAGES
      : isTherapist
        ? THERAPIST_PAGES
        : STAFF_PAGES;
  let cur = allowed.includes(page) ? page : allowed[0];
  if ((cur === "case" || cur === "rec-patient") && !patientTarget)
    cur = isTherapist ? "my-cases" : "queue";
  if (cur === "assess" && !assessTarget) cur = "my-home";
  return cur;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  // เปิดจาก URL ได้เลย (รีเฟรชแล้วอยู่หน้าเดิม)
  const [init] = useState(() => {
    const s = loadSession();
    return s ? parseUrl(s.user.role_id) : null;
  });
  const [page, setPage] = useState<PageKey>(
    () => init?.page ?? homeOf(loadSession()?.user.role_id ?? ""),
  );
  // คำขอนัดที่กดมาจากหน้าสถานะ → หน้าตารางนัดเปิดโหมดลงนัดให้ทันที
  const [bookRequest, setBookRequest] = useState<string | null>(null);
  // ผู้ป่วยที่เปิดดูอยู่ (หน้าเคส / ประวัติการรักษา) และนัดประเมินที่กำลังทำ
  const [patientTarget, setPatientTarget] = useState<string | null>(() =>
    init && (init.page === "case" || init.page === "rec-patient")
      ? init.id
      : null,
  );
  const [assessTarget, setAssessTarget] = useState<string | null>(() =>
    init && init.page === "assess" ? init.id : null,
  );
  // หน้าประวัติการรักษา (เวชระเบียน) เปิดมาจากหน้าไหน — ปุ่มกลับพากลับไปที่นั่น
  const [historyBack, setHistoryBack] = useState<PageKey>("queue");
  // หน้าเคสของนักกายภาพเปิดที่แท็บไหน (เคสของฉัน → ประวัติการรักษา)
  const [caseTab, setCaseTab] = useState<CaseTab>(() => init?.tab ?? "today");
  const [lastSet, setLastSet] = useState<TherapySession | null>(null);
  const firstUrl = useRef(true);

  // หน้าเปลี่ยน → อัปเดต URL
  useEffect(() => {
    if (!session) {
      // ยังไม่ล็อกอิน → URL เป็น /login
      if (window.location.pathname !== "/login")
        window.history.replaceState(null, "", "/login");
      return;
    }
    const role = session.user.role_id;
    const cur = resolvePage(role, page, patientTarget, assessTarget);
    const id =
      cur === "case" || cur === "rec-patient"
        ? patientTarget
        : cur === "assess"
          ? assessTarget
          : null;
    const path = pathOf(role, cur, id, caseTab);
    if (path !== window.location.pathname + window.location.search) {
      if (firstUrl.current) window.history.replaceState(null, "", path);
      else window.history.pushState(null, "", path);
    }
    firstUrl.current = false;
  }, [session, page, patientTarget, assessTarget, caseTab]);

  // ปุ่มย้อนกลับ/ไปข้างหน้าของเบราว์เซอร์ → เปลี่ยนหน้าตาม URL
  useEffect(() => {
    if (!session) return;
    const role = session.user.role_id;
    const onPop = () => {
      const r = parseUrl(role);
      if (!r) {
        window.history.replaceState(
          null,
          "",
          pathOf(role, homeOf(role), null, "today"),
        );
        setPage(homeOf(role));
        return;
      }
      if (r.page === "case" || r.page === "rec-patient") setPatientTarget(r.id);
      if (r.page === "assess") setAssessTarget(r.id);
      if (r.page === "case") setCaseTab(r.tab);
      setPage(r.page);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [session]);

  const handleLogin = (token: string, user: AuthUser) => {
    const s = { token, user };
    sessionStorage.setItem("als-session", JSON.stringify(s));
    firstUrl.current = true;
    setSession(s);
    setPage(homeOf(user.role_id));
  };

  const handleLogout = () => {
    sessionStorage.removeItem("als-session");
    window.history.replaceState(null, "", "/login");
    setSession(null);
  };

  if (!session) return <LoginPage onLogin={handleLogin} />;

  const { user } = session;
  const isTherapist = user.role_id === "R002";
  const isPatient = user.role_id === "R001";
  const current = resolvePage(user.role_id, page, patientTarget, assessTarget);

  const goto = (p: PageKey) => {
    setPage(p);
    window.scrollTo(0, 0);
  };
  const openPatient = (patientId: string, from: PageKey = "queue") => {
    setPatientTarget(patientId);
    setHistoryBack(from);
    setCaseTab("today");
    goto(isTherapist ? "case" : "rec-patient");
  };
  const openCaseHistory = (patientId: string) => {
    setPatientTarget(patientId);
    setCaseTab("history");
    goto("case");
  };
  const openAssess = (appointmentId: string) => {
    setAssessTarget(appointmentId);
    goto("assess");
  };

  if (isPatient) {
    const patientId = user.patient_id ?? "";
    const shell =
      "mx-auto flex h-screen max-w-[480px] flex-col border-x border-pt-line bg-pt-bg font-pt text-pt-ink";

    // หน้าระหว่างฝึก / สรุปหลังจบเซต แสดงเต็มจอ ไม่มีแท็บด้านล่าง
    if (current === "patient-train" || current === "patient-summary") {
      return (
        <div className={shell}>
          <div className="flex-1 overflow-y-auto">
            {current === "patient-train" && (
              <PatientTrainPage
                patientId={patientId}
                onBack={() => goto("patient-home")}
                onFinish={(s) => {
                  setLastSet(s);
                  goto("patient-summary");
                }}
              />
            )}
            {current === "patient-summary" && (
              <PatientSummaryPage
                patientId={patientId}
                firstName={user.first_name.trim()}
                session={lastSet}
                onHome={() => goto("patient-home")}
                onHistory={() => goto("patient-stats")}
              />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={shell}>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
          {current === "patient-home" && (
            <PatientHomePage
              patientId={patientId}
              onNavigate={goto}
              onLogout={handleLogout}
            />
          )}
          {current === "patient-queue" && (
            <PatientQueuePage
              patientId={patientId}
              onTrain={() => goto("patient-train")}
            />
          )}
          {current === "patient-appointments" && (
            <PatientAppointmentsPage patientId={patientId} />
          )}
          {current === "patient-stats" && (
            <PatientStatsPage patientId={patientId} />
          )}
          {current === "patient-feedback" && (
            <PatientFeedbackPage patientId={patientId} />
          )}
          {current === "patient-profile" && (
            <PatientProfilePage user={user} onLogout={handleLogout} />
          )}
        </div>
        <PatientTabBar page={current} onNavigate={goto} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-wrap bg-rx-gradient font-rx text-rx-ink md:flex-nowrap">
      <Sidebar
        page={current}
        onNavigate={goto}
        user={user}
        onLogout={handleLogout}
      />
      <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6">
        <div className="flex max-w-[1200px] flex-col gap-6">
          {current === "dashboard" && <DashboardPage />}
          {current === "register" && (
            <RegisterPage user={user} onDone={() => goto("queue")} />
          )}
          {current === "patients" && (
            <PatientsPage onOpenHistory={(id) => openPatient(id, "patients")} />
          )}
          {current === "queue" && (
            <QueuePage user={user} onOpenPatient={openPatient} />
          )}
          {current === "rec-patient" && patientTarget && (
            <PatientHistoryPage
              patientId={patientTarget}
              backLabel={
                historyBack === "patients"
                  ? "กลับไปผู้ป่วยทั้งหมด"
                  : historyBack === "status"
                    ? "กลับไปหน้าสถานะ"
                    : "กลับไปคิวผู้ป่วย"
              }
              onBack={() => goto(historyBack)}
            />
          )}
          {current === "status" && (
            <TreatmentStatusPage
              user={user}
              onOpenHistory={(id) => openPatient(id, "status")}
              onGoSchedule={(rid) => {
                setBookRequest(rid ?? null);
                goto("schedule");
              }}
            />
          )}
          {current === "schedule" && (
            <SchedulePage
              user={user}
              bookRequestId={bookRequest}
              onBookingHandled={() => setBookRequest(null)}
            />
          )}
          {current === "my-schedule" && <SchedulePage user={user} />}
          {current === "programs" && <ProgramLibraryPage user={user} />}
          {current === "my-home" && (
            <TherapistHomePage
              user={user}
              onOpenCase={openPatient}
              onAssess={openAssess}
            />
          )}
          {current === "my-cases" && (
            <MyCasesPage user={user} onOpenCase={openCaseHistory} />
          )}
          {current === "case" && patientTarget && (
            <CasePage
              key={`${patientTarget}-${caseTab}`}
              user={user}
              patientId={patientTarget}
              initialTab={caseTab}
              onBack={() => goto("my-cases")}
            />
          )}
          {current === "assess" && assessTarget && (
            <AssessPage
              user={user}
              appointmentId={assessTarget}
              onBack={() => goto("my-home")}
              onDone={openPatient}
            />
          )}
        </div>
      </main>
    </div>
  );
}
