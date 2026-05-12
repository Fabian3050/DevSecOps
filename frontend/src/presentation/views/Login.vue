<template>
  <div class="login-wrapper fade-in">
    <div class="card login-card">
      <div class="login-header">
        <div class="logo-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
        <h1 class="title">Wazuh VulnSync</h1>
        <p class="subtitle">Accede a la plataforma de gestión</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="form-label">Usuario</label>
          <div class="input-icon">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <input type="text" v-model="username" class="form-input" required placeholder="Ingresa tu usuario">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <div class="input-icon">
             <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
             <input :type="showPassword ? 'text' : 'password'" v-model="password" class="form-input" required placeholder="••••••••">
             <button type="button" class="eye-btn" @click="showPassword = !showPassword">
               <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
               <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
             </button>
          </div>
        </div>
        
        <div v-if="error" class="error-message fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          {{ error }}
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          <svg v-if="loading" class="spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
          <span v-else>Iniciar Sesión</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import authService from '../../application/services/authService'
import userService from '../../application/services/userService'

const router = useRouter()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  error.value = ''
  loading.value = true
  
  try {
    const formData = new URLSearchParams()
    formData.append('username', username.value)
    formData.append('password', password.value)
    
    // Login req is form URL encoded for OAuth2
    const res = await authService.login(formData)
    
    // Save token
    localStorage.setItem('token', res.data.access_token)
    localStorage.setItem('username', username.value)

    const userMeRes = await userService.getUserMe()
    const user = userMeRes.data

    // mostrar el valor de is_default_password para verificar
    console.log('Is default password:', user.is_default_password) // Debug log
    if (user.is_default_password) {
      sessionStorage.setItem(
        'force_password_message',
        'Por seguridad, debe cambiar tu contraseña inmediatamente antes de continuar. Todas las demás rutas se están bloqueadas hasta que cambies tu contraseña.'
      )
      router.push('/change-password') // aqui tendrá bloqueado lo de+
    } else {
      router.push('/dashboard')
    }

  } catch (err) {
    if (err.response && err.response.data.detail) {
      error.value = err.response.data.detail
    } else {
      error.value = 'Ha ocurrido un error al conectar con el servidor.'
    }
  } finally {
    loading.value = false
  }
}




</script>

<style scoped>
.login-card {
  width: 100%;
  max-width: 440px;
  padding: 3rem;
  border-top: 4px solid var(--primary);
}

.login-header {
  text-align: center;
  margin-bottom: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-box {
  width: 64px;
  height: 64px;
  background: var(--bg-hover);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  margin-bottom: 1.5rem;
  border: 1px solid var(--border);
  box-shadow: 0 0 20px rgba(135, 197, 62, 0.1);
}

.title {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.subtitle {
  margin-bottom: 0;
}

.input-icon {
  position: relative;
}

.input-icon .icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.input-icon .form-input {
  padding-left: 3rem;
  padding-right: 3rem;
  height: 3rem;
}

.eye-btn {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: var(--transition);
}

.eye-btn:hover {
  color: var(--text-main);
}

.error-message {
  color: var(--danger);
  background-color: var(--danger-bg);
  padding: 1rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  border: 1px solid rgba(239, 68, 68, 0.3);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-block {
  width: 100%;
  height: 3rem;
  margin-top: 1rem;
}
</style>
