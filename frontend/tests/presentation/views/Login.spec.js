import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Login from '@/presentation/views/Login.vue'
import authService from '@/application/services/authService'
import userService from '@/application/services/userService'

// Mock services
vi.mock('@/application/services/authService', () => ({
    default: {
        login: vi.fn()
    }
}))

vi.mock('@/application/services/userService', () => ({
    default: {
        getUserMe: vi.fn()
    }
}))

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: mockPush
    })
}))

describe('Login.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        sessionStorage.clear()
    })

    it('renders correctly', () => {
        const wrapper = mount(Login)
        expect(wrapper.text()).toContain('Wazuh VulnSync')
        expect(wrapper.find('form').exists()).toBe(true)
    })

    it('shows error message if login fails', async () => {
        const wrapper = mount(Login)
        const err = { response: { data: { detail: 'Invalid credentials' } } }
        authService.login.mockRejectedValueOnce(err)

        // Simulate form submit
        await wrapper.find('form').trigger('submit.prevent')

        // Wait for DOM updates
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()

        expect(authService.login).toHaveBeenCalled()
        expect(wrapper.text()).toContain('Invalid credentials')
    })

    it('redirects to dashboard on successful login', async () => {
        const wrapper = mount(Login)

        authService.login.mockResolvedValueOnce({ data: { access_token: 'fake-token' } })
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: false } })

        // Set input values
        wrapper.vm.username = 'admin'
        wrapper.vm.password = '1234'

        await wrapper.find('form').trigger('submit.prevent')

        // Wait for promises to resolve
        await new Promise(r => setTimeout(r, 10))

        expect(authService.login).toHaveBeenCalled()
        expect(localStorage.getItem('token')).toBe('fake-token')
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('redirects to change-password if is_default_password is true', async () => {
        const wrapper = mount(Login)

        authService.login.mockResolvedValueOnce({ data: { access_token: 'fake-token' } })
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: true } })

        // Set input values
        wrapper.vm.username = 'admin'
        wrapper.vm.password = '1234'

        await wrapper.find('form').trigger('submit.prevent')

        // Wait for promises to resolve
        await new Promise(r => setTimeout(r, 10))

        expect(authService.login).toHaveBeenCalled()
        expect(sessionStorage.getItem('force_password_message')).toBeDefined()
        expect(mockPush).toHaveBeenCalledWith('/change-password')
    })

    it('handles login error when response has no detail property', async () => {
        const wrapper = mount(Login)
        authService.login.mockRejectedValueOnce({
            response: { data: {} }
        })

        wrapper.vm.username = 'admin'
        wrapper.vm.password = 'wrong'

        await wrapper.find('form').trigger('submit.prevent')
        await new Promise(r => setTimeout(r, 10))

        expect(wrapper.vm.error).toBe('Ha ocurrido un error al conectar con el servidor.')
    })

    it('handles login error when response is missing entirely', async () => {
        const wrapper = mount(Login)
        authService.login.mockRejectedValueOnce(new Error('Network error'))

        wrapper.vm.username = 'admin'
        wrapper.vm.password = '1234'

        await wrapper.find('form').trigger('submit.prevent')
        await new Promise(r => setTimeout(r, 10))

        expect(wrapper.vm.error).toBe('Ha ocurrido un error al conectar con el servidor.')
    })

    it('clears error message on successful login attempt', async () => {
        const wrapper = mount(Login)

        wrapper.vm.error = 'Previous error'
        authService.login.mockResolvedValueOnce({ data: { access_token: 'token123' } })
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: false } })

        wrapper.vm.username = 'admin'
        wrapper.vm.password = '1234'

        await wrapper.find('form').trigger('submit.prevent')
        await new Promise(r => setTimeout(r, 10))

        expect(wrapper.vm.error).toBe('')
    })

    it('stores username in localStorage on successful login', async () => {
        const wrapper = mount(Login)

        authService.login.mockResolvedValueOnce({ data: { access_token: 'token123' } })
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: false } })

        wrapper.vm.username = 'testuser'
        wrapper.vm.password = 'pass123'

        await wrapper.find('form').trigger('submit.prevent')
        await new Promise(r => setTimeout(r, 10))

        expect(localStorage.getItem('username')).toBe('testuser')
    })

    it('toggles password visibility', async () => {
        const wrapper = mount(Login)

        expect(wrapper.vm.showPassword).toBe(false)
        await wrapper.find('.eye-btn').trigger('click')
        expect(wrapper.vm.showPassword).toBe(true)
    })

    it('sets loading state during login process', async () => {
        const wrapper = mount(Login)

        authService.login.mockImplementationOnce(
            () => new Promise(r => setTimeout(() => r({ data: { access_token: 'token' } }), 50))
        )
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: false } })

        expect(wrapper.vm.loading).toBe(false)

        wrapper.vm.username = 'admin'
        wrapper.vm.password = 'pass'
        wrapper.find('form').trigger('submit.prevent')

        expect(wrapper.vm.loading).toBe(true)

        await new Promise(r => setTimeout(r, 60))

        expect(wrapper.vm.loading).toBe(false)
    })

    it('resets error state before each login attempt', async () => {
        const wrapper = mount(Login)
        
        // First failed attempt
        authService.login.mockRejectedValueOnce({
            response: { data: { detail: 'Invalid credentials' } }
        })
        
        wrapper.vm.username = 'admin'
        wrapper.vm.password = 'wrong'
        await wrapper.find('form').trigger('submit.prevent')
        await new Promise(r => setTimeout(r, 10))
        expect(wrapper.vm.error).toBe('Invalid credentials')

        // Second attempt with success
        authService.login.mockResolvedValueOnce({ data: { access_token: 'token' } })
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: false } })
        
        wrapper.vm.password = 'correct'
        await wrapper.find('form').trigger('submit.prevent')
        await new Promise(r => setTimeout(r, 10))
        
        expect(wrapper.vm.error).toBe('')
    })
})
