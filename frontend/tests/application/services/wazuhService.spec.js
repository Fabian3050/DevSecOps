import { describe, it, expect, vi } from 'vitest'
import wazuhService from '@/application/services/wazuhService'
import apiClient from '@/infrastructure/http/apiClient'

// Mock the apiClient module
vi.mock('@/infrastructure/http/apiClient', () => {
    return {
        default: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        }
    }
})

describe('wazuhService.js', () => {

    it('getConnections calls apiClient.get on /wazuh-connections', async () => {
        const mockResponse = { data: [] }
        apiClient.get.mockResolvedValueOnce(mockResponse)

        const result = await wazuhService.getConnections()

        expect(apiClient.get).toHaveBeenCalledWith('/wazuh-connections')
        expect(result).toEqual(mockResponse)
    })

    it('createConnection calls apiClient.post on /wazuh-connections with data', async () => {
        const newConn = { host: '192.168.1.1', user: 'admin' }
        const mockResponse = { data: { id: 1, ...newConn } }

        apiClient.post.mockResolvedValueOnce(mockResponse)

        const result = await wazuhService.createConnection(newConn)

        expect(apiClient.post).toHaveBeenCalledWith('/wazuh-connections', newConn)
        expect(result).toEqual(mockResponse)
    })

    it('editConnection calls apiClient.put on /wazuh-connections/:connId with data', async () => {
        const connData = { host: '192.168.1.2' }
        const mockResponse = { data: { id: 1, ...connData } }

        apiClient.put.mockResolvedValueOnce(mockResponse)

        const result = await wazuhService.editConnection(1, connData)

        expect(apiClient.put).toHaveBeenCalledWith('/wazuh-connections/1', connData)
        expect(result).toEqual(mockResponse)
    })

    it('deleteConnection calls apiClient.delete on /wazuh-connections/:connId', async () => {
        const mockResponse = { data: { success: true } }
        apiClient.delete.mockResolvedValueOnce(mockResponse)

        const result = await wazuhService.deleteConnection(5)

        expect(apiClient.delete).toHaveBeenCalledWith('/wazuh-connections/5')
        expect(result).toEqual(mockResponse)
    })

    it('testConnection calls the correct endpoint', async () => {
        apiClient.post.mockResolvedValueOnce({ data: { ok: true } })
        const response = await wazuhService.testConnection(123)
        expect(apiClient.post).toHaveBeenCalledWith('/wazuh-connections/123/test')
        expect(response.data.ok).toBe(true)
    })
})
