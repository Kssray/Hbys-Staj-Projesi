import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const initialForm = {
  tc_no: '',
  first_name: '',
  last_name: '',
  phone: '',
  gender: 'Kadın',
}

function App() {
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])

  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [patientSearch, setPatientSearch] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        const responses = await Promise.all([
          fetch(`${API_URL}/departments/`),
          fetch(`${API_URL}/doctors/`),
          fetch(`${API_URL}/patients/`),
        ])

        if (responses.some((response) => !response.ok)) {
          throw new Error('Sunucudan veriler alınamadı.')
        }

        const [departmentsData, doctorsData, patientsData] = await Promise.all(
          responses.map((response) => response.json()),
        )

        setDepartments(departmentsData)
        setDoctors(doctorsData)
        setPatients(patientsData)
      } catch (err) {
        console.error(err)
        setError(
          'Veriler yüklenemedi. Backend sunucusunun çalıştığından emin olun.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    let newValue = value

    // TC numarası ve telefon alanlarında yalnızca rakam kabul edilir.
    if (name === 'tc_no' || name === 'phone') {
      newValue = value.replace(/\D/g, '')
    }

    setForm((previousForm) => ({
      ...previousForm,
      [name]: newValue,
    }))
  }

  const handleAddPatient = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (form.tc_no.length !== 11) {
      setError('TC kimlik numarası 11 haneli olmalıdır.')
      return
    }

    if (form.phone.length < 10) {
      setError('Telefon numarası geçerli görünmüyor.')
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`${API_URL}/patients/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        let message = 'Kayıt başarısız oldu.'

        try {
          const errorData = await response.json()
          message = errorData.detail || errorData.message || message
        } catch {
          // Sunucu JSON dönmezse varsayılan mesaj kullanılır.
        }

        throw new Error(`${message} TC numarası kullanılıyor olabilir.`)
      }

      const savedPatient = await response.json()

      setPatients((previousPatients) => [...previousPatients, savedPatient])
      setForm(initialForm)
      setSuccessMessage(
        `${savedPatient.first_name} ${savedPatient.last_name} başarıyla kaydedildi.`,
      )
    } catch (err) {
      console.error(err)
      setError(err.message || 'Hasta kaydedilirken bir hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const maskTcNo = (tcNo) => {
    if (!tcNo) return '-'
    return `${tcNo.slice(0, 3)}******${tcNo.slice(-2)}`
  }

  const filteredDepartments = departments.filter((department) =>
    department.name.toLocaleLowerCase('tr-TR').includes(
      departmentSearch.toLocaleLowerCase('tr-TR'),
    ),
  )

  const filteredDoctors = doctors.filter((doctor) =>
    `${doctor.first_name} ${doctor.last_name}`
      .toLocaleLowerCase('tr-TR')
      .includes(doctorSearch.toLocaleLowerCase('tr-TR')),
  )

  const filteredPatients = patients.filter((patient) =>
    `${patient.first_name} ${patient.last_name} ${patient.tc_no}`
      .toLocaleLowerCase('tr-TR')
      .includes(patientSearch.toLocaleLowerCase('tr-TR')),
  )

  const SearchBox = ({ value, onChange, placeholder }) => (
    <div style={styles.searchBox}>
      <span style={styles.searchIcon} aria-hidden="true">⌕</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={styles.searchInput}
      />
    </div>
  )

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>HASTANE BİLGİ YÖNETİM SİSTEMİ</p>
          <h1 style={styles.title}>HBYS Yönetim Paneli</h1>
          <p style={styles.subtitle}>
            Poliklinik, doktor ve hasta kayıtlarını buradan yönetebilirsiniz.
          </p>
        </div>
        <div style={styles.headerIcon}>🏥</div>
      </header>

      {loading && <div style={styles.infoMessage}>Veriler yükleniyor...</div>}
      {error && <div style={styles.errorMessage}>{error}</div>}
      {successMessage && (
        <div style={styles.successMessage}>{successMessage}</div>
      )}

      <section style={styles.dashboard}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>🩺</span>
            <span style={styles.cardTitle}>Poliklinikler</span>
          </div>
          <strong style={styles.number}>{departments.length}</strong>
          <p style={styles.cardText}>Kayıtlı poliklinik</p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>👨‍⚕️</span>
            <span style={styles.cardTitle}>Doktorlar</span>
          </div>
          <strong style={styles.number}>{doctors.length}</strong>
          <p style={styles.cardText}>Kayıtlı doktor</p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>👥</span>
            <span style={styles.cardTitle}>Hastalar</span>
          </div>
          <strong style={styles.number}>{patients.length}</strong>
          <p style={styles.cardText}>Kayıtlı hasta</p>
        </div>
      </section>

      <section style={styles.contentGrid}>
        <div style={styles.panel}>
          <div style={styles.panelHeading}>
            <h2 style={styles.panelTitle}>Poliklinikler</h2>
            <span style={styles.resultCount}>{filteredDepartments.length}</span>
          </div>
          <SearchBox
            value={departmentSearch}
            onChange={setDepartmentSearch}
            placeholder="Poliklinik ara..."
          />
          {departments.length === 0 ? (
            <p style={styles.emptyText}>Kayıtlı poliklinik bulunmuyor.</p>
          ) : filteredDepartments.length === 0 ? (
            <p style={styles.emptyText}>Aramanızla eşleşen poliklinik yok.</p>
          ) : (
            <ul style={styles.list}>
              {filteredDepartments.map((department) => (
                <li key={department.id} style={styles.listItem}>
                  <span>{department.name}</span>
                  <span style={styles.badge}>Aktif</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeading}>
            <h2 style={styles.panelTitle}>Doktorlar</h2>
            <span style={styles.resultCount}>{filteredDoctors.length}</span>
          </div>
          <SearchBox
            value={doctorSearch}
            onChange={setDoctorSearch}
            placeholder="Doktor ara..."
          />
          {doctors.length === 0 ? (
            <p style={styles.emptyText}>Kayıtlı doktor bulunmuyor.</p>
          ) : filteredDoctors.length === 0 ? (
            <p style={styles.emptyText}>Aramanızla eşleşen doktor yok.</p>
          ) : (
            <ul style={styles.list}>
              {filteredDoctors.map((doctor) => (
                <li key={doctor.id} style={styles.listItem}>
                  <span>
                    Dr. {doctor.first_name} {doctor.last_name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeading}>
            <h2 style={styles.panelTitle}>Son Hasta Kayıtları</h2>
            <span style={styles.resultCount}>{filteredPatients.length}</span>
          </div>
          <SearchBox
            value={patientSearch}
            onChange={setPatientSearch}
            placeholder="Hasta adı veya TC ara..."
          />
          {patients.length === 0 ? (
            <p style={styles.emptyText}>Kayıtlı hasta bulunmuyor.</p>
          ) : filteredPatients.length === 0 ? (
            <p style={styles.emptyText}>Aramanızla eşleşen hasta yok.</p>
          ) : (
            <ul style={styles.list}>
              {filteredPatients.map((patient) => (
                <li key={patient.id} style={styles.listItem}>
                  <span>
                    {patient.first_name} {patient.last_name}
                    <small style={styles.patientTc}>
                      TC: {maskTcNo(patient.tc_no)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={styles.formPanel}>
        <h2 style={styles.formTitle}>Yeni Hasta Kaydı</h2>
        <p style={styles.formDescription}>
          Hasta bilgilerini eksiksiz doldurarak sisteme yeni kayıt ekleyin.
        </p>

        <form onSubmit={handleAddPatient} style={styles.form}>
          <label style={styles.label}>
            TC Kimlik No
            <input
              name="tc_no"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{11}"
              maxLength={11}
              placeholder="11 haneli TC no"
              value={form.tc_no}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Ad
            <input
              name="first_name"
              type="text"
              placeholder="Hasta adı"
              value={form.first_name}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Soyad
            <input
              name="last_name"
              type="text"
              placeholder="Hasta soyadı"
              value={form.last_name}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Telefon
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              placeholder="05XXXXXXXXX"
              value={form.phone}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Cinsiyet
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="Kadın">Kadın</option>
              <option value="Erkek">Erkek</option>
              <option value="Belirtmek istemiyor">Belirtmek istemiyor</option>
            </select>
          </label>

          <button type="submit" disabled={saving} style={styles.button}>
            {saving ? 'Kaydediliyor...' : 'Hasta Kaydet'}
          </button>
        </form>
      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    margin: 0,
    boxSizing: 'border-box',
    padding: '32px',
    backgroundColor: '#f4f7fb',
    color: '#1f2937',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    margin: '0 0 8px',
    color: '#2563eb',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
  title: {
    margin: 0,
    color: '#172554',
    fontSize: '32px',
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#64748b',
  },
  headerIcon: {
    display: 'grid',
    placeItems: 'center',
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    backgroundColor: '#dbeafe',
    fontSize: '32px',
  },
  dashboard: {
    maxWidth: '1200px',
    margin: '0 auto 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '18px',
  },
  card: {
    padding: '22px',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardIcon: { fontSize: '23px' },
  cardTitle: { color: '#475569', fontWeight: 'bold' },
  number: {
    display: 'block',
    marginTop: '14px',
    color: '#1d4ed8',
    fontSize: '34px',
  },
  cardText: { margin: '4px 0 0', color: '#94a3b8' },
  contentGrid: {
    maxWidth: '1200px',
    margin: '0 auto 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '18px',
  },
  panel: {
    minHeight: '220px',
    padding: '22px',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    backgroundColor: '#ffffff',
  },
  panelTitle: {
    margin: '0 0 16px',
    color: '#172554',
    fontSize: '20px',
  },
  panelHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  resultCount: {
    display: 'inline-grid',
    placeItems: 'center',
    minWidth: '26px',
    height: '26px',
    padding: '0 7px',
    borderRadius: '999px',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    padding: '8px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '9px',
    backgroundColor: '#f8fafc',
  },
  searchIcon: {
    color: '#94a3b8',
    fontSize: '22px',
    lineHeight: 1,
    transform: 'rotate(-20deg)',
  },
  searchInput: {
    width: '100%',
    minWidth: 0,
    padding: 0,
    border: 0,
    outline: 'none',
    color: '#1f2937',
    backgroundColor: 'transparent',
    fontSize: '13px',
  },
  list: { padding: 0, margin: 0, listStyle: 'none' },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '999px',
    color: '#166534',
    backgroundColor: '#dcfce7',
    fontSize: '12px',
  },
  patientTc: {
    display: 'block',
    marginTop: '4px',
    color: '#94a3b8',
    fontSize: '12px',
  },
  emptyText: { color: '#94a3b8' },
  formPanel: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
    border: '1px solid #bbf7d0',
    borderRadius: '14px',
    backgroundColor: '#f0fdf4',
  },
  formTitle: { margin: 0, color: '#166534' },
  formDescription: { color: '#4b5563' },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '14px',
    alignItems: 'end',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    color: '#374151',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: '14px',
  },
  button: {
    minHeight: '42px',
    padding: '10px 16px',
    border: 0,
    borderRadius: '8px',
    color: '#ffffff',
    backgroundColor: '#16a34a',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  infoMessage: {
    maxWidth: '1200px',
    margin: '0 auto 16px',
    padding: '12px 16px',
    borderRadius: '8px',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
  },
  errorMessage: {
    maxWidth: '1200px',
    margin: '0 auto 16px',
    padding: '12px 16px',
    borderRadius: '8px',
    color: '#991b1b',
    backgroundColor: '#fee2e2',
  },
  successMessage: {
    maxWidth: '1200px',
    margin: '0 auto 16px',
    padding: '12px 16px',
    borderRadius: '8px',
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
}

export default App
