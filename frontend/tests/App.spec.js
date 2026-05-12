import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import App from '@/App.vue'
import Swal from 'sweetalert2'

// Mock sweetalert2
vi.mock('sweetalert2', () => ({
    default: {
        fire: vi.fn()
    }
}))

// Mock router
const mockPush = vi.fn()
const mockRoute = reactive({
    name: 'Dashboard',
    path: '/dashboard'
})

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  }),
  useRoute: () => mockRoute
}))

describe('App.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        mockRoute.name = 'Dashboard'
        mockRoute.path = '/dashboard'
    })

    it('renders auth layout when on Login route', async () => {
        mockRoute.name = 'Login'
        mockRoute.path = '/login'

        // El app layout no debiera estar
        const wrapper = mount(App, {
            global: {
                stubs: ['router-view', 'router-link']
            }
        })

        expect(wrapper.find('.auth-layout').exists()).toBe(true)
        expect(wrapper.find('.app-layout').exists()).toBe(false)
    })

    it('renders app layout and currentRouteName when authenticated', () => {
        mockRoute.name = 'ConfigUser'
        mockRoute.path = '/config-user'

        const wrapper = mount(App, {
            global: {
                stubs: ['router-view', 'router-link']
            }
        })

        expect(wrapper.find('.app-layout').exists()).toBe(true)
        expect(wrapper.find('.header-title').text()).toBe('Gestión de Usuarios')
    })

    it('blocks navigation and shows alert if must_change_password is true', async () => {
        localStorage.setItem('must_change_password', 'true')

        const wrapper = mount(App, {
            global: {
                stubs: ['router-view', 'router-link']
            }
        })

        // Simulate clicking dashboard in sidebar
        const dashboardLink = wrapper.findAll('.nav-item').find(el => el.text().includes('Dashboard'))
        await dashboardLink.trigger('click')

        expect(Swal.fire).toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('allows navigation if must_change_password is false or not set', async () => {
        const wrapper = mount(App, {
            global: {
                stubs: ['router-view', 'router-link']
            }
        })

        const dashboardLink = wrapper.findAll('.nav-item').find(el => el.text().includes('Dashboard'))
        await dashboardLink.trigger('click')

        expect(Swal.fire).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('logs out and clears localStorage', async () => {
        localStorage.setItem('token', 'fake-token')
        localStorage.setItem('username', 'admin')

        const wrapper = mount(App, {
            global: {
                stubs: ['router-view', 'router-link']
            }
        })

        const logoutBtn = wrapper.find('.logout-btn')
        await logoutBtn.trigger('click')

        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('username')).toBeNull()
        expect(mockPush).toHaveBeenCalledWith('/login')
    })
    it('navigates to timeline when clicking timeline link', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    const timelineLink = wrapper.findAll('.nav-item').find(el =>
      el.text().includes('Línea de Tiempo')
    )

    await timelineLink.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/timeline')
  })

  it('navigates to config-user when clicking administrar usuarios', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    const configUserLink = wrapper.findAll('.nav-item').find(el =>
      el.text().includes('Administrar usuarios')
    )

    await configUserLink.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/config-user')
  })

  it('navigates to config-wazuh when clicking wazuh config link', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    const configWazuhLink = wrapper.findAll('.nav-item').find(el =>
      el.text().includes('Administar conexiones Wazuh')
    )

    await configWazuhLink.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/config-wazuh')
  })

  it('renders change-password router-link in sidebar footer', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-view': true,
          'router-link': {
            template: '<a class="change-password-link"><slot /></a>'
          }
        }
      }
    })

    expect(wrapper.find('.change-password-link').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cambiar Contraseña')
  })
    
  it('updates username when route changes and user is authenticated', async () => {
    localStorage.setItem('token', 'fake-token')
    localStorage.setItem('username', 'sebastian')

    const wrapper = mount(App, {
        global: {
        stubs: ['router-view', 'router-link']
        }
    })

    expect(wrapper.text()).toContain('sebastian')

    localStorage.setItem('username', 'clau')
    mockRoute.name = 'Timeline'
    mockRoute.path = '/timeline'

    await nextTick()

    expect(wrapper.text()).toContain('clau')
})

  it('shows route title for Timeline', () => {
    mockRoute.name = 'Timeline'
    mockRoute.path = '/timeline'

    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    expect(wrapper.find('.header-title').text()).toBe('Linea de tiempo')
  })

  it('shows route title for ConfigWazuh', () => {
    mockRoute.name = 'ConfigWazuh'
    mockRoute.path = '/config-wazuh'

    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    expect(wrapper.find('.header-title').text()).toBe('Configuración de Wazuh')
  })

  it('shows route title for ChangePassword', () => {
    mockRoute.name = 'ChangePassword'
    mockRoute.path = '/change-password'

    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    expect(wrapper.find('.header-title').text()).toBe('Seguridad de Cuenta')
  })

  it('renders auth layout for NotFound route', () => {
    mockRoute.name = 'NotFound'
    mockRoute.path = '/404'

    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    expect(wrapper.find('.auth-layout').exists()).toBe(true)
    expect(wrapper.find('.app-layout').exists()).toBe(false)
  })

  it('returns empty title for unknown route', () => {
    mockRoute.name = 'AlgoRaro'
    mockRoute.path = '/algo-raro'

    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'router-link']
      }
    })

    expect(wrapper.find('.header-title').text()).toBe('')
  })

})
