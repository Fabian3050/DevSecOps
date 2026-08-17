<template>
  <div class="analytics-grid">
    <div class="chart-card fade-in">
      <h3>Distribución por Severidad</h3>
      <div class="chart-container">
        <Doughnut v-if="hasSeverityData" :data="severityChartData" :options="doughnutOptions" />
        <div v-else class="no-data">Sin datos</div>
      </div>
    </div>
    
    <div class="chart-card fade-in" style="animation-delay: 0.1s;">
      <h3>Top 5 CVEs Frecuentes</h3>
      <div class="chart-container">
        <Bar v-if="hasCveData" :data="cveChartData" :options="barOptions" />
        <div v-else class="no-data">Sin datos</div>
      </div>
    </div>

    <div class="chart-card fade-in" style="animation-delay: 0.2s;">
      <h3>Top 5 Agentes con más Vulnerabilidades</h3>
      <div class="chart-container">
        <Bar v-if="hasAgentData" :data="agentChartData" :options="barOptions" />
        <div v-else class="no-data">Sin datos</div>
      </div>
    </div>
  </div>

  <div v-if="summaryMetrics" class="summary-metrics-grid">
    <div class="metric-card fade-in" style="animation-delay: 0.3s;">
      <div class="metric-title">% Vulnerabilidades Críticas</div>
      <div class="metric-value" :class="{'text-danger': summaryMetrics.pct_critical_vulns > 10}">
        {{ summaryMetrics.pct_critical_vulns }}%
      </div>
      <div class="metric-sub">{{ summaryMetrics.critical_vulns }} de {{ summaryMetrics.total_vulns }}</div>
    </div>
    
    <div class="metric-card fade-in" style="animation-delay: 0.4s;">
      <div class="metric-title">% Agentes Críticos</div>
      <div class="metric-value" :class="{'text-danger': summaryMetrics.pct_critical_agents > 10}">
        {{ summaryMetrics.pct_critical_agents }}%
      </div>
      <div class="metric-sub">{{ summaryMetrics.critical_agents }} de {{ summaryMetrics.total_agents }} afectados</div>
    </div>
    
    <div class="metric-card fade-in" style="animation-delay: 0.5s;">
      <div class="metric-title">CVEs Reincidentes</div>
      <div class="metric-value text-warning">
        {{ summaryMetrics.reincident_cves }}
      </div>
      <div class="metric-sub">En múltiples agentes</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement
} from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const props = defineProps({
  data: {
    type: Object,
    default: () => null
  }
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right' }
  }
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false }
  }
}

const getSeverityColor = (sev) => {
  const s = (sev || '').toLowerCase()
  if (s === 'critical' || s === 'critica') return '#ef4444'
  if (s === 'high' || s === 'alta') return '#f97316'
  if (s === 'medium' || s === 'media') return '#eab308'
  if (s === 'low' || s === 'baja') return '#3b82f6'
  return '#9ca3af'
}

const hasSeverityData = computed(() => props.data?.severity_distribution?.length > 0)
const severityChartData = computed(() => {
  if (!hasSeverityData.value) return { labels: [], datasets: [] }
  
  const order = { 'critical': 1, 'critica': 1, 'high': 2, 'alta': 2, 'medium': 3, 'media': 3, 'low': 4, 'baja': 4 }
  const raw = [...props.data.severity_distribution].sort((a, b) => {
    const rankA = order[(a.severity || '').toLowerCase()] || 99
    const rankB = order[(b.severity || '').toLowerCase()] || 99
    return rankA - rankB
  })

  return {
    labels: raw.map(r => r.severity),
    datasets: [{
      data: raw.map(r => r.count),
      backgroundColor: raw.map(r => getSeverityColor(r.severity)),
      borderWidth: 0
    }]
  }
})

const hasCveData = computed(() => props.data?.top_cves?.length > 0)
const cveChartData = computed(() => {
  if (!hasCveData.value) return { labels: [], datasets: [] }
  const raw = props.data.top_cves
  return {
    labels: raw.map(r => r.cve_id),
    datasets: [{
      label: 'Agentes Afectados',
      data: raw.map(r => r.count),
      backgroundColor: '#8b5cf6',
      borderRadius: 4
    }]
  }
})

const hasAgentData = computed(() => props.data?.top_agents?.length > 0)
const agentChartData = computed(() => {
  if (!hasAgentData.value) return { labels: [], datasets: [] }
  const raw = props.data.top_agents
  return {
    labels: raw.map(r => r.agent_name || 'Desconocido'),
    datasets: [{
      label: 'Vulnerabilidades',
      data: raw.map(r => r.count),
      backgroundColor: '#06b6d4',
      borderRadius: 4
    }]
  }
})

const summaryMetrics = computed(() => props.data?.summary_metrics || null)
</script>

<style scoped>
.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.chart-card {
  background: white;
  border-radius: var(--border-radius, 8px);
  padding: 1.5rem;
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.1));
  border: 1px solid var(--border-color, #e5e7eb);
}

.chart-card h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #374151;
  font-weight: 600;
}

.chart-container {
  height: 250px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-data {
  color: #9ca3af;
  font-size: 0.9rem;
}

.fade-in {
  animation: fadeIn 0.4s ease-out forwards;
  opacity: 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.summary-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: white;
  border-radius: var(--border-radius, 8px);
  padding: 1.5rem;
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.1));
  border: 1px solid var(--border-color, #e5e7eb);
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.metric-title {
  font-size: 0.95rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.metric-value {
  font-size: 2.2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.metric-sub {
  font-size: 0.85rem;
  color: #9ca3af;
}

.text-danger { color: #ef4444; }
.text-warning { color: #f59e0b; }

@media (prefers-color-scheme: dark) {
  .metric-card {
    background: white;
    border-color: #e5e7eb;
  }
  .metric-title { color: #6b7280; }
  .metric-value { color: #6b7280; }
  .metric-sub { color: #6b7280; }
}
</style>
