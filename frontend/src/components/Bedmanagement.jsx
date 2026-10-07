import { useMemo, useState } from 'react'
import styles from '../styles.js'

export default function BedManagement({ services, beds, patients, onAssign, onDischarge, saving, readOnly = false, canAssign = false, canDischarge = false }) {
  const [serviceFilter, setServiceFilter] = useState('all')
  const [bedStatus, setBedStatus] = useState('all')
  const [selectedBed, setSelectedBed] = useState(null)
  const [patientId, setPatientId] = useState('')
  const [reason, setReason] = useState('')

  const visibleBeds = useMemo(() => beds.filter((bed) => {
    const serviceMatch = serviceFilter === 'all' || String(bed.service_id) === String(serviceFilter)
    const statusMatch = bedStatus === 'all' || bed.status === bedStatus
    return serviceMatch && statusMatch
  }), [beds, serviceFilter, bedStatus])

  const submitAssignment = async (event) => {
    event.preventDefault()
    if (!selectedBed || !patientId) return
    const ok = await onAssign({ bed_id: selectedBed.id, patient_id: Number(patientId), admission_reason: reason.trim() || null })
    if (ok) {
      setSelectedBed(null)
      setPatientId('')
      setReason('')
    }
  }

  return (
    <div style={styles.bedWorkspace}>
      <section style={styles.bedHero}>
        <div>
          <p style={styles.tabEyebrow}>YATAKLI TEDAVİ YÖNETİMİ</p>
          <h2 style={styles.tabPageTitle}>Servis ve Yatak Yönetimi</h2>
          <p style={styles.formDescription}>{readOnly ? 'Servislerde yatan hastaların ve yatak durumlarının güncel görünümü.' : 'Servis, oda ve yatak doluluklarını takip edin; hastayı uygun yatağa yatırın veya taburcu edin.'}</p>
        </div>
        <div style={styles.bedHeroMetric}><strong>{beds.filter((bed) => bed.status === 'Boş').length}</strong><span>boş yatak</span></div>
      </section>

      <section style={styles.bedServiceGrid}>
        {services.map((service) => <article key={service.id} style={styles.bedServiceCard}>
          <div style={styles.bedServiceIcon}>▦</div>
          <div style={styles.bedServiceInfo}><strong>{service.name}</strong><small>{service.floor} · {service.specialty}</small></div>
          <div style={styles.bedServiceNumbers}><b>{service.occupied_beds}/{service.total_beds}</b><small>dolu yatak</small></div>
        </article>)}
      </section>

      <section style={styles.bedPanel}>
        <div style={styles.bedPanelHeader}><div><h3 style={styles.cardSectionTitle}>Yatak Durumları</h3><p style={styles.cardSectionText}>{readOnly ? 'Bu ekran yalnızca görüntüleme amaçlıdır.' : 'Bir yatağa tıklayarak hasta yatışı başlatabilirsiniz.'}</p></div><span style={styles.tabSummaryBadge}>{visibleBeds.length} yatak</span></div>
        <div style={styles.bedFilters}>
          <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} style={styles.input}><option value="all">Tüm servisler</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
          <select value={bedStatus} onChange={(event) => setBedStatus(event.target.value)} style={styles.input}><option value="all">Tüm durumlar</option><option value="Boş">Boş</option><option value="Dolu">Dolu</option><option value="Temizlikte">Temizlikte</option></select>
        </div>
        <div style={styles.bedGrid}>
          {visibleBeds.map((bed) => <article key={bed.id} style={{ ...styles.bedCard, ...(bed.status === 'Boş' ? styles.bedCardAvailable : bed.status === 'Dolu' ? styles.bedCardOccupied : styles.bedCardCleaning) }}>
            <div style={styles.bedCardTop}><span style={styles.bedNumber}>#{bed.bed_number}</span><span style={styles.bedStatusBadge}>{bed.status}</span></div>
            <div style={styles.bedCardMeta}><strong>{bed.service_name}</strong><small>{bed.room_number} numaralı oda · {bed.floor}</small></div>
            {bed.patient_name ? <div style={styles.bedPatient}><span style={styles.patientAvatar}>{bed.patient_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div style={styles.bedPatientInfo}><strong>{bed.patient_name}</strong><small>Yatan hasta</small></div></div> : <p style={styles.bedEmpty}>Hasta atanmamış</p>}
            {!readOnly && canAssign && bed.status === 'Boş' && <button type="button" onClick={() => setSelectedBed(bed)} style={styles.bedAssignButton}>+ Hastayı Yatır</button>}
            {!readOnly && canDischarge && bed.status === 'Dolu' && bed.assignment_id && <button type="button" disabled={saving} onClick={() => onDischarge(bed.assignment_id)} style={styles.bedDischargeButton}>Taburcu Et</button>}
            {bed.status === 'Temizlikte' && <small style={styles.bedCleaningNote}>Yatak hazırlık süreci otomatik yürütülüyor.</small>}
          </article>)}
        </div>
      </section>

      {!readOnly && selectedBed && <div style={styles.bedAssignOverlay} onClick={() => setSelectedBed(null)}><form style={styles.bedAssignModal} onClick={(event) => event.stopPropagation()} onSubmit={submitAssignment}>
        <div style={styles.modalHeader}><h2 style={styles.modalTitle}>Hastayı Yatağa Yatır</h2><button type="button" onClick={() => setSelectedBed(null)} style={styles.closeButton}>×</button></div>
        <p style={styles.modalHint}>{selectedBed.service_name} · Oda {selectedBed.room_number} · Yatak #{selectedBed.bed_number}</p>
        <label style={styles.label}>Hasta<select required value={patientId} onChange={(event) => setPatientId(event.target.value)} style={styles.input}><option value="">Hasta seçin</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.first_name} {patient.last_name}</option>)}</select></label>
        <label style={styles.label}>Yatış nedeni<textarea value={reason} onChange={(event) => setReason(event.target.value)} style={styles.textarea} placeholder="Örn: Gözlem ve tedavi" /></label>
        <div style={styles.modalFooter}><button type="button" onClick={() => setSelectedBed(null)} style={styles.secondaryButton}>Vazgeç</button><button type="submit" disabled={saving} style={saving ? styles.disabledButton : styles.primaryButton}>{saving ? 'Kaydediliyor...' : 'Yatışı Kaydet'}</button></div>
      </form></div>}
    </div>
  )
}
