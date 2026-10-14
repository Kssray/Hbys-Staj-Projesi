import { useState } from 'react'
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

export function PatientCard({ patient, appointmentCount, nextAppointment, formatDate, onCreateAppointment }) {
  const initials = `${patient.first_name?.charAt(0) || ''}${patient.last_name?.charAt(0) || ''}`.toLocaleUpperCase('tr-TR')
  const maskedTc = patient.tc_no ? `${patient.tc_no.slice(0, 3)}******${patient.tc_no.slice(-2)}` : '-'

  return (
    <article className="patientCard" style={styles.patientCard}>
      <div style={styles.patientCardHeader}>
        <div style={styles.patientCardIdentity}>
          <div style={styles.patientCardAvatar}>{initials}</div>
          <div style={styles.patientCardNameGroup}>
            <strong style={styles.patientCardName}>{patient.first_name} {patient.last_name}</strong>
            <span style={styles.patientCardNumber}>Hasta No: #{String(patient.id).padStart(4, '0')}</span>
          </div>
        </div>
        <span style={styles.patientActiveBadge}>Aktif</span>
      </div>

      <div className="patientCardInfoGrid" style={styles.patientCardInfoGrid}>
        <div style={styles.patientInfoItem}><small>TC Kimlik No</small><strong>{maskedTc}</strong></div>
        <div style={styles.patientInfoItem}><small>Telefon</small><strong>{patient.phone || 'Kayıtlı değil'}</strong></div>
        <div style={styles.patientInfoItem}><small>Cinsiyet</small><strong>{patient.gender || 'Belirtilmemiş'}</strong></div>
        <div style={styles.patientInfoItem}><small>Randevu</small><strong>{appointmentCount} kayıt</strong></div>
      </div>

      <div className="patientCardFooter" style={styles.patientCardFooter}>
        <div style={styles.patientNextAppointment}>
          <small>Yaklaşan randevu</small>
          <strong>{nextAppointment ? formatDate(nextAppointment.appointment_date) : 'Planlanmış randevu yok'}</strong>
        </div>
        <button type="button" onClick={() => onCreateAppointment(patient)} style={styles.patientAppointmentButton}>+ Randevu</button>
      </div>
    </article>
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
    onMarkNoShow,
  compact = false,
}) {
  return (
    <div style={compact ? styles.compactTableWrap : styles.tableWrap}>
      <table style={compact ? styles.compactTable : styles.table}>
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
                      : appointment.status === 'Gelmedi'
                        ? styles.noShowBadge
                      : appointment.status === 'İptal' || appointment.status === 'İptal Edildi' || appointment.status === 'Reddedildi'
                        ? styles.cancelledBadge
                        : styles.waitingBadge
                  }
                >
                  {appointment.status === 'İptal Edildi' ? 'İptal' : appointment.status === 'Bekliyor' ? 'Muayene Bekliyor' : appointment.status}
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
                {appointment.status === 'Bekliyor' && onMarkNoShow && new Date(appointment.appointment_date) <= new Date() && (
                  <button type="button" onClick={() => onMarkNoShow(appointment.id)} style={styles.noShowButton}>Gelmedi</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div
        style={wide ? styles.modalContentWide : styles.modalContent}
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

export function LoginScreen({ form, onChange, onSubmit, onDemoSelect, error, saving }) {
  const [activeDemoGroup, setActiveDemoGroup] = useState('secretaries')
  const demoAccounts = [
    { group: 'admin', label: 'Yönetici', detail: 'Sistem Yöneticisi', username: 'admin', password: 'admin123' },
    { group: 'secretaries', label: 'Dahiliye', detail: 'Ayşe Sekreter', username: 'sekreter', password: 'sekreter123' },
    { group: 'secretaries', label: 'Dahiliye', detail: 'Elif Kaya', username: 'dahiliye_demo', password: 'demo1234' },
    { group: 'secretaries', label: 'Göz Hastalıkları', detail: 'Melis Aydın', username: 'goz_demo', password: 'demo1234' },
    { group: 'secretaries', label: 'Kardiyoloji', detail: 'Zeynep Çelik', username: 'kardiyo_demo', password: 'demo1234' },
    { group: 'secretaries', label: 'Çocuk Sağlığı', detail: 'Buse Yıldız', username: 'cocuk_demo', password: 'demo1234' },
    { group: 'secretaries', label: 'Ortopedi', detail: 'Emre Şahin', username: 'ortopedi_demo', password: 'demo1234' },
    { group: 'secretaries', label: 'Dermatoloji', detail: 'Seda Arslan', username: 'derma_demo', password: 'demo1234' },
    { group: 'nurses', label: 'Dahiliye Servisi', detail: 'Dahiliye Hemşiresi', username: 'dahiliye_hemsire', password: 'demo1234' },
    { group: 'nurses', label: 'Cerrahi Servisi', detail: 'Cerrahi Hemşiresi', username: 'cerrahi_hemsire', password: 'demo1234' },
    { group: 'nurses', label: 'Çocuk Servisi', detail: 'Çocuk Servisi Hemşiresi', username: 'cocuk_hemsire', password: 'demo1234' },
    { group: 'cleaners', label: 'Hastane Geneli', detail: 'Merkezi Temizlik Personeli', username: 'temizlik_personeli', password: 'demo1234' },
    { group: 'cleaners', label: 'Hastane Geneli', detail: 'Ayşe Temizlik Personeli', username: 'temizlik_demo', password: 'demo1234' },
    { group: 'doctors', label: 'Dahiliye', detail: 'Dr. Ahmet Yılmaz', username: 'doktor', password: 'doktor123' },
    { group: 'doctors', label: 'Dahiliye', detail: 'Dr. Selin Akar', username: 'dahiliye_doktor2', password: 'demo1234' },
    { group: 'doctors', label: 'Dahiliye', detail: 'Dr. Bora Kılıç', username: 'dahiliye_doktor3', password: 'demo1234' },
    { group: 'doctors', label: 'Göz Hastalıkları', detail: 'Dr. Ayşe Demir', username: 'goz_doktor', password: 'demo1234' },
    { group: 'doctors', label: 'Göz Hastalıkları', detail: 'Dr. Burak Öz', username: 'goz_doktor2', password: 'demo1234' },
    { group: 'doctors', label: 'Göz Hastalıkları', detail: 'Dr. Leyla Uçar', username: 'goz_doktor3', password: 'demo1234' },
    { group: 'doctors', label: 'Kardiyoloji', detail: 'Dr. Mehmet Kaya', username: 'kardiyoloji_doktor', password: 'demo1234' },
    { group: 'doctors', label: 'Kardiyoloji', detail: 'Dr. İpek Çetin', username: 'kardiyoloji_doktor2', password: 'demo1234' },
    { group: 'doctors', label: 'Kardiyoloji', detail: 'Dr. Kerem Ersoy', username: 'kardiyoloji_doktor3', password: 'demo1234' },
    { group: 'doctors', label: 'Çocuk Sağlığı', detail: 'Dr. Elif Şahin', username: 'cocuk_doktor', password: 'demo1234' },
    { group: 'doctors', label: 'Çocuk Sağlığı', detail: 'Dr. Deniz Aksoy', username: 'cocuk_doktor2', password: 'demo1234' },
    { group: 'doctors', label: 'Çocuk Sağlığı', detail: 'Dr. Sibel Yıldız', username: 'cocuk_doktor3', password: 'demo1234' },
    { group: 'doctors', label: 'Ortopedi', detail: 'Dr. Can Öztürk', username: 'ortopedi_doktor', password: 'demo1234' },
    { group: 'doctors', label: 'Ortopedi', detail: 'Dr. Onur Eren', username: 'ortopedi_doktor2', password: 'demo1234' },
    { group: 'doctors', label: 'Ortopedi', detail: 'Dr. Gizem Polat', username: 'ortopedi_doktor3', password: 'demo1234' },
    { group: 'doctors', label: 'Dermatoloji', detail: 'Dr. Zeynep Arslan', username: 'dermatoloji_doktor', password: 'demo1234' },
    { group: 'doctors', label: 'Dermatoloji', detail: 'Dr. Murat Keskin', username: 'dermatoloji_doktor2', password: 'demo1234' },
    { group: 'doctors', label: 'Dermatoloji', detail: 'Dr. Pelin Doğan', username: 'dermatoloji_doktor3', password: 'demo1234' },
    { group: 'patients', label: 'Hasta', detail: 'Kübra Yılmaz', username: 'hasta', password: 'hasta123' },
    { group: 'patients', label: 'Hasta', detail: 'Uğur Yılmaz', username: 'ugur_hasta', password: 'demo1234' },
    { group: 'patients', label: 'Hasta', detail: 'Nur Kaya', username: 'nur_hasta', password: 'demo1234' },
    { group: 'patients', label: 'Hasta', detail: 'Mert Aydın', username: 'mert_hasta', password: 'demo1234' },
    { group: 'patients', label: 'Hasta', detail: 'Seda Çelik', username: 'seda_hasta', password: 'demo1234' },
    { group: 'patients', label: 'Hasta', detail: 'Emir Koç', username: 'emir_hasta', password: 'demo1234' },
    { group: 'patients', label: 'Hasta', detail: 'Derya Şimşek', username: 'derya_hasta', password: 'demo1234' },
    { group: 'patients', label: 'Hasta', detail: 'Ece Demir', username: 'ece_hasta', password: 'demo1234' },
  ]
  const demoGroups = [
    { key: 'secretaries', label: 'Sekreterler' },
    { key: 'doctors', label: 'Doktorlar' },
    { key: 'nurses', label: 'Hemşireler' },
    { key: 'cleaners', label: 'Temizlik Personeli' },
    { key: 'patients', label: 'Hastalar' },
    { key: 'admin', label: 'Yönetici' },
  ]
  const visibleDemoAccounts = demoAccounts.filter((account) => account.group === activeDemoGroup)

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
        <details style={styles.demoAccounts}>
          <summary style={styles.demoAccountsSummary}>Hızlı demo hesapları</summary>
          <p style={styles.demoAccountsHint}>Önce rol grubunu, ardından giriş yapmak istediğiniz hesabı seçin.</p>
          <div style={styles.demoGroupTabs}>{demoGroups.map((group) => { const count = demoAccounts.filter((account) => account.group === group.key).length; return <button key={group.key} type="button" onClick={() => setActiveDemoGroup(group.key)} style={activeDemoGroup === group.key ? styles.demoGroupButtonActive : styles.demoGroupButton}>{group.label}<span>{count}</span></button> })}</div>
          <div style={styles.demoAccountGrid}>{visibleDemoAccounts.map((account) => <button key={account.username} type="button" onClick={() => onDemoSelect(account)} style={styles.demoAccountButton}><span style={styles.demoAccountRole}>{account.label}</span><small style={styles.demoAccountDetail}>{account.detail} · {account.username}</small></button>)}</div>
        </details>
        </section>
      </div>
    </main>
  )
}
