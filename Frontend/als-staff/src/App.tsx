import { useState } from 'react'
import type { AuthUser, PageKey, TherapySession } from './types'
import Sidebar from './components/Sidebar'
import PatientTabBar from './components/PatientTabBar'
import LoginPage from './pages/shared/LoginPage'
import SchedulePage from './pages/shared/SchedulePage'
import ProgramLibraryPage from './pages/shared/ProgramLibraryPage'
import DashboardPage from './pages/staff/DashboardPage'
import RegisterPage from './pages/staff/RegisterPage'
import QueuePage from './pages/staff/QueuePage'
import PatientHistoryPage from './pages/staff/PatientHistoryPage'
import TreatmentStatusPage from './pages/staff/TreatmentStatusPage'
import TherapistHomePage from './pages/therapist/HomePage'
import MyCasesPage from './pages/therapist/MyCasesPage'
import CasePage from './pages/therapist/CasePage'
import AssessPage from './pages/therapist/AssessPage'
import PatientHomePage from './pages/patient/PatientHomePage'
import PatientQueuePage from './pages/patient/PatientQueuePage'
import PatientAppointmentsPage from './pages/patient/PatientAppointmentsPage'
import PatientStatsPage from './pages/patient/PatientStatsPage'
import PatientFeedbackPage from './pages/patient/PatientFeedbackPage'
import PatientProfilePage from './pages/patient/PatientProfilePage'
import PatientTrainPage from './pages/patient/PatientTrainPage'
import PatientSummaryPage from './pages/patient/PatientSummaryPage'

interface Session { token: string; user: AuthUser }

const STAFF_PAGES: PageKey[] = ['dashboard', 'register', 'queue', 'rec-patient', 'status', 'schedule', 'programs']
const THERAPIST_PAGES: PageKey[] = ['my-home', 'my-cases', 'case', 'assess', 'my-schedule', 'programs']
const PATIENT_PAGES: PageKey[] = ['patient-home', 'patient-queue', 'patient-appointments', 'patient-stats', 'patient-feedback', 'patient-profile', 'patient-train', 'patient-summary']

const homeOf = (role: string): PageKey => (role === 'R002' ? 'my-home' : role === 'R001' ? 'patient-home' : 'dashboard')

const loadSession = (): Session | null => {
  const raw = localStorage.getItem('als-session')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [page, setPage] = useState<PageKey>(() => homeOf(loadSession()?.user.role_id ?? ''))
  // ผู้ป่วยที่เปิดดูอยู่ (หน้าเคส / ประวัติการรักษา) และนัดประเมินที่กำลังทำ
  const [patientTarget, setPatientTarget] = useState<string | null>(null)
  const [assessTarget, setAssessTarget] = useState<string | null>(null)
  const [lastSet, setLastSet] = useState<TherapySession | null>(null)

  const handleLogin = (token: string, user: AuthUser) => {
    const s = { token, user }
    localStorage.setItem('als-session', JSON.stringify(s))
    setSession(s)
    setPage(homeOf(user.role_id))
  }

  const handleLogout = () => {
    localStorage.removeItem('als-session')
    setSession(null)
  }

  if (!session) return <LoginPage onLogin={handleLogin} />

  const { user } = session
  const isTherapist = user.role_id === 'R002'
  const isPatient = user.role_id === 'R001'
  const allowedPages = isPatient ? PATIENT_PAGES : isTherapist ? THERAPIST_PAGES : STAFF_PAGES
  let current = allowedPages.includes(page) ? page : allowedPages[0]
  if ((current === 'case' || current === 'rec-patient') && !patientTarget) current = isTherapist ? 'my-cases' : 'queue'
  if (current === 'assess' && !assessTarget) current = 'my-home'

  const goto = (p: PageKey) => { setPage(p); window.scrollTo(0, 0) }
  const openPatient = (patientId: string) => { setPatientTarget(patientId); goto(isTherapist ? 'case' : 'rec-patient') }
  const openAssess = (appointmentId: string) => { setAssessTarget(appointmentId); goto('assess') }

  if (isPatient) {
    const patientId = user.patient_id ?? ''
    const shell = 'mx-auto flex h-screen max-w-[480px] flex-col border-x border-pt-line bg-pt-bg font-pt text-pt-ink'

    // หน้าระหว่างฝึก / สรุปหลังจบเซต แสดงเต็มจอ ไม่มีแท็บด้านล่าง
    if (current === 'patient-train' || current === 'patient-summary') {
      return (
        <div className={shell}>
          <div className="flex-1 overflow-y-auto">
            {current === 'patient-train' && (
              <PatientTrainPage
                patientId={patientId}
                onBack={() => goto('patient-home')}
                onFinish={s => { setLastSet(s); goto('patient-summary') }}
              />
            )}
            {current === 'patient-summary' && (
              <PatientSummaryPage
                patientId={patientId}
                firstName={user.first_name.trim()}
                session={lastSet}
                onHome={() => goto('patient-home')}
                onHistory={() => goto('patient-stats')}
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div className={shell}>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
          {current === 'patient-home'         && <PatientHomePage patientId={patientId} onNavigate={goto} onLogout={handleLogout} />}
          {current === 'patient-queue'        && <PatientQueuePage patientId={patientId} onTrain={() => goto('patient-train')} />}
          {current === 'patient-appointments' && <PatientAppointmentsPage patientId={patientId} />}
          {current === 'patient-stats'        && <PatientStatsPage patientId={patientId} />}
          {current === 'patient-feedback'     && <PatientFeedbackPage patientId={patientId} />}
          {current === 'patient-profile'      && <PatientProfilePage user={user} onLogout={handleLogout} />}
        </div>
        <PatientTabBar page={current} onNavigate={goto} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-wrap bg-rx-bg font-rx text-rx-ink md:flex-nowrap">
      <Sidebar page={current} onNavigate={goto} user={user} onLogout={handleLogout} />
      <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6">
        <div className="flex max-w-[1200px] flex-col gap-6">
          {current === 'dashboard'   && <DashboardPage />}
          {current === 'register'    && <RegisterPage user={user} onDone={() => goto('queue')} />}
          {current === 'queue'       && <QueuePage user={user} onOpenPatient={openPatient} />}
          {current === 'rec-patient' && patientTarget && <PatientHistoryPage patientId={patientTarget} onBack={() => goto('queue')} />}
          {current === 'status'      && <TreatmentStatusPage user={user} />}
          {current === 'schedule'    && <SchedulePage user={user} />}
          {current === 'my-schedule' && <SchedulePage user={user} />}
          {current === 'programs'    && <ProgramLibraryPage user={user} />}
          {current === 'my-home'     && <TherapistHomePage user={user} onOpenCase={openPatient} onAssess={openAssess} />}
          {current === 'my-cases'    && <MyCasesPage user={user} onOpenCase={openPatient} />}
          {current === 'case'        && patientTarget && <CasePage user={user} patientId={patientTarget} onBack={() => goto('my-cases')} />}
          {current === 'assess'      && assessTarget && <AssessPage user={user} appointmentId={assessTarget} onBack={() => goto('my-home')} onDone={openPatient} />}
        </div>
      </main>
    </div>
  )
}
