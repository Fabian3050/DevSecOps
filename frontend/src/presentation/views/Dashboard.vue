<template>
  <div class="fade-in">
    <!-- Header Area -->
    <div class="header-actions">
      <div>
        <h1 class="title">Panorama de Amenazas</h1>
        <p class="subtitle">Visualiza y gestiona el inventario de vulnerabilidades reportado por Wazuh.</p>
      </div>
      <div>
        <button class="btn btn-primary" @click="syncVulns" :disabled="syncing">
          <svg v-if="syncing" class="spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.5l1.75 1.93"></path></svg>
          {{ syncing ? 'Sincronizando con Wazuh...' : 'Forzar Sincronización' }}
        </button>
      </div>
    </div>

    <!-- Error/Loading states -->
    <div v-if="error" class="alert alert-danger fade-in">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      {{ error }}
    </div>

    <!-- Filter Toggle Bar (minimalista) -->
    <div v-if="!loading && vulns.length > 0" class="filter-toggle-bar">
      <button class="btn-filter-toggle" @click="showFilters = !showFilters">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        <span>{{ showFilters ? 'Ocultar filtros' : 'Filtros avanzados' }}</span>
      </button>
      <button v-if="showFilters" class="btn-clear-filters" @click="clearFilters">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
        <span>Limpiar</span>
      </button>
    </div>

    <!-- Dashboard Filters -->
    <div v-show="showFilters" class="card filter-panel">
      <div class="filter-row">
        <div class="f-group">
          <label>Conexión Wazuh</label>
          <select v-model="selectedConnection" @change="onConnectionChange" class="filter-input">
            <option value="">Todas las conexiones</option>
            <option v-for="conn in connections" :key="conn.id" :value="conn.id">{{ conn.name }}</option>
          </select>
        </div>

        <div class="f-group popover-wrap" v-click-outside="() => (dropdowns.agents = false)">
          <label>Agentes</label>
          <button class="filter-input dd-btn" @click="dropdowns.agents = !dropdowns.agents" :disabled="!agentOptions.length">
            <span>{{ selectedAgents.length ? selectedAgents.length + ' sel.' : 'Todos' }}</span>
            <span>▼</span>
          </button>
          <div v-if="dropdowns.agents" class="dd-panel fade-in">
            <input type="text" v-model="search.agent" placeholder="Buscar agente..." class="dd-search">
            <div class="dd-actions">
              <span @click="selectedAgents = [...agentOptions]">Todos</span>
              <span @click="selectedAgents = []">Limpiar</span>
            </div>
            <div class="dd-list custom-scroll">
              <label v-for="agent in filteredAgents" :key="agent" class="dd-item">
                <input type="checkbox" :value="agent" v-model="selectedAgents"> {{ agent }}
              </label>
            </div>
          </div>
        </div>

        <div class="f-group popover-wrap" v-click-outside="() => (dropdowns.vulns = false)">
          <label>CVE ID</label>
          <button class="filter-input dd-btn" @click="dropdowns.vulns = !dropdowns.vulns" :disabled="!vulnOptions.length">
            <span>{{ selectedVulns.length ? selectedVulns.length + ' sel.' : 'Todas' }}</span>
            <span>▼</span>
          </button>
          <div v-if="dropdowns.vulns" class="dd-panel fade-in">
            <input type="text" v-model="search.vuln" placeholder="Buscar CVE..." class="dd-search">
            <div class="dd-actions">
              <span @click="selectedVulns = [...vulnOptions]">Todas</span>
              <span @click="selectedVulns = []">Limpiar</span>
            </div>
            <div class="dd-list custom-scroll">
              <label v-for="vuln in filteredCVEOptions" :key="vuln" class="dd-item">
                <input type="checkbox" :value="vuln" v-model="selectedVulns"> {{ vuln }}
              </label>
            </div>
          </div>
        </div>

        <div class="f-group popover-wrap" v-click-outside="() => (dropdowns.packages = false)">
          <label>Software Afectado</label>
          <button class="filter-input dd-btn" @click="dropdowns.packages = !dropdowns.packages" :disabled="!packageOptions.length">
            <span>{{ selectedPackages.length ? selectedPackages.length + ' sel.' : 'Todos' }}</span>
            <span>▼</span>
          </button>
          <div v-if="dropdowns.packages" class="dd-panel fade-in">
            <input type="text" v-model="search.package" placeholder="Buscar software..." class="dd-search">
            <div class="dd-actions">
              <span @click="selectedPackages = [...packageOptions]">Todos</span>
              <span @click="selectedPackages = []">Limpiar</span>
            </div>
            <div class="dd-list custom-scroll">
              <label v-for="pkg in filteredPackages" :key="pkg" class="dd-item">
                <input type="checkbox" :value="pkg" v-model="selectedPackages"> {{ pkg }}
              </label>
            </div>
          </div>
        </div>

        <div class="f-group popover-wrap" v-click-outside="() => (dropdowns.severity = false)">
          <label>Severidad</label>
          <button class="filter-input dd-btn" @click="dropdowns.severity = !dropdowns.severity" :disabled="!severityOptions.length">
            <span>{{ selectedSeverities.length ? selectedSeverities.length + ' sel.' : 'Todas' }}</span>
            <span>▼</span>
          </button>
          <div v-if="dropdowns.severity" class="dd-panel fade-in">
            <div class="dd-actions">
              <span @click="selectedSeverities = [...severityOptions]">Todas</span>
              <span @click="selectedSeverities = []">Limpiar</span>
            </div>
            <div class="dd-list custom-scroll">
              <label v-for="sev in severityOptions" :key="sev" class="dd-item">
                <input type="checkbox" :value="sev" v-model="selectedSeverities"> 
                <span :class="'badge-mini ' + getSeverityBadgeClass(sev)">{{ sev }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="f-group">
          <label>Score CVSS (Base)</label>
          <div class="range-inputs">
            <input type="number" v-model.number="scoreMin" min="0" max="10" step="0.1" placeholder="Min" class="filter-input-sm">
            <span>-</span>
            <input type="number" v-model.number="scoreMax" min="0" max="10" step="0.1" placeholder="Max" class="filter-input-sm">
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="empty-state">
      <div class="spinner-box">
        <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
      </div>
      <p>Cargando datos del cluster...</p>
    </div>

    <!-- Table -->
    <div v-else class="card" style="padding: 0;">
      <div class="table-wrapper">
        <div v-if="totalPages > 1" class="pagination-header">
          <span class="pagination-info">
            Mostrando {{ (currentPage - 1) * itemsPerPage + 1 }} - {{ Math.min(currentPage * itemsPerPage, sortedVulns.length) }} de {{ sortedVulns.length }} vulnerabilidades
          </span>
          <div class="pagination-nav">
            <button class="btn-icon-page" :disabled="currentPage === 1" @click="jumpBackward" title="Retroceder 5 páginas" aria-label="Retroceder 5 páginas">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 8 12 13 7"></polyline><polyline points="19 17 14 12 19 7"></polyline></svg>
            </button>
            <button class="btn-icon-page" :disabled="currentPage === 1" @click="prevPage" title="Anterior">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div class="page-numbers">
              <template v-for="(item, idx) in visiblePages" :key="`top-${item}-${idx}`">
                <button
                  v-if="typeof item === 'number'"
                  class="btn-page"
                  :class="{ 'active': currentPage === item }"
                  @click="currentPage = item"
                >
                  {{ item }}
                </button>
                <span v-else class="pagination-ellipsis">...</span>
              </template>
            </div>
            <button class="btn-icon-page" :disabled="currentPage === totalPages" @click="nextPage" title="Siguiente">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button class="btn-icon-page" :disabled="currentPage === totalPages" @click="jumpForward" title="Avanzar 5 páginas" aria-label="Avanzar 5 páginas">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 16 12 11 7"></polyline><polyline points="5 17 10 12 5 7"></polyline></svg>
            </button>
          </div>
        </div>

        <table v-if="vulns.length > 0" class="vuln-table">
          <caption class="visually-hidden">
            Tabla de vulnerabilidades con severidad, CVE, agente, software afectado y linea de tiempo de actividad.
          </caption>
          <thead>
            <tr>
              <th style="width: 10%;" @click="sortBy('connection_name')">
                Conexión Wazuh
                <span v-if="sortKey === 'connection_name'" class="sort-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" :class="sortOrder === 'asc' ? '' : 'rotate-180'">
                    <path d="M7 14l5-5 5 5z"/>
                  </svg>
                </span>
              </th>
              <th style="width: 12%;" @click="sortBy('severity')">
                Severidad
                <span v-if="sortKey === 'severity'" class="sort-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" :class="sortOrder === 'asc' ? '' : 'rotate-180'">
                    <path d="M7 14l5-5 5 5z"/>
                  </svg>
                </span>
              </th>
              <th style="width: 8%;" @click="sortBy('score_base')">
                Score CVSS
                <span v-if="sortKey === 'score_base'" class="sort-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" :class="sortOrder === 'asc' ? '' : 'rotate-180'">
                    <path d="M7 14l5-5 5 5z"/>
                  </svg>
                </span>
              </th>
              <th class="col-cve" @click="sortBy('cve_id')">
                CVE ID
                <span v-if="sortKey === 'cve_id'" class="sort-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" :class="sortOrder === 'asc' ? '' : 'rotate-180'">
                    <path d="M7 14l5-5 5 5z"/>
                  </svg>
                </span>
              </th>
              <th class="col-agent" @click="sortBy('agent_name')">
                Agente
                <span v-if="sortKey === 'agent_name'" class="sort-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" :class="sortOrder === 'asc' ? '' : 'rotate-180'">
                    <path d="M7 14l5-5 5 5z"/>
                  </svg>
                </span>
              </th>
              <th class="col-package" @click="sortBy('package_name')">
                Software Afectado
                <span v-if="sortKey === 'package_name'" class="sort-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" :class="sortOrder === 'asc' ? '' : 'rotate-180'">
                    <path d="M7 14l5-5 5 5z"/>
                  </svg>
                </span>
              </th>
              <th class="col-timeline" @click="sortBy('last_seen')">
                Línea de Tiempo
                <span v-if="sortKey === 'last_seen'" class="sort-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" :class="sortOrder === 'asc' ? '' : 'rotate-180'">
                    <path d="M7 14l5-5 5 5z"/>
                  </svg>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vuln in paginatedVulns" :key="vuln.id">
              <td>{{ vuln.connection_name || '-' }}</td>
              <td>
                <span :class="getSeverityClass(vuln.severity)">
                  {{ (vuln.severity || 'UNKNOWN').toUpperCase() }}
                </span>
              </td>
              <td class="font-medium score-cell">
                {{ vuln.score_base != null ? vuln.score_base.toFixed(1) : 'N/A' }}
              </td>
              <td class="font-medium text-black">{{ vuln.cve_id || 'N/A' }}</td>
              <td>
                <div class="agent-info">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                  <span>{{ vuln.agent_name || vuln.agent_id || 'N/A' }}</span>
                </div>
              </td>
              <td>
                <div class="package-info">
                  <span class="pkg-name">{{ vuln.package_name }}</span>
                  <span class="pkg-version">v{{ vuln.package_version }}</span>
                </div>
              </td>
              <td>
                <div class="visual-timeline">
                  <!-- Punto de Detección -->
                  <div class="timeline-point start">
                    <div class="point-marker">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div class="point-content">
                      <span class="point-title">Detectado</span>
                      <span class="point-time" :title="formatDate(vuln.first_seen)">{{ timeAgo(vuln.first_seen) }}</span>
                    </div>
                  </div>

                  <!-- Línea Conectora -->
                  <div class="timeline-track">
                    <div class="track-progress" :style="{ width: getTimelineProgress(vuln) + '%' }"></div>
                  </div>

                  <!-- Punto de Última Vista -->
                  <div class="timeline-point end">
                    <div class="point-marker" :class="{ 'pulse-radar': isRecentlySeen(vuln.last_seen) }">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div class="point-content">
                      <span class="point-title">Última actividad</span>
                      <span class="point-time" :title="formatDate(vuln.last_seen)">{{ timeAgo(vuln.last_seen) }}</span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Controles de Paginación Abajo -->
        <div v-if="totalPages > 1" class="pagination-controls-bottom">
          <div class="pagination-nav" style="margin-left: auto;">
            <button class="btn-icon-page" :disabled="currentPage === 1" @click="jumpBackward" title="Retroceder 5 páginas" aria-label="Retroceder 5 páginas">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 8 12 13 7"></polyline><polyline points="19 17 14 12 19 7"></polyline></svg>
            </button>
            <button class="btn-icon-page" :disabled="currentPage === 1" @click="prevPage" title="Anterior">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div class="page-numbers">
              <template v-for="(item, idx) in visiblePages" :key="`bottom-${item}-${idx}`">
                <button
                  v-if="typeof item === 'number'"
                  class="btn-page"
                  :class="{ 'active': currentPage === item }"
                  @click="currentPage = item"
                >
                  {{ item }}
                </button>
                <span v-else class="pagination-ellipsis">...</span>
              </template>
            </div>
            <button class="btn-icon-page" :disabled="currentPage === totalPages" @click="nextPage" title="Siguiente">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button class="btn-icon-page" :disabled="currentPage === totalPages" @click="jumpForward" title="Avanzar 5 páginas" aria-label="Avanzar 5 páginas">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 16 12 11 7"></polyline><polyline points="5 17 10 12 5 7"></polyline></svg>
            </button>
          </div>
        </div>

        <div v-if="vulns.length === 0 && !loading" class="empty-state" style="padding: 4rem 2rem;">
          <div class="shield-box">
             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
          </div>
          <p style="color: var(--text-main); font-weight: 500; font-size: 1.1rem; margin-bottom: 0.5rem;">No hay conexiones activas</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">El sistema no reporta conexiones activas actualmente.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue'
import vulnService from '../../application/services/vulnService'
import wazuhService from '../../application/services/wazuhService'

const vulns = ref([])
const loading = ref(true)
const syncing = ref(false)
const error = ref('')
const sortKey = ref('last_seen')
const sortOrder = ref('desc')
const showFilters = ref(false)

// Paginación
const currentPage = ref(1)
const itemsPerPage = 50
const pageJump = 10

// Filter state
const connections = ref([])
const agentOptions = ref([])
const vulnOptions = ref([])
const packageOptions = ref([])
const severityOptions = ref([])

const selectedConnection = ref('')
const selectedAgents = ref([])
const selectedVulns = ref([])
const selectedPackages = ref([])
const selectedSeverities = ref([])
const scoreMin = ref('')
const scoreMax = ref('')

// Dropdown state
const search = reactive({ agent: '', vuln: '', package: '' })
const dropdowns = reactive({ agents: false, vulns: false, packages: false, severity: false })

// Filtered lists for search
const filteredAgents = computed(() =>
  agentOptions.value.filter(agent => agent.toLowerCase().includes(search.agent.toLowerCase()))
)

const filteredCVEOptions = computed(() =>
  vulnOptions.value.filter(vuln => vuln.toLowerCase().includes(search.vuln.toLowerCase()))
)

const filteredPackages = computed(() =>
  packageOptions.value.filter(pkg => pkg.toLowerCase().includes(search.package.toLowerCase()))
)

const getSeverityLevel = (s) => {
  if (!s) return 0
  const severity = s.toLowerCase()
  if (severity === 'critical' || severity === 'critica') return 4
  if (severity === 'high' || severity === 'alta') return 3
  if (severity === 'medium' || severity === 'media') return 2
  return 1 // low or unknown
}

const compareValues = (a, b, key) => {
  let aVal = a[key]
  let bVal = b[key]

  if (key === 'first_seen' || key === 'last_seen') {
    aVal = aVal ? new Date(aVal).getTime() : 0
    bVal = bVal ? new Date(bVal).getTime() : 0
    return aVal - bVal
  } else if (key === 'severity') {
    aVal = getSeverityLevel(aVal)
    bVal = getSeverityLevel(bVal)
    return aVal - bVal
  } else {
    aVal = aVal || ''
    bVal = bVal || ''
    if (typeof aVal === 'string') {
      return aVal.toLowerCase().localeCompare(bVal.toLowerCase())
    }
    return aVal - bVal
  }
}


const updateFilterOptions = () => {
  const agents = new Set()
  const vulnIds = new Set()
  const packages = new Set()
  const severities = new Set()

  vulns.value.forEach(vuln => {
    if (vuln.agent_name) agents.add(vuln.agent_name)
    if (vuln.cve_id) vulnIds.add(vuln.cve_id)
    if (vuln.package_name) packages.add(vuln.package_name)
    if (vuln.severity) severities.add(vuln.severity.toUpperCase())
  })

  agentOptions.value = Array.from(agents).sort()
  vulnOptions.value = Array.from(vulnIds).sort()
  packageOptions.value = Array.from(packages).sort()
  severityOptions.value = Array.from(severities).sort((a, b) => {
    const levelA = getSeverityLevel(a.toLowerCase())
    const levelB = getSeverityLevel(b.toLowerCase())
    return levelB - levelA
  })
}

const matchesConnection = (vuln) => 
  !selectedConnection.value || vuln.connection_id === selectedConnection.value

const matchesAgent = (vuln) => 
  selectedAgents.value.length === 0 || selectedAgents.value.includes(vuln.agent_name)

const matchesVuln = (vuln) => 
  selectedVulns.value.length === 0 || selectedVulns.value.includes(vuln.cve_id)

const matchesPackage = (vuln) => 
  selectedPackages.value.length === 0 || selectedPackages.value.includes(vuln.package_name)

const matchesSeverity = (vuln) => {
  if (selectedSeverities.value.length === 0) return true
  const vulnSeverity = (vuln.severity || 'UNKNOWN').toUpperCase()
  return selectedSeverities.value.includes(vulnSeverity)
}

const matchesScore = (vuln) => {
  if (scoreMin.value === '' && scoreMax.value === '') return true
  
  const score = vuln.score_base
  if (score === null || score === undefined) return false
  
  const minOk = scoreMin.value === '' || score >= scoreMin.value
  const maxOk = scoreMax.value === '' || score <= scoreMax.value
  
  return minOk && maxOk
}

const filteredVulns = computed(() => {
  return vulns.value.filter(vuln => {
    return matchesConnection(vuln) &&
           matchesAgent(vuln) &&
           matchesVuln(vuln) &&
           matchesPackage(vuln) &&
           matchesSeverity(vuln) &&
           matchesScore(vuln)
  })
})

const sortedVulns = computed(() => {
  if (!sortKey.value) return filteredVulns.value
  return [...filteredVulns.value].sort((a, b) => {
    const cmp = compareValues(a, b, sortKey.value)
    return sortOrder.value === 'asc' ? cmp : -cmp
  })
})

// === LOGICA DE PAGINACION ===
const totalPages = computed(() => {
  return Math.ceil(sortedVulns.value.length / itemsPerPage)
})

const paginatedVulns = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return sortedVulns.value.slice(start, end)
})

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value
  const maxNumericButtons = 7

  if (total <= maxNumericButtons) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  const middleSlots = maxNumericButtons - 2 // Reservamos 1 y ultima pagina.
  pages.push(1)

  let start = Math.max(2, current - Math.floor(middleSlots / 2))
  let end = start + middleSlots - 1

  if (end > total - 1) {
    end = total - 1
    start = end - middleSlots + 1
  }

  if (start > 2) pages.push('left-ellipsis')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('right-ellipsis')

  pages.push(total)
  return pages
})

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const jumpBackward = () => {
  currentPage.value = Math.max(1, currentPage.value - pageJump)
}

const jumpForward = () => {
  currentPage.value = Math.min(totalPages.value, currentPage.value + pageJump)
}

// Al filtrar o ordenar volvemos a la pagina 1
watch(selectedConnection, () => { currentPage.value = 1 })
watch(selectedAgents, () => { currentPage.value = 1 })
watch(selectedVulns, () => { currentPage.value = 1 })
watch(selectedPackages, () => { currentPage.value = 1 })
watch(selectedSeverities, () => { currentPage.value = 1 })
watch(scoreMin, () => { currentPage.value = 1 })
watch(scoreMax, () => { currentPage.value = 1 })
watch(sortKey, () => { currentPage.value = 1 })
watch(sortOrder, () => { currentPage.value = 1 })


const sortBy = (key) => {
  if (sortKey.value !== key) {
    sortKey.value = key
    sortOrder.value = 'asc'
  } else if (sortOrder.value === 'asc') {
    sortOrder.value = 'desc'
  } else {
    sortKey.value = ''
    sortOrder.value = ''
  }
}

const onConnectionChange = () => {
  // When connection changes, clear dependent filters
  selectedAgents.value = []
  selectedVulns.value = []
  selectedPackages.value = []
  selectedSeverities.value = []
  scoreMin.value = ''
  scoreMax.value = ''
}

const clearFilters = () => {
  selectedConnection.value = ''
  selectedAgents.value = []
  selectedVulns.value = []
  selectedPackages.value = []
  selectedSeverities.value = []
  scoreMin.value = ''
  scoreMax.value = ''
}

const fetchVulns = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await vulnService.getVulns()
    if (res.data && res.data.length > 0) {
      vulns.value = res.data
      updateFilterOptions()
    } else {
      vulns.value = []
    }
  } catch (err) {
    console.error('Error fetching vulns:', err)
  } finally {
    loading.value = false
  }
}

const fetchConnections = async () => {
  try {
    const res = await wazuhService.getConnections()
    connections.value = res?.data || []
  } catch (err) {
    console.error('Error fetching connections:', err)
    connections.value = []
  }
}

const syncVulns = async () => {
  syncing.value = true
  error.value = ''
  try {
    await vulnService.syncVulns()
    await fetchVulns()
  } catch (err) {
    error.value = 'Error durante la sincronización con Wazuh. Verifica tu configuración en Admin Wazuh.'
  } finally {
    syncing.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const d = new Date(dateString)
  return d.toLocaleDateString('es-ES', { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  })
}

const isNew = (firstSeenDate) => {
  if (!firstSeenDate) return false
  const now = new Date()
  const firstSeen = new Date(firstSeenDate)
  const diffTime = Math.abs(now - firstSeen)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= 1
}

const getSeverityClass = (severity) => {
  if (!severity) return 'badge badge-low'
  const s = severity.toLowerCase()
  if (['critical', 'high', 'alta', 'critica'].includes(s)) return 'badge badge-critical'
  if (['medium', 'media'].includes(s)) return 'badge badge-medium'
  return 'badge badge-low'
}

const getSeverityBadgeClass = (severity) => {
  const s = severity.toLowerCase()
  if (['critical', 'critica'].includes(s)) return 'badge-critical'
  if (['high', 'alta'].includes(s)) return 'badge-high'
  if (['medium', 'media'].includes(s)) return 'badge-medium'
  return 'badge-low'
}

const isRecentlySeen = (lastSeenDate) => {
  if (!lastSeenDate) return false
  const now = new Date()
  const lastSeen = new Date(lastSeenDate)
  const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60))
  return diffMinutes <= 60 // Visto en la última hora
}

const getTimelineProgress = (vuln) => {
  if (!vuln.first_seen || !vuln.last_seen) return 0
  const first = new Date(vuln.first_seen).getTime()
  const last = new Date(vuln.last_seen).getTime()
  const now = new Date().getTime()
  
  if (last === first) return 0
  
  const totalDuration = now - first
  const activeDuration = last - first
  
  // Porcentaje de tiempo que ha estado activa respecto a su edad total
  return Math.min(100, Math.max(5, (activeDuration / totalDuration) * 100))
}

const timeAgo = (date) => {
  if (!date) return 'N/A'
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  
  let interval = seconds / 31536000
  if (interval > 1) return `Hace ${Math.floor(interval)} años`
  
  interval = seconds / 2592000
  if (interval > 1) return `Hace ${Math.floor(interval)} meses`
  
  interval = seconds / 86400
  if (interval > 1) return `Hace ${Math.floor(interval)} días`
  
  interval = seconds / 3600
  if (interval > 1) return `Hace ${Math.floor(interval)} horas`
  
  interval = seconds / 60
  if (interval > 1) return `Hace ${Math.floor(interval)} min`
  
  return 'Justo ahora'
}

onMounted(() => {
  fetchConnections()
  fetchVulns()
})
</script>

<style scoped>
.visual-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
  min-width: 180px;
}

.timeline-point {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.point-marker {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.start .point-marker {
  background-color: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.end .point-marker {
  background-color: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.point-content {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.point-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  color: #9ca3af;
  font-weight: 600;
}

.point-time {
  font-size: 0.85rem;
  color: var(--text-main);
  font-weight: 500;
}

.timeline-track {
  background-color: #f3f4f6;
  border-radius: 2px;
  margin-left: 10px;
  width: 2px; /* Vertical track look */
  height: 12px;
  position: relative;
}

.track-progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background-color: #3b82f6;
  border-radius: 2px;
}

/* Radar pulse for active items */
.pulse-radar {
  position: relative;
}

.pulse-radar::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: #3b82f6;
  opacity: 0.4;
  animation: radar-pulse 2s infinite;
}

@keyframes radar-pulse {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.5); opacity: 0; }
}
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

th {
  cursor: pointer;
}

.sort-indicator {
  margin-left: 0.5rem;
  display: inline-block;
  transition: transform 0.2s ease;
}

.vuln-table .col-severity { width: 12%; }
.vuln-table .col-cve { width: 15%; }
.vuln-table .col-agent { width: 15%; }
.vuln-table .col-package { width: 28%; }
.vuln-table .col-timeline { width: 20%; }

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.rotate-180 {
  transform: rotate(180deg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}

.spinner-box {
  margin-bottom: 1rem;
}

.shield-box {
  width: 80px;
  height: 80px;
  background-color: var(--success-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  border: 4px solid rgba(16, 185, 129, 0.1);
}

.font-medium {
  font-weight: 500;
}
.text-black {
  color: var(--text-main);
  font-weight: 400;
}

.agent-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
}

.package-info {
  display: flex;
  flex-direction: column;
}

.pkg-name {
  color: var(--text-main);
  font-weight: 500;
}

.pkg-version {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.timeline-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.timeline-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.timeline-label {
  color: #6b7280;
}

.pulse-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary);
  margin-right: 0.35rem;
  box-shadow: 0 0 0 0 rgba(135, 197, 62, 0.7);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(135, 197, 62, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(135, 197, 62, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(135, 197, 62, 0); }
}

.alert {
  padding: 1rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}
.alert-danger {
  color: var(--danger);
  background-color: var(--danger-bg);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* PAGINACION */
.pagination-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background-color: var(--bg-panel);
}

.pagination-info {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}

.pagination-controls-bottom {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  background-color: var(--bg-card);
}

.pagination-nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.page-numbers {
  display: flex;
  gap: 0.2rem;
}

.btn-icon-page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-main);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon-page:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--text-muted);
}

.btn-icon-page:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: transparent;
}

.btn-page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 0.25rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-page:hover:not(.active) {
  background-color: var(--bg-hover);
  color: var(--text-main);
}

.btn-page.active {
  background-color: var(--primary);
  color: #000;
}

.filter-toggle-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  margin-bottom: 0.5rem;
}

.btn-filter-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-filter-toggle:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-muted);
  color: var(--text-main);
}

.btn-filter-toggle svg {
  width: 16px;
  height: 16px;
}

.btn-clear-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-clear-filters:hover {
  background-color: var(--bg-hover);
  border-color: var(--danger);
  color: var(--danger);
}

.btn-clear-filters svg {
  width: 16px;
  height: 16px;
}

.pagination-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

/* FILTER PANEL STYLES */
.filter-panel { 
  padding: 0; 
  margin-bottom: 1.5rem; 
  overflow: visible; 
}

.filter-row { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); 
  align-items: center; 
}

.f-group { 
  display: flex; 
  flex-direction: column; 
  padding: 1rem 1.2rem; 
  border-right: 1px solid var(--border); 
}

.f-group:last-child { 
  border-right: none; 
}

.f-group label { 
  font-size: 0.7rem; 
  font-weight: 700; 
  color: var(--text-muted); 
  text-transform: uppercase; 
  margin-bottom: 0.5rem; 
}

.filter-input, .dd-btn { 
  width: 100%; 
  padding: 0.55rem 0.8rem; 
  border: 1px solid var(--border); 
  background: var(--bg-dark); 
  border-radius: var(--radius-sm); 
  color: var(--text-main); 
  cursor: pointer; 
  font-size: 0.85rem;
}

.filter-input:disabled, .dd-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.filter-input-sm {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  background: var(--bg-dark);
  border-radius: var(--radius-sm);
  color: var(--text-main);
  font-size: 0.8rem;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.range-inputs span {
  color: var(--text-muted);
  font-weight: 600;
}

.popover-wrap { 
  position: relative; 
}

.dd-btn { 
  display: flex; 
  justify-content: space-between; 
}

.dd-panel { 
  position: absolute; 
  top: calc(100% + 6px); 
  left: 0; 
  width: 280px; 
  border: 1px solid var(--border); 
  border-radius: var(--radius-md); 
  background: var(--bg-panel); 
  z-index: 20; 
  overflow: hidden; 
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dd-search { 
  width: 100%; 
  border: none; 
  border-bottom: 1px solid var(--border); 
  padding: 0.65rem 0.9rem; 
  background: var(--bg-hover); 
  color: var(--text-main); 
}

.dd-actions { 
  display: flex; 
  justify-content: space-between; 
  padding: 0.5rem 0.9rem; 
  border-bottom: 1px solid var(--border); 
  font-size: 0.75rem; 
  color: var(--primary); 
}

.dd-actions span { 
  cursor: pointer; 
}

.dd-actions span:hover {
  text-decoration: underline;
}

.dd-list { 
  max-height: 220px; 
  overflow-y: auto; 
}

.dd-item { 
  display: flex; 
  gap: 0.6rem; 
  padding: 0.5rem 0.9rem; 
  font-size: 0.82rem; 
  cursor: pointer;
  align-items: center;
}

.dd-item:hover {
  background: var(--bg-hover);
}

.badge-mini {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-critical {
  background: rgba(220, 38, 38, 0.15);
  color: #dc2626;
}

.badge-high {
  background: rgba(234, 88, 12, 0.15);
  color: #ea580c;
}

.badge-medium {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.badge-low {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

@media (max-width: 1400px) {
  .filter-row { 
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
  }
}

@media (max-width: 1100px) {
  .filter-row { 
    grid-template-columns: 1fr 1fr; 
  }
  .f-group { 
    border-right: none; 
    border-bottom: 1px solid var(--border); 
  }
}
</style>
