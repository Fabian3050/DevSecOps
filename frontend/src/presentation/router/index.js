import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import ConfigUser from '../views/ConfigUser.vue'
import ConfigWazuh from '../views/ConfigWazuh.vue'
import Timeline from '../views/Timeline.vue'
import ChangePassword from '../views/ChangePassword.vue'
import NotFound from '../views/NotFound.vue'
import userService from '../../application/services/userService'


const routes = [
  { path: '/login', name: 'Login', component: Login },
  { path: '/', redirect: '/login' },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/timeline', name: 'Timeline', component: Timeline, meta: { requiresAuth: true } },
  { path: '/config-user', name: 'ConfigUser', component: ConfigUser, meta: { requiresAuth: true } },
  { path: '/config-wazuh', name: 'ConfigWazuh', component: ConfigWazuh, meta: { requiresAuth: true } },
  { path: '/change-password', name: 'ChangePassword', component: ChangePassword, meta: { requiresAuth: true } },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from) => {
  const token = localStorage.getItem('token')
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (to.matched.length === 0) {
    return '/login'
  }

  if (requiresAuth && !token) {
    return '/login'
  }

  if (token && to.path === '/login') {
    return '/dashboard'
  }

  // Si hay token, preguntamos SIEMPRE al backend
  if (token) {
    try {
      const userMeRes = await userService.getUserMe()
      const user = userMeRes.data

      // Si sigue con contraseña por defecto, solo puede entrar a change-password
      if (user.is_default_password && to.path !== '/change-password') {
        sessionStorage.setItem(
          'force_password_message',
          'Para continuar, debes cambiar tu contraseña obligatoriamente.'
        )
        return '/change-password'
      }

      return true
    } catch (error) {
      // Si falla getUserMe, token inválido/expirado o backend no responde
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      return '/login'
    }
  }

  return true
})

export default router
