<template>
  <div class="fade-in timeline-view">
    <div class="header-actions">
      <div>
        <h1 class="title">Linea del tiempo</h1>
        <p class="subtitle">Vista infografica con linea continua y slots con o sin cambios.</p>
      </div>
    </div>

    <div v-if="statusError" class="status-banner status-error">{{ statusError }}</div>
    <div v-if="statusWarning" class="status-banner status-warning">{{ statusWarning }}</div>

    <TimelineFilters
      :connections="connections"
      :agent-options="agentOpts"
      :vuln-options="vulnOpts"
      :selected-connection="selectedConnection"
      :selected-agents="selectedAgents"
      :selected-vulns="selectedVulns"
      :period="period"
      :periods="periods"
      :custom-date="customDate"
      :loading="loading"
      @update:selected-connection="selectedConnection = $event"
      @update:selected-agents="selectedAgents = $event"
      @update:selected-vulns="selectedVulns = $event"
      @update:custom-date="customDate = $event"
      @connection-change="onConnectionChange"
      @set-period="setPeriod"
      @build="buildTimeline"
    />

    <TimelineKpiStrip
      :has-built="hasBuilt"
      :painted-count="paintedCount"
      :latest-snap="latestSnap"
    />

    <TimelineCanvas
      v-if="hasBuilt && visibleSlots.length > 0"
      :all-slots="allSlots"
      :visible-slots="visibleSlots"
      :painted-count="paintedCount"
      :year-label="yearLabel"
      :active-zoom="activeZoom"
      :can-move-left="canMoveLeft"
      :can-move-right="canMoveRight"
      :can-zoom-in="canZoomIn"
      :can-zoom-out="canZoomOut"
      @move-left="moveLeft"
      @move-right="moveRight"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @open-slot="openModal"
    />

    <div v-else class="card empty-card">
      <div v-if="loading" class="empty-center"><p>Escaneando historial...</p></div>
      <div v-else class="empty-center">
        <h3>Sin datos para mostrar</h3>
        <p>Selecciona filtros y presiona "Generar Vista".</p>
      </div>
    </div>

    <TimelineDetailModal
      :show="modalOpen"
      :event-data="selectedEvent"
      @close="modalOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import wazuhService from '../../application/services/wazuhService'
import useTimelineData from './timeline/useTimelineData'
import useTimelineNavigation from './timeline/useTimelineNavigation'
import { fmtYear } from './timeline/timelineFormatters'
import TimelineCanvas from './timeline/components/TimelineCanvas.vue'
import TimelineDetailModal from './timeline/components/TimelineDetailModal.vue'
import TimelineFilters from './timeline/components/TimelineFilters.vue'
import TimelineKpiStrip from './timeline/components/TimelineKpiStrip.vue'

const periods = [
  { l: '24H', v: '24h' },
  { l: '7D', v: '7d' },
  { l: '30D', v: '30d' },
  { l: 'Dia', v: 'day' },
  { l: 'Todo', v: 'all' }
]

const connections = ref([])
const agentOpts = ref([])
const vulnOpts = ref([])
const selectedConnection = ref('')
const selectedAgents = ref([])
const selectedVulns = ref([])
const period = ref('30d')
const customDate = ref(new Date().toISOString().split('T')[0])
const errorBanner = ref('')

const modalOpen = ref(false)
const selectedEvent = ref(null)

const getConnectionName = () => {
  const found = connections.value.find(conn => String(conn.id) === String(selectedConnection.value))
  return found?.name || ''
}

let allSlotsRef = null
const navigation = useTimelineNavigation(() => (allSlotsRef ? allSlotsRef.value.length : 0))

const {
  loading,
  hasBuilt,
  allSlots,
  paintedCount,
  latestSnap,
  errorMessage,
  warningMessage,
  build,
  fetchConnectionVulns
} = useTimelineData({
  selectedConnection,
  selectedAgents,
  selectedVulns,
  period,
  customDate,
  activeZoom: navigation.activeZoom,
  getConnectionName
})

allSlotsRef = allSlots

const {
  activeZoom,
  visibleCount,
  viewStartIndex,
  canMoveLeft,
  canMoveRight,
  canZoomIn,
  canZoomOut,
  setZoomLevel,
  zoomIn,
  zoomOut,
  moveLeft,
  moveRight,
  jumpToEnd
} = navigation

const visibleSlots = computed(() =>
  allSlots.value.slice(viewStartIndex.value, viewStartIndex.value + visibleCount.value)
)

const yearLabel = computed(() => {
  if (!visibleSlots.value.length) return ''
  const start = fmtYear(visibleSlots.value[0].startMs)
  const end = fmtYear(visibleSlots.value[visibleSlots.value.length - 1].startMs)
  return start === end ? start : `${start} - ${end}`
})

const setPeriod = value => {
  period.value = value
}

const onConnectionChange = async () => {
  selectedAgents.value = []
  selectedVulns.value = []
  agentOpts.value = []
  vulnOpts.value = []
  errorBanner.value = ''

  if (!selectedConnection.value) return

  try {
    const data = await fetchConnectionVulns()
    const agents = new Set()
    const vulns = new Set()

    data.forEach(vuln => {
      if (vuln.agent_name) agents.add(vuln.agent_name)
      if (vuln.cve_id) vulns.add(vuln.cve_id)
    })

    agentOpts.value = Array.from(agents).sort()
    vulnOpts.value = Array.from(vulns).sort()
  } catch (error) {
    console.error(error)
    errorBanner.value = 'No se pudieron cargar agentes y CVEs para la conexion seleccionada.'
  }
}

const buildTimeline = async () => {
  errorBanner.value = ''
  try {
    const { initialZoom } = await build()
    setZoomLevel(initialZoom)
    jumpToEnd()
  } catch (error) {
    console.error(error)
  }
}

const openModal = slot => {
  selectedEvent.value = slot
  modalOpen.value = true
}

onMounted(async () => {
  try {
    const response = await wazuhService.getConnections()
    connections.value = Array.isArray(response.data) ? response.data : []
  } catch (error) {
    console.error(error)
    errorBanner.value = 'No se pudieron cargar las conexiones Wazuh.'
  }
})

const statusError = computed(() => errorBanner.value || errorMessage.value)
const statusWarning = computed(() => warningMessage.value)
</script>

<style scoped>
.timeline-view {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.status-banner {
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border);
  font-size: 0.85rem;
  font-weight: 600;
}

.status-error {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: rgba(220, 38, 38, 0.3);
}

.status-warning {
  color: var(--warning);
  background: var(--warning-bg);
  border-color: rgba(217, 119, 6, 0.25);
}

.empty-card {
  min-height: 240px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.empty-center p {
  color: var(--text-muted);
}
</style>
