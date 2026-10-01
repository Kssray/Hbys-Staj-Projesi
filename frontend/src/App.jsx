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
import styles from './styles.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

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

const APPOINTMENT_START_TIME = '08:00'
const APPOINTMENT_END_TIME = '17:30'

function isValidAppointmentTime(time) {
  if (!time || time < APPOINTMENT_START_TIME || time > APPOINTMENT_END_TIME) return false
  const minute = Number(time.split(':')[1])
  return minute === 0 || minute === 30
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
      return storedUser?.role === 'doktor' ? 'doctor' : storedUser?.role === 'hasta' ? 'patient' : storedUser?.role === 'yonetici' ? 'admin' : 'secretary'
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
  const [selectedPatientCard, setSelectedPatientCard] = useState(null)
  const [rescheduleAppointment, setRescheduleAppointment] = useState(null)
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' })
  const [calendarRevision, setCalendarRevision] = useState(0)

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
      setRole(loggedInUser.role === 'doktor' ? 'doctor' : loggedInUser.role === 'hasta' ? 'patient' : loggedInUser.role === 'yonetici' ? 'admin' : 'secretary')
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
      const appointmentsUrl = user?.role === 'doktor' && user.doctor_id
        ? `${API_URL}/appointments/?doctor_id=${user.doctor_id}`
        : user?.role === 'sekreter' && user.department_id
          ? `${API_URL}/appointments/?department_id=${user.department_id}`
          : user?.role === 'hasta' && user.patient_id
            ? `${API_URL}/appointments/?patient_id=${user.patient_id}`
            : `${API_URL}/appointments/`
      const patientsUrl = user?.role === 'hasta' && user.patient_id
        ? `${API_URL}/patients/?patient_id=${user.patient_id}`
        : `${API_URL}/patients/`
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
        ? `${API_URL}/sms-reminders/?department_id=${user.department_id}`
        : `${API_URL}/sms-reminders/`
      const responses = await Promise.all([
        fetch(`${API_URL}/departments/`),
        fetch(`${API_URL}/doctors/`),
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
    } catch (err) {
      console.error(err)
      setError('Veriler yüklenemedi. Backend sunucusunun çalıştığını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  const refreshSmsReminders = async () => {
    if (!user || !['sekreter', 'yonetici'].includes(user.role)) return
    try {
      const url = user.role === 'sekreter' && user.department_id
        ? `${API_URL}/sms-reminders/?department_id=${user.department_id}`
        : `${API_URL}/sms-reminders/`
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) setSmsReminders(await response.json())
    } catch (err) {
      console.warn('SMS kuyruğu yenilenemedi:', err)
    }
  }

  const refreshAppointments = async () => {
    const url = user?.role === 'sekreter' && user.department_id
      ? `${API_URL}/appointments/?department_id=${user.department_id}`
      : user?.role === 'doktor' && user.doctor_id
        ? `${API_URL}/appointments/?doctor_id=${user.doctor_id}`
        : user?.role === 'hasta' && user.patient_id
          ? `${API_URL}/appointments/?patient_id=${user.patient_id}`
          : `${API_URL}/appointments/`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Güncel randevular alınamadı.')
    const freshAppointments = await response.json()
    setAppointments(freshAppointments)
    return freshAppointments
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

    const selectedDateTime = new Date(
      `${appointmentForm.date}T${appointmentForm.time}`,
    )

    if (!appointmentForm.date || !appointmentForm.time || selectedDateTime < new Date()) {
      setError('Geçmiş bir tarih veya saate randevu alınamaz.')
      return
    }

    if (!isValidAppointmentTime(appointmentForm.time)) {
      setError('Randevu saati 08:00–17:30 arasında ve tam veya yarım saat olmalıdır.')
      return
    }

    const selectedDateKey = `${appointmentForm.date}T${appointmentForm.time}`
    const activeAppointments = appointments.filter(
      (item) => item.status !== 'İptal' && item.status !== 'İptal Edildi',
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
      const response = await fetch(`${API_URL}/appointments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: Number(appointmentForm.patient_id),
          doctor_id: Number(appointmentForm.doctor_id),
          department_id: Number(appointmentForm.department_id),
          appointment_date: `${appointmentForm.date}T${appointmentForm.time}:00`,
          status: role === 'patient' ? 'Talep Edildi' : 'Onaylandı',
          request_note: appointmentForm.note.trim() || null,
          requested_by_user_id: user.id,
        }),
      })
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Randevu kaydedilemedi.'))
      }
      const appointment = await response.json()
      setAppointments((previous) => [...previous, appointment])
      setAppointmentForm(emptyAppointment)
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
        ? `${getPatientName(previousAppointment.patient_id)} randevusu onaylandı ve SMS hatırlatmaları hazırlandı.`
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
      setError('Randevular yalnızca 08:00–17:30 çalışma saatleri içinde planlanabilir.')
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
      setError('Randevu saati 08:00–17:30 arasında ve tam veya yarım saat olmalıdır.')
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

      const refreshedResponse = await fetch(`${API_URL}/appointments/?department_id=${user.department_id}`, { cache: 'no-store' })
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
      const response = await fetch(`${API_URL}/appointments/${appointment.id}/status?status=Muayenede&user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Muayene başlatılamadı.'))
      const updated = await response.json()
      setAppointments((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setSelectedAppointment(updated)
      setIsExaminationModalOpen(true)
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
        `${API_URL}/appointments/${selectedAppointment.id}/status?status=Tamamlandı`,
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

  const renderDoctorAppointments = (items, emptyMessage) => items.length === 0 ? (
    <div style={styles.doctorEmptyState}><span style={styles.doctorEmptyIcon}>✓</span><strong>{emptyMessage}</strong><small>Yeni kayıtlar oluştuğunda bu alanda görüntülenecektir.</small></div>
  ) : (
    <div style={styles.doctorAppointmentList}>
      {items.map((appointment) => {
        const hasRecord = medicalRecords.some((record) => record.appointment_id === appointment.id)
        return <div key={appointment.id} style={styles.doctorAppointmentCard}>
          <div style={styles.doctorAppointmentMain}><div style={styles.patientAvatar}>{getPatientName(appointment.patient_id).split(' ').map((part) => part.charAt(0)).slice(0, 2).join('')}</div><div><strong style={styles.appointmentPatient}>{getPatientName(appointment.patient_id)}</strong><p style={styles.appointmentDetails}>{getDepartmentName(appointment.department_id)} · {formatDate(appointment.appointment_date)}</p><span style={styles.doctorStatusText}>Durum: {hasRecord || appointment.status === 'Tamamlandı' ? 'Tamamlandı' : appointment.status}</span></div></div>
          {hasRecord || appointment.status === 'Tamamlandı' ? <span style={styles.completedBadge}>Tamamlandı</span> : appointment.status === 'İptal' || appointment.status === 'İptal Edildi' ? <span style={styles.cancelledBadge}>İptal Edildi</span> : appointment.status === 'Onaylandı' || appointment.status === 'Bekliyor' ? <button type="button" onClick={() => handleStartExamination(appointment)} style={styles.primaryButton}>Muayeneye Al</button> : <span style={styles.waitingBadge}>Sekreter onayı bekleniyor</span>}
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
        <span style={styles.roleLabel}>{user.full_name} · {user.role === 'doktor' ? 'Doktor' : user.role === 'yonetici' ? 'Yönetici' : user.role === 'hasta' ? 'Hasta' : 'Sekreter'}</span>
        <span style={styles.roleLabel}>Aktif panel: {role === 'doctor' ? 'Doktor' : role === 'patient' ? 'Hasta' : role === 'admin' ? 'Yönetim' : 'Sekreter'}</span>
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
          {[['today', 'Bugünkü Randevular'], ['waiting', 'Muayene Bekleyenler'], ['completed', 'Tamamlananlar'], ['history', 'Hasta Geçmişi']].map(([tabKey, label]) => (
            <button key={tabKey} type="button" onClick={() => { setActiveDoctorTab(tabKey); setAppointmentSearch(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={activeDoctorTab === tabKey ? styles.activeTabButton : styles.tabButton}>{label}</button>
          ))}
        </nav>
      )}

      {loading && <div style={styles.infoMessage}>Veriler yükleniyor...</div>}
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

      {role !== 'secretary' && role !== 'doctor' && <section style={styles.dashboard} data-reveal="up">
        <StatCard icon="👥" title="Hastalar" value={patients.length} text="Kayıtlı hasta" />
        <StatCard icon="📅" title="Randevular" value={appointments.length} text="Toplam randevu" />
        <StatCard icon="🗓️" title="Bugün" value={appointmentStats.today} text="Bugünkü randevu" />
        <StatCard icon="⏳" title="Bekleyen" value={appointmentStats.pending} text="Bekleyen randevu" />
        <StatCard icon="✅" title="Tamamlanan" value={appointmentStats.completed} text="Tamamlanan randevu" />
        <StatCard icon="💊" title="Reçeteler" value={prescriptions.length} text={`${appointmentStats.cancelled} iptal randevu`} />
      </section>}

      {role === 'admin' ? (
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
          <h3 style={styles.sectionTitle}>Randevularım</h3>
          {filteredAppointments.length === 0 ? <p style={styles.emptyText}>Henüz randevunuz bulunmuyor.</p> : <AppointmentTable appointments={filteredAppointments} getPatientName={getPatientName} getDoctorName={getDoctorName} getDepartmentName={getDepartmentName} formatDate={formatDate} onCancel={handleCancelAppointment} />}
          <h3 style={styles.sectionTitle}>Muayene ve Reçete Geçmişim</h3>
          {medicalRecords.length === 0 ? <p style={styles.emptyText}>Henüz tamamlanmış bir muayene kaydınız bulunmuyor.</p> : (
            <div style={styles.doctorAppointmentList}>
              {medicalRecords.map((record) => {
                const appointment = appointments.find((item) => item.id === record.appointment_id)
                const recordPrescriptions = prescriptions.filter((item) => item.medical_record_id === record.id)
                return <div key={record.id} style={styles.doctorAppointmentCard}>
                  <div><strong style={styles.appointmentPatient}>{record.diagnosis}</strong><p style={styles.appointmentDetails}>{appointment ? `${getDoctorName(appointment.doctor_id)} · ${formatDate(record.created_at)}` : formatDate(record.created_at)}</p><span>{record.notes || 'Muayene notu bulunmuyor.'}</span></div>
                  <div>{recordPrescriptions.length === 0 ? <span style={styles.waitingBadge}>Reçete yok</span> : recordPrescriptions.map((item) => <div key={item.id} style={{ marginBottom: 5 }}><strong>{item.medicine_name}</strong><br /><small>{item.dosage} · {item.days} gün</small></div>)}</div>
                </div>
              })}
            </div>
          )}
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
              {requestedAppointments.length === 0 ? <div style={styles.approvalEmptyMessage}><span>✓</span><div><strong>Bekleyen talep bulunmuyor</strong><small>Yeni hasta talebi geldiğinde burada görünecektir.</small></div></div> : <div style={styles.approvalRequestList}>{requestedAppointments.map((appointment) => <article key={appointment.id} style={String(processingRequest?.id) === String(appointment.id) ? { ...styles.approvalRequestCard, ...styles.approvalRequestCardProcessing } : styles.approvalRequestCard}><div style={styles.approvalPatient}><div style={styles.patientAvatar}>{getPatientName(appointment.patient_id).split(' ').map((part) => part.charAt(0)).slice(0, 2).join('')}</div><div><strong style={styles.appointmentPatient}>{getPatientName(appointment.patient_id)}</strong><small style={styles.approvalMeta}>{getDoctorName(appointment.doctor_id)} · {formatDate(appointment.appointment_date)}</small>{appointment.request_note && <p style={styles.approvalNote}>“{appointment.request_note}”</p>}</div></div><div style={styles.approvalActions}><button type="button" disabled={Boolean(processingRequest)} onClick={() => handleAppointmentDecision(appointment.id, 'reject')} style={processingRequest ? styles.requestActionDisabled : styles.rejectRequestButton}>{String(processingRequest?.id) === String(appointment.id) && processingRequest?.decision === 'reject' ? 'Reddediliyor...' : 'Reddet'}</button><button type="button" disabled={Boolean(processingRequest)} onClick={() => handleAppointmentDecision(appointment.id, 'approve')} style={processingRequest ? styles.requestActionDisabled : styles.approveRequestButton}>{String(processingRequest?.id) === String(appointment.id) && processingRequest?.decision === 'approve' ? 'Onaylanıyor...' : 'Onayla'}</button></div></article>)}</div>}
            </section>
            <section style={styles.appointmentListPanel}><div style={styles.panelHeading}><h2 style={styles.panelTitle}>Randevu Listesi</h2><span style={styles.resultCount}>{filteredAppointments.length}</span></div><SearchBox value={appointmentSearch} onChange={setAppointmentSearch} placeholder="Hasta veya doktor ara..." />{filteredAppointments.length === 0 ? <p style={styles.emptyText}>Henüz randevu bulunmuyor.</p> : <AppointmentTable appointments={filteredAppointments} getPatientName={getPatientName} getDoctorName={getDoctorName} getDepartmentName={getDepartmentName} formatDate={formatDate} onCancel={handleCancelAppointment} onApprove={(id) => handleAppointmentDecision(id, 'approve')} onReject={(id) => handleAppointmentDecision(id, 'reject')} compact />}</section>
          </div>}

          {activeSecretaryTab === 'patients' && <div style={styles.tabContent}><div style={styles.tabPageHeader}><div><p style={styles.tabEyebrow}>HASTA İŞLEMLERİ</p><h2 style={styles.tabPageTitle}>Hasta Yönetimi</h2><p style={styles.formDescription}>Kayıtlı hastaları görüntüleyin veya sisteme yeni hasta ekleyin.</p></div><span style={styles.tabSummaryBadge}>{patients.length} kayıtlı hasta</span></div><section className="patientWorkspace" style={styles.patientWorkspace}><div style={styles.patientListCard}><div style={styles.panelHeading}><div><h3 style={styles.cardSectionTitle}>Kayıtlı Hastalar</h3><p style={styles.cardSectionText}>Ad, soyad veya TC numarasıyla arayın.</p></div><span style={styles.resultCount}>{filteredPatients.length}</span></div><SearchBox value={patientSearch} onChange={setPatientSearch} placeholder="Hasta adı veya TC ara..." /><div style={styles.patientNameList}>{filteredPatients.map((patient) => <button className="patientListButton" key={patient.id} type="button" onClick={() => setSelectedPatientCard(patient)} style={styles.patientListButton}><div style={styles.patientAvatar}>{patient.first_name.charAt(0)}{patient.last_name.charAt(0)}</div><div style={styles.patientListButtonText}><strong style={styles.patientName}>{patient.first_name} {patient.last_name}</strong><small style={styles.patientMeta}>TC: {patient.tc_no.slice(0, 3)}******{patient.tc_no.slice(-2)}</small></div><span style={styles.patientDetailsArrow}>›</span></button>)}</div></div><section id="patient-registration" style={styles.patientFormCard}><div style={styles.patientFormHeader}><span style={styles.patientFormIcon}>+</span><div><h3 style={styles.cardSectionTitle}>Yeni Hasta Kaydı</h3><p style={styles.cardSectionText}>İlk kez başvuran hastanın temel bilgilerini girin.</p></div></div>{newPatientCredentials && <div style={{ ...styles.infoMessage, textAlign: 'left', marginBottom: 16 }}><strong>{newPatientCredentials.fullName}</strong><br />Kullanıcı adı: <strong>{newPatientCredentials.username}</strong><br />Geçici şifre: <strong>{newPatientCredentials.password}</strong><button type="button" onClick={() => setNewPatientCredentials(null)} style={{ ...styles.secondaryButton, marginTop: 8 }}>Bilgiyi Kapat</button></div>}<form onSubmit={handleAddPatient} style={styles.patientFormGrid}><Input label="TC Kimlik No" name="tc_no" value={patientForm.tc_no} onChange={handlePatientChange} placeholder="11 haneli TC no" maxLength={11} required /><Input label="Telefon" name="phone" value={patientForm.phone} onChange={handlePatientChange} placeholder="05XXXXXXXXX" required /><Input label="Ad" name="first_name" value={patientForm.first_name} onChange={handlePatientChange} placeholder="Hasta adı" required /><Input label="Soyad" name="last_name" value={patientForm.last_name} onChange={handlePatientChange} placeholder="Hasta soyadı" required /><label style={{ ...styles.label, gridColumn: '1 / -1' }}>Cinsiyet<select name="gender" value={patientForm.gender} onChange={handlePatientChange} style={styles.input}><option>Kadın</option><option>Erkek</option><option>Belirtmek istemiyor</option></select></label><button type="submit" disabled={saving} style={{ ...(saving ? styles.disabledButton : styles.saveButton), gridColumn: '1 / -1' }}>{saving && <Spinner />}{saving ? 'Kaydediliyor...' : 'Hasta Kaydet'}</button></form></section></section></div>}

          {activeSecretaryTab === 'sms' && <div style={styles.tabContent}><section style={styles.smsHero}><div><p style={styles.tabEyebrow}>DEMO BİLDİRİM MERKEZİ</p><h2 style={styles.tabPageTitle}>SMS Hatırlatmaları</h2><p style={styles.formDescription}>Onaylanan randevular için 24 saat ve 2 saat öncesine planlanan mesajları takip edin.</p></div><button type="button" disabled={saving} onClick={handleRunDueSms} style={saving ? styles.disabledButton : styles.primaryButton}>{saving && <Spinner />}{saving ? 'Çalıştırılıyor...' : 'Zamanı Gelenleri Gönder'}</button></section><section style={styles.smsStatsGrid}><div style={styles.smsStatCard}><span style={styles.smsStatIcon}>◷</span><div><strong>{smsStats.pending}</strong><small>Bekleyen mesaj</small></div></div><div style={styles.smsStatCard}><span style={styles.smsStatIcon}>✓</span><div><strong>{smsStats.sent}</strong><small>Gönderildi</small></div></div><div style={styles.smsStatCard}><span style={styles.smsStatIcon}>×</span><div><strong>{smsStats.cancelled}</strong><small>İptal edildi</small></div></div></section><section style={styles.smsQueuePanel}><div style={styles.panelHeading}><div><h3 style={styles.cardSectionTitle}>Mesaj Kuyruğu</h3><p style={styles.cardSectionText}>Bu ekran demo gönderimini simüle eder; gerçek telefona SMS gönderilmez.</p></div><span style={styles.resultCount}>{smsReminders.length}</span></div>{smsReminders.length === 0 ? <div style={styles.doctorEmptyState}><span style={styles.doctorEmptyIcon}>✉</span><strong>Henüz SMS hatırlatması yok</strong><small>Bir randevu onaylandığında mesajlar otomatik hazırlanır.</small></div> : <div style={styles.smsQueueList}>{smsReminders.map((reminder) => <article key={reminder.id} style={styles.smsQueueCard}><div style={styles.smsQueueMain}><span style={styles.smsPhoneIcon}>SMS</span><div style={styles.smsQueueInfo}><strong>{getPatientName(reminder.patient_id)}</strong><small>{reminder.phone.slice(0, 4)}***{reminder.phone.slice(-4)} · {reminder.reminder_type}</small><p>{reminder.message}</p><span>Planlanan gönderim: {formatDate(reminder.scheduled_for)}</span></div></div><div style={styles.smsQueueAction}><span style={reminder.status === 'Gönderildi' ? styles.smsSentBadge : reminder.status === 'İptal Edildi' ? styles.cancelledBadge : styles.waitingBadge}>{reminder.status}</span>{reminder.status === 'Bekliyor' && <button type="button" disabled={saving} onClick={() => handleSimulateSmsSend(reminder.id)} style={styles.smsSendButton}>Şimdi Gönder</button>}</div></article>)}</div>}</section></div>}

          {activeSecretaryTab === 'calendar' && <div style={styles.tabContent}><section style={styles.calendarPanelLarge}>
            <div style={styles.calendarHeader}>
              <div><p style={styles.eyebrowDark}>PLANLAMA MERKEZİ</p><h2 style={styles.panelTitle}>Randevu Takvimi</h2><p style={styles.formDescription}>Polikliniğinizdeki randevuları haftalık veya günlük görünümde yönetin.</p></div>
              <div style={styles.calendarActions}><button type="button" onClick={() => { setCalendarDate(getLocalToday()); setWeekOffset(0) }} style={styles.calendarTodayButton}>Bugün</button><button type="button" onClick={() => setCalendarView('day')} style={calendarView === 'day' ? styles.calendarViewActive : styles.calendarViewButton}>Günlük</button><button type="button" onClick={() => setCalendarView('week')} style={calendarView === 'week' ? styles.calendarViewActive : styles.calendarViewButton}>Haftalık</button><Input label="" type="date" value={calendarDate} onChange={(event) => { setCalendarDate(event.target.value); setWeekOffset(0) }} /></div>
            </div>
            {outOfHoursAppointments.length > 0 && <div style={styles.calendarWarning}><div><strong>{outOfHoursAppointments.length} randevu çalışma saati dışında</strong><small>Bu kayıtları 08:00–17:30 aralığına taşıyın.</small></div><div style={styles.calendarWarningList}>{outOfHoursAppointments.map((appointment) => <button key={appointment.id} type="button" onClick={() => openRescheduleModal(appointment)} style={styles.calendarWarningButton}>{getPatientName(appointment.patient_id)} · {getLocalTimeKey(appointment.appointment_date)} · Düzelt</button>)}</div></div>}
            {calendarView === 'day' ? (
              <div key={`day-${calendarDate}-${calendarRevision}`} style={styles.calendarGrid}>{calendarAppointments.length === 0 ? <p style={styles.emptyText}>Bu gün için randevu bulunmuyor.</p> : calendarAppointments.map((appointment) => <div key={appointment.id} role={canRescheduleAppointment(appointment) ? 'button' : undefined} tabIndex={canRescheduleAppointment(appointment) ? 0 : undefined} title={canRescheduleAppointment(appointment) ? 'Tarih veya saati değiştirmek için tıklayın' : 'Bu randevu artık değiştirilemez'} onClick={() => canRescheduleAppointment(appointment) && openRescheduleModal(appointment)} onKeyDown={(event) => { if (canRescheduleAppointment(appointment) && (event.key === 'Enter' || event.key === ' ')) openRescheduleModal(appointment) }} style={{ ...styles.calendarItem, ...getCalendarStatusStyle(appointment.status), ...(canRescheduleAppointment(appointment) ? styles.calendarEditable : styles.calendarLocked) }}><strong style={styles.calendarTime}>{new Date(appointment.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</strong><div><strong>{getPatientName(appointment.patient_id)}</strong><small style={styles.calendarMeta}>{getDoctorName(appointment.doctor_id)} · {getDepartmentName(appointment.department_id)}</small></div><div style={styles.calendarStatusColumn}><span>{appointment.status}</span>{canRescheduleAppointment(appointment) && <small style={styles.calendarEditHint}>Değiştir</small>}</div></div>)}</div>
            ) : (
              <><div style={styles.weekNavigation}><button type="button" onClick={() => setWeekOffset((value) => value - 1)} style={styles.calendarArrow}>‹</button><strong>{new Date(`${weekDates[0]}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })} — {new Date(`${weekDates[6]}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong><button type="button" onClick={() => setWeekOffset((value) => value + 1)} style={styles.calendarArrow}>›</button></div><div key={`week-${calendarDate}-${weekOffset}-${calendarRevision}`} style={styles.weekCalendar}><div style={styles.weekCorner}></div>{weekDates.map((date, dayIndex) => <div key={date} style={{ ...styles.weekDayHeader, ...(date === getLocalToday() ? styles.weekDayToday : {}), gridColumn: dayIndex + 2, gridRow: 1 }}>{new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })}<strong>{new Date(`${date}T12:00:00`).getDate()}</strong></div>)}{Array.from({ length: 20 }, (_, slotIndex) => { const totalMinutes = 8 * 60 + slotIndex * 30; const slotHour = Math.floor(totalMinutes / 60); const slotMinute = totalMinutes % 60; return <div key={`slot-time-${slotIndex}`} style={{ ...styles.weekHour, gridColumn: 1, gridRow: slotIndex + 2 }}>{`${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`}</div> })}{Array.from({ length: 20 * 7 }, (_, index) => <div key={`slot-${index}`} style={{ ...styles.weekSlot, gridColumn: (index % 7) + 2, gridRow: Math.floor(index / 7) + 2 }}></div>)}{weeklyAppointments.filter((appointment) => isValidAppointmentTime(getLocalTimeKey(appointment.appointment_date))).map((appointment) => { const appointmentDate = new Date(appointment.appointment_date); const date = getLocalDateKey(appointmentDate); const hour = appointmentDate.getHours(); const minute = appointmentDate.getMinutes(); const slotIndex = (hour - 8) * 2 + (minute >= 30 ? 1 : 0); const dayIndex = weekDates.indexOf(date); return <div key={appointment.id} role={canRescheduleAppointment(appointment) ? 'button' : undefined} tabIndex={canRescheduleAppointment(appointment) ? 0 : undefined} title={canRescheduleAppointment(appointment) ? 'Tarih veya saati değiştirmek için tıklayın' : 'Bu randevu artık değiştirilemez'} onClick={() => canRescheduleAppointment(appointment) && openRescheduleModal(appointment)} onKeyDown={(event) => { if (canRescheduleAppointment(appointment) && (event.key === 'Enter' || event.key === ' ')) openRescheduleModal(appointment) }} style={{ ...styles.weekAppointment, ...getCalendarStatusStyle(appointment.status), ...(canRescheduleAppointment(appointment) ? styles.calendarEditable : styles.calendarLocked), gridColumn: dayIndex + 2, gridRow: `${slotIndex + 2} / span 1` }}><strong>{String(appointment.appointment_date).slice(11, 16)}</strong><span>{getPatientName(appointment.patient_id)}</span><small>{getDoctorName(appointment.doctor_id)}</small></div> })}</div></>
            )}
            <div style={styles.calendarLegend}><span><i style={styles.legendBlue}></i> Onaylandı</span><span><i style={styles.legendPurple}></i> Muayenede</span><span><i style={styles.legendGreen}></i> Tamamlandı</span><span><i style={styles.legendRed}></i> İptal / Reddedildi</span></div>
          </section></div>}

        </>
      ) : (
        <div style={styles.tabContent}>
          <section style={styles.doctorWorkspaceHeader}>
            <div><p style={styles.tabEyebrow}>DOKTOR ÇALIŞMA ALANI</p><h2 style={styles.tabPageTitle}>{activeDoctorTab === 'today' ? 'Bugünkü Randevular' : activeDoctorTab === 'waiting' ? 'Muayene Bekleyenler' : activeDoctorTab === 'completed' ? 'Tamamlanan Muayeneler' : 'Hasta Geçmişi'}</h2><p style={styles.formDescription}>{activeDoctorTab === 'today' ? 'Bugün planlanan hasta görüşmelerinizi saat sırasıyla takip edin.' : activeDoctorTab === 'waiting' ? 'Muayeneye alınmaya hazır onaylı hastaları yönetin.' : activeDoctorTab === 'completed' ? 'Tamamladığınız muayene kayıtlarını görüntüleyin.' : 'Önceki teşhis, muayene notu ve reçete bilgilerine ulaşın.'}</p></div>
            <div style={styles.doctorHeaderIdentity}><span style={styles.doctorOnlineDot}></span><div style={styles.doctorIdentityInfo}><strong style={styles.doctorIdentityName}>{user.full_name}</strong><small style={styles.doctorIdentityMeta}>{clinicDepartment?.name || 'Poliklinik'} · Aktif</small></div></div>
          </section>

          {activeDoctorTab !== 'history' && <SearchBox value={appointmentSearch} onChange={setAppointmentSearch} placeholder="Hasta adı veya randevu durumu ara..." />}
          {activeDoctorTab === 'today' && <section style={styles.doctorPanel}>{renderDoctorAppointments(doctorTodayAppointments, 'Bugün için randevu bulunmuyor')}</section>}
          {activeDoctorTab === 'waiting' && <section style={styles.doctorPanel}>{renderDoctorAppointments(doctorWaitingAppointments, 'Muayene bekleyen hasta bulunmuyor')}</section>}
          {activeDoctorTab === 'completed' && <section style={styles.doctorPanel}>{renderDoctorAppointments(doctorCompletedAppointments, 'Tamamlanan muayene bulunmuyor')}</section>}
          {activeDoctorTab === 'history' && <section style={styles.doctorPanel}>{medicalRecords.length === 0 ? <div style={styles.doctorEmptyState}><span style={styles.doctorEmptyIcon}>↺</span><strong>Hasta geçmişi bulunmuyor</strong><small>Tamamlanan muayeneler bu alanda görüntülenecektir.</small></div> : <div style={styles.medicalHistoryGrid}>{[...medicalRecords].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((record) => { const appointment = appointments.find((item) => item.id === record.appointment_id); const recordPrescriptions = prescriptions.filter((item) => item.medical_record_id === record.id); return <article key={record.id} style={styles.medicalHistoryCard}><div style={styles.medicalHistoryTop}><div><span style={styles.medicalRecordLabel}>MUAYENE KAYDI</span><h3 style={styles.medicalDiagnosis}>{record.diagnosis}</h3></div><span style={styles.completedBadge}>Tamamlandı</span></div><div style={styles.medicalPatientLine}><div style={styles.patientAvatar}>{appointment ? getPatientName(appointment.patient_id).split(' ').map((part) => part.charAt(0)).slice(0, 2).join('') : 'H'}</div><div style={styles.doctorIdentityInfo}><strong style={styles.doctorIdentityName}>{appointment ? getPatientName(appointment.patient_id) : 'Hasta bilgisi'}</strong><small style={styles.doctorIdentityMeta}>{formatDate(record.created_at)}</small></div></div><p style={styles.medicalNotes}>{record.notes || 'Muayene notu bulunmuyor.'}</p><div style={styles.prescriptionSummary}><strong>Reçete</strong>{recordPrescriptions.length === 0 ? <small>Reçete oluşturulmamış.</small> : recordPrescriptions.map((item) => <span key={item.id}>{item.medicine_name} · {item.dosage} · {item.days} gün</span>)}</div></article> })}</div>}</section>}
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
        <Modal title="Yeni Randevu Oluştur" onClose={() => setIsAppointmentModalOpen(false)}>
          {error && <p style={styles.modalError}>{error}</p>}
          <form onSubmit={handleCreateAppointment} style={styles.modalForm}>
            <Select label="Hasta" name="patient_id" value={appointmentForm.patient_id} onChange={updateForm(setAppointmentForm)} options={patients.map((item) => ({ value: item.id, label: `${item.first_name} ${item.last_name}` }))} placeholder="Hasta seçin" />
            <Select label="Poliklinik" name="department_id" value={appointmentForm.department_id} onChange={updateForm(setAppointmentForm)} options={visibleDepartments.map((item) => ({ value: item.id, label: item.name }))} placeholder="Poliklinik seçin" />
            <Select 
  label="Doktor" 
  name="doctor_id" 
  value={appointmentForm.doctor_id} 
  onChange={updateForm(setAppointmentForm)} 
  // SADECE FİLTRELENMİŞ DOKTORLARI GÖSTER:
  options={filteredDoctorsByDepartment.map((item) => ({ value: item.id, label: `Dr. ${item.first_name} ${item.last_name}` }))} 
  placeholder="Doktor seçin"
  // POLİKLİNİK SEÇİLMEDEN DOKTOR SEÇİMİNİ PASİF YAP:
  disabled={!appointmentForm.department_id} 
/>
            <div style={styles.modalRow}><Input label="Tarih" name="date" type="date" min={getLocalToday()} value={appointmentForm.date} onChange={updateForm(setAppointmentForm)} required /><Input label="Saat" name="time" type="time" min={APPOINTMENT_START_TIME} max={APPOINTMENT_END_TIME} step="1800" value={appointmentForm.time} onChange={updateForm(setAppointmentForm)} required /></div>
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
