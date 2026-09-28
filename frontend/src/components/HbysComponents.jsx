import styles from '../styles.js'

export function StatCard({ icon, title, value, text }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.cardIcon}>{icon}</span>
        <span style={styles.cardTitle}>{title}</span>
      </div>
      <strong style={styles.number}>{value}</strong>
      <p style={styles.cardText}>{text}</p>
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <label style={styles.label}>
      {label}
      <input {...props} style={{ ...styles.input, ...(props.style || {}) }} />
    </label>
  )
}

export function Textarea({ label, ...props }) {
  return (
    <label style={styles.label}>
      {label}
      <textarea {...props} style={styles.textarea} />
    </label>
  )
}

export function Select({ label, options, placeholder, ...props }) {
  return (
    <label style={styles.label}>
      {label}
      <select {...props} style={styles.input} required>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={styles.searchBox}>
      <span style={styles.searchIcon}>⌕</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={styles.searchInput}
      />
    </div>
  )
}

export function AppointmentTable({
  appointments,
  getPatientName,
  getDoctorName,
  getDepartmentName,
  formatDate,
  onCancel,
  onApprove,
  onReject,
}) {
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
                <span
                  style={
                    appointment.status === 'Tamamlandı'
                      ? styles.completedBadge
                      : appointment.status === 'İptal' || appointment.status === 'İptal Edildi' || appointment.status === 'Reddedildi'
                        ? styles.cancelledBadge
                        : styles.waitingBadge
                  }
                >
                  {appointment.status === 'İptal Edildi' ? 'İptal' : appointment.status}
                </span>
              </td>
              <td style={styles.td}>
                {appointment.status === 'Talep Edildi' && onApprove && onReject && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => onApprove(appointment.id)} style={styles.saveButton}>Onayla</button>
                    <button type="button" onClick={() => onReject(appointment.id)} style={styles.cancelButton}>Reddet</button>
                  </div>
                )}
                {(appointment.status === 'Bekliyor' || appointment.status === 'Onaylandı') && onCancel && (
                  <button
                    type="button"
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

export function Modal({ title, onClose, children }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div
        style={styles.modalContent}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Pencereyi kapat"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ModalFooter({ onClose, saving, submitText }) {
  return (
    <div style={styles.modalFooter}>
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        style={styles.secondaryButton}
      >
        Vazgeç
      </button>
      <button
        type="submit"
        disabled={saving}
        style={saving ? styles.disabledButton : styles.primaryButton}
      >
        {saving && <Spinner />}
        {saving ? 'Kaydediliyor...' : submitText}
      </button>
    </div>
  )
}

export function Spinner() {
  return <span style={styles.spinner} aria-hidden="true" />
}

export function Toast({ type, message, onClose }) {
  return (
    <div
      style={{
        ...styles.toast,
        ...(type === 'error' ? styles.toastError : styles.toastSuccess),
      }}
      role="alert"
    >
      <span
        style={{
          ...styles.toastIcon,
          ...(type === 'error' ? styles.toastErrorIcon : {}),
        }}
      >
        {type === 'error' ? '!' : '✓'}
      </span>
      <span style={styles.toastMessage}>{message}</span>
      <button
        type="button"
        onClick={onClose}
        style={styles.toastClose}
        aria-label="Bildirimi kapat"
      >
        ×
      </button>
    </div>
  )
}

export function LoginScreen({ form, onChange, onSubmit, error, saving }) {
  return (
    <main className="loginPage" style={styles.loginPage}>
      <div style={styles.loginColumn}>
        <div className="loginBackdropQuote" style={styles.loginBackdropQuote}>
          <span>“Beni Türk hekimlerine emanet ediniz.”</span>
          <cite>— Mustafa Kemal Atatürk</cite>
        </div>
        <section style={styles.loginCard}>
        <div style={styles.loginBrand} aria-label="HBYS logo">
          <span style={styles.loginBrandMark}>✚</span>
          <span style={styles.loginBrandText}>HBYS</span>
        </div>
        <p style={styles.loginEyebrow}>HASTANE BİLGİ YÖNETİM SİSTEMİ</p>
        <h1 style={styles.loginTitle}>Hoş Geldiniz</h1>
        <p style={styles.loginDescription}>Sağlık hizmetlerini güvenli ve düzenli şekilde yönetin.</p>
        {error && <div style={styles.loginError}>{error}</div>}
        <form onSubmit={onSubmit} style={styles.loginForm}>
          <label style={styles.label}>
            Kullanıcı adı
            <input style={styles.input} name="username" value={form.username} onChange={onChange} placeholder="Kullanıcı adınız" autoComplete="username" required />
          </label>
          <label style={styles.label}>
            Şifre
            <input style={styles.input} name="password" type="password" value={form.password} onChange={onChange} placeholder="Şifreniz" autoComplete="current-password" required />
          </label>
          <button type="submit" disabled={saving} style={saving ? styles.disabledButton : styles.primaryButton}>
            {saving && <Spinner />}
            {saving ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
        <div style={styles.demoAccounts}>
          <strong>Demo hesapları</strong>
          <span>admin / admin123</span>
          <span>sekreter / sekreter123</span>
          <span>doktor / doktor123</span>
        </div>
        </section>
      </div>
    </main>
  )
}
