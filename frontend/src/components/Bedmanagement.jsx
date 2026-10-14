import { useMemo, useState } from 'react'
import styles from '../styles.js'

export default function BedManagement({ services, beds, patients, cleaningTasks = [], onRefresh, onAssign, onDischarge, onTransfer, onCompleteCleaning, onCompleteCleaningTask, onStartCleaningTask, saving, readOnly = false, canAssign = false, canDischarge = false, canUpdateStatus = false }) {
  const [serviceFilter, setServiceFilter] = useState('all')
  const [bedStatus, setBedStatus] = useState('all')
  const [selectedBed, setSelectedBed] = useState(null)
  const [patientId, setPatientId] = useState('')
  const [reason, setReason] = useState('')
  const [isolationRequired, setIsolationRequired] = useState('Yok')
  const [transferBed, setTransferBed] = useState(null)
  const [targetBedId, setTargetBedId] = useState('')
  const [transferReason, setTransferReason] = useState('')

  const openAssignmentModal = async (bed) => {
    if (onRefresh) {
      try {
        const freshData = await onRefresh()
        const freshBed = freshData?.beds?.find((item) => item.id === bed.id)
        if (freshBed && freshBed.status !== 'Boş') return
        setSelectedBed(freshBed || bed)
        return
      } catch {
        return
      }
    }
    setSelectedBed(bed)
  }

  const visibleBeds = useMemo(() => beds.filter((bed) => {
    const serviceMatch = serviceFilter === 'all' || String(bed.service_id) === String(serviceFilter)
    const statusMatch = bedStatus === 'all' || bed.status === bedStatus
    return serviceMatch && statusMatch
  }), [beds, serviceFilter, bedStatus])

  const eligiblePatients = useMemo(() => {
    // `beds` tüm servislerden gelir. Yatak durumu değişmiş olsa bile
    // aktif yatış kaydı taşıyan bir hasta başka bir servise tekrar yatırılmaz.
    const admittedPatientIds = new Set(
      beds
        .filter((bed) => bed.patient_id)
        .map((bed) => Number(bed.patient_id)),
    )
    return patients.filter((patient) => !admittedPatientIds.has(Number(patient.id)))
  }, [beds, patients])

  const submitAssignment = async (event) => {
    event.preventDefault()
    if (!selectedBed || !patientId) return
    const ok = await onAssign({ bed_id: selectedBed.id, patient_id: Number(patientId), admission_reason: reason.trim() || null, isolation_required: isolationRequired })
    if (ok) {
      setSelectedBed(null)
      setPatientId('')
      setReason('')
      setIsolationRequired('Yok')
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
            <div style={styles.bedCardMeta}><strong>{bed.service_name}</strong><small>{bed.room_number} numaralı oda · {bed.floor} · İzolasyon: {bed.isolation_type || 'Yok'}</small></div>
            {bed.patient_name ? <div style={styles.bedPatient}><span style={styles.patientAvatar}>{bed.patient_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div style={styles.bedPatientInfo}><strong>{bed.patient_name}</strong><small>Yatan hasta</small></div></div> : <p style={styles.bedEmpty}>Hasta atanmamış</p>}
            {!readOnly && canAssign && bed.status === 'Boş' && <button type="button" onClick={() => openAssignmentModal(bed)} style={styles.bedAssignButton}>+ Hastayı Yatır</button>}
            {!readOnly && canDischarge && bed.status === 'Dolu' && bed.assignment_id && <button type="button" disabled={saving} onClick={() => onDischarge(bed.assignment_id)} style={styles.bedDischargeButton}>Taburcu Et</button>}
            {!readOnly && canDischarge && bed.status === 'Dolu' && bed.assignment_id && onTransfer && <button type="button" disabled={saving} onClick={() => { setTransferBed(bed); setTargetBedId('') }} style={styles.bedTransferButton}>Yatağı Değiştir</button>}
            {bed.status === 'Temizlikte' && (canUpdateStatus && onCompleteCleaning ? <button type="button" disabled={saving} onClick={() => onCompleteCleaning(bed.id)} style={styles.bedCleaningButton}>Temizliği Tamamla</button> : <small style={styles.bedCleaningNote}>Hemşire temizliği tamamlayınca yatak kullanıma açılır.</small>)}
          </article>)}
        </div>
      </section>

      {cleaningTasks.length > 0 && <section style={styles.cleaningTaskPanel}>
        <div style={styles.bedPanelHeader}><div><h3 style={styles.cardSectionTitle}>Temizlik Görevleri</h3><p style={styles.cardSectionText}>Taburcu edilen hastalardan sonra oluşan aktif görevler.</p></div><span style={styles.tabSummaryBadge}>{cleaningTasks.length} görev</span></div>
        <div style={styles.cleaningTaskList}>{cleaningTasks.map((task) => <article key={task.id} style={styles.cleaningTaskCard}><div><strong>{task.service_name} · Oda {task.room_number} · Yatak #{task.bed_number}</strong><small>Durum: {task.status}</small></div>{task.status === 'Bekliyor' && onStartCleaningTask ? <button type="button" disabled={saving} onClick={() => onStartCleaningTask(task.id)} style={styles.bedCleaningButton}>Temizliği Başlat</button> : <button type="button" disabled={saving} onClick={() => onCompleteCleaningTask(task.id)} style={styles.bedCleaningButton}>Temizliği Tamamla</button>}</article>)}</div>
      </section>}

      {!readOnly && selectedBed && <div style={styles.bedAssignOverlay} onClick={() => setSelectedBed(null)}><form style={styles.bedAssignModal} onClick={(event) => event.stopPropagation()} onSubmit={submitAssignment}>
        <div style={styles.modalHeader}><h2 style={styles.modalTitle}>Hastayı Yatağa Yatır</h2><button type="button" onClick={() => setSelectedBed(null)} style={styles.closeButton}>×</button></div>
        <p style={styles.modalHint}>{selectedBed.service_name} · Oda {selectedBed.room_number} · Yatak #{selectedBed.bed_number}</p>
        <label style={styles.label}>Hasta<select required value={patientId} onChange={(event) => setPatientId(event.target.value)} style={styles.input}><option value="">Hasta seçin</option>{eligiblePatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.first_name} {patient.last_name}</option>)}</select>{eligiblePatients.length === 0 && <small style={styles.formHint}>Aktif yatışı olmayan hasta bulunmuyor.</small>}</label>
        <label style={styles.label}>Yatış nedeni<textarea value={reason} onChange={(event) => setReason(event.target.value)} style={styles.textarea} placeholder="Örn: Gözlem ve tedavi" /></label>
        <label style={styles.label}>İzolasyon gereksinimi<select value={isolationRequired} onChange={(event) => setIsolationRequired(event.target.value)} style={styles.input}><option>Yok</option><option>Temas</option><option>Damlacık</option><option>Hava Yolu</option></select></label>
        <div style={styles.modalFooter}><button type="button" onClick={() => setSelectedBed(null)} style={styles.secondaryButton}>Vazgeç</button><button type="submit" disabled={saving} style={saving ? styles.disabledButton : styles.primaryButton}>{saving ? 'Kaydediliyor...' : 'Yatışı Kaydet'}</button></div>
      </form></div>}
      {!readOnly && transferBed && <div style={styles.bedAssignOverlay} onClick={() => setTransferBed(null)}><form style={styles.bedAssignModal} onClick={(event) => event.stopPropagation()} onSubmit={async (event) => { event.preventDefault(); if (!targetBedId) return; const ok = await onTransfer(transferBed.assignment_id, { target_bed_id: Number(targetBedId), reason: transferReason.trim() || null }); if (ok) { setTransferBed(null); setTargetBedId(''); setTransferReason('') } }}><div style={styles.modalHeader}><h2 style={styles.modalTitle}>Hastayı Başka Yatağa Transfer Et</h2><button type="button" onClick={() => setTransferBed(null)} style={styles.closeButton}>×</button></div><p style={styles.modalHint}>{transferBed.patient_name} · Mevcut yatak #{transferBed.bed_number}</p><label style={styles.label}>Hedef boş yatak<select required value={targetBedId} onChange={(event) => setTargetBedId(event.target.value)} style={styles.input}><option value="">Yatak seçin</option>{beds.filter((bed) => bed.status === 'Boş' && bed.id !== transferBed.id).map((bed) => <option key={bed.id} value={bed.id}>{bed.service_name} · Oda {bed.room_number} · #{bed.bed_number}</option>)}</select></label><label style={styles.label}>Transfer nedeni<textarea value={transferReason} onChange={(event) => setTransferReason(event.target.value)} style={styles.textarea} placeholder="Örn: Servis içi takip değişikliği" /></label><div style={styles.modalFooter}><button type="button" onClick={() => setTransferBed(null)} style={styles.secondaryButton}>Vazgeç</button><button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? 'Aktarılıyor...' : 'Transferi Kaydet'}</button></div></form></div>}
    </div>
  )
}
