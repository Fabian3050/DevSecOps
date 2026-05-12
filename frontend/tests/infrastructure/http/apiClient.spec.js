import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios BEFORE importing apiClient
vi.mock('axios', () => {
    return {
        default: {
            create: vi.fn(() => ({
                interceptors: {
                    request: {
                        use: vi.fn()
                    }
                }
            }))
        }
    }
})

describe('apiClient.js', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_API_URL', 'http://api-test:8000')
    })

    it('debe crear la instancia de axios con baseURL del entorno', async () => {
        const axios = (await import('axios')).default
        const apiClient = (await import('@/infrastructure/http/apiClient')).default

        expect(axios.create).toHaveBeenCalledWith({
            baseURL: 'http://api-test:8000'
        })

        // Validar que se ha importado como default
        expect(apiClient).not.toBeUndefined()
        expect(apiClient.interceptors.request.use).toHaveBeenCalled()
    })
})
