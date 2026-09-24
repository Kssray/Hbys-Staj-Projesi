import { useEffect, useMemo, useState } from 'react'

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

async function getErrorMessage(response, fallback) {
  try {
    const data = await response.json()
    return data.detail || data.message || fallback
  } catch {
    return fallback
  }
}

function App() {
  const [role, setRole] = useState('secretary')
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [medicalRecords, setMedicalRecords] = useState([])
  const [prescriptions, setPrescriptions] = useState([])

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

  const loadData = async () => {
    try {
      setLoading(true)
      const responses = await Promise.all([
        fetch(`${API_URL}/departments/`),
        fetch(`${API_URL}/doctors/`),
        fetch(`${API_URL}/patients/`),
        fetch(`${API_URL}/appointments/`),
        fetch(`${API_URL}/medical-records/`),
        fetch(`${API_URL}/prescriptions/`),
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
    } catch (err) {
      console.error(err)
      setError('Veriler yüklenemedi. Backend sunucusunun çalıştığını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
    setError('')
    setSuccessMessage('')

    if (patientForm.tc_no.length !== 11) {
      setError('TC kimlik numarası 11 haneli olmalıdır.')
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`${API_URL}/patients/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientForm),
      })
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Hasta kaydedilemedi.'))
      }
      const patient = await response.json()
      setPatients((previous) => [...previous, patient])
      setPatientForm(emptyPatient)
      setSuccessMessage('Hasta başarıyla kaydedildi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAppointment = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

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
          status: 'Bekliyor',
        }),
      })
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Randevu kaydedilemedi.'))
      }
      const appointment = await response.json()
      setAppointments((previous) => [...previous, appointment])
      setAppointmentForm(emptyAppointment)
      setIsAppointmentModalOpen(false)
      setSuccessMessage('Randevu başarıyla oluşturuldu.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // YENİ EKLENEN İPTAL ETME FONKSİYONU
  const handleCancelAppointment = async (id) => {
    if (window.confirm("Bu randevuyu iptal etmek istediğinize emin misiniz?")) {
      try {
        setSaving(true)
        const response = await fetch(`${API_URL}/appointments/${id}/cancel`, {
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

  const handleCreateExamination = async (event) => {
    event.preventDefault()
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
      const recordResponse = await fetch(`${API_URL}/medical-records/`, {
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
        const prescriptionResponse = await fetch(`${API_URL}/prescriptions/`, {
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

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>HASTANE BİLGİ YÖNETİM SİSTEMİ</p>
          <h1 style={styles.title}>HBYS Yönetim Paneli</h1>
          <p style={styles.subtitle}>Randevu, muayene ve reçete süreçlerini yönetin.</p>
        </div>
        <div style={styles.headerIcon}>🏥</div>
      </header>

      <section style={styles.roleBar}>
        <span style={styles.roleLabel}>Aktif kullanıcı görünümü:</span>
        <button
          type="button"
          onClick={() => setRole('secretary')}
          style={role === 'secretary' ? styles.activeRoleButton : styles.roleButton}
        >
          Hasta / Sekreter
        </button>
        <button
          type="button"
          onClick={() => setRole('doctor')}
          style={role === 'doctor' ? styles.activeRoleButton : styles.roleButton}
        >
          Doktor
        </button>
      </section>

      {loading && <div style={styles.infoMessage}>Veriler yükleniyor...</div>}
      {error && <div style={styles.errorMessage}>{error}</div>}
      {successMessage && <div style={styles.successMessage}>{successMessage}</div>}

      <section style={styles.dashboard}>
        <StatCard icon="👥" title="Hastalar" value={patients.length} text="Kayıtlı hasta" />
        <StatCard icon="📅" title="Randevular" value={appointments.length} text="Toplam randevu" />
        <StatCard icon="💊" title="Reçeteler" value={prescriptions.length} text="Kayıtlı reçete" />
      </section>

      {role === 'secretary' ? (
        <>
          <section style={styles.actionPanel}>
            <div>
              <h2 style={styles.panelTitle}>Randevu Yönetimi</h2>
              <p style={styles.formDescription}>Hasta veya sekreter, hastayı uygun doktor ve polikliniğe yönlendirir.</p>
            </div>
            <button type="button" onClick={() => setIsAppointmentModalOpen(true)} style={styles.primaryButton}>
              + Yeni Randevu Oluştur
            </button>
          </section>

          <section style={styles.contentGrid}>
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

          <section style={styles.formPanel}>
            <h2 style={styles.formTitle}>Yeni Hasta Kaydı</h2>
            <form onSubmit={handleAddPatient} style={styles.form}>
              <Input label="TC Kimlik No" name="tc_no" value={patientForm.tc_no} onChange={handlePatientChange} placeholder="11 haneli TC no" maxLength={11} required />
              <Input label="Ad" name="first_name" value={patientForm.first_name} onChange={handlePatientChange} placeholder="Hasta adı" required />
              <Input label="Soyad" name="last_name" value={patientForm.last_name} onChange={handlePatientChange} placeholder="Hasta soyadı" required />
              <Input label="Telefon" name="phone" value={patientForm.phone} onChange={handlePatientChange} placeholder="05XXXXXXXXX" required />
              <label style={styles.label}>Cinsiyet<select name="gender" value={patientForm.gender} onChange={handlePatientChange} style={styles.input}><option>Kadın</option><option>Erkek</option><option>Belirtmek istemiyor</option></select></label>
              <button type="submit" disabled={saving} style={styles.saveButton}>{saving ? 'Kaydediliyor...' : 'Hasta Kaydet'}</button>
            </form>
          </section>
        </>
      ) : (
        <section style={styles.panelWide}>
          <div style={styles.actionPanelInner}>
            <div>
              <h2 style={styles.panelTitle}>Doktor Randevuları</h2>
              <p style={styles.formDescription}>Doktor, kendisine gelen randevuyu açarak muayene ve reçete kaydı oluşturur.</p>
            </div>
            <span style={styles.doctorBadge}>Doktor çalışma alanı</span>
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
                    ) : appointment.status === 'İptal' ? (
                      <span style={styles.cancelledBadge}>İptal Edildi</span>
                    ) : (
                      <button type="button" onClick={() => { setSelectedAppointment(appointment); setIsExaminationModalOpen(true) }} style={styles.primaryButton}>
                        Muayene Et
                      </button>
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
          <form onSubmit={handleCreateAppointment} style={styles.modalForm}>
            <Select label="Hasta" name="patient_id" value={appointmentForm.patient_id} onChange={updateForm(setAppointmentForm)} options={patients.map((item) => ({ value: item.id, label: `${item.first_name} ${item.last_name}` }))} placeholder="Hasta seçin" />
            <Select label="Poliklinik" name="department_id" value={appointmentForm.department_id} onChange={updateForm(setAppointmentForm)} options={departments.map((item) => ({ value: item.id, label: item.name }))} placeholder="Poliklinik seçin" />
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
            <div style={styles.modalRow}><Input label="Tarih" name="date" type="date" value={appointmentForm.date} onChange={updateForm(setAppointmentForm)} required /><Input label="Saat" name="time" type="time" value={appointmentForm.time} onChange={updateForm(setAppointmentForm)} required /></div>
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
    </main>
  )
}

function StatCard({ icon, title, value, text }) {
  return <div style={styles.card}><div style={styles.cardHeader}><span style={styles.cardIcon}>{icon}</span><span style={styles.cardTitle}>{title}</span></div><strong style={styles.number}>{value}</strong><p style={styles.cardText}>{text}</p></div>
}

function Input({ label, ...props }) {
  return <label style={styles.label}>{label}<input {...props} style={{ ...styles.input, ...(props.style || {}) }} /></label>
}

function Textarea({ label, ...props }) {
  return <label style={styles.label}>{label}<textarea {...props} style={styles.textarea} /></label>
}

function Select({ label, options, placeholder, ...props }) {
  return <label style={styles.label}>{label}<select {...props} style={styles.input} required><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function SearchBox({ value, onChange, placeholder }) {
  return <div style={styles.searchBox}><span style={styles.searchIcon}>⌕</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={styles.searchInput} /></div>
}

function AppointmentTable({ appointments, getPatientName, getDoctorName, getDepartmentName, formatDate, onCancel }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Hasta</th>
            <th style={styles.th}>Doktor</th>
            <th style={styles.th}>Poliklinik</th>
            <th style={styles.th}>Tarih</th>
            <th style={styles.th}>Durum</th>
            <th style={styles.th}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td style={styles.td}>{getPatientName(appointment.patient_id)}</td>
              <td style={styles.td}>{getDoctorName(appointment.doctor_id)}</td>
              <td style={styles.td}>{getDepartmentName(appointment.department_id)}</td>
              <td style={styles.td}>{formatDate(appointment.appointment_date)}</td>
              <td style={styles.td}>
                <span style={appointment.status === 'Tamamlandı' ? styles.completedBadge : appointment.status === 'İptal' ? styles.cancelledBadge : styles.waitingBadge}>
                  {appointment.status}
                </span>
              </td>
              <td style={styles.td}>
                {appointment.status === 'Bekliyor' && (
                  <button 
                    onClick={() => onCancel(appointment.id)}
                    style={styles.cancelButton}
                  >
                    İptal Et
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return <div style={styles.modalOverlay} onClick={onClose}><div style={styles.modalContent} onClick={(event) => event.stopPropagation()}><div style={styles.modalHeader}><div><h2 style={styles.modalTitle}>{title}</h2></div><button type="button" onClick={onClose} style={styles.closeButton}>×</button></div>{children}</div></div>
}

function ModalFooter({ onClose, saving, submitText }) {
  return <div style={styles.modalFooter}><button type="button" onClick={onClose} style={styles.secondaryButton}>Vazgeç</button><button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? 'Kaydediliyor...' : submitText}</button></div>
}

const styles = {
  page: { minHeight: '100vh', width: '100%', margin: 0, padding: '32px', boxSizing: 'border-box', backgroundColor: '#f4f7fb', color: '#1f2937', fontFamily: 'Arial, sans-serif' },
  header: { maxWidth: '1200px', margin: '0 auto 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { margin: '0 0 8px', color: '#2563eb', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' },
  title: { margin: 0, color: '#172554', fontSize: '32px' },
  subtitle: { margin: '10px 0 0', color: '#64748b' },
  headerIcon: { display: 'grid', placeItems: 'center', width: '62px', height: '62px', borderRadius: '18px', backgroundColor: '#dbeafe', fontSize: '30px' },
  roleBar: { maxWidth: '1200px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid #dbeafe', borderRadius: '10px', backgroundColor: '#eff6ff' },
  roleLabel: { marginRight: '6px', color: '#475569', fontSize: '13px', fontWeight: 'bold' },
  roleButton: { padding: '9px 13px', border: 0, borderRadius: '7px', color: '#475569', backgroundColor: 'transparent', cursor: 'pointer' },
  activeRoleButton: { padding: '9px 13px', border: 0, borderRadius: '7px', color: '#fff', backgroundColor: '#2563eb', fontWeight: 'bold', cursor: 'pointer' },
  dashboard: { maxWidth: '1200px', margin: '0 auto 20px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' },
  card: { padding: '20px', border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: '#fff', boxShadow: '0 4px 14px rgba(15, 23, 42, .05)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '9px' },
  cardIcon: { fontSize: '22px' },
  cardTitle: { color: '#475569', fontWeight: 'bold' },
  number: { display: 'block', marginTop: '12px', color: '#1d4ed8', fontSize: '32px' },
  cardText: { margin: '3px 0 0', color: '#94a3b8' },
  contentGrid: { maxWidth: '1200px', margin: '0 auto 20px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' },
  panel: { padding: '20px', border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: '#fff' },
  panelWide: { maxWidth: '1200px', margin: '0 auto 20px', padding: '22px', border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: '#fff' },
  actionPanel: { maxWidth: '1200px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', padding: '20px', border: '1px solid #bfdbfe', borderRadius: '14px', backgroundColor: '#eff6ff' },
  actionPanelInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '14px' },
  panelHeading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  panelTitle: { margin: '0 0 12px', color: '#172554', fontSize: '20px' },
  formDescription: { margin: '0', color: '#64748b', fontSize: '14px' },
  resultCount: { display: 'inline-grid', placeItems: 'center', minWidth: '26px', height: '26px', borderRadius: '50%', color: '#1d4ed8', backgroundColor: '#dbeafe', fontSize: '12px', fontWeight: 'bold' },
  doctorBadge: { padding: '8px 12px', borderRadius: '999px', color: '#166534', backgroundColor: '#dcfce7', fontSize: '12px', fontWeight: 'bold' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 12px', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: '9px', backgroundColor: '#f8fafc' },
  searchIcon: { color: '#94a3b8', fontSize: '22px', transform: 'rotate(-20deg)' },
  searchInput: { width: '100%', minWidth: 0, padding: 0, border: 0, outline: 0, color: '#1f2937', backgroundColor: 'transparent' },
  patientRow: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '11px 0', borderBottom: '1px solid #f1f5f9' },
  formPanel: { maxWidth: '1200px', margin: '0 auto', padding: '22px', border: '1px solid #bbf7d0', borderRadius: '14px', backgroundColor: '#f0fdf4' },
  formTitle: { margin: '0 0 16px', color: '#166534' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '14px', alignItems: 'end' },
  label: { display: 'flex', flexDirection: 'column', gap: '7px', color: '#374151', fontSize: '13px', fontWeight: 'bold' },
  input: { boxSizing: 'border-box', width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#fff', color: '#111827', fontSize: '14px' },
  textarea: { boxSizing: 'border-box', width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', resize: 'vertical', backgroundColor: '#fff', color: '#111827', fontSize: '14px' },
  saveButton: { minHeight: '42px', padding: '10px 16px', border: 0, borderRadius: '8px', color: '#fff', backgroundColor: '#16a34a', fontWeight: 'bold', cursor: 'pointer' },
  primaryButton: { minHeight: '42px', padding: '10px 16px', border: 0, borderRadius: '8px', color: '#fff', backgroundColor: '#2563eb', fontWeight: 'bold', cursor: 'pointer' },
  secondaryButton: { minHeight: '42px', padding: '10px 16px', border: 0, borderRadius: '8px', color: '#374151', backgroundColor: '#e5e7eb', fontWeight: 'bold', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '12px 8px', color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px 8px', borderBottom: '1px solid #f1f5f9' },
  waitingBadge: { padding: '5px 8px', borderRadius: '999px', color: '#92400e', backgroundColor: '#fef3c7', fontSize: '12px' },
  completedBadge: { padding: '5px 8px', borderRadius: '999px', color: '#166534', backgroundColor: '#dcfce7', fontSize: '12px', fontWeight: 'bold' },
  cancelledBadge: { padding: '5px 8px', borderRadius: '999px', color: '#991b1b', backgroundColor: '#fee2e2', fontSize: '12px' },
  cancelButton: { padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  doctorAppointmentList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  doctorAppointmentCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc' },
  appointmentPatient: { display: 'block', color: '#172554', fontSize: '16px' },
  appointmentDetails: { margin: '5px 0', color: '#475569' },
  divider: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', color: '#172554' },
  modalOverlay: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: 'rgba(15, 23, 42, .48)', backdropFilter: 'blur(4px)', zIndex: 1000 },
  modalContent: { width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '16px', backgroundColor: '#fff', boxShadow: '0 24px 60px rgba(15, 23, 42, .25)' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '18px' },
  modalTitle: { margin: 0, color: '#172554', fontSize: '22px' },
  closeButton: { border: 0, padding: '0 4px', color: '#64748b', backgroundColor: 'transparent', fontSize: '28px', lineHeight: 1, cursor: 'pointer' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '14px' },
  modalRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '18px', borderTop: '1px solid #e2e8f0' },
  modalHint: { margin: '0 0 14px', padding: '10px 12px', borderRadius: '8px', color: '#475569', backgroundColor: '#f1f5f9', fontSize: '13px', lineHeight: 1.5 },
  infoMessage: { maxWidth: '1200px', margin: '0 auto 14px', padding: '12px 16px', borderRadius: '8px', color: '#1e40af', backgroundColor: '#dbeafe' },
  errorMessage: { maxWidth: '1200px', margin: '0 auto 14px', padding: '12px 16px', borderRadius: '8px', color: '#991b1b', backgroundColor: '#fee2e2' },
  successMessage: { maxWidth: '1200px', margin: '0 auto 14px', padding: '12px 16px', borderRadius: '8px', color: '#166534', backgroundColor: '#dcfce7' },
  emptyText: { color: '#94a3b8' },
}

export default App