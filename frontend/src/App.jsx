import { useEffect, useMemo, useState } from 'react'
import {
  AppointmentTable,
  Input,
  LoginScreen,
  Modal,
  ModalFooter,
  PatientCard,
  SearchBox,
  Select,
  Spinner,
  StatCard,
  Textarea,
  Toast,
} from './components/HbysComponents.jsx'
import BedManagement from './components/Bedmanagement.jsx'
import styles from './styles.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const ROLE_PERMISSIONS = {
  hasta: ['appointment.create', 'appointment.cancel', 'patient.view'],
  doktor: ['appointment.create', 'appointment.cancel', 'appointment.status.update', 'medical_record.create', 'prescription.create', 'bed.view'],
  sekreter: ['patient.create', 'patient.view', 'appointment.create', 'appointment.cancel', 'appointment.approve', 'appointment.reject', 'appointment.reschedule', 'appointment.status.update', 'bed.view'],
  hemsire: ['patient.view', 'bed.view', 'bed.assign', 'bed.discharge', 'bed.status.update', 'cleaning.view', 'cleaning.complete'],
  temizlik_personeli: ['bed.view', 'cleaning.view', 'cleaning.start', 'cleaning.complete'],
  yonetici: ['*'],
}

const emptyPatient = {
  tc_no: '',
  first_name: '',
  last_name: '',
  phone: '',
  gender: 'Kadın',
}

const emptyAppointment = {
  patient_id: '',
  doctor_id: '',
  department_id: '',
  date: '',
  time: '',
  note: '',
}

const emptyExamination = {
  diagnosis: '',
  notes: '',
  medicine_name: '',
  dosage: '',
  days: '5',
}

function getLocalToday() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateKeyForDisplay(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

function getLocalTimeKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function getLocalTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`
}

const APPOINTMENT_START_TIME = '08:30'
const APPOINTMENT_END_TIME = '17:00'

function isValidAppointmentTime(time) {
  if (!time || time < APPOINTMENT_START_TIME || time > APPOINTMENT_END_TIME) return false
  const minute = Number(time.split(':')[1])
  return minute === 0 || minute === 30
}

function isAppointmentTimeReached(value) {
  const appointmentDate = new Date(value)
  return !Number.isNaN(appointmentDate.getTime()) && appointmentDate.getTime() <= Date.now()
}

async function getErrorMessage(response, fallback) {
  try {
    const data = await response.json()
    return data.detail || data.message || fallback
  } catch {
    return fallback
  }
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('hbys_user')) || null
    } catch {
      return null
    }
  })
  const [role, setRole] = useState(() => {
    try {
      const storedUser = JSON.parse(sessionStorage.getItem('hbys_user'))
      return storedUser?.role === 'doktor' ? 'doctor' : storedUser?.role === 'hasta' ? 'patient' : storedUser?.role === 'yonetici' ? 'admin' : storedUser?.role === 'hemsire' ? 'nurse' : storedUser?.role === 'temizlik_personeli' ? 'cleaner' : 'secretary'
    } catch {
      return 'secretary'
    }
  })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [medicalRecords, setMedicalRecords] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [smsReminders, setSmsReminders] = useState([])
  const [inpatientServices, setInpatientServices] = useState([])
  const [beds, setBeds] = useState([])
  const [cleaningTasks, setCleaningTasks] = useState([])
  const [processingRequest, setProcessingRequest] = useState(null)

  const [patientForm, setPatientForm] = useState(emptyPatient)
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment)
  const [examinationForm, setExaminationForm] = useState(emptyExamination)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false)
  const [isExaminationModalOpen, setIsExaminationModalOpen] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [appointmentSearch, setAppointmentSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [newPatientCredentials, setNewPatientCredentials] = useState(null)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [calendarDate, setCalendarDate] = useState(getLocalToday())
  const [calendarView, setCalendarView] = useState('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeSecretaryTab, setActiveSecretaryTab] = useState('appointments')
  const [activeDoctorTab, setActiveDoctorTab] = useState('today')
  const [activePatientTab, setActivePatientTab] = useState('appointments')
  const [activeAdminTab, setActiveAdminTab] = useState('operations')
  const [operationsPeriod, setOperationsPeriod] = useState('today')
  const [operationsDepartmentId, setOperationsDepartmentId] = useState('all')
  const [selectedPatientCard, setSelectedPatientCard] = useState(null)
  const [rescheduleAppointment, setRescheduleAppointment] = useState(null)
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' })
  const [calendarRevision, setCalendarRevision] = useState(0)
  const [availabilityRange, setAvailabilityRange] = useState('14')
  const [morningOnly, setMorningOnly] = useState(false)
  const [afternoonOnly, setAfternoonOnly] = useState(false)
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState('')
  const [useNearestAppointment, setUseNearestAppointment] = useState(false)
  const [showAvailabilityOptions, setShowAvailabilityOptions] = useState(false)

  const can = (permission) => {
    const permissions = ROLE_PERMISSIONS[user?.role] || []
    return permissions.includes('*') || permissions.includes(permission)
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Giriş yapılamadı.'))
      }
      const loggedInUser = await response.json()
      sessionStorage.setItem('hbys_user', JSON.stringify(loggedInUser))
      setUser(loggedInUser)
      setRole(loggedInUser.role === 'doktor' ? 'doctor' : loggedInUser.role === 'hasta' ? 'patient' : loggedInUser.role === 'yonetici' ? 'admin' : loggedInUser.role === 'hemsire' ? 'nurse' : loggedInUser.role === 'temizlik_personeli' ? 'cleaner' : 'secretary')
      setLoginForm({ username: '', password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('hbys_user')
    setUser(null)
    setRole('secretary')
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    if (saving) return
    setError('')
    setSuccessMessage('')
    if (passwordForm.new_password.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalıdır.')
      return
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('Yeni şifre tekrarı eşleşmiyor.')
      return
    }
    try {
      setSaving(true)
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, current_password: passwordForm.current_password, new_password: passwordForm.new_password }),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Şifre değiştirilemedi.'))
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setIsPasswordModalOpen(false)
      setSuccessMessage('Şifreniz başarıyla değiştirildi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      if (user?.role === 'temizlik_personeli') {
        const cleaningResponse = await fetch(`${API_URL}/cleaning-tasks/?user_id=${user.id}`)
        if (!cleaningResponse.ok) throw new Error('Temizlik görevleri alınamadı.')
        setPatients([])
        setInpatientServices([])
        setBeds([])
        setCleaningTasks(await cleaningResponse.json())
        setDepartments([]); setDoctors([]); setAppointments([]); setMedicalRecords([]); setPrescriptions([]); setAuditLogs([]); setSmsReminders([])
        return
      }
      if (user?.role === 'hemsire') {
        const [patientResponse, serviceResponse, bedResponse, cleaningResponse] = await Promise.all([
          fetch(`${API_URL}/patients/?user_id=${user.id}&available_for_admission=true`),
          fetch(`${API_URL}/inpatient-services/?user_id=${user.id}`),
          fetch(`${API_URL}/beds/?user_id=${user.id}`),
          fetch(`${API_URL}/cleaning-tasks/?user_id=${user.id}`),
        ])
        if (!patientResponse.ok || !serviceResponse.ok || !bedResponse.ok || !cleaningResponse.ok) throw new Error('Hemşire verileri alınamadı.')
        setPatients(await patientResponse.json())
        setInpatientServices(await serviceResponse.json())
        setBeds(await bedResponse.json())
        setCleaningTasks(await cleaningResponse.json())
        setDepartments([]); setDoctors([]); setAppointments([]); setMedicalRecords([]); setPrescriptions([]); setAuditLogs([]); setSmsReminders([])
        return
      }
      const appointmentsUrl = user?.role === 'doktor' && user.doctor_id
        ? `${API_URL}/appointments/?doctor_id=${user.doctor_id}&user_id=${user.id}`
        : user?.role === 'sekreter' && user.department_id
          ? `${API_URL}/appointments/?department_id=${user.department_id}&user_id=${user.id}`
          : user?.role === 'hasta' && user.patient_id
            ? `${API_URL}/appointments/?patient_id=${user.patient_id}&user_id=${user.id}`
            : `${API_URL}/appointments/?user_id=${user?.id || ''}`
      const departmentsUrl = `${API_URL}/departments/?user_id=${user?.id || ''}`
      const doctorsUrl = `${API_URL}/doctors/?user_id=${user?.id || ''}`
      const patientsUrl = user?.role === 'hasta' && user.patient_id
        ? `${API_URL}/patients/?patient_id=${user.patient_id}&user_id=${user.id}`
        : `${API_URL}/patients/?user_id=${user.id}`
      const medicalRecordsUrl = user?.role === 'hasta' && user.patient_id
        ? `${API_URL}/medical-records/?patient_id=${user.patient_id}`
        : user?.role === 'doktor' && user.doctor_id
          ? `${API_URL}/medical-records/?doctor_id=${user.doctor_id}`
          : `${API_URL}/medical-records/`
      const prescriptionsUrl = user?.role === 'hasta' && user.patient_id
        ? `${API_URL}/prescriptions/?patient_id=${user.patient_id}`
        : user?.role === 'doktor' && user.doctor_id
          ? `${API_URL}/prescriptions/?doctor_id=${user.doctor_id}`
          : `${API_URL}/prescriptions/`
      const smsRemindersUrl = user?.role === 'sekreter' && user.department_id
        ? `${API_URL}/sms-reminders/?user_id=${user.id}&department_id=${user.department_id}`
        : `${API_URL}/sms-reminders/?user_id=${user?.id || ''}`
      const responses = await Promise.all([
        fetch(departmentsUrl),
        fetch(doctorsUrl),
        fetch(patientsUrl),
        fetch(appointmentsUrl),
        fetch(medicalRecordsUrl),
        fetch(prescriptionsUrl),
        fetch(`${API_URL}/audit-logs/`),
        fetch(smsRemindersUrl),
      ])

      if (responses.slice(0, 7).some((response) => !response.ok)) {
        throw new Error('Backend verileri alınamadı.')
      }

      const data = await Promise.all(responses.slice(0, 7).map((response) => response.json()))
      setDepartments(data[0])
      setDoctors(data[1])
      setPatients(data[2])
      setAppointments(data[3])
      setMedicalRecords(data[4])
      setPrescriptions(data[5])
      setAuditLogs(data[6])
      setSmsReminders(responses[7].ok ? await responses[7].json() : [])
      if (['sekreter', 'doktor', 'yonetici', 'hemsire', 'temizlik_personeli'].includes(user?.role)) {
        const bedQuery = `?user_id=${user.id}`
        const [serviceResponse, bedResponse] = await Promise.all([
          fetch(`${API_URL}/inpatient-services/${bedQuery}`),
          fetch(`${API_URL}/beds/${bedQuery}`),
        ])
        if (serviceResponse.ok) setInpatientServices(await serviceResponse.json())
        if (bedResponse.ok) setBeds(await bedResponse.json())
      } else {
        setInpatientServices([])
        setBeds([])
      }
    } catch (err) {
      console.error(err)
      setError('Veriler yüklenemedi. Backend sunucusunun çalıştığını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  const refreshSmsReminders = async () => {
    if (!user || !['sekreter', 'yonetici', 'hasta'].includes(user.role)) return
    try {
      const url = user.role === 'sekreter' && user.department_id
        ? `${API_URL}/sms-reminders/?user_id=${user.id}&department_id=${user.department_id}`
        : `${API_URL}/sms-reminders/?user_id=${user.id}`
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) setSmsReminders(await response.json())
    } catch (err) {
      console.warn('SMS kuyruğu yenilenemedi:', err)
    }
  }

  const refreshAppointments = async () => {
    const url = user?.role === 'sekreter' && user.department_id
      ? `${API_URL}/appointments/?department_id=${user.department_id}&user_id=${user.id}`
      : user?.role === 'doktor' && user.doctor_id
        ? `${API_URL}/appointments/?doctor_id=${user.doctor_id}&user_id=${user.id}`
        : user?.role === 'hasta' && user.patient_id
          ? `${API_URL}/appointments/?patient_id=${user.patient_id}&user_id=${user.id}`
          : `${API_URL}/appointments/?user_id=${user?.id || ''}`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Güncel randevular alınamadı.')
    const freshAppointments = await response.json()
    setAppointments(freshAppointments)
    return freshAppointments
  }

  const refreshBedData = async () => {
    if (!user || !['doktor', 'yonetici', 'hemsire', 'temizlik_personeli'].includes(user.role)) return
    const query = `?user_id=${user.id}`
    const [serviceResponse, bedResponse] = await Promise.all([
      fetch(`${API_URL}/inpatient-services/${query}`, { cache: 'no-store' }),
      fetch(`${API_URL}/beds/${query}`, { cache: 'no-store' }),
    ])
    if (!serviceResponse.ok || !bedResponse.ok) throw new Error('Servis ve yatak verileri alınamadı.')
    const freshServices = await serviceResponse.json()
    const freshBeds = await bedResponse.json()
    setInpatientServices(freshServices)
    setBeds(freshBeds)
    if (['hemsire', 'yonetici', 'temizlik_personeli'].includes(user.role)) {
      const taskResponse = await fetch(`${API_URL}/cleaning-tasks/?user_id=${user.id}`, { cache: 'no-store' })
      if (taskResponse.ok) setCleaningTasks(await taskResponse.json())
    }
    return { services: freshServices, beds: freshBeds }
  }

  const handleAssignBed = async (payload) => {
    if (saving) return false
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/bed-assignments/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Hasta yatağa yatırılamadı.'))
      await refreshBedData()
      setSuccessMessage('Hasta seçilen yatağa başarıyla yatırıldı.')
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleDischargePatient = async (assignmentId) => {
    if (saving || !window.confirm('Bu hastayı taburcu etmek istediğinize emin misiniz?')) return
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/bed-assignments/${assignmentId}/discharge?user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Hasta taburcu edilemedi.'))
      await refreshBedData()
      setSuccessMessage('Hasta taburcu edildi. Yatak temizlik bekliyor durumuna alındı.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTransferPatient = async (assignmentId, payload) => {
    if (saving) return false
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/bed-assignments/${assignmentId}/transfer?user_id=${user.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Hasta transfer edilemedi.'))
      await refreshBedData()
      setSuccessMessage('Hasta yeni yatağa başarıyla transfer edildi.')
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteBedCleaning = async (bedId) => {
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/beds/${bedId}/status?status=${encodeURIComponent('Boş')}&user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Yatak boş duruma alınamadı.'))
      await refreshBedData()
      setSuccessMessage('Yatak temizliği tamamlandı ve tekrar kullanıma açıldı.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteCleaningTask = async (taskId) => {
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/cleaning-tasks/${taskId}/complete?user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Temizlik görevi tamamlanamadı.'))
      await refreshBedData()
      setSuccessMessage('Temizlik görevi tamamlandı. Yatak tekrar kullanıma açıldı.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStartCleaningTask = async (taskId) => {
    if (saving) return
    try {
      setSaving(true)
      const response = await fetch(`${API_URL}/cleaning-tasks/${taskId}/start?user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Temizlik görevi başlatılamadı.'))
      await refreshBedData()
      setSuccessMessage('Temizlik görevi başlatıldı.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (user) loadData()
  }, [user])

  useEffect(() => {
    if (!user || role !== 'secretary' || activeSecretaryTab !== 'appointments') return undefined
    const timer = window.setInterval(() => {
      refreshAppointments().catch((err) => console.warn('Randevu talepleri otomatik yenilenemedi:', err))
    }, 15000)
    return () => window.clearInterval(timer)
  }, [user?.id, role, activeSecretaryTab])

  useEffect(() => {
    if (!user || !['secretary', 'admin', 'patient'].includes(role)) return undefined
    const timer = window.setInterval(() => {
      refreshSmsReminders().catch((err) => console.warn('SMS durumu otomatik yenilenemedi:', err))
    }, 15000)
    return () => window.clearInterval(timer)
  }, [user?.id, role, user?.department_id])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDateTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [role, loading])

  const filteredPatients = useMemo(() => {
    const query = patientSearch.toLocaleLowerCase('tr-TR')
    return patients.filter((patient) =>
      `${patient.first_name} ${patient.last_name} ${patient.tc_no}`
        .toLocaleLowerCase('tr-TR')
        .includes(query),
    )
  }, [patients, patientSearch])

  const filteredAppointments = useMemo(() => {
    const query = appointmentSearch.toLocaleLowerCase('tr-TR')
    return appointments.filter((appointment) => {
      const patient = patients.find((item) => item.id === appointment.patient_id)
      const doctor = doctors.find((item) => item.id === appointment.doctor_id)
      const text = `${patient?.first_name || ''} ${patient?.last_name || ''} ${doctor?.first_name || ''} ${doctor?.last_name || ''} ${appointment.status || ''}`
      return text.toLocaleLowerCase('tr-TR').includes(query)
    })
  }, [appointments, patients, doctors, appointmentSearch])

  const requestedAppointments = useMemo(() => appointments
    .filter((appointment) => appointment.status === 'Talep Edildi')
    .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date))), [appointments])

  const calendarAppointments = useMemo(() => appointments
    .filter((appointment) => getLocalDateKey(appointment.appointment_date) === calendarDate)
    .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date))), [appointments, calendarDate])

  const weekDates = useMemo(() => {
    const selected = new Date(`${calendarDate}T12:00:00`)
    const monday = new Date(selected)
    const day = monday.getDay() || 7
    monday.setDate(monday.getDate() - day + 1 + weekOffset * 7)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return getLocalDateKey(date)
    })
  }, [calendarDate, weekOffset])

  const weeklyAppointments = useMemo(() => appointments.filter((appointment) => weekDates.includes(getLocalDateKey(appointment.appointment_date))), [appointments, weekDates])
  const outOfHoursAppointments = useMemo(() => {
    const visibleAppointments = calendarView === 'day' ? calendarAppointments : weeklyAppointments
    return visibleAppointments.filter((appointment) => !isValidAppointmentTime(getLocalTimeKey(appointment.appointment_date)))
  }, [calendarView, calendarAppointments, weeklyAppointments])

  const clinicDepartment = useMemo(() => departments.find((department) => department.id === user?.department_id), [departments, user])
  const clinicDoctors = useMemo(() => doctors.filter((doctor) => doctor.department_id === user?.department_id), [doctors, user])
  const clinicAppointments = useMemo(() => appointments.filter((appointment) => appointment.department_id === user?.department_id), [appointments, user])
  const clinicTodayAppointments = useMemo(() => clinicAppointments.filter((appointment) => getLocalDateKey(appointment.appointment_date) === getLocalToday()), [clinicAppointments])
  const patientAppointmentSummaries = useMemo(() => {
    const summaries = Object.fromEntries(patients.map((patient) => [patient.id, { count: 0, next: null }]))
    const now = new Date()
    appointments.forEach((appointment) => {
      if (!summaries[appointment.patient_id]) summaries[appointment.patient_id] = { count: 0, next: null }
      summaries[appointment.patient_id].count += 1
      const isActive = !['İptal', 'İptal Edildi', 'Reddedildi', 'Tamamlandı', 'Gelmedi'].includes(appointment.status)
      const appointmentDate = new Date(appointment.appointment_date)
      if (isActive && appointmentDate >= now && (!summaries[appointment.patient_id].next || appointmentDate < new Date(summaries[appointment.patient_id].next.appointment_date))) {
        summaries[appointment.patient_id].next = appointment
      }
    })
    return summaries
  }, [patients, appointments])
  const doctorTodayAppointments = useMemo(() => filteredAppointments.filter((appointment) => getLocalDateKey(appointment.appointment_date) === getLocalToday()).sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date))), [filteredAppointments])
  const doctorWaitingAppointments = useMemo(() => filteredAppointments.filter((appointment) => ['Onaylandı', 'Bekliyor'].includes(appointment.status)).sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date))), [filteredAppointments])
  const doctorCompletedAppointments = useMemo(() => filteredAppointments.filter((appointment) => appointment.status === 'Tamamlandı' || medicalRecords.some((record) => record.appointment_id === appointment.id)).sort((a, b) => String(b.appointment_date).localeCompare(String(a.appointment_date))), [filteredAppointments, medicalRecords])

  const getCalendarStatusStyle = (status) => status === 'Tamamlandı' ? styles.calendarCompleted : status === 'İptal' || status === 'İptal Edildi' || status === 'Reddedildi' ? styles.calendarCancelled : status === 'Muayenede' ? styles.calendarInExam : styles.calendarConfirmed
  const canRescheduleAppointment = (appointment) => !['Muayenede', 'Tamamlandı', 'İptal', 'İptal Edildi', 'Reddedildi', 'Gelmedi'].includes(appointment.status)

  const filteredDoctorsByDepartment = useMemo(() => {
    // Eğer randevu formunda bir poliklinik (department_id) seçilmişse:
    if (appointmentForm.department_id) {
      return doctors.filter(
        (doctor) => doctor.department_id === Number(appointmentForm.department_id)
      )
    }
    // Seçilmemişse tüm doktorları listele (veya boş dizi [] döndürebilirsin)
    return doctors
  }, [doctors, appointmentForm.department_id])

  const availableAppointmentSlots = useMemo(() => {
    if (!appointmentForm.doctor_id || !appointmentForm.date) return []
    const slots = []
    for (let minutes = 8 * 60 + 30; minutes <= 17 * 60; minutes += 30) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
      const minute = String(minutes % 60).padStart(2, '0')
      const time = `${hour}:${minute}`
      const dateTimeKey = `${appointmentForm.date}T${time}`
      const doctorBusy = appointments.some((item) =>
        String(item.doctor_id) === String(appointmentForm.doctor_id) &&
        !['İptal', 'İptal Edildi', 'Reddedildi'].includes(item.status) &&
        String(item.appointment_date).slice(0, 16) === dateTimeKey,
      )
      const patientBusy = appointmentForm.patient_id && appointments.some((item) =>
        String(item.patient_id) === String(appointmentForm.patient_id) &&
        !['İptal', 'İptal Edildi', 'Reddedildi'].includes(item.status) &&
        String(item.appointment_date).slice(0, 16) === dateTimeKey,
      )
      if (!doctorBusy && !patientBusy && new Date(dateTimeKey) >= new Date()) {
        slots.push({ value: time, label: time })
      }
    }
    return slots
  }, [appointments, appointmentForm.doctor_id, appointmentForm.date, appointmentForm.patient_id])

  const doctorAppointmentSuggestions = useMemo(() => {
    if (!appointmentForm.department_id) return {}
    const departmentDoctors = doctors.filter((doctor) => doctor.department_id === Number(appointmentForm.department_id))
    const blockedStatuses = ['İptal', 'İptal Edildi', 'Reddedildi']
    const suggestions = {}
    departmentDoctors.forEach((doctor) => {
      for (let dayOffset = 0; dayOffset < 90 && !suggestions[doctor.id]; dayOffset += 1) {
        const candidateDate = new Date()
        candidateDate.setHours(0, 0, 0, 0)
        candidateDate.setDate(candidateDate.getDate() + dayOffset)
        if (candidateDate.getDay() === 0 || candidateDate.getDay() === 6) continue
        const dateKey = getLocalDateKey(candidateDate)
        for (let minutes = 8 * 60 + 30; minutes <= 17 * 60; minutes += 30) {
          const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
          const key = `${dateKey}T${time}`
          const doctorBusy = appointments.some((item) => String(item.doctor_id) === String(doctor.id) && !blockedStatuses.includes(item.status) && String(item.appointment_date).slice(0, 16) === key)
          const patientBusy = appointmentForm.patient_id && appointments.some((item) => String(item.patient_id) === String(appointmentForm.patient_id) && !blockedStatuses.includes(item.status) && String(item.appointment_date).slice(0, 16) === key)
          if (!doctorBusy && !patientBusy && new Date(key) >= new Date()) {
            suggestions[doctor.id] = { doctor, date: dateKey, time }
            break
          }
        }
      }
    })
    return suggestions
  }, [appointments, doctors, appointmentForm.department_id, appointmentForm.patient_id])

  const nearestAppointmentSuggestion = appointmentForm.doctor_id
    ? doctorAppointmentSuggestions[appointmentForm.doctor_id] || null
    : null

  const appointmentAvailability = useMemo(() => {
    if (!appointmentForm.doctor_id) return []
    const blockedStatuses = ['İptal', 'İptal Edildi', 'Reddedildi']
    const days = []
    const dayCount = Number(availabilityRange)
    for (let offset = 0; offset < dayCount; offset += 1) {
      const candidate = new Date()
      candidate.setHours(0, 0, 0, 0)
      candidate.setDate(candidate.getDate() + offset)
      if (candidate.getDay() === 0 || candidate.getDay() === 6) continue
      const date = getLocalDateKey(candidate)
      const slots = []
      for (let minutes = 8 * 60 + 30; minutes <= 17 * 60; minutes += 30) {
        const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
        const key = `${date}T${time}`
        const doctorBusy = appointments.some((item) => String(item.doctor_id) === String(appointmentForm.doctor_id) && !blockedStatuses.includes(item.status) && String(item.appointment_date).slice(0, 16) === key)
        const patientBusy = appointmentForm.patient_id && appointments.some((item) => String(item.patient_id) === String(appointmentForm.patient_id) && !blockedStatuses.includes(item.status) && String(item.appointment_date).slice(0, 16) === key)
        const matchesPeriod = (!morningOnly && !afternoonOnly) || (morningOnly && minutes < 12 * 60) || (afternoonOnly && minutes >= 12 * 60)
        if (!doctorBusy && !patientBusy && matchesPeriod && new Date(key) >= new Date()) slots.push(time)
      }
      if (slots.length) days.push({ date, slots })
    }
    return days
  }, [appointments, appointmentForm.doctor_id, appointmentForm.patient_id, availabilityRange, morningOnly, afternoonOnly])

  useEffect(() => {
    const selectedSlotIsValid = availableAppointmentSlots.some((slot) => slot.value === appointmentForm.time)
    if (appointmentForm.time && !selectedSlotIsValid) {
      setAppointmentForm((previous) => ({ ...previous, time: availableAppointmentSlots[0]?.value || '' }))
    } else if (!appointmentForm.time && availableAppointmentSlots[0]) {
      setAppointmentForm((previous) => ({ ...previous, time: availableAppointmentSlots[0].value }))
    }
  }, [availableAppointmentSlots, appointmentForm.time])

  useEffect(() => {
    if (!appointmentForm.doctor_id || !appointmentAvailability.length) return
    const selectedDay = appointmentAvailability.find((item) => item.date === selectedAvailabilityDate) || appointmentAvailability.find((item) => item.date === appointmentForm.date) || appointmentAvailability[0]
    if (selectedAvailabilityDate !== selectedDay.date) setSelectedAvailabilityDate(selectedDay.date)
    if (appointmentForm.date !== selectedDay.date || !selectedDay.slots.includes(appointmentForm.time)) {
      setAppointmentForm((previous) => ({ ...previous, date: selectedDay.date, time: selectedDay.slots[0] }))
    }
  }, [appointmentAvailability, appointmentForm.doctor_id, selectedAvailabilityDate])

  const activeAvailabilityDay = appointmentAvailability.find((day) => day.date === selectedAvailabilityDate) || appointmentAvailability[0] || null

  const visibleDepartments = useMemo(() => {
    if (user?.role === 'sekreter' && user.department_id) {
      return departments.filter((department) => department.id === user.department_id)
    }
    return departments
  }, [departments, user])

  const appointmentStats = useMemo(() => {
    const today = getLocalToday()
    return {
      today: appointments.filter((item) => String(item.appointment_date).slice(0, 10) === today).length,
      pending: appointments.filter((item) => item.status === 'Bekliyor').length,
      completed: appointments.filter((item) => item.status === 'Tamamlandı').length,
      cancelled: appointments.filter((item) => item.status === 'İptal' || item.status === 'İptal Edildi').length,
    }
  }, [appointments])

  const smsStats = useMemo(() => ({
    pending: smsReminders.filter((item) => item.status === 'Bekliyor').length,
    sent: smsReminders.filter((item) => item.status === 'Gönderildi').length,
    cancelled: smsReminders.filter((item) => item.status === 'İptal Edildi').length,
  }), [smsReminders])

  const operationsOverview = useMemo(() => {
    const activeStatuses = ['İptal', 'İptal Edildi', 'Reddedildi']
    const activeAppointments = appointments.filter((item) => !activeStatuses.includes(item.status))
    const today = getLocalToday()
    const periodEnd = new Date(`${today}T12:00:00`)
    if (operationsPeriod === 'week') periodEnd.setDate(periodEnd.getDate() + 6)
    if (operationsPeriod === 'month') periodEnd.setDate(periodEnd.getDate() + 29)
    const endDate = getLocalDateKey(periodEnd)
    const periodAppointments = activeAppointments.filter((item) => {
      const date = getLocalDateKey(item.appointment_date)
      return date >= today && date <= endDate && (operationsDepartmentId === 'all' || String(item.department_id) === String(operationsDepartmentId))
    })
    const todayAppointments = periodAppointments
    const departmentLoad = departments.map((department) => ({
      ...department,
      count: periodAppointments.filter((item) => item.department_id === department.id).length,
      todayCount: todayAppointments.filter((item) => item.department_id === department.id).length,
    })).map((department) => ({
      ...department,
      percentage: periodAppointments.length ? Math.round((department.count / periodAppointments.length) * 100) : 0,
    })).filter((department) => operationsDepartmentId === 'all' || String(department.id) === String(operationsDepartmentId)).sort((a, b) => b.count - a.count || b.todayCount - a.todayCount)
    const doctorLoad = doctors.map((doctor) => ({
      ...doctor,
      count: todayAppointments.filter((item) => item.doctor_id === doctor.id).length,
    })).sort((a, b) => b.count - a.count)
    const occupiedBeds = beds.filter((bed) => bed.status === 'Dolu').length
    const cleaningBeds = beds.filter((bed) => bed.status === 'Temizlikte').length
    const availableBeds = beds.filter((bed) => bed.status === 'Boş').length
    return {
      activeAppointments,
      todayAppointments,
      departmentLoad,
      doctorLoad,
      occupiedBeds,
      cleaningBeds,
      availableBeds,
      noShowRisk: periodAppointments.filter((item) => item.status === 'Gelmedi').length,
      waiting: periodAppointments.filter((item) => ['Bekliyor', 'Onaylandı'].includes(item.status)).length,
      inExamination: periodAppointments.filter((item) => item.status === 'Muayenede').length,
      periodLabel: operationsPeriod === 'today' ? 'Bugün' : operationsPeriod === 'week' ? 'Önümüzdeki 7 gün' : 'Önümüzdeki 30 gün',
      peakDepartment: departmentLoad[0] || null,
    }
  }, [appointments, departments, doctors, beds, operationsPeriod, operationsDepartmentId])

  const updateForm = (setter) => (event) => {
    const { name, value } = event.target
    setter((previous) => ({ ...previous, [name]: value }))
  }

  const handlePatientChange = (event) => {
    const { name, value } = event.target
    const cleanValue = name === 'tc_no' || name === 'phone'
      ? value.replace(/\D/g, '')
      : value
    setPatientForm((previous) => ({ ...previous, [name]: cleanValue }))
  }

  const handleAddPatient = async (event) => {
    event.preventDefault()
    if (saving) return
    setError('')
    setSuccessMessage('')

    if (patientForm.tc_no.length !== 11) {
      setError('TC kimlik numarası 11 haneli olmalıdır.')
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`${API_URL}/patients/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientForm),
      })
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Hasta kaydedilemedi.'))
      }
      const result = await response.json()
      // Backend yeniden başlatılmadan önceki sürüm yalnızca Patient döndürebilir.
      // Yeni sürüm ise { patient, username, temporary_password } döndürür.
      const patient = result.patient || result.data?.patient || result
      if (!patient?.id) {
        throw new Error('Sunucudan geçerli hasta kaydı alınamadı. Backend’i durdurup main.py dosyasının bulunduğu klasörde yeniden başlatın.')
      }
      setPatients((previous) => [...previous, patient])
      setPatientForm(emptyPatient)
      if (result.username && result.temporary_password) {
        setNewPatientCredentials({
          fullName: `${patient.first_name} ${patient.last_name}`,
          username: result.username,
          password: result.temporary_password,
        })
        setSuccessMessage('Hasta ve hasta kullanıcı hesabı başarıyla oluşturuldu.')
      } else {
        setSuccessMessage('Hasta kaydedildi. Kullanıcı hesabı için backend’i yeniden başlatın.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAppointment = async (event) => {
    event.preventDefault()
    if (saving) return
    setError('')
    setSuccessMessage('')

    if (
      !appointmentForm.patient_id ||
      !appointmentForm.doctor_id ||
      !appointmentForm.department_id
    ) {
      setError('Hasta, poliklinik ve doktor seçmelisiniz.')
      return
    }

    const selectedDateKey = `${appointmentForm.date}T${appointmentForm.time}`
    const selectedDateTime = new Date(selectedDateKey)

    if (!appointmentForm.date || !appointmentForm.time || Number.isNaN(selectedDateTime.getTime())) {
      setError('Geçerli bir randevu tarihi ve saati seçmelisiniz.')
      return
    }

    if (selectedDateTime < new Date()) {
      setError('Geçmiş bir tarih veya saate randevu alınamaz.')
      return
    }

    if (!isValidAppointmentTime(appointmentForm.time)) {
      setError('Randevu saati 08:30–17:00 arasında ve yarım saatlik aralıklarla olmalıdır.')
      return
    }

    const selectedDoctor = doctors.find((doctor) => doctor.id === Number(appointmentForm.doctor_id))
    if (!selectedDoctor || selectedDoctor.department_id !== Number(appointmentForm.department_id)) {
      setError('Seçilen doktor bu poliklinikte görev yapmıyor.')
      return
    }

    const selectedSlotIsAvailable = availableAppointmentSlots.some((slot) => slot.value === appointmentForm.time)
    if (!selectedSlotIsAvailable) {
      setError('Seçilen tarih ve saat uygun değil. Lütfen listeden uygun bir saat seçin.')
      return
    }

    const activeAppointments = appointments.filter(
      (item) => !['İptal', 'İptal Edildi', 'Reddedildi'].includes(item.status),
    )

    const doctorConflict = activeAppointments.some(
      (item) =>
        String(item.doctor_id) === String(appointmentForm.doctor_id) &&
        String(item.appointment_date).slice(0, 16) === selectedDateKey,
    )

    if (doctorConflict) {
      setError('Bu doktorun seçtiğiniz gün ve saatte başka bir randevusu var.')
      return
    }

    const patientConflict = activeAppointments.some(
      (item) =>
        String(item.patient_id) === String(appointmentForm.patient_id) &&
        String(item.appointment_date).slice(0, 16) === selectedDateKey,
    )

    if (patientConflict) {
      setError('Bu hastanın seçtiğiniz gün ve saatte başka bir randevusu var.')
      return
    }

    try {
      setSaving(true)
      const requestNote = appointmentForm.note.trim()
      const response = await fetch(`${API_URL}/appointments/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: Number(appointmentForm.patient_id),
          doctor_id: Number(appointmentForm.doctor_id),
          department_id: Number(appointmentForm.department_id),
          appointment_date: `${appointmentForm.date}T${appointmentForm.time}:00`,
          status: role === 'patient' ? 'Talep Edildi' : 'Onaylandı',
          request_note: requestNote || null,
          requested_by_user_id: user.id,
        }),
      })
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Randevu kaydedilemedi.'))
      }
      const appointment = await response.json()
      setAppointments((previous) => [...previous, appointment])
      setAppointmentForm(emptyAppointment)
      setUseNearestAppointment(false)
      setIsAppointmentModalOpen(false)
      await refreshSmsReminders()
      setSuccessMessage(role === 'patient' ? 'Randevu talebiniz sekreter onayına gönderildi.' : 'Randevu başarıyla oluşturuldu.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // YENİ EKLENEN İPTAL ETME FONKSİYONU
  const handleCancelAppointment = async (id) => {
    if (saving) return
    if (window.confirm("Bu randevuyu iptal etmek istediğinize emin misiniz?")) {
      try {
        setSaving(true)
        const response = await fetch(`${API_URL}/appointments/${id}/cancel?user_id=${user.id}`, {
          method: 'PUT',
        })
        if (!response.ok) {
          throw new Error(await getErrorMessage(response, 'Randevu iptal edilemedi.'))
        }
        setSuccessMessage('Randevu başarıyla iptal edildi! 🚫')
        // Sayfayı yenilemek yerine verileri tekrar çekerek ekranı anında güncelleriz
        loadData() 
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
    }
  }

  const handleMarkNoShow = async (id) => {
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/appointments/${id}/status?status=Gelmedi&user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Randevu gelmedi olarak işaretlenemedi.'))
      const updated = await response.json()
      setAppointments((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setSuccessMessage('Randevu hasta gelmedi olarak işaretlendi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAppointmentDecision = async (id, decision) => {
    if (processingRequest) return
    const previousAppointment = appointments.find((item) => String(item.id) === String(id))
    if (!previousAppointment) return
    const targetStatus = decision === 'approve' ? 'Onaylandı' : 'Reddedildi'

    setError('')
    setSuccessMessage('')
    setProcessingRequest({ id, decision })

    try {
      const response = await fetch(`${API_URL}/appointments/${id}/${decision}?user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Randevu işlemi tamamlanamadı.'))
      const updated = await response.json()
      setAppointments((previous) => previous.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated, status: targetStatus } : item))

      try {
        await refreshAppointments()
      } catch (refreshError) {
        console.warn(refreshError)
      }
      await refreshSmsReminders()
      setSuccessMessage(decision === 'approve'
        ? `${getPatientName(previousAppointment.patient_id)} randevusu onaylandı. SMS hatırlatmaları zamanı geldiğinde otomatik gönderilecek.`
        : `${getPatientName(previousAppointment.patient_id)} randevu talebi reddedildi.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleSimulateSmsSend = async (reminderId) => {
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/sms-reminders/${reminderId}/simulate-send?user_id=${user.id}`, { method: 'POST' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Demo SMS gönderilemedi.'))
      const updated = await response.json()
      setSmsReminders((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setSuccessMessage('Demo SMS gönderildi olarak işaretlendi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRunDueSms = async () => {
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/sms-reminders/actions/simulate-due?user_id=${user.id}`, { method: 'POST' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'SMS kuyruğu çalıştırılamadı.'))
      const sent = await response.json()
      await refreshSmsReminders()
      setSuccessMessage(sent.length > 0 ? `${sent.length} zamanı gelen demo SMS gönderildi.` : 'Şu anda gönderim zamanı gelen SMS bulunmuyor.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openRescheduleModal = (appointment) => {
    const blockedStatuses = ['Muayenede', 'Tamamlandı', 'İptal', 'İptal Edildi', 'Reddedildi', 'Gelmedi']
    if (blockedStatuses.includes(appointment.status)) {
      setError(`${appointment.status} durumundaki randevu yeniden planlanamaz.`)
      return
    }
    setError('')
    setRescheduleAppointment(appointment)
    setRescheduleForm({
      date: String(appointment.appointment_date).slice(0, 10),
      time: String(appointment.appointment_date).slice(11, 16),
    })
  }

  const shiftRescheduleTime = ({ minutes = 0, days = 0 }) => {
    if (!rescheduleForm.date || !rescheduleForm.time) return
    const shifted = new Date(`${rescheduleForm.date}T${rescheduleForm.time}:00`)
    shifted.setMinutes(shifted.getMinutes() + minutes)
    shifted.setDate(shifted.getDate() + days)
    const date = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`
    const time = `${String(shifted.getHours()).padStart(2, '0')}:${String(shifted.getMinutes()).padStart(2, '0')}`
    if (!isValidAppointmentTime(time)) {
      setError('Randevular yalnızca 08:30–17:00 çalışma saatleri içinde planlanabilir.')
      return
    }
    setError('')
    setRescheduleForm({ date, time })
  }

  const handleRescheduleAppointment = async (event) => {
    event.preventDefault()
    if (saving || !rescheduleAppointment) return
    setError('')
    setSuccessMessage('')

    const selectedDateTime = new Date(`${rescheduleForm.date}T${rescheduleForm.time}:00`)
    if (!rescheduleForm.date || !rescheduleForm.time || selectedDateTime < new Date()) {
      setError('Randevu geçmiş bir tarih veya saate taşınamaz.')
      return
    }

    if (!isValidAppointmentTime(rescheduleForm.time)) {
      setError('Randevu saati 08:30–17:00 arasında ve yarım saatlik aralıklarla olmalıdır.')
      return
    }

    const newDateKey = `${rescheduleForm.date}T${rescheduleForm.time}`
    const activeAppointments = appointments.filter((item) => item.id !== rescheduleAppointment.id && !['İptal', 'İptal Edildi', 'Reddedildi'].includes(item.status))
    if (activeAppointments.some((item) => item.doctor_id === rescheduleAppointment.doctor_id && String(item.appointment_date).slice(0, 16) === newDateKey)) {
      setError('Doktorun seçilen gün ve saatte başka bir randevusu var.')
      return
    }
    if (activeAppointments.some((item) => item.patient_id === rescheduleAppointment.patient_id && String(item.appointment_date).slice(0, 16) === newDateKey)) {
      setError('Hastanın seçilen gün ve saatte başka bir randevusu var.')
      return
    }

    try {
      setSaving(true)
      const targetDate = rescheduleForm.date
      const targetTime = rescheduleForm.time
      const response = await fetch(`${API_URL}/appointments/${rescheduleAppointment.id}/reschedule?user_id=${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_date: `${targetDate}T${targetTime}:00` }),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Randevu yeniden planlanamadı.'))
      const updated = await response.json()
      const updatedForCalendar = { ...updated, appointment_date: `${targetDate}T${targetTime}:00` }
      setAppointments((previous) => previous.map((item) => String(item.id) === String(updated.id) ? updatedForCalendar : item))
      setCalendarDate(targetDate)
      setWeekOffset(0)
      setCalendarRevision((value) => value + 1)
      setRescheduleAppointment(null)

      const refreshedResponse = await fetch(`${API_URL}/appointments/?department_id=${user.department_id}&user_id=${user.id}`, { cache: 'no-store' })
      if (refreshedResponse.ok) {
        setAppointments(await refreshedResponse.json())
        setCalendarRevision((value) => value + 1)
      }
      await refreshSmsReminders()
      setSuccessMessage(`Randevu ${formatDate(updatedForCalendar.appointment_date)} tarihine taşındı ve takvim güncellendi.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStartExamination = async (appointment) => {
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const transition = async (status) => {
        const response = await fetch(`${API_URL}/appointments/${appointment.id}/status?status=${encodeURIComponent(status)}&user_id=${user.id}`, { method: 'PATCH' })
        if (!response.ok) throw new Error(await getErrorMessage(response, 'Muayene başlatılamadı.'))
        return response.json()
      }
      // Kullanıcı tek butona basar; backend'deki gerçekçi ara durum
      // Onaylandı -> Bekliyor -> Muayenede sırasıyla otomatik ilerletilir.
      if (appointment.status === 'Onaylandı') await transition('Bekliyor')
      const updated = await transition('Muayenede')
      setAppointments((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setSelectedAppointment(updated)
      setIsExaminationModalOpen(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMoveToWaiting = async (appointment) => {
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const response = await fetch(`${API_URL}/appointments/${appointment.id}/status?status=Bekliyor&user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Randevu bekleme kuyruğuna alınamadı.'))
      const updated = await response.json()
      setAppointments((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setSuccessMessage('Hasta bekleme kuyruğuna alındı. Artık muayeneyi başlatabilirsiniz.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateExamination = async (event) => {
    event.preventDefault()
    if (saving) return
    if (!selectedAppointment) return
    setError('')
    setSuccessMessage('')

    if (!examinationForm.diagnosis.trim()) {
      setError('Muayene için teşhis alanı zorunludur.')
      return
    }

    if (examinationForm.medicine_name.trim() && !examinationForm.dosage.trim()) {
      setError('İlaç yazıldığında kullanım şekli de girilmelidir.')
      return
    }

    try {
      setSaving(true)
      const recordResponse = await fetch(`${API_URL}/medical-records/?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: selectedAppointment.id,
          diagnosis: examinationForm.diagnosis.trim(),
          notes: examinationForm.notes.trim() || null,
        }),
      })
      if (!recordResponse.ok) {
        throw new Error(await getErrorMessage(recordResponse, 'Muayene kaydedilemedi.'))
      }
      const record = await recordResponse.json()
      setMedicalRecords((previous) => [...previous, record])

      if (examinationForm.medicine_name.trim()) {
        const prescriptionResponse = await fetch(`${API_URL}/prescriptions/?user_id=${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medical_record_id: record.id,
            medicine_name: examinationForm.medicine_name.trim(),
            dosage: examinationForm.dosage.trim(),
            days: Number(examinationForm.days),
          }),
        })
        if (!prescriptionResponse.ok) {
          throw new Error(await getErrorMessage(prescriptionResponse, 'Reçete kaydedilemedi.'))
        }
        const prescription = await prescriptionResponse.json()
        setPrescriptions((previous) => [...previous, prescription])
      }

      const statusResponse = await fetch(
        `${API_URL}/appointments/${selectedAppointment.id}/status?status=Tamamlandı&user_id=${user.id}`,
        { method: 'PATCH' },
      )
      if (statusResponse.ok) {
        const updatedAppointment = await statusResponse.json()
        setAppointments((previous) => previous.map((item) =>
          item.id === updatedAppointment.id ? updatedAppointment : item,
        ))
      }

      setExaminationForm(emptyExamination)
      setSelectedAppointment(null)
      setIsExaminationModalOpen(false)
      setSuccessMessage('Muayene ve varsa reçete başarıyla kaydedildi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const getPatientName = (id) => {
    const patient = patients.find((item) => item.id === id)
    return patient ? `${patient.first_name} ${patient.last_name}` : `Hasta #${id}`
  }

  const getDoctorName = (id) => {
    const doctor = doctors.find((item) => item.id === id)
    return doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : `Doktor #${id}`
  }

  const getDepartmentName = (id) => {
    const department = departments.find((item) => item.id === id)
    return department?.name || `Poliklinik #${id}`
  }

  const formatDate = (value) => value
    ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : '-'

  const formatSmsStatus = (status) => status === 'Bekliyor' ? 'Planlandı' : status

  const renderDoctorAppointments = (items, emptyMessage) => items.length === 0 ? (
    <div style={styles.doctorEmptyState}><span style={styles.doctorEmptyIcon}>✓</span><strong>{emptyMessage}</strong><small>Yeni kayıtlar oluştuğunda bu alanda görüntülenecektir.</small></div>
  ) : (
    <div style={styles.doctorAppointmentList}>
      {items.map((appointment) => {
        const hasRecord = medicalRecords.some((record) => record.appointment_id === appointment.id)
        return <div key={appointment.id} style={styles.doctorAppointmentCard}>
          <div style={styles.doctorAppointmentMain}><div style={styles.patientAvatar}>{getPatientName(appointment.patient_id).split(' ').map((part) => part.charAt(0)).slice(0, 2).join('')}</div><div><strong style={styles.appointmentPatient}>{getPatientName(appointment.patient_id)}</strong><p style={styles.appointmentDetails}>{getDepartmentName(appointment.department_id)} · {formatDate(appointment.appointment_date)}</p><span style={styles.doctorStatusText}>Durum: {hasRecord || appointment.status === 'Tamamlandı' ? 'Tamamlandı' : appointment.status}</span></div></div>
          {hasRecord || appointment.status === 'Tamamlandı' ? <span style={styles.completedBadge}>Tamamlandı</span> : appointment.status === 'İptal' || appointment.status === 'İptal Edildi' ? <span style={styles.cancelledBadge}>İptal Edildi</span> : appointment.status === 'Onaylandı' || appointment.status === 'Bekliyor' ? isAppointmentTimeReached(appointment.appointment_date) ? <button type="button" disabled={saving} onClick={() => handleStartExamination(appointment)} style={saving ? styles.disabledButton : styles.primaryButton}>{saving ? 'Hazırlanıyor...' : 'Muayeneye Al'}</button> : <span style={styles.scheduledBadge}>Randevu zamanı bekleniyor</span> : <span style={styles.waitingBadge}>Sekreter onayı bekleniyor</span>}
        </div>
      })}
    </div>
  )

  if (!user) {
    return (
      <LoginScreen
        form={loginForm}
        onChange={(event) => setLoginForm((previous) => ({ ...previous, [event.target.name]: event.target.value }))}
        onDemoSelect={(account) => { setLoginForm({ username: account.username, password: account.password }); setError('') }}
        onSubmit={handleLogin}
        error={error}
        saving={saving}
      />
    )
  }

  return (
    <main style={styles.page}>
      <header className="heroHeader" style={styles.header} data-reveal="up">
        <div>
          <p style={styles.eyebrow}>HASTANE BİLGİ YÖNETİM SİSTEMİ</p>
          <h1 style={styles.title}>HBYS Yönetim Paneli</h1>
          <p style={styles.subtitle}>Randevu, muayene ve reçete süreçlerini yönetin.</p>
        </div>
        <div style={styles.heroMeta}>
          <strong>{currentDateTime.toLocaleTimeString('tr-TR')}</strong>
          <span>{currentDateTime.toLocaleDateString('tr-TR')}</span>
        </div>
      </header>

      <section style={styles.roleBar} data-reveal="up">
        <span style={styles.roleLabel}>{user.full_name} · {user.role === 'doktor' ? 'Doktor' : user.role === 'yonetici' ? 'Yönetici' : user.role === 'hasta' ? 'Hasta' : user.role === 'hemsire' ? 'Hemşire' : user.role === 'temizlik_personeli' ? 'Temizlik Personeli' : 'Sekreter'}</span>
        <span style={styles.roleLabel}>Aktif panel: {role === 'doctor' ? 'Doktor' : role === 'patient' ? 'Hasta' : role === 'admin' ? 'Yönetim' : role === 'nurse' ? 'Hemşire' : role === 'cleaner' ? 'Temizlik Personeli' : 'Sekreter'}</span>
        <button type="button" onClick={() => setIsPasswordModalOpen(true)} style={styles.roleButton}>Şifre Değiştir</button>
        <button type="button" onClick={handleLogout} style={styles.roleButton}>Çıkış Yap</button>
      </section>

      {role === 'secretary' && (
        <nav style={styles.tabContainer} aria-label="Sekreter paneli sekmeleri">
          {[['appointments', requestedAppointments.length ? `Randevular (${requestedAppointments.length})` : 'Randevular'], ['patients', 'Hastalar'], ['calendar', 'Takvim'], ['sms', smsStats.pending ? `SMS (${smsStats.pending})` : 'SMS'], ['summary', 'Poliklinik Özeti']].map(([tabKey, label]) => (
            <button key={tabKey} type="button" onClick={() => { setActiveSecretaryTab(tabKey); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={activeSecretaryTab === tabKey ? styles.activeTabButton : styles.tabButton}>{label}</button>
          ))}
        </nav>
      )}
      {role === 'doctor' && (
        <nav style={styles.tabContainer} aria-label="Doktor paneli sekmeleri">
          {[['today', 'Bugünkü Randevular'], ['waiting', 'Muayene Bekleyenler'], ['completed', 'Tamamlananlar'], ['history', 'Hasta Geçmişi'], ['inpatients', 'Servis Hastaları']].map(([tabKey, label]) => (
            <button key={tabKey} type="button" onClick={() => { setActiveDoctorTab(tabKey); setAppointmentSearch(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={activeDoctorTab === tabKey ? styles.activeTabButton : styles.tabButton}>{label}</button>
          ))}
        </nav>
      )}

      {loading && <div style={styles.infoMessage}>Veriler yükleniyor...</div>}
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

      {role !== 'secretary' && role !== 'doctor' && role !== 'nurse' && role !== 'cleaner' && <section style={styles.dashboard} data-reveal="up">
        <StatCard icon="👥" title="Hastalar" value={patients.length} text="Kayıtlı hasta" />
        <StatCard icon="📅" title="Randevular" value={appointments.length} text="Toplam randevu" />
        <StatCard icon="🗓️" title="Bugün" value={appointmentStats.today} text="Bugünkü randevu" />
        <StatCard icon="⏳" title="Bekleyen" value={appointmentStats.pending} text="Bekleyen randevu" />
        <StatCard icon="✅" title="Tamamlanan" value={appointmentStats.completed} text="Tamamlanan randevu" />
        <StatCard icon="💊" title="Reçeteler" value={prescriptions.length} text={`${appointmentStats.cancelled} iptal randevu`} />
      </section>}

      {['nurse', 'cleaner'].includes(role) ? (
        <section style={styles.tabContent} data-reveal="up">
          {role === 'cleaner' ? <>
            <section style={styles.cleanerHero}>
              <div><p style={styles.tabEyebrow}>HASTANE DESTEK HİZMETLERİ</p><h2 style={styles.tabPageTitle}>Temizlik Görevlerim</h2><p style={styles.formDescription}>Size atanan oda, bölüm ve yatak temizliği görevlerini buradan takip edin.</p></div>
              <div style={styles.cleanerHeroBadge}><span style={styles.doctorOnlineDot}></span><div style={styles.cleanerIdentityText}><strong>{user.full_name}</strong><small>Temizlik Personeli · Hastane Geneli</small></div></div>
            </section>
            <section style={styles.cleanerMetricsGrid}>
              <div style={styles.cleanerMetricCard}><span style={styles.cleanerMetricIcon}>✦</span><div style={styles.cleanerMetricText}><strong>{cleaningTasks.length}</strong><small>Aktif görev</small></div></div>
              <div style={styles.cleanerMetricCard}><span style={styles.cleanerMetricIcon}>◷</span><div style={styles.cleanerMetricText}><strong>{cleaningTasks.filter((task) => task.status === 'Bekliyor').length}</strong><small>Bekleyen</small></div></div>
              <div style={styles.cleanerMetricCard}><span style={styles.cleanerMetricIcon}>✓</span><div style={styles.cleanerMetricText}><strong>{cleaningTasks.filter((task) => task.status === 'Devam Ediyor').length}</strong><small>Devam eden</small></div></div>
            </section>
            <section style={styles.cleanerTaskPanel}>
              <div style={styles.bedPanelHeader}><div><h3 style={styles.cardSectionTitle}>Atanmış görevler</h3><p style={styles.cardSectionText}>Görevler konum bilgisine göre listelenir. Yatak boşaltıldığında ilgili oda için otomatik görev oluşur.</p></div><span style={styles.tabSummaryBadge}>{cleaningTasks.length} aktif görev</span></div>
              {cleaningTasks.length === 0 ? <div style={styles.cleanerEmptyState}><span>✓</span><div style={styles.cleanerIdentityText}><strong>Atanmış temizlik görevi yok</strong><small>Yeni bir oda, bölüm veya yatak görevi atandığında burada görünecektir.</small></div></div> : <div style={styles.cleanerTaskList}>{cleaningTasks.map((task) => <article key={task.id} style={styles.cleanerTaskCard}><div style={styles.cleanerTaskIdentity}><span style={styles.cleanerTaskIcon}>⌂</span><div style={styles.cleanerIdentityText}><strong>{task.location || `${task.service_name || 'Hastane Geneli'} / Oda ${task.room_number || '-'}`}</strong><small>{task.task_type || 'Temizlik görevi'} · Görev no: #{task.id}</small><span style={styles.cleanerTaskDate}>Oluşturulma: {formatDate(task.created_at)}</span></div></div><div style={styles.cleanerTaskActions}><span style={task.status === 'Devam Ediyor' ? styles.cleanerInProgressBadge : styles.cleanerWaitingBadge}>{task.status}</span>{task.status === 'Bekliyor' && <button type="button" disabled={saving} onClick={() => handleStartCleaningTask(task.id)} style={styles.bedCleaningButton}>Görevi Başlat</button>}{task.status === 'Devam Ediyor' && <button type="button" disabled={saving} onClick={() => handleCompleteCleaningTask(task.id)} style={styles.bedCleaningButton}>Tamamlandı İşaretle</button>}</div></article>)}</div>}
            </section>
          </> : null}
          {role === 'nurse' && <>
          <section style={styles.doctorWorkspaceHeader}>
            <div><p style={styles.tabEyebrow}>{role === 'cleaner' ? 'TEMİZLİK OPERASYONLARI' : 'KLİNİK SERVİS PERSONELİ'}</p><h2 style={styles.tabPageTitle}>{role === 'cleaner' ? 'Temizlik Görevleri' : 'Servis ve Yatak Yönetimi'}</h2><p style={styles.formDescription}>{role === 'cleaner' ? 'Size atanan yatak temizlik görevlerini takip edin ve tamamlayın.' : 'Bağlı olduğunuz departmandaki hastaları uygun yataklara yerleştirin ve taburcu işlemlerini yönetin.'}</p></div>
            <div style={styles.doctorHeaderIdentity}><span style={styles.doctorOnlineDot}></span><div style={styles.doctorIdentityInfo}><strong style={styles.doctorIdentityName}>{user.full_name}</strong><small style={styles.doctorIdentityMeta}>{role === 'cleaner' ? 'Temizlik Personeli · Hastane Geneli' : `Hemşire · ${clinicDepartment?.name || 'Servis'}`}</small></div></div>
          </section>
          <BedManagement services={inpatientServices} beds={beds} patients={patients} cleaningTasks={cleaningTasks} onRefresh={refreshBedData} onAssign={handleAssignBed} onDischarge={handleDischargePatient} onTransfer={handleTransferPatient} onCompleteCleaning={handleCompleteBedCleaning} onCompleteCleaningTask={handleCompleteCleaningTask} onStartCleaningTask={null} saving={saving} readOnly={false} canAssign={can('bed.assign')} canDischarge={can('bed.discharge')} canUpdateStatus={can('bed.status.update')} />
          </>}
        </section>
      ) : role === 'admin' ? (
        <>
        <nav style={styles.tabContainer} aria-label="Yönetim paneli sekmeleri">
          {[['operations', 'Operasyon Merkezi'], ['audit', 'Audit Logları']].map(([tabKey, label]) => (
            <button key={tabKey} type="button" onClick={() => { setActiveAdminTab(tabKey); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={activeAdminTab === tabKey ? styles.activeTabButton : styles.tabButton}>{label}</button>
          ))}
        </nav>
        {activeAdminTab === 'operations' ? (
        <section style={styles.operationsPanel} data-reveal="up">
          <div style={styles.operationsHero}>
            <div><p style={styles.tabEyebrow}>HASTANE KARAR DESTEK MERKEZİ</p><h2 style={styles.tabPageTitle}>Akıllı Operasyon Merkezi</h2><p style={styles.formDescription}>Hastanenin randevu yoğunluğunu, klinik akışını ve yatak kapasitesini tek ekrandan izleyin.</p></div>
            <span style={styles.liveBadge}>● Canlı veriler</span>
          </div>
          <div style={styles.operationsFilters}><label style={styles.operationsFilter}><span>Dönem</span><select style={styles.operationsFilterSelect} value={operationsPeriod} onChange={(event) => setOperationsPeriod(event.target.value)}><option value="today">Bugün</option><option value="week">Önümüzdeki 7 gün</option><option value="month">Önümüzdeki 30 gün</option></select></label><label style={styles.operationsFilter}><span>Poliklinik</span><select style={styles.operationsFilterSelect} value={operationsDepartmentId} onChange={(event) => setOperationsDepartmentId(event.target.value)}><option value="all">Tüm poliklinikler</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><span style={styles.operationsFilterNote}>Gösterilen randevular: <strong>{operationsOverview.periodLabel}</strong></span></div>
          <div style={styles.operationsStatsGrid}>
            <div style={styles.operationsStatCard}><span style={styles.operationsStatIcon}>◷</span><div style={styles.operationsStatContent}><strong style={styles.operationsStatValue}>{operationsOverview.todayAppointments.length}</strong><small style={styles.operationsStatLabel}>{operationsOverview.periodLabel} randevu</small></div></div>
            <div style={styles.operationsStatCard}><span style={styles.operationsStatIcon}>⌛</span><div style={styles.operationsStatContent}><strong style={styles.operationsStatValue}>{operationsOverview.waiting}</strong><small style={styles.operationsStatLabel}>Bekleyen akış</small></div></div>
            <div style={styles.operationsStatCard}><span style={styles.operationsStatIcon}>◉</span><div style={styles.operationsStatContent}><strong style={styles.operationsStatValue}>{operationsOverview.inExamination}</strong><small style={styles.operationsStatLabel}>Muayenede</small></div></div>
            <div style={styles.operationsStatCard}><span style={styles.operationsStatIcon}>▣</span><div style={styles.operationsStatContent}><strong style={styles.operationsStatValue}>{operationsOverview.availableBeds}</strong><small style={styles.operationsStatLabel}>Boş yatak</small></div></div>
          </div>
          <div style={styles.operationsGrid}>
            <section style={styles.operationsCard}><div style={styles.operationsCardHeader}><div><h3 style={styles.cardSectionTitle}>Poliklinik yoğunluğu</h3><p style={styles.cardSectionText}>Seçilen dönemdeki randevuların polikliniklere göre dağılımı.</p></div><span style={styles.resultCount}>{operationsOverview.todayAppointments.length} randevu</span></div><div style={styles.loadSummary}>{operationsOverview.peakDepartment ? <span>En yoğun birim: <strong>{operationsOverview.peakDepartment.name}</strong></span> : <span>Bu dönem için randevu bulunmuyor.</span>}<span>Toplamın yüzdesi</span></div>{operationsOverview.departmentLoad.map((department) => <div key={department.id} style={styles.loadRow}><div style={styles.loadRowTop}><strong>{department.name}</strong><span style={styles.loadPercentBadge}>{department.percentage}%</span></div><div style={styles.loadTrack}><span style={{ ...styles.loadBar, width: `${department.percentage}%` }} /></div><div style={styles.loadRowMeta}><span>{department.count} randevu</span><span>{department.percentage === 0 ? 'Yoğunluk yok' : department.percentage >= 35 ? 'Yüksek yoğunluk' : department.percentage >= 15 ? 'Orta yoğunluk' : 'Düşük yoğunluk'}</span></div></div>)}</section>
            <section style={styles.operationsCard}><div style={styles.operationsCardHeader}><div><h3 style={styles.cardSectionTitle}>Yatak kapasitesi</h3><p style={styles.cardSectionText}>Servislerin güncel durumu.</p></div></div><div style={styles.bedOverviewGrid}><div style={styles.bedOverviewCell}><strong style={styles.bedOverviewValue}>{operationsOverview.occupiedBeds}</strong><small style={styles.bedOverviewLabel}>Dolu</small></div><div style={styles.bedOverviewCell}><strong style={styles.bedOverviewValue}>{operationsOverview.availableBeds}</strong><small style={styles.bedOverviewLabel}>Boş</small></div><div style={styles.bedOverviewCell}><strong style={styles.bedOverviewValue}>{operationsOverview.cleaningBeds}</strong><small style={styles.bedOverviewLabel}>Temizlikte</small></div></div><div style={styles.operationsNotice}>Toplam takip edilen yatak: <strong>{beds.length}</strong></div></section>
          </div>
          <section style={styles.operationsCard}><div style={styles.operationsCardHeader}><div><h3 style={styles.cardSectionTitle}>Dikkat gerektiren durumlar</h3><p style={styles.cardSectionText}>Yönetim için öne çıkan operasyon sinyalleri.</p></div></div><div style={styles.alertGrid}><div style={operationsOverview.waiting ? styles.alertItemWarning : styles.alertItemGood}><strong>{operationsOverview.waiting}</strong><span>Onay veya muayene bekleyen randevu</span></div><div style={operationsOverview.noShowRisk ? styles.alertItemWarning : styles.alertItemGood}><strong>{operationsOverview.noShowRisk}</strong><span>Gelmedi olarak işaretlenen randevu</span></div><div style={operationsOverview.cleaningBeds ? styles.alertItemWarning : styles.alertItemGood}><strong>{operationsOverview.cleaningBeds}</strong><span>Temizlik bekleyen yatak</span></div></div></section>
        </section>
        ) : (
        <section style={styles.panelWide} data-reveal="up">
          <div style={styles.actionPanelInner}>
            <div>
              <h2 style={styles.panelTitle}>Sistem Audit Logları</h2>
              <p style={styles.formDescription}>Kullanıcıların sistem üzerindeki önemli işlemlerini ve zaman bilgilerini izleyin.</p>
            </div>
            <span style={styles.doctorBadge}>{auditLogs.length} işlem</span>
          </div>
          {auditLogs.length === 0 ? <p style={styles.emptyText}>Henüz kayıtlı işlem bulunmuyor.</p> : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Tarih</th><th style={styles.th}>Kullanıcı ID</th><th style={styles.th}>İşlem</th><th style={styles.th}>Varlık</th><th style={styles.th}>Kayıt ID</th><th style={styles.th}>Detay</th></tr></thead>
                <tbody>{auditLogs.map((log) => <tr key={log.id}><td style={styles.td}>{formatDate(log.created_at)}</td><td style={styles.td}>{log.user_id || '-'}</td><td style={styles.td}><span style={styles.waitingBadge}>{log.action}</span></td><td style={styles.td}>{log.entity_type}</td><td style={styles.td}>{log.entity_id || '-'}</td><td style={styles.td}>{log.details || '-'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
        )}
        </>
      ) : role === 'patient' ? (
        <section style={styles.panelWide} data-reveal="up">
          <div style={styles.actionPanelInner}>
            <div>
              <h2 style={styles.panelTitle}>Hasta Panelim</h2>
              <p style={styles.formDescription}>Kişisel randevularınızı ve sağlık kayıtlarınızı buradan takip edebilirsiniz.</p>
            </div>
            <span style={styles.doctorBadge}>Hasta hesabı</span>
            <button type="button" onClick={() => { setAppointmentForm({ ...emptyAppointment, patient_id: user.patient_id || '' }); setIsAppointmentModalOpen(true) }} style={styles.primaryButton}>+ Randevu Talep Et</button>
          </div>
          {patients[0] && <div style={styles.patientRow}><strong>{patients[0].first_name} {patients[0].last_name}</strong><small>TC: {patients[0].tc_no.slice(0, 3)}******{patients[0].tc_no.slice(-2)}</small></div>}
          <nav style={styles.patientTabContainer} aria-label="Hasta paneli sekmeleri">
            {[['appointments', 'Randevularım'], ['history', 'Sağlık Geçmişim'], ['notifications', `Bildirimlerim${smsReminders.length ? ` (${smsReminders.length})` : ''}`]].map(([tabKey, label]) => (
              <button key={tabKey} type="button" onClick={() => setActivePatientTab(tabKey)} style={activePatientTab === tabKey ? styles.activePatientTabButton : styles.patientTabButton}>{label}</button>
            ))}
          </nav>
          {activePatientTab === 'appointments' && <div style={styles.patientTabContent}>
            <div style={styles.patientHistoryHeader}><div><p style={styles.tabEyebrow}>RANDEVU TAKİBİ</p><h3 style={styles.sectionTitle}>Randevularım</h3><p style={styles.formDescription}>Yaklaşan ve geçmiş randevularınızı tek listeden takip edin.</p></div><span style={styles.tabSummaryBadge}>{filteredAppointments.length} kayıt</span></div>
            {filteredAppointments.length === 0 ? <p style={styles.emptyText}>Henüz randevunuz bulunmuyor.</p> : <div style={styles.patientAppointmentsScroll}><AppointmentTable appointments={filteredAppointments} getPatientName={getPatientName} getDoctorName={getDoctorName} getDepartmentName={getDepartmentName} formatDate={formatDate} onCancel={handleCancelAppointment} /></div>}
          </div>}
          {activePatientTab === 'history' && <div style={styles.patientTabContent}>
            <div style={styles.patientHistoryHeader}><div><p style={styles.tabEyebrow}>KLİNİK GEÇMİŞ</p><h3 style={styles.sectionTitle}>Muayene ve Reçete Geçmişim</h3><p style={styles.formDescription}>Muayene notlarınızı ve reçetelerinizi güvenli biçimde görüntüleyin.</p></div><span style={styles.tabSummaryBadge}>{medicalRecords.length} muayene</span></div>
            {medicalRecords.length === 0 ? <p style={styles.emptyText}>Henüz tamamlanmış bir muayene kaydınız bulunmuyor.</p> : (
              <div style={styles.patientHistoryScroll}>
                <div style={styles.doctorAppointmentList}>
                {medicalRecords.map((record) => {
                  const appointment = appointments.find((item) => item.id === record.appointment_id)
                  const recordPrescriptions = prescriptions.filter((item) => item.medical_record_id === record.id)
                  return <article key={record.id} style={styles.patientHealthCard}>
                    <div style={styles.patientHealthCardHeader}><div><span style={styles.healthRecordBadge}>MUAYENE</span><strong style={styles.appointmentPatient}>{record.diagnosis}</strong><p style={styles.appointmentDetails}>{appointment ? `${getDoctorName(appointment.doctor_id)} · ${formatDate(record.created_at)}` : formatDate(record.created_at)}</p></div><span style={styles.completedBadge}>Tamamlandı</span></div>
                    <p style={styles.patientHealthNotes}>{record.notes || 'Muayene notu bulunmuyor.'}</p>
                    <div style={styles.prescriptionSection}><div style={styles.prescriptionSectionTitle}><span>▣</span><strong>Reçete</strong><span style={styles.prescriptionCount}>{recordPrescriptions.length}</span></div>{recordPrescriptions.length === 0 ? <span style={styles.waitingBadge}>Bu muayenede reçete oluşturulmadı.</span> : <div style={styles.prescriptionList}>{recordPrescriptions.map((item) => <div key={item.id} style={styles.prescriptionCard}><div style={styles.prescriptionMedicine}>{item.medicine_name}</div><div style={styles.prescriptionMeta}>{item.dosage}</div><div style={styles.prescriptionCode}>E-Reçete: {item.prescription_number || `EREC-${String(item.id).padStart(6, '0')}`} · Barkod: {item.barcode || `HBYS-${String(item.id).padStart(8, '0')}`}</div><span style={styles.prescriptionDuration}>{item.days} gün</span></div>)}</div>}</div>
                  </article>
                })}
                </div>
              </div>
            )}
          </div>}
          {activePatientTab === 'notifications' && <div style={styles.patientTabContent}>
            <div style={styles.patientHistoryHeader}><div><p style={styles.tabEyebrow}>RANDEVU BİLDİRİMLERİ</p><h3 style={styles.sectionTitle}>SMS Hatırlatmalarım</h3><p style={styles.formDescription}>Onaylanan randevularınız için hazırlanan otomatik hatırlatma mesajlarını burada görebilirsiniz.</p></div><span style={styles.tabSummaryBadge}>{smsReminders.length} bildirim</span></div>
            {smsReminders.length === 0 ? <div style={styles.patientNotificationEmpty}><span style={styles.smsPhoneIcon}>SMS</span><div style={styles.patientNotificationEmptyText}><strong>Henüz SMS bildiriminiz yok</strong><small>Randevunuz onaylandığında 24 saat ve 2 saat öncesi için otomatik bildirim hazırlanır.</small></div></div> : <div style={styles.patientHistoryScroll}>{smsReminders.map((reminder) => <article key={reminder.id} style={styles.patientNotificationCard}><div style={styles.smsQueueMain}><span style={styles.smsPhoneIcon}>SMS</span><div style={styles.smsQueueInfo}><strong>{reminder.reminder_type} hatırlatması</strong><small>{formatDate(reminder.scheduled_for)} · {formatSmsStatus(reminder.status)}</small><p>{reminder.message}</p></div></div><span style={reminder.status === 'Gönderildi' ? styles.smsSentBadge : reminder.status === 'İptal Edildi' ? styles.cancelledBadge : styles.waitingBadge}>{formatSmsStatus(reminder.status)}</span></article>)}</div>}
          </div>}
        </section>
      ) : role === 'secretary' ? (
        <>
          {activeSecretaryTab === 'summary' && <>
            <section style={styles.clinicHero}>
              <div style={styles.clinicHeroCopy}><p style={styles.eyebrow}>POLİKLİNİK MERKEZİ</p><h2 style={styles.clinicTitle}>{clinicDepartment?.name || 'Poliklinik Yönetimi'}</h2><p style={styles.clinicDescription}>{clinicDepartment?.description || 'Polikliniğinizin hasta, doktor ve randevu süreçlerini tek merkezden yönetin.'}</p></div>
              <div style={styles.clinicHeroMark}><span>✚</span><small>HBYS CLINIC<br />WORKSPACE</small></div>
            </section>
            <section style={styles.clinicStatsGrid}>
              <div style={styles.clinicStatCard}><span style={styles.clinicStatIcon}>◉</span><div><strong style={styles.clinicStatValue}>{clinicDoctors.length}</strong><small style={styles.clinicStatLabel}>Aktif doktor</small></div></div><div style={styles.clinicStatCard}><span style={styles.clinicStatIcon}>▣</span><div><strong style={styles.clinicStatValue}>{clinicAppointments.length}</strong><small style={styles.clinicStatLabel}>Toplam randevu</small></div></div><div style={styles.clinicStatCard}><span style={styles.clinicStatIcon}>◷</span><div><strong style={styles.clinicStatValue}>{clinicTodayAppointments.length}</strong><small style={styles.clinicStatLabel}>Bugünkü randevu</small></div></div><div style={styles.clinicStatCard}><span style={styles.clinicStatIcon}>⌁</span><div><strong style={styles.clinicStatValue}>{patients.length}</strong><small style={styles.clinicStatLabel}>Kayıtlı hasta</small></div></div>
            </section>
            <section style={styles.clinicDoctorsPanel}><div style={styles.panelHeading}><div><h2 style={styles.panelTitle}>Poliklinik Doktorları</h2><p style={styles.formDescription}>Bu poliklinikte görev yapan doktorlar.</p></div><span style={styles.doctorBadge}>{clinicDoctors.length} doktor</span></div><div style={styles.clinicDoctorGrid}>{clinicDoctors.map((doctor) => { const doctorCount = clinicAppointments.filter((appointment) => appointment.doctor_id === doctor.id).length; return <div key={doctor.id} style={styles.clinicDoctorCard}><div style={styles.doctorAvatar}>{doctor.first_name.charAt(0)}{doctor.last_name.charAt(0)}</div><div style={styles.clinicDoctorInfo}><strong style={styles.clinicDoctorName}>Dr. {doctor.first_name} {doctor.last_name}</strong><small style={styles.clinicDoctorMeta}>{doctorCount} randevu · {clinicDepartment?.name}</small></div><span style={styles.doctorAvailability}>Aktif</span></div> })}</div></section>
          </>}

          {activeSecretaryTab === 'appointments' && <div style={styles.tabContent}>
            <section id="appointment-management" style={styles.actionPanel}><div><h2 style={styles.panelTitle}>Randevu Yönetimi</h2><p style={styles.formDescription}>Hasta ve doktor randevularını yönetin.</p></div><button type="button" onClick={() => setIsAppointmentModalOpen(true)} style={styles.primaryButton}>+ Yeni Randevu Oluştur</button></section>
            <section style={requestedAppointments.length > 0 ? styles.approvalPanel : styles.approvalPanelEmpty}>
              <div style={styles.approvalHeader}><div><p style={styles.approvalEyebrow}>SEKRETER ONAYI</p><h2 style={styles.panelTitle}>Onay Bekleyen Hasta Talepleri</h2><p style={styles.formDescription}>Hastaların oluşturduğu randevu taleplerini inceleyerek onaylayın veya reddedin.</p></div><div style={styles.approvalHeaderActions}><button type="button" disabled={loading} onClick={loadData} style={styles.refreshRequestsButton}>↻ Talepleri Yenile</button><span style={requestedAppointments.length > 0 ? styles.approvalCount : styles.approvalCountEmpty}>{requestedAppointments.length}</span></div></div>
              {requestedAppointments.length === 0 ? <div style={styles.approvalEmptyMessage}><span>✓</span><div style={styles.approvalEmptyText}><strong>Bekleyen talep bulunmuyor</strong><small>Yeni hasta talebi geldiğinde burada görünecektir.</small></div></div> : <div style={styles.approvalRequestList}>{requestedAppointments.map((appointment) => <article key={appointment.id} style={String(processingRequest?.id) === String(appointment.id) ? { ...styles.approvalRequestCard, ...styles.approvalRequestCardProcessing } : styles.approvalRequestCard}><div style={styles.approvalPatient}><div style={styles.patientAvatar}>{getPatientName(appointment.patient_id).split(' ').map((part) => part.charAt(0)).slice(0, 2).join('')}</div><div><strong style={styles.appointmentPatient}>{getPatientName(appointment.patient_id)}</strong><small style={styles.approvalMeta}>{getDoctorName(appointment.doctor_id)} · {formatDate(appointment.appointment_date)}</small>{appointment.request_note && <p style={styles.approvalNote}>“{appointment.request_note}”</p>}</div></div><div style={styles.approvalActions}><button type="button" disabled={Boolean(processingRequest)} onClick={() => handleAppointmentDecision(appointment.id, 'reject')} style={processingRequest ? styles.requestActionDisabled : styles.rejectRequestButton}>{String(processingRequest?.id) === String(appointment.id) && processingRequest?.decision === 'reject' ? 'Reddediliyor...' : 'Reddet'}</button><button type="button" disabled={Boolean(processingRequest)} onClick={() => handleAppointmentDecision(appointment.id, 'approve')} style={processingRequest ? styles.requestActionDisabled : styles.approveRequestButton}>{String(processingRequest?.id) === String(appointment.id) && processingRequest?.decision === 'approve' ? 'Onaylanıyor...' : 'Onayla'}</button></div></article>)}</div>}
            </section>
            <section style={styles.appointmentListPanel}><div style={styles.panelHeading}><h2 style={styles.panelTitle}>Randevu Listesi</h2><span style={styles.resultCount}>{filteredAppointments.length}</span></div><SearchBox value={appointmentSearch} onChange={setAppointmentSearch} placeholder="Hasta veya doktor ara..." />{filteredAppointments.length === 0 ? <p style={styles.emptyText}>Henüz randevu bulunmuyor.</p> : <AppointmentTable appointments={filteredAppointments} getPatientName={getPatientName} getDoctorName={getDoctorName} getDepartmentName={getDepartmentName} formatDate={formatDate} onCancel={handleCancelAppointment} onMarkNoShow={handleMarkNoShow} onApprove={(id) => handleAppointmentDecision(id, 'approve')} onReject={(id) => handleAppointmentDecision(id, 'reject')} compact />}</section>
          </div>}

          {activeSecretaryTab === 'patients' && <div style={styles.tabContent}><div style={styles.tabPageHeader}><div><p style={styles.tabEyebrow}>HASTA İŞLEMLERİ</p><h2 style={styles.tabPageTitle}>Hasta Yönetimi</h2><p style={styles.formDescription}>Kayıtlı hastaları görüntüleyin veya sisteme yeni hasta ekleyin.</p></div><span style={styles.tabSummaryBadge}>{patients.length} kayıtlı hasta</span></div><section className="patientWorkspace" style={styles.patientWorkspace}><div style={styles.patientListCard}><div style={styles.panelHeading}><div><h3 style={styles.cardSectionTitle}>Kayıtlı Hastalar</h3><p style={styles.cardSectionText}>Ad, soyad veya TC numarasıyla arayın.</p></div><span style={styles.resultCount}>{filteredPatients.length}</span></div><SearchBox value={patientSearch} onChange={setPatientSearch} placeholder="Hasta adı veya TC ara..." /><div style={styles.patientNameList}>{filteredPatients.map((patient) => <button className="patientListButton" key={patient.id} type="button" onClick={() => setSelectedPatientCard(patient)} style={styles.patientListButton}><div style={styles.patientAvatar}>{patient.first_name.charAt(0)}{patient.last_name.charAt(0)}</div><div style={styles.patientListButtonText}><strong style={styles.patientName}>{patient.first_name} {patient.last_name}</strong><small style={styles.patientMeta}>TC: {patient.tc_no.slice(0, 3)}******{patient.tc_no.slice(-2)}</small></div><span style={styles.patientDetailsArrow}>›</span></button>)}</div></div><section id="patient-registration" style={styles.patientFormCard}><div style={styles.patientFormHeader}><span style={styles.patientFormIcon}>+</span><div><h3 style={styles.cardSectionTitle}>Yeni Hasta Kaydı</h3><p style={styles.cardSectionText}>İlk kez başvuran hastanın temel bilgilerini girin.</p></div></div>{newPatientCredentials && <div style={{ ...styles.infoMessage, textAlign: 'left', marginBottom: 16 }}><strong>{newPatientCredentials.fullName}</strong><br />Kullanıcı adı: <strong>{newPatientCredentials.username}</strong><br />Geçici şifre: <strong>{newPatientCredentials.password}</strong><button type="button" onClick={() => setNewPatientCredentials(null)} style={{ ...styles.secondaryButton, marginTop: 8 }}>Bilgiyi Kapat</button></div>}<form onSubmit={handleAddPatient} style={styles.patientFormGrid}><Input label="TC Kimlik No" name="tc_no" value={patientForm.tc_no} onChange={handlePatientChange} placeholder="11 haneli TC no" maxLength={11} required /><Input label="Telefon" name="phone" value={patientForm.phone} onChange={handlePatientChange} placeholder="05XXXXXXXXX" required /><Input label="Ad" name="first_name" value={patientForm.first_name} onChange={handlePatientChange} placeholder="Hasta adı" required /><Input label="Soyad" name="last_name" value={patientForm.last_name} onChange={handlePatientChange} placeholder="Hasta soyadı" required /><label style={{ ...styles.label, gridColumn: '1 / -1' }}>Cinsiyet<select name="gender" value={patientForm.gender} onChange={handlePatientChange} style={styles.input}><option>Kadın</option><option>Erkek</option><option>Belirtmek istemiyor</option></select></label><button type="submit" disabled={saving} style={{ ...(saving ? styles.disabledButton : styles.saveButton), gridColumn: '1 / -1' }}>{saving && <Spinner />}{saving ? 'Kaydediliyor...' : 'Hasta Kaydet'}</button></form></section></section></div>}


          {activeSecretaryTab === 'sms' && <div style={styles.tabContent}><section style={styles.smsHero}><div><p style={styles.tabEyebrow}>OTOMATİK BİLDİRİM MERKEZİ</p><h2 style={styles.tabPageTitle}>SMS Hatırlatmaları</h2><p style={styles.formDescription}>Onaylanan randevular için 24 saat ve 2 saat öncesine planlanan mesajlar backend tarafından otomatik işlenir. Sekreterin manuel gönderim yapmasına gerek yoktur.</p></div><span style={styles.doctorBadge}>Otomatik aktif</span></section><section style={styles.smsStatsGrid}><div style={styles.smsStatCard}><span style={styles.smsStatIcon}>◷</span><div style={styles.smsStatContent}><strong style={styles.smsStatValue}>{smsStats.pending}</strong><small style={styles.smsStatLabel}>Planlanan mesaj</small></div></div><div style={styles.smsStatCard}><span style={styles.smsStatIcon}>✓</span><div style={styles.smsStatContent}><strong style={styles.smsStatValue}>{smsStats.sent}</strong><small style={styles.smsStatLabel}>Otomatik gönderildi</small></div></div><div style={styles.smsStatCard}><span style={styles.smsStatIcon}>×</span><div style={styles.smsStatContent}><strong style={styles.smsStatValue}>{smsStats.cancelled}</strong><small style={styles.smsStatLabel}>İptal edildi</small></div></div></section><section style={styles.smsQueuePanel}><div style={styles.panelHeading}><div><h3 style={styles.cardSectionTitle}>Mesaj Kuyruğu</h3><p style={styles.cardSectionText}>Backend her dakika zamanı gelen kayıtları otomatik olarak gönderildi durumuna geçirir. Bu proje ortamında gerçek telefon SMS’i gönderilmez.</p></div><span style={styles.resultCount}>{smsReminders.length}</span></div>{smsReminders.length === 0 ? <div style={styles.doctorEmptyState}><span style={styles.doctorEmptyIcon}>✉</span><strong>Henüz SMS hatırlatması yok</strong><small>Bir randevu onaylandığında mesajlar otomatik hazırlanır.</small></div> : <div style={styles.smsQueueList}>{smsReminders.map((reminder) => <article key={reminder.id} style={styles.smsQueueCard}><div style={styles.smsQueueMain}><span style={styles.smsPhoneIcon}>SMS</span><div style={styles.smsQueueInfo}><strong>{getPatientName(reminder.patient_id)}</strong><small>{reminder.phone.slice(0, 4)}***{reminder.phone.slice(-4)} · {reminder.reminder_type}</small><p>{reminder.message}</p><span>Planlanan gönderim: {formatDate(reminder.scheduled_for)}</span></div></div><div style={styles.smsQueueAction}><span style={reminder.status === 'Gönderildi' ? styles.smsSentBadge : reminder.status === 'İptal Edildi' ? styles.cancelledBadge : styles.waitingBadge}>{formatSmsStatus(reminder.status)}</span></div></article>)}</div>}</section></div>}

          {activeSecretaryTab === 'calendar' && <div style={styles.tabContent}><section style={styles.calendarPanelLarge}>
            <div style={styles.calendarHeader}>
              <div><p style={styles.eyebrowDark}>PLANLAMA MERKEZİ</p><h2 style={styles.panelTitle}>Randevu Takvimi</h2><p style={styles.formDescription}>Polikliniğinizdeki randevuları haftalık veya günlük görünümde yönetin.</p></div>
              <div style={styles.calendarActions}><button type="button" onClick={() => { setCalendarDate(getLocalToday()); setWeekOffset(0) }} style={styles.calendarTodayButton}>Bugün</button><button type="button" onClick={() => setCalendarView('day')} style={calendarView === 'day' ? styles.calendarViewActive : styles.calendarViewButton}>Günlük</button><button type="button" onClick={() => setCalendarView('week')} style={calendarView === 'week' ? styles.calendarViewActive : styles.calendarViewButton}>Haftalık</button><Input label="" type="date" value={calendarDate} onChange={(event) => { setCalendarDate(event.target.value); setWeekOffset(0) }} /></div>
            </div>
            {outOfHoursAppointments.length > 0 && <div style={styles.calendarWarning}><div style={styles.calendarWarningInfo}><strong style={styles.calendarWarningTitle}>{outOfHoursAppointments.length} randevu çalışma saati dışında</strong><small style={styles.calendarWarningText}>Bu eski kayıtları 08:30–17:00 aralığına taşıyın.</small></div><div style={styles.calendarWarningList}>{outOfHoursAppointments.map((appointment) => <button key={appointment.id} type="button" onClick={() => openRescheduleModal(appointment)} style={styles.calendarWarningButton}><span>{getPatientName(appointment.patient_id)}</span><small>{getLocalTimeKey(appointment.appointment_date)} · Düzelt</small></button>)}</div></div>}
            {calendarView === 'day' ? (
              <div key={`day-${calendarDate}-${calendarRevision}`} style={styles.calendarGrid}>{calendarAppointments.length === 0 ? <p style={styles.emptyText}>Bu gün için randevu bulunmuyor.</p> : calendarAppointments.map((appointment) => <div key={appointment.id} role={canRescheduleAppointment(appointment) ? 'button' : undefined} tabIndex={canRescheduleAppointment(appointment) ? 0 : undefined} title={canRescheduleAppointment(appointment) ? 'Tarih veya saati değiştirmek için tıklayın' : 'Bu randevu artık değiştirilemez'} onClick={() => canRescheduleAppointment(appointment) && openRescheduleModal(appointment)} onKeyDown={(event) => { if (canRescheduleAppointment(appointment) && (event.key === 'Enter' || event.key === ' ')) openRescheduleModal(appointment) }} style={{ ...styles.calendarItem, ...getCalendarStatusStyle(appointment.status), ...(canRescheduleAppointment(appointment) ? styles.calendarEditable : styles.calendarLocked) }}><strong style={styles.calendarTime}>{new Date(appointment.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</strong><div><strong>{getPatientName(appointment.patient_id)}</strong><small style={styles.calendarMeta}>{getDoctorName(appointment.doctor_id)} · {getDepartmentName(appointment.department_id)}</small></div><div style={styles.calendarStatusColumn}><span>{appointment.status}</span>{canRescheduleAppointment(appointment) && <small style={styles.calendarEditHint}>Değiştir</small>}</div></div>)}</div>
            ) : (
              <><div style={styles.weekNavigation}><button type="button" onClick={() => setWeekOffset((value) => value - 1)} style={styles.calendarArrow}>‹</button><strong>{new Date(`${weekDates[0]}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })} — {new Date(`${weekDates[6]}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong><button type="button" onClick={() => setWeekOffset((value) => value + 1)} style={styles.calendarArrow}>›</button></div><div key={`week-${calendarDate}-${weekOffset}-${calendarRevision}`} style={styles.weekCalendar}><div style={styles.weekCorner}></div>{weekDates.map((date, dayIndex) => <div key={date} style={{ ...styles.weekDayHeader, ...(date === getLocalToday() ? styles.weekDayToday : {}), gridColumn: dayIndex + 2, gridRow: 1 }}>{new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })}<strong>{new Date(`${date}T12:00:00`).getDate()}</strong></div>)}{Array.from({ length: 18 }, (_, slotIndex) => { const totalMinutes = 8 * 60 + 30 + slotIndex * 30; const slotHour = Math.floor(totalMinutes / 60); const slotMinute = totalMinutes % 60; return <div key={`slot-time-${slotIndex}`} style={{ ...styles.weekHour, gridColumn: 1, gridRow: slotIndex + 2 }}>{`${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`}</div> })}{Array.from({ length: 18 * 7 }, (_, index) => <div key={`slot-${index}`} style={{ ...styles.weekSlot, gridColumn: (index % 7) + 2, gridRow: Math.floor(index / 7) + 2 }}></div>)}{weeklyAppointments.filter((appointment) => isValidAppointmentTime(getLocalTimeKey(appointment.appointment_date))).map((appointment) => { const appointmentDate = new Date(appointment.appointment_date); const date = getLocalDateKey(appointmentDate); const hour = appointmentDate.getHours(); const minute = appointmentDate.getMinutes(); const slotIndex = (hour - 8) * 2 + (minute >= 30 ? 1 : 0) - 1; const dayIndex = weekDates.indexOf(date); return <div key={appointment.id} role={canRescheduleAppointment(appointment) ? 'button' : undefined} tabIndex={canRescheduleAppointment(appointment) ? 0 : undefined} title={canRescheduleAppointment(appointment) ? 'Tarih veya saati değiştirmek için tıklayın' : 'Bu randevu artık değiştirilemez'} onClick={() => canRescheduleAppointment(appointment) && openRescheduleModal(appointment)} onKeyDown={(event) => { if (canRescheduleAppointment(appointment) && (event.key === 'Enter' || event.key === ' ')) openRescheduleModal(appointment) }} style={{ ...styles.weekAppointment, ...getCalendarStatusStyle(appointment.status), ...(canRescheduleAppointment(appointment) ? styles.calendarEditable : styles.calendarLocked), gridColumn: dayIndex + 2, gridRow: `${slotIndex + 2} / span 1` }}><strong>{String(appointment.appointment_date).slice(11, 16)}</strong><span>{getPatientName(appointment.patient_id)}</span><small>{getDoctorName(appointment.doctor_id)}</small></div> })}</div></>
            )}
            <div style={styles.calendarLegend}><span><i style={styles.legendBlue}></i> Onaylandı</span><span><i style={styles.legendPurple}></i> Muayenede</span><span><i style={styles.legendGreen}></i> Tamamlandı</span><span><i style={styles.legendRed}></i> İptal / Reddedildi</span></div>
          </section></div>}

        </>
      ) : (
        <div style={styles.tabContent}>
          <section style={styles.doctorWorkspaceHeader}>
            <div><p style={styles.tabEyebrow}>DOKTOR ÇALIŞMA ALANI</p><h2 style={styles.tabPageTitle}>{activeDoctorTab === 'today' ? 'Bugünkü Randevular' : activeDoctorTab === 'waiting' ? 'Muayene Bekleyenler' : activeDoctorTab === 'completed' ? 'Tamamlanan Muayeneler' : activeDoctorTab === 'history' ? 'Hasta Geçmişi' : 'Servis Hastaları'}</h2><p style={styles.formDescription}>{activeDoctorTab === 'today' ? 'Bugün planlanan hasta görüşmelerinizi saat sırasıyla takip edin.' : activeDoctorTab === 'waiting' ? 'Muayeneye alınmaya hazır onaylı hastaları yönetin.' : activeDoctorTab === 'completed' ? 'Tamamladığınız muayeneleri görüntüleyin.' : activeDoctorTab === 'history' ? 'Önceki teşhis, muayene notu ve reçete bilgilerine ulaşın.' : 'Yataklı servislerde bulunan hastaların güncel durumunu görüntüleyin.'}</p></div>
            <div style={styles.doctorHeaderIdentity}><span style={styles.doctorOnlineDot}></span><div style={styles.doctorIdentityInfo}><strong style={styles.doctorIdentityName}>{user.full_name}</strong><small style={styles.doctorIdentityMeta}>{clinicDepartment?.name || 'Poliklinik'} · Aktif</small></div></div>
          </section>

          {activeDoctorTab !== 'history' && activeDoctorTab !== 'inpatients' && <SearchBox value={appointmentSearch} onChange={setAppointmentSearch} placeholder="Hasta adı veya randevu durumu ara..." />}
          {activeDoctorTab === 'today' && <section style={styles.doctorPanel}>{renderDoctorAppointments(doctorTodayAppointments, 'Bugün için randevu bulunmuyor')}</section>}
          {activeDoctorTab === 'waiting' && <section style={styles.doctorPanel}>{renderDoctorAppointments(doctorWaitingAppointments, 'Muayene bekleyen hasta bulunmuyor')}</section>}
          {activeDoctorTab === 'completed' && <section style={styles.doctorPanel}>{renderDoctorAppointments(doctorCompletedAppointments, 'Tamamlanan muayene bulunmuyor')}</section>}
          {activeDoctorTab === 'inpatients' && <BedManagement services={inpatientServices} beds={beds} patients={[]} readOnly={!can('bed.assign')} canAssign={can('bed.assign')} canDischarge={can('bed.discharge')} />}
          {activeDoctorTab === 'history' && <section style={styles.doctorPanel}>{medicalRecords.length === 0 ? <div style={styles.doctorEmptyState}><span style={styles.doctorEmptyIcon}>↺</span><strong>Hasta geçmişi bulunmuyor</strong><small>Tamamlanan muayeneler bu alanda görüntülenecektir.</small></div> : <div style={styles.medicalHistoryGrid}>{[...medicalRecords].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((record) => { const appointment = appointments.find((item) => item.id === record.appointment_id); const recordPrescriptions = prescriptions.filter((item) => item.medical_record_id === record.id); return <article key={record.id} style={styles.medicalHistoryCard}><div style={styles.medicalHistoryTop}><div><span style={styles.medicalRecordLabel}>MUAYENE KAYDI</span><h3 style={styles.medicalDiagnosis}>{record.diagnosis}</h3></div><span style={styles.completedBadge}>Tamamlandı</span></div><div style={styles.medicalPatientLine}><div style={styles.patientAvatar}>{appointment ? getPatientName(appointment.patient_id).split(' ').map((part) => part.charAt(0)).slice(0, 2).join('') : 'H'}</div><div style={styles.doctorIdentityInfo}><strong style={styles.doctorIdentityName}>{appointment ? getPatientName(appointment.patient_id) : 'Hasta bilgisi'}</strong><small style={styles.doctorIdentityMeta}>{formatDate(record.created_at)}</small></div></div><p style={styles.medicalNotes}>{record.notes || 'Muayene notu bulunmuyor.'}</p><div style={styles.prescriptionSummary}><strong>Reçete</strong>{recordPrescriptions.length === 0 ? <small>Reçete oluşturulmamış.</small> : recordPrescriptions.map((item) => <span key={item.id}>{item.medicine_name} · {item.dosage} · {item.days} gün · E-Reçete: {item.prescription_number || `EREC-${String(item.id).padStart(6, '0')}`} · Barkod: {item.barcode || `HBYS-${String(item.id).padStart(8, '0')}`}</span>)}</div></article> })}</div>}</section>}
        </div>
      )}

      {rescheduleAppointment && (
        <Modal title="Randevuyu Yeniden Planla" onClose={() => { setRescheduleAppointment(null); setError('') }}>
          {error && <p style={styles.modalError}>{error}</p>}
          <div style={styles.rescheduleSummary}>
            <div style={styles.patientAvatar}>{getPatientName(rescheduleAppointment.patient_id).split(' ').map((part) => part.charAt(0)).slice(0, 2).join('')}</div>
            <div style={styles.rescheduleIdentity}><strong>{getPatientName(rescheduleAppointment.patient_id)}</strong><small>{getDoctorName(rescheduleAppointment.doctor_id)} · {getDepartmentName(rescheduleAppointment.department_id)}</small><span>Mevcut: {formatDate(rescheduleAppointment.appointment_date)}</span></div>
          </div>
          <form onSubmit={handleRescheduleAppointment} style={styles.modalForm}>
            <div style={styles.quickShiftPanel}><span style={styles.quickShiftTitle}>Hızlı değişiklik</span><div style={styles.quickShiftButtons}><button type="button" onClick={() => shiftRescheduleTime({ minutes: -30 })} style={styles.quickShiftButton}>−30 dk</button><button type="button" onClick={() => shiftRescheduleTime({ minutes: 30 })} style={styles.quickShiftButton}>+30 dk</button><button type="button" onClick={() => shiftRescheduleTime({ days: 1 })} style={styles.quickShiftButton}>+1 gün</button><button type="button" onClick={() => shiftRescheduleTime({ days: 7 })} style={styles.quickShiftButton}>+1 hafta</button></div></div>
            <div style={styles.modalRow}><Input label="Yeni tarih" type="date" min={getLocalToday()} value={rescheduleForm.date} onChange={(event) => setRescheduleForm((previous) => ({ ...previous, date: event.target.value }))} required /><Input label="Yeni saat" type="time" min={APPOINTMENT_START_TIME} max={APPOINTMENT_END_TIME} step="1800" value={rescheduleForm.time} onChange={(event) => setRescheduleForm((previous) => ({ ...previous, time: event.target.value }))} required /></div>
            <p style={styles.rescheduleNotice}>Hasta, doktor ve poliklinik değişmez. Sistem doktor ve hasta saat çakışmasını kaydetmeden önce yeniden kontrol eder.</p>
            <ModalFooter onClose={() => { setRescheduleAppointment(null); setError('') }} saving={saving} submitText="Değişikliği Kaydet" />
          </form>
        </Modal>
      )}

      {selectedPatientCard && (
        <Modal title="Hasta Bilgileri" onClose={() => setSelectedPatientCard(null)}>
          <PatientCard
            patient={selectedPatientCard}
            appointmentCount={(patientAppointmentSummaries[selectedPatientCard.id] || { count: 0 }).count}
            nextAppointment={(patientAppointmentSummaries[selectedPatientCard.id] || { next: null }).next}
            formatDate={formatDate}
            onCreateAppointment={(patient) => {
              setSelectedPatientCard(null)
              setAppointmentForm({ ...emptyAppointment, patient_id: patient.id, department_id: user.department_id || '' })
              setIsAppointmentModalOpen(true)
            }}
          />
        </Modal>
      )}

      {isAppointmentModalOpen && (
        <Modal title="Yeni Randevu Oluştur" wide onClose={() => setIsAppointmentModalOpen(false)}>
          {error && <p style={styles.modalError}>{error}</p>}
          <form onSubmit={handleCreateAppointment} style={styles.modalForm}>
            <Select label="Hasta" name="patient_id" value={appointmentForm.patient_id} onChange={updateForm(setAppointmentForm)} options={patients.map((item) => ({ value: item.id, label: `${item.first_name} ${item.last_name}` }))} placeholder="Hasta seçin" />
            <Select label="Poliklinik" name="department_id" value={appointmentForm.department_id} onChange={(event) => { setSelectedAvailabilityDate(''); setShowAvailabilityOptions(false); setAppointmentForm((previous) => ({ ...previous, department_id: event.target.value, doctor_id: '', date: '', time: '' })) }} options={visibleDepartments.map((item) => ({ value: item.id, label: item.name }))} placeholder="Poliklinik seçin" />
            <Select 
  label="Doktor" 
  name="doctor_id" 
  value={appointmentForm.doctor_id} 
  onChange={(event) => {
    const doctorId = event.target.value
    const suggestion = doctorAppointmentSuggestions[doctorId]
    setUseNearestAppointment(false)
    setShowAvailabilityOptions(false)
    setSelectedAvailabilityDate(suggestion?.date || '')
    setAppointmentForm((previous) => ({ ...previous, doctor_id: doctorId, date: suggestion?.date || '', time: suggestion?.time || '' }))
  }} 
  // SADECE FİLTRELENMİŞ DOKTORLARI GÖSTER:
  options={filteredDoctorsByDepartment.map((item) => {
    const suggestion = doctorAppointmentSuggestions[item.id]
    const suggestionText = suggestion ? ` · En yakın uygun randevu: ${formatDateKeyForDisplay(suggestion.date)} ${suggestion.time}` : ' · Uygun randevu bulunamadı'
    return { value: item.id, label: `Dr. ${item.first_name} ${item.last_name}${suggestionText}` }
  })} 
  placeholder="Doktor seçin"
  // POLİKLİNİK SEÇİLMEDEN DOKTOR SEÇİMİNİ PASİF YAP:
  disabled={!appointmentForm.department_id} 
/>
            {nearestAppointmentSuggestion && <div style={styles.appointmentSuggestion}><strong>En yakın uygun randevu</strong><span>Dr. {nearestAppointmentSuggestion.doctor.first_name} {nearestAppointmentSuggestion.doctor.last_name} · {formatDateKeyForDisplay(nearestAppointmentSuggestion.date)} · {nearestAppointmentSuggestion.time}</span><small>İsterseniz aşağıdaki listeden doktorun diğer uygun gün ve saatlerinden birini seçebilirsiniz.</small><label style={styles.nearestAppointmentChoice}><input type="checkbox" checked={useNearestAppointment} onChange={(event) => { const checked = event.target.checked; setUseNearestAppointment(checked); if (checked) { setSelectedAvailabilityDate(nearestAppointmentSuggestion.date); setAppointmentForm((previous) => ({ ...previous, date: nearestAppointmentSuggestion.date, time: nearestAppointmentSuggestion.time })) } }} /> En yakın randevuyu seç</label></div>}
            {appointmentForm.doctor_id ? <>
              <button type="button" style={styles.availabilityToggleButton} onClick={() => setShowAvailabilityOptions((value) => !value)}>{showAvailabilityOptions ? '▲ Diğer tarih ve saatleri gizle' : '＋ Diğer tarih ve saatleri göster'}</button>
              {showAvailabilityOptions && <>
              <div style={styles.availabilityToolbar}>
                <div><strong style={styles.availabilityTitle}>Dr. {doctors.find((doctor) => doctor.id === Number(appointmentForm.doctor_id))?.first_name} {doctors.find((doctor) => doctor.id === Number(appointmentForm.doctor_id))?.last_name} için uygun randevular</strong><small style={styles.availabilitySubtitle}>Doktor değiştiğinde bu tarih ve saat listesi otomatik olarak yenilenir.</small></div>
                <label style={styles.availabilityFilter}>Aralık<select value={availabilityRange} onChange={(event) => setAvailabilityRange(event.target.value)} style={styles.availabilitySelect}><option value="7">7 gün</option><option value="14">14 gün</option><option value="30">30 gün</option></select></label>
              </div>
              <div style={styles.availabilityCheckboxes}>
                <label style={styles.availabilityCheckbox}><input type="checkbox" checked={morningOnly} onChange={(event) => setMorningOnly(event.target.checked)} /> Sabah (08:30–11:30)</label>
                <label style={styles.availabilityCheckbox}><input type="checkbox" checked={afternoonOnly} onChange={(event) => setAfternoonOnly(event.target.checked)} /> Öğleden sonra (12:00–17:00)</label>
              </div>
              {appointmentAvailability.length ? <div style={styles.availabilityWorkspace}>
                <div style={styles.availabilityDateList}>{appointmentAvailability.map((day) => <button key={day.date} type="button" onClick={() => { setUseNearestAppointment(false); setSelectedAvailabilityDate(day.date); setAppointmentForm((previous) => ({ ...previous, date: day.date, time: day.slots[0] })) }} style={selectedAvailabilityDate === day.date ? styles.selectedAvailabilityDate : styles.availabilityDateButton}><strong>{formatDateKeyForDisplay(day.date)}</strong><small>{day.slots.length} uygun saat</small></button>)}</div>
                <div style={styles.availabilityTimePanel}><strong style={styles.availabilityTimeTitle}>{activeAvailabilityDay ? formatDateKeyForDisplay(activeAvailabilityDay.date) : 'Tarih seçin'}</strong><small style={styles.availabilitySubtitle}>Bu gün için uygun saatler</small><div style={styles.availabilitySlots}>{(activeAvailabilityDay?.slots || []).map((time) => <button key={time} type="button" onClick={() => { setUseNearestAppointment(false); setAppointmentForm((previous) => ({ ...previous, date: activeAvailabilityDay.date, time })) }} style={appointmentForm.date === activeAvailabilityDay?.date && appointmentForm.time === time ? styles.selectedAvailabilitySlot : styles.availabilitySlot}>{time}</button>)}</div></div>
              </div> : <p style={styles.modalHint}>Seçilen aralıkta uygun randevu bulunamadı. Daha uzun bir tarih aralığı deneyin.</p>}
              <div style={styles.selectedAppointmentSummary}>Seçilen randevu: <strong>{appointmentForm.date ? `${formatDateKeyForDisplay(appointmentForm.date)} ${appointmentForm.time || ''}` : 'Henüz seçilmedi'}</strong></div>
              </>}
            </> : <p style={styles.modalHint}>Önce poliklinik ve doktor seçin; uygun gün ve saatler burada listelenecektir.</p>}
            <Textarea label="Not (isteğe bağlı)" name="note" value={appointmentForm.note} onChange={updateForm(setAppointmentForm)} placeholder="Randevu notu..." />
            <ModalFooter onClose={() => setIsAppointmentModalOpen(false)} saving={saving} submitText="Randevuyu Kaydet" />
          </form>
        </Modal>
      )}

      {isExaminationModalOpen && selectedAppointment && (
        <Modal title={`Muayene: ${getPatientName(selectedAppointment.patient_id)}`} onClose={() => setIsExaminationModalOpen(false)}>
          <p style={styles.modalHint}>Randevu oluşturma işlemi sekreter tarafından tamamlandı. Bu bölüm yalnızca doktorun muayene ve reçete kaydı içindir.</p>
          <form onSubmit={handleCreateExamination} style={styles.modalForm}>
            <Input label="Teşhis" name="diagnosis" value={examinationForm.diagnosis} onChange={updateForm(setExaminationForm)} placeholder="Örn: Akut faranjit" required />
            <Textarea label="Muayene notları" name="notes" value={examinationForm.notes} onChange={updateForm(setExaminationForm)} placeholder="Muayene bulguları..." />
            <div style={styles.divider}><strong>Reçete (isteğe bağlı)</strong><span>Muayene kaydından sonra reçeteye bağlanır.</span></div>
            <Input label="İlaç adı" name="medicine_name" value={examinationForm.medicine_name} onChange={updateForm(setExaminationForm)} placeholder="Örn: Parol 500mg" />
            <div style={styles.modalRow}><Input label="Kullanım şekli" name="dosage" value={examinationForm.dosage} onChange={updateForm(setExaminationForm)} placeholder="Günde 2 kez tok karnına" /><Input label="Tedavi günü" name="days" type="number" min="1" value={examinationForm.days} onChange={updateForm(setExaminationForm)} /></div>
            <ModalFooter onClose={() => setIsExaminationModalOpen(false)} saving={saving} submitText="Muayene ve Reçeteyi Kaydet" />
          </form>
        </Modal>
      )}

      {isPasswordModalOpen && (
        <Modal title="Şifre Değiştir" onClose={() => setIsPasswordModalOpen(false)}>
          <p style={styles.modalHint}>Güvenliğiniz için en az 8 karakterli, tahmin edilmesi zor bir şifre belirleyin.</p>
          <form onSubmit={handleChangePassword} style={styles.modalForm}>
            <Input label="Mevcut şifre" name="current_password" type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((previous) => ({ ...previous, current_password: event.target.value }))} required autoComplete="current-password" />
            <Input label="Yeni şifre" name="new_password" type="password" minLength={8} value={passwordForm.new_password} onChange={(event) => setPasswordForm((previous) => ({ ...previous, new_password: event.target.value }))} required autoComplete="new-password" />
            <Input label="Yeni şifre tekrarı" name="confirm_password" type="password" minLength={8} value={passwordForm.confirm_password} onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirm_password: event.target.value }))} required autoComplete="new-password" />
            <ModalFooter onClose={() => setIsPasswordModalOpen(false)} saving={saving} submitText="Şifreyi Güncelle" />
          </form>
        </Modal>
      )}
    </main>
  )
}

export default App
