import { useEffect, useMemo, useState } from 'react'
import {
  AppointmentTable,
  Input,
  LoginScreen,
  Modal,
  ModalFooter,
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

function getLocalTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`
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
      const responses = await Promise.all([
        fetch(`${API_URL}/departments/`),
        fetch(`${API_URL}/doctors/`),
        fetch(patientsUrl),
        fetch(appointmentsUrl),
        fetch(medicalRecordsUrl),
        fetch(prescriptionsUrl),
        fetch(`${API_URL}/audit-logs/`),
      ])

      if (responses.some((response) => !response.ok)) {
        throw new Error('Backend verileri alınamadı.')
      }

      const data = await Promise.all(responses.map((response) => response.json()))
      setDepartments(data[0])
      setDoctors(data[1])
      setPatients(data[2])
      setAppointments(data[3])
      setMedicalRecords(data[4])
      setPrescriptions(data[5])
      setAuditLogs(data[6])
    } catch (err) {
      console.error(err)
      setError('Veriler yüklenemedi. Backend sunucusunun çalıştığını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadData()
  }, [user])

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

  const calendarAppointments = useMemo(() => appointments
    .filter((appointment) => String(appointment.appointment_date).slice(0, 10) === calendarDate)
    .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date))), [appointments, calendarDate])

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
    if (saving) return
    try {
      setSaving(true)
      const response = await fetch(`${API_URL}/appointments/${id}/${decision}?user_id=${user.id}`, { method: 'PATCH' })
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Randevu işlemi tamamlanamadı.'))
      const updated = await response.json()
      setAppointments((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setSuccessMessage(decision === 'approve' ? 'Randevu onaylandı.' : 'Randevu reddedildi.')
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

  if (!user) {
    return (
      <LoginScreen
        form={loginForm}
        onChange={(event) => setLoginForm((previous) => ({ ...previous, [event.target.name]: event.target.value }))}
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

      {loading && <div style={styles.infoMessage}>Veriler yükleniyor...</div>}
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {successMessage && <Toast type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

      <section style={styles.dashboard} data-reveal="up">
        <StatCard icon="👥" title="Hastalar" value={patients.length} text="Kayıtlı hasta" />
        <StatCard icon="📅" title="Randevular" value={appointments.length} text="Toplam randevu" />
        <StatCard icon="🗓️" title="Bugün" value={appointmentStats.today} text="Bugünkü randevu" />
        <StatCard icon="⏳" title="Bekleyen" value={appointmentStats.pending} text="Bekleyen randevu" />
        <StatCard icon="✅" title="Tamamlanan" value={appointmentStats.completed} text="Tamamlanan randevu" />
        <StatCard icon="💊" title="Reçeteler" value={prescriptions.length} text={`${appointmentStats.cancelled} iptal randevu`} />
      </section>

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
          <section style={styles.actionPanel} data-reveal="up">
            <div>
              <h2 style={styles.panelTitle}>Randevu Yönetimi</h2>
              <p style={styles.formDescription}>Hasta veya sekreter, hastayı uygun doktor ve polikliniğe yönlendirir.</p>
            </div>
            <button type="button" onClick={() => setIsAppointmentModalOpen(true)} style={styles.primaryButton}>
              + Yeni Randevu Oluştur
            </button>
          </section>

          <section style={styles.contentGrid} data-reveal="up">
            <div style={styles.panelWide}>
              <div style={styles.panelHeading}>
                <h2 style={styles.panelTitle}>Randevu Listesi</h2>
                <span style={styles.resultCount}>{filteredAppointments.length}</span>
              </div>
              <SearchBox value={appointmentSearch} onChange={setAppointmentSearch} placeholder="Hasta veya doktor ara..." />
              {filteredAppointments.length === 0 ? (
                <p style={styles.emptyText}>Henüz randevu bulunmuyor.</p>
              ) : (
                <AppointmentTable 
                  appointments={filteredAppointments} 
                  getPatientName={getPatientName} 
                  getDoctorName={getDoctorName} 
                  getDepartmentName={getDepartmentName} 
                  formatDate={formatDate} 
                  onCancel={handleCancelAppointment}
                  onApprove={(id) => handleAppointmentDecision(id, 'approve')}
                  onReject={(id) => handleAppointmentDecision(id, 'reject')}
                />
              )}
            </div>
            <div style={styles.panel}>
              <div style={styles.panelHeading}>
                <h2 style={styles.panelTitle}>Hastalar</h2>
                <span style={styles.resultCount}>{filteredPatients.length}</span>
              </div>
              <SearchBox value={patientSearch} onChange={setPatientSearch} placeholder="Hasta adı veya TC ara..." />
              {filteredPatients.map((patient) => (
                <div key={patient.id} style={styles.patientRow}>
                  <strong>{patient.first_name} {patient.last_name}</strong>
                  <small>TC: {patient.tc_no.slice(0, 3)}******{patient.tc_no.slice(-2)}</small>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.calendarPanel} data-reveal="up">
            <div style={styles.panelHeading}>
              <div>
                <h2 style={styles.panelTitle}>Randevu Takvimi</h2>
                <p style={styles.formDescription}>Seçilen güne ait randevuları saat sırasına göre görüntüleyin.</p>
              </div>
              <Input label="Gün seçin" type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} />
            </div>
            {calendarAppointments.length === 0 ? <p style={styles.emptyText}>Bu gün için randevu bulunmuyor.</p> : (
              <div style={styles.calendarGrid}>
                {calendarAppointments.map((appointment) => <div key={appointment.id} style={styles.calendarItem}>
                  <strong style={styles.calendarTime}>{new Date(appointment.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</strong>
                  <div><strong>{getPatientName(appointment.patient_id)}</strong><small style={styles.calendarMeta}>{getDoctorName(appointment.doctor_id)} · {getDepartmentName(appointment.department_id)}</small></div>
                  <span style={appointment.status === 'Tamamlandı' ? styles.completedBadge : appointment.status === 'Reddedildi' || appointment.status === 'İptal Edildi' ? styles.cancelledBadge : styles.waitingBadge}>{appointment.status}</span>
                </div>)}
              </div>
            )}
          </section>

          <section style={styles.formPanel} data-reveal="up">
            <h2 style={styles.formTitle}>Yeni Hasta Kaydı</h2>
            {newPatientCredentials && (
              <div style={{ ...styles.infoMessage, textAlign: 'left', marginBottom: 18 }}>
                <strong>{newPatientCredentials.fullName} için giriş bilgileri</strong>
                <br />Kullanıcı adı: <strong>{newPatientCredentials.username}</strong>
                <br />Geçici şifre: <strong>{newPatientCredentials.password}</strong>
                <br /><small>Bu bilgileri hastaya güvenli şekilde iletin.</small>
                <button type="button" onClick={() => setNewPatientCredentials(null)} style={{ ...styles.secondaryButton, marginTop: 10 }}>Bilgiyi Kapat</button>
              </div>
            )}
            <form onSubmit={handleAddPatient} style={styles.form}>
              <Input label="TC Kimlik No" name="tc_no" value={patientForm.tc_no} onChange={handlePatientChange} placeholder="11 haneli TC no" maxLength={11} required />
              <Input label="Ad" name="first_name" value={patientForm.first_name} onChange={handlePatientChange} placeholder="Hasta adı" required />
              <Input label="Soyad" name="last_name" value={patientForm.last_name} onChange={handlePatientChange} placeholder="Hasta soyadı" required />
              <Input label="Telefon" name="phone" value={patientForm.phone} onChange={handlePatientChange} placeholder="05XXXXXXXXX" required />
              <label style={styles.label}>Cinsiyet<select name="gender" value={patientForm.gender} onChange={handlePatientChange} style={styles.input}><option>Kadın</option><option>Erkek</option><option>Belirtmek istemiyor</option></select></label>
              <button type="submit" disabled={saving} style={saving ? styles.disabledButton : styles.saveButton}>{saving && <Spinner />}{saving ? 'Kaydediliyor...' : 'Hasta Kaydet'}</button>
            </form>
          </section>
        </>
      ) : (
        <section style={styles.panelWide} data-reveal="up">
          <div style={styles.actionPanelInner}>
            <div>
              <h2 style={styles.panelTitle}>Doktor Randevuları</h2>
              <p style={styles.formDescription}>Doktor, kendisine ait randevuları açarak muayene ve reçete kaydı oluşturur.</p>
            </div>
            <span style={styles.doctorBadge}>Doktor çalışma alanı</span>
          </div>
          <div style={styles.calendarToolbar}><strong>Günlük takvim</strong><Input label="" type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} /></div>
          <div style={styles.calendarGrid}>
            {calendarAppointments.length === 0 ? <p style={styles.emptyText}>Seçilen gün için randevu bulunmuyor.</p> : calendarAppointments.map((appointment) => <div key={appointment.id} style={styles.calendarItem}><strong style={styles.calendarTime}>{new Date(appointment.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</strong><div><strong>{getPatientName(appointment.patient_id)}</strong><small style={styles.calendarMeta}>{appointment.status}</small></div></div>)}
          </div>
          <SearchBox value={appointmentSearch} onChange={setAppointmentSearch} placeholder="Hasta veya randevu ara..." />
          {filteredAppointments.length === 0 ? (
            <p style={styles.emptyText}>Bekleyen randevu bulunmuyor.</p>
          ) : (
            <div style={styles.doctorAppointmentList}>
              {filteredAppointments.map((appointment) => {
                const hasRecord = medicalRecords.some((record) => record.appointment_id === appointment.id)
                return (
                  <div key={appointment.id} style={styles.doctorAppointmentCard}>
                    <div>
                      <strong style={styles.appointmentPatient}>{getPatientName(appointment.patient_id)}</strong>
                      <p style={styles.appointmentDetails}>{getDepartmentName(appointment.department_id)} · {formatDate(appointment.appointment_date)}</p>
                      <span>{getDoctorName(appointment.doctor_id)} - Durum: {hasRecord || appointment.status === 'Tamamlandı' ? 'Tamamlandı' : appointment.status}</span>
                    </div>
                    {hasRecord || appointment.status === 'Tamamlandı' ? (
                      <span style={styles.completedBadge}>Tamamlandı</span>
                    ) : appointment.status === 'İptal' || appointment.status === 'İptal Edildi' ? (
                      <span style={styles.cancelledBadge}>İptal Edildi</span>
                    ) : appointment.status === 'Onaylandı' || appointment.status === 'Bekliyor' ? (
                      <button type="button" onClick={() => handleStartExamination(appointment)} style={styles.primaryButton}>
                        Muayeneye Al
                      </button>
                    ) : (
                      <span style={styles.waitingBadge}>Sekreter onayı bekleniyor</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
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
            <div style={styles.modalRow}><Input label="Tarih" name="date" type="date" min={getLocalToday()} value={appointmentForm.date} onChange={updateForm(setAppointmentForm)} required /><Input label="Saat" name="time" type="time" min={appointmentForm.date === getLocalToday() ? getLocalTime() : undefined} value={appointmentForm.time} onChange={updateForm(setAppointmentForm)} required /></div>
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
