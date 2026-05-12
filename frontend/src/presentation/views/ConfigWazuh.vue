<template>
  <div class="fade-in">
    <div class="header-actions">
      <div>
        <h1 class="title">Configuración Wazuh</h1>
        <p class="subtitle" style="margin-bottom:0">Administra los parámetros de conexión y las conexiones al clúster.</p>
      </div>
      <div>
        <button class="btn btn-primary" @click="openAddModal">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Añadir nueva conexión
        </button>
      </div>
    </div>

    <div class="config-grid mt-4">

      <div class="card" style="padding: 0;">
        <div class="table-wrapper">
          <div v-if="loadingConns" class="empty-state" style="padding: 3rem;">
            <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            <p>Cargando conexiones...</p>
          </div>
          <table v-else-if="connections.length > 0" class="connection-table">
            <caption class="visually-hidden">
              Tabla de conexiones Wazuh con estado, resultado del ultimo test y acciones disponibles.
            </caption>
            <thead>
              <tr>
                <th class="col-id">ID</th>
                <th class="col-name">Nombre</th>
                <th class="col-indexer">Indexer URL</th>
                <th class="col-status">Estado</th>
                <th class="col-last-test">Último Test</th>
                <th class="col-test-ok">Test OK?</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="conn in connections" :key="conn.id">
                <td>{{ conn.id }}</td>
                <td class="font-medium text-black">{{ conn.name }}</td>
                <td>{{ conn.indexer_url }}</td>
                <td>
                  <span v-if="conn.is_active" class="badge badge-success">ACTIVO</span>
                  <span v-else class="badge badge-low">INACTIVO</span>
                </td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">{{ formatDate(conn.last_tested_at) }}</td>
                <td>
                  <span v-if="conn.tested && conn.last_test_ok" class="badge badge-success">OK</span>
                  <span v-else-if="conn.tested && !conn.last_test_ok" class="badge badge-danger">ERROR</span>
                  <span v-else class="badge" style="color:var(--text-muted)">N/D</span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button class="btn-icon" @click="handleTestConnection(conn.id)" title="Testear conexión">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                  </button>
                  <button class="btn-icon" @click="openEditModal(conn)" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </button>
                  <button class="btn-icon btn-icon-danger" @click="deleteConn(conn.id)" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state" style="padding: 4rem 2rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
            <p style="color: var(--text-main); font-weight: 500; font-size: 1.1rem; margin-bottom: 0.5rem;">Cero conexiones</p>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Agrega una conexión para visualizarla aquí.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Connection Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content card fade-in">
        <div class="card-header" style="margin-bottom: 1.5rem; padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <h2 class="title" style="font-size: 1.25rem;">{{ isEditing ? 'Editar conexión' : 'Añadir nueva conexión' }}</h2>
          <button type="button" class="btn-close" @click="closeModal">&times;</button>
        </div>
        
        <form @submit.prevent="submitConnection">
          <div class="form-group">
            <label class="form-label">Nombre</label>
            <div class="input-icon">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <input type="text" v-model="newConn.name" class="form-input" required placeholder="Mi conexión">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">URL del Indexer</label>
            <div class="input-icon">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              <input type="url" v-model="newConn.indexer_url" class="form-input" required placeholder="https://indexer-url:9200">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Usuario Wazuh</label>
            <div class="input-icon">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <input type="text" v-model="newConn.wazuh_user" class="form-input" required placeholder="admin">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña Wazuh <span v-if="isEditing" style="font-weight:400; color:var(--text-muted);"></span></label>
            <div class="input-icon">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <input :type="showPassword ? 'text' : 'password'" v-model="newConn.wazuh_password" class="form-input" :required="!isEditing" placeholder="••••••••">
              <button type="button" class="eye-btn" @click="showPassword = !showPassword">
                <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
              </button>
            </div>
          </div>

          <div v-if="newConnError" class="alert alert-danger fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {{ newConnError }}
          </div>

          <div class="modal-actions" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
            <button type="button" class="btn btn-outline" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="creatingConn">
              <svg v-if="creatingConn" class="spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
              <span v-else>{{ isEditing ? 'Guardar Cambios' : 'Guardar Conexión' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import wazuhService from '../../application/services/wazuhService'
import Swal from 'sweetalert2'

const connections = ref([])
const loadingConns = ref(false)
const connsError = ref('')

const showAddModal = ref(false)
const isEditing = ref(false)
const creatingConn = ref(false)
const showPassword = ref(false)
const newConnError = ref('')
const newConn = ref({ id: null, name: '', indexer_url: '', wazuh_user: '', wazuh_password: '' })


const fetchConnections = async () => {
  loadingConns.value = true
  connsError.value = ''
  try {
    const res = await wazuhService.getConnections()
    if (Array.isArray(res.data)) connections.value = res.data
    else if (res.data && Array.isArray(res.data.data)) connections.value = res.data.data
    else connections.value = res.data
  } catch (err) {
    connsError.value = 'No se pudieron cargar las conexiones.'
  } finally {
    loadingConns.value = false
  }
}

const openAddModal = () => {
  isEditing.value = false
  newConn.value = { id: null, name: '', indexer_url: '', wazuh_user: '', wazuh_password: '' }
  showAddModal.value = true
}

const openEditModal = (conn) => {
  isEditing.value = true
  newConn.value = { 
    id: conn.id, 
    name: conn.name, 
    indexer_url: conn.indexer_url, 
    wazuh_user: conn.wazuh_user, 
    wazuh_password: '' 
  }
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  newConnError.value = ''
  newConn.value = { id: null, name: '', indexer_url: '', wazuh_user: '', wazuh_password: '' }
  isEditing.value = false
}

const submitConnection = async () => {
  creatingConn.value = true
  newConnError.value = ''

  try {
    const payload = {
      name: newConn.value.name.trim(),
      indexer_url: newConn.value.indexer_url.trim(),
      wazuh_user: newConn.value.wazuh_user.trim(),
      wazuh_password: newConn.value.wazuh_password.trim()
    }

    const isInvalid = newConn.value.name === '' || 
                     newConn.value.indexer_url === '' || 
                     newConn.value.wazuh_user === '' || 
                     (!isEditing.value && newConn.value.wazuh_password === '')

    if (isInvalid) {
      newConnError.value = 'Por favor, completa todos los campos requeridos.'
      creatingConn.value = false
      return
    }

    if (isEditing.value) {
      await wazuhService.editConnection(newConn.value.id, payload)
    } else {
      await wazuhService.createConnection(payload)
    }
    closeModal()
    await fetchConnections()
  } catch (err) {
    newConnError.value = err.response?.data?.detail || 'Error al guardar la conexión. Verifica que los datos sean correctos.'
  } finally {
    creatingConn.value = false
  }
}

const deleteConn = async (id) => {
  const result = await Swal.fire({
    title: '¿Eliminar conexión?',
    text: 'Esta acción no se puede deshacer. Eliminar la conexión elimina también a todas las vulnerabilidades asociadas.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--danger)',
    cancelButtonColor: 'var(--border)',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    background: 'var(--bg-panel)',
    color: 'var(--text-main)'
  });

  if(result.isConfirmed) {
    try {
      await wazuhService.deleteConnection(id)
      fetchConnections()
      Swal.fire({
        title: '¡Eliminado!',
        text: 'La conexión ha sido eliminada.',
        icon: 'success',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        confirmButtonColor: 'var(--primary)'
      })
    } catch (err) {
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.detail || 'Error al eliminar la conexión.',
        icon: 'error',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        confirmButtonColor: 'var(--primary)'
      })
    }
  }
}

const handleTestConnection = async (connId) => {
  try {
    const response = await wazuhService.testConnection(connId)

    console.log('TEST RESPONSE:', response)
    console.log('TEST RESPONSE DATA:', response.data)

    if (response.data && response.data.ok) {
      Swal.fire({
        title: 'Conexión exitosa',
        text: 'La prueba de conexión se realizó correctamente.',
        icon: 'success',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        confirmButtonColor: 'var(--primary)'
      })
    } else {
      Swal.fire({
        title: 'Conexión Fallida',
        text: 'No se pudo conectar al clúster de Wazuh.',
        icon: 'warning',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        confirmButtonColor: 'var(--warning, #f59e0b)'
      })
    }

    await fetchConnections()
  } catch (error) {
    console.error('Error probando conexión:', error)
    Swal.fire({
      title: 'Error',
      text: error.response?.data?.detail || 'Ocurrió un error al intentar probar la conexión.',
      icon: 'error',
      background: 'var(--bg-panel)',
      color: 'var(--text-main)',
      confirmButtonColor: 'var(--primary)'
    })
    await fetchConnections()
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Nunca'
  const d = new Date(dateStr)
  return d.toLocaleString()
}

onMounted(() => {
  fetchConnections()
})
</script>

<style scoped>
.header-actions { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.config-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; align-items: start; margin-top: 1rem; }
.card-header { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
.icon-box { width: 48px; height: 48px; background-color: var(--primary-glow); color: var(--primary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.input-icon { position: relative; }
.input-icon .icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.input-icon .form-input { padding-left: 3rem; padding-right: 3rem; }
.eye-btn { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: var(--transition); }
.eye-btn:hover { color: var(--text-main); }
.alert { padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
.alert-danger { color: var(--danger); background-color: var(--danger-bg); border: 1px solid rgba(239, 68, 68, 0.3); }
.alert-success { color: var(--success); background-color: var(--success-bg); border: 1px solid rgba(16, 185, 129, 0.3); }
.font-medium { font-weight: 500; }
.text-black { color: var(--text-main); font-weight: 400; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3rem; color: var(--text-muted); }
.btn-success { background-color: var(--success); color: white; display: flex; align-items: center; gap: 0.5rem; border-color: var(--success); }
.btn-success:hover { background-color: #0c9f6e; }
.btn-outline { background-color: transparent; border: 1px solid var(--border); color: var(--text-main); padding: 0.5rem 1rem; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.9rem; transition: all 0.2s ease; }
.btn-outline:hover { background-color: var(--bg-hover); border-color: var(--text-muted); }
.badge-success { background-color: var(--success-bg); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
.badge-danger { background-color: var(--danger-bg); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;}
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(2px); }
.modal-content { width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; position: relative; padding: 2rem; }
.btn-close { background: none; border: none; font-size: 2rem; line-height: 1; cursor: pointer; color: var(--text-muted); transition: color 0.2s; }
.btn-close:hover { color: var(--text-main); }
.btn-icon { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; }
.btn-icon:hover { color: var(--primary); background-color: var(--primary-glow); }
.btn-icon-danger:hover { color: var(--danger); background-color: var(--danger-bg); }

.connection-table .col-id { width: 5%; }
.connection-table .col-name { width: 20%; }
.connection-table .col-indexer { width: 25%; }
.connection-table .col-status { width: 10%; }
.connection-table .col-last-test { width: 15%; }
.connection-table .col-test-ok { width: 10%; }
.connection-table .col-actions { width: 15%; }

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
</style>
