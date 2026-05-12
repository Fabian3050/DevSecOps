import { describe, it, expect, vi } from 'vitest'
import userService from '@/application/services/userService'
import apiClient from '@/infrastructure/http/apiClient'

// Mock the apiClient module
vi.mock('@/infrastructure/http/apiClient', () => {
    return {
        default: {
            get: vi.fn(),
            post: vi.fn(),
            delete: vi.fn(),
        }
    }
})

describe('userService.js', () => {

    it('getUsers calls apiClient.get on /users', async () => {
        const mockResponse = { data: [] }
        apiClient.get.mockResolvedValueOnce(mockResponse)

        const result = await userService.getUsers()

        expect(apiClient.get).toHaveBeenCalledWith('/users')
        expect(result).toEqual(mockResponse)
    })

    it('createUser calls apiClient.post on /users with data', async () => {
        const newUser = { username: 'testuser', role: 'admin' }
        const mockResponse = { data: { id: 1, ...newUser } }

        apiClient.post.mockResolvedValueOnce(mockResponse)

        const result = await userService.createUser(newUser)

        expect(apiClient.post).toHaveBeenCalledWith('/users', newUser)
        expect(result).toEqual(mockResponse)
    })

    it('deleteUser calls apiClient.delete on /users/:id', async () => {
        const mockResponse = { data: { success: true } }
        apiClient.delete.mockResolvedValueOnce(mockResponse)

        const result = await userService.deleteUser(5)

        expect(apiClient.delete).toHaveBeenCalledWith('/users/5')
        expect(result).toEqual(mockResponse)
    })

    it('getUserMe calls apiClient.get on /users/me', async () => {
        const mockResponse = { data: { id: 1, username: 'me' } }
        apiClient.get.mockResolvedValueOnce(mockResponse)

        const result = await userService.getUserMe()

        expect(apiClient.get).toHaveBeenCalledWith('/users/me')
        expect(result).toEqual(mockResponse)
    })
})
