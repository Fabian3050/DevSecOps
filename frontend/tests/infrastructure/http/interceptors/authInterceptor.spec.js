import { describe, it, expect, vi, beforeEach } from 'vitest'
import setupAuthInterceptor from '@/infrastructure/http/interceptors/authInterceptor'

describe('authInterceptor.js', () => {
    let mockApiClient

    beforeEach(() => {
        // Limpiar localStorage antes de cada prueba
        localStorage.clear()

        // Mockear la estructura del cliente que espera setupAuthInterceptor
        mockApiClient = {
            interceptors: {
                request: {
                    use: vi.fn()
                }
            }
        }
    })

    it('debe registrar el interceptor de request', () => {
        setupAuthInterceptor(mockApiClient)
        expect(mockApiClient.interceptors.request.use).toHaveBeenCalledOnce()
    })

    it('debe agregar el token Authorization cuando existe el token y no es ruta excluida', () => {
        setupAuthInterceptor(mockApiClient)
        const interceptorFn = mockApiClient.interceptors.request.use.mock.calls[0][0]

        // Configurar localStorage
        localStorage.setItem('token', 'fake-token-123')

        const config = { url: '/users/me', headers: {} }
        const resultConfig = interceptorFn(config)

        expect(resultConfig.headers.Authorization).toBe('Bearer fake-token-123')
    })

    it('NO debe agregar el token Authorization en ruta excluida (/auth/login)', () => {
        setupAuthInterceptor(mockApiClient)
        const interceptorFn = mockApiClient.interceptors.request.use.mock.calls[0][0]

        // Configurar localStorage
        localStorage.setItem('token', 'fake-token-123')

        const config = { url: '/auth/login', headers: {} }
        const resultConfig = interceptorFn(config)

        expect(resultConfig.headers.Authorization).toBeUndefined()
    })

    it('NO debe agregar el token si no hay un token en el localStorage', () => {
        setupAuthInterceptor(mockApiClient)
        const interceptorFn = mockApiClient.interceptors.request.use.mock.calls[0][0]

        const config = { url: '/users/me', headers: {} }
        const resultConfig = interceptorFn(config)

        expect(resultConfig.headers.Authorization).toBeUndefined()
    })
})
