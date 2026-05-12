<template>
  <div v-if="show && eventData" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-box fade-in">
      <div class="modal-top">
        <div>
          <h2>Detalle de {{ eventData.cardLabel }}</h2>
          <p class="text-muted">{{ eventData.details.length }} registros</p>
        </div>
        <div class="modal-top-right">
          <input type="text" v-model="search" placeholder="Buscar..." class="modal-search">
          <button class="modal-close" @click="emit('close')">&times;</button>
        </div>
      </div>
      <div class="modal-content custom-scroll">
        <table class="modal-table" aria-label="Tabla de vulnerabilidades detectadas en el período seleccionado, mostrando detalles como conexión, equipo, CVE, severidad y estado">
          <thead>
            <tr>
              <th @click="sortBy('connection_name')">Conexion</th>
              <th @click="sortBy('agent_name')">Equipo</th>
              <th @click="sortBy('cve_id')">CVE</th>
              <th @click="sortBy('severity')">Severidad</th>
              <th @click="sortBy('timeline_event_at')">Evento en slot</th>
              <th @click="sortBy('detected_at')">Detectado (Wazuh)</th>
              <th @click="sortBy('first_seen')">Primera vez (App)</th>
              <th @click="sortBy('last_seen')">Ultimo sync</th>
              <th @click="sortBy('status')">Estado</th>
              <th @click="sortBy('resolved_at')">Resolucion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vuln in rows" :key="vuln.id + '-' + vuln.cve_id">
              <td>{{ vuln.connection_name }}</td>
              <td>{{ vuln.agent_name }}</td>
              <td><code>{{ vuln.cve_id }}</code></td>
              <td>{{ vuln.severity }}</td>
              <td>
                <span v-if="vuln.timeline_event_at">
                  {{ fmtDateTime(vuln.timeline_event_at) }}
                  <small class="event-chip">{{ vuln.timeline_event_label }}</small>
                </span>
                <span v-else>-</span>
              </td>
              <td>{{ vuln.detected_at ? fmtDateTime(vuln.detected_at) : '-' }}</td>
              <td>{{ fmtDateTime(vuln.first_seen) }}</td>
              <td>{{ vuln.last_seen ? fmtDateTime(vuln.last_seen) : '-' }}</td>
              <td>{{ vuln.status === 'ACTIVE' ? 'ACTIVO' : 'RESUELTO' }}</td>
              <td>{{ vuln.resolved_at ? fmtDateTime(vuln.resolved_at) : '-' }}</td>
            </tr>
            <tr v-if="rows.length === 0"><td colspan="10" class="empty-row">Sin coincidencias</td></tr>
          </tbody>
        </table>
      </div>
      <div class="modal-bottom">
        <span>{{ rows.length }} de {{ eventData.details.length }} registros</span>
        <button class="btn modal-outline" @click="emit('close')">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { fmtDateTime } from '../timelineFormatters'

const props = defineProps({
  show: { type: Boolean, default: false },
  eventData: { type: Object, default: null }
})

const emit = defineEmits(['close'])

const search = ref('')
const sortKey = ref('status')
const sortOrder = ref(1)

watch(
  () => props.eventData,
  () => {
    search.value = ''
    sortKey.value = 'status'
    sortOrder.value = 1
  }
)

const sortBy = key => {
  if (sortKey.value === key) {
    sortOrder.value *= -1
    return
  }
  sortKey.value = key
  sortOrder.value = 1
}

const rows = computed(() => {
  if (!props.eventData || !props.show) return []
  const list = props.eventData.details
  
  // Filtro rápido
  let filtered = list
  if (search.value) {
    const q = search.value.toLowerCase()
    filtered = list.filter(v => 
      v.agent_name?.toLowerCase().includes(q) ||
      v.cve_id?.toLowerCase().includes(q) ||
      v.severity?.toLowerCase().includes(q)
    )
  }

  // Ordenar sin copia innecesaria
  const key = sortKey.value
  const order = sortOrder.value
  return filtered.slice().sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''

    if (av < bv) return -order
    if (av > bv) return order
    return 0
  })
})
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal-box { width: 100%; max-width: 1000px; max-height: 88vh; background: var(--bg-panel); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden; }
.modal-top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); }
.modal-search { padding: 0.45rem 0.8rem; border: 1px solid var(--border); border-radius: 20px; background: var(--bg-hover); color: var(--text-main); }
.modal-close { border: none; background: transparent; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; }
.modal-top-right { display: flex; align-items: center; gap: 0.6rem; }
.modal-content { overflow: auto; }
.modal-table { width: 100%; border-collapse: collapse; }
.modal-table th, .modal-table td { padding: 0.7rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
.modal-table th { font-size: 0.67rem; text-transform: uppercase; color: var(--text-muted); background: var(--bg-hover); position: sticky; top: 0; cursor: pointer; }
.event-chip { margin-left: 0.4rem; padding: 0.12rem 0.35rem; border-radius: 999px; background: var(--bg-hover); color: var(--text-muted); font-size: 0.64rem; font-weight: 700; }
.empty-row { text-align: center; color: var(--text-muted); }
.modal-bottom { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.2rem; border-top: 1px solid var(--border); font-size: 0.78rem; color: var(--text-muted); }
.modal-outline { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
</style>
