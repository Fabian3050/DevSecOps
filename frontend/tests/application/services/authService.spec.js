import { describe, it, expect, vi } from 'vitest'
import authService from '@/application/services/authService'
import apiClient from '@/infrastructure/http/apiClient'

// Mock the apiClient module
vi.mock('@/infrastructure/http/apiClient', () => {
    return {
        default: {
            post: vi.fn(),
        }
    }
})

describe('authService.js', () => {

    it('login calls apiClient.post with credentials and correct headers', async () => {
        const credentials = { username: 'testuser', password: 'password' }
        const mockResponse = { data: { access_token: '12345' } }

        apiClient.post.mockResolvedValueOnce(mockResponse)

        const result = await authService.login(credentials)

        expect(apiClient.post).toHaveBeenCalledWith('/auth/login', credentials, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        expect(result).toEqual(mockResponse)
    })

    it('changePassword calls apiClient.post with the passwords data', async () => {
        const passwords = { old_password: '123', new_password: '456' }
        const mockResponse = { data: { success: true } }

        apiClient.post.mockResolvedValueOnce(mockResponse)

        const result = await authService.changePassword(passwords)

        expect(apiClient.post).toHaveBeenCalledWith('/auth/change-password', passwords)
        expect(result).toEqual(mockResponse)
    })

})
