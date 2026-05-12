<template>
  <div class="fade-in">
    <div class="header-actions">
      <div>
        <h1 class="title">Administradores</h1>
        <p class="subtitle" style="margin-bottom:0">Visualiza y registra nuevos usuarios con acceso a la plataforma.</p>
      </div>
      <div>
        <button class="btn btn-primary" @click="openAddModal">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Añadir nuevo administrador
        </button>
      </div>
    </div>

    <div class="config-grid mt-4">

      <div class="card" style="padding: 0;">
        <div class="table-wrapper">
          <div v-if="loadingUsers" class="empty-state" style="padding: 3rem;">
            <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            <p>Cargando administradores...</p>
          </div>
          <table v-else-if="users.length > 0" aria-label="Lista de usuarios administradores">
            <thead>
              <tr>
                <th style="width:20%;">ID</th>
                <th style="width:70%;">Nombre de usuario</th>
                <th style="width:10%;"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.id }}</td>
                <td class="font-medium text-black">{{ user.username }}</td>
                <td style="text-align: right;">
                  <button class="btn-icon btn-icon-danger" @click="deleteUserAdmin(user.id)" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-state" style="padding: 4rem 2rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            <p style="color: var(--text-main); font-weight: 500; font-size: 1.1rem; margin-bottom: 0.5rem;">Cero administradores</p>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Agrega un administrador para visualizarlo aquí.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content card fade-in">
        <div class="card-header" style="margin-bottom: 1.5rem; padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <h2 class="title" style="font-size: 1.25rem;">Añadir nuevo administrador</h2>
          <button type="button" class="btn-close" @click="closeModal">&times;</button>
        </div>
        
        <form @submit.prevent="handleAddUser">
          <div class="form-group">
            <label class="form-label">Nombre de usuario</label>
            <div class="input-icon">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <input type="text" v-model="newUser.username" class="form-input" required placeholder="Ej: analista_soc">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Contraseña inicial</label>
            <div class="input-icon">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <input type="password" v-model="newUser.password" class="form-input" required placeholder="••••••••">
            </div>
          </div>

          <div v-if="error" class="alert alert-danger fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            {{ error }}
          </div>
          
          <div class="modal-actions" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
            <button type="button" class="btn btn-outline" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <svg v-if="loading" class="spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
              <span v-else>Crear Usuario</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import userService from '../../application/services/userService'
import Swal from 'sweetalert2'

const users = ref([])
const loadingUsers = ref(false)
const usersError = ref('')

const showAddModal = ref(false)
const newUser = ref({ username: '', password: '' })
const error = ref('')
const loading = ref(false)

const fetchUsers = async () => {
  loadingUsers.value = true
  usersError.value = ''
  try {
    const res = await userService.getUsers()
    if (Array.isArray(res.data)) users.value = res.data
    else if (res.data && Array.isArray(res.data.data)) users.value = res.data.data
    else users.value = res.data
  } catch (err) {
    usersError.value = 'No se pudieron cargar los administradores.'
  } finally {
    loadingUsers.value = false
  }
}

const openAddModal = () => {
  newUser.value = { username: '', password: '' }
  error.value = ''
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  error.value = ''
  newUser.value = { username: '', password: '' }
}

const handleAddUser = async () => {
  error.value = ''
  loading.value = true
  
  if(!newUser.value.username || !newUser.value.password) {
    error.value = 'El nombre de usuario y la contraseña no pueden estar vacíos.'
    loading.value = false
    return
  }
  
  try {
    await userService.createUser({
      username: newUser.value.username.trim(),
      password: newUser.value.password.trim()
    })

    closeModal()
    fetchUsers()
  } catch (err) {
    if (err.response && err.response.data.detail) {
      error.value = err.response.data.detail
    } else {
      error.value = 'Error al crear el usuario. Asegúrate de que no exista.'
    }
  } finally {
    loading.value = false
  }
}

const deleteUserAdmin = async (id) => {
  const result = await Swal.fire({
    title: '¿Eliminar administrador?',
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--danger)',
    cancelButtonColor: 'var(--border)',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    background: 'var(--bg-panel)',
    color: 'var(--text-main)'
  })

  if(result.isConfirmed) {
    try {
      await userService.deleteUser(id)
      fetchUsers()
      Swal.fire({
        title: '¡Eliminado!',
        text: 'El administrador ha sido eliminado.',
        icon: 'success',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        confirmButtonColor: 'var(--primary)'
      })
    } catch (err) {
      Swal.fire({
        title: 'Error',
        text: err.response?.data?.detail || 'Error al eliminar el administrador.',
        icon: 'error',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        confirmButtonColor: 'var(--primary)'
      })
    }
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.header-actions { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.config-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; align-items: start; margin-top: 1rem; }
.card-header { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
.icon-box { width: 48px; height: 48px; background-color: var(--primary-glow); color: var(--primary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.input-icon { position: relative; }
.input-icon .icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.input-icon .form-input { padding-left: 3rem; }
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
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(2px); }
.modal-content { width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; position: relative; padding: 2rem; }
.btn-close { background: none; border: none; font-size: 2rem; line-height: 1; cursor: pointer; color: var(--text-muted); transition: color 0.2s; }
.btn-close:hover { color: var(--text-main); }
.btn-icon { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; }
.btn-icon:hover { color: var(--primary); background-color: var(--primary-glow); }
.btn-icon-danger:hover { color: var(--danger); background-color: var(--danger-bg); }
</style>
