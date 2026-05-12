import { describe, it, expect, beforeEach, vi } from 'vitest'
import router from '@/presentation/router/index'
import userService from '@/application/services/userService'

// 1. OBLIGATORIO: Simular el servicio que usa el router
vi.mock('@/application/services/userService', () => ({
    default: {
        getUserMe: vi.fn()
    }
}))

describe('router/index.js global guard', () => {
    beforeEach(async () => {
        localStorage.clear()
        sessionStorage.clear()
        vi.clearAllMocks()

        if (router.currentRoute.value.path !== '/login') {
            await router.push('/login').catch(() => {})
        }
    })

    it('redirects to /login if navigating to auth route without token', async () => {
        await router.push('/dashboard')
        await router.isReady()
        expect(router.currentRoute.value.path).toBe('/login')
    })

    it('allows navigation to auth route with token', async () => {
        localStorage.setItem('token', 'fake-token')
        // 2. Simulamos que el backend responde que el usuario está OK y NO tiene pass por defecto
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: false } })

        await router.push('/dashboard')
        await router.isReady()

        expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    it('redirects to /dashboard if logged in and navigating to /login', async () => {
        localStorage.setItem('token', 'fake-token')
        userService.getUserMe.mockResolvedValueOnce({ data: { is_default_password: false } })

        await router.push('/dashboard').catch(() => {})
        await router.push('/login')
        await router.isReady()

        expect(router.currentRoute.value.path).toBe('/dashboard')
    })

    it('renders NotFound component for unknown routes correctly', async () => {
        await router.push('/non-existent-route-123')
        await router.isReady()
        expect(router.currentRoute.value.name).toBe('NotFound')
    })

    it('redirects to /change-password when user has default password', async () => {
        localStorage.setItem('token', 'fake-token')

        userService.getUserMe.mockResolvedValue({
            data: { is_default_password: true }
        })

        await router.push('/dashboard')
        await router.isReady()

        expect(router.currentRoute.value.path).toBe('/change-password')
        expect(sessionStorage.getItem('force_password_message')).toBe(
            'Para continuar, debes cambiar tu contraseña obligatoriamente.'
        )
    })

    it('allows navigation to /change-password when user has default password', async () => {
        localStorage.setItem('token', 'fake-token')

        userService.getUserMe.mockResolvedValue({
            data: { is_default_password: true }
        })

        await router.push('/change-password')
        await router.isReady()

        expect(router.currentRoute.value.path).toBe('/change-password')
    })

    it('redirects to /login and clears storage when getUserMe fails', async () => {
        localStorage.setItem('token', 'fake-token')
        localStorage.setItem('username', 'clau')

        userService.getUserMe.mockRejectedValueOnce(new Error('Unauthorized'))

        await router.push('/dashboard')
        await router.isReady()

        expect(router.currentRoute.value.path).toBe('/login')
        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('username')).toBeNull()
    })
})
