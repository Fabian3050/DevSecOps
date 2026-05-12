import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ConfigWazuh from '@/presentation/views/ConfigWazuh.vue'
import wazuhService from '@/application/services/wazuhService'
import Swal from 'sweetalert2'

vi.mock('@/application/services/wazuhService', () => ({
    default: {
        getConnections: vi.fn(),
        createConnection: vi.fn(),
        editConnection: vi.fn(),
        deleteConnection: vi.fn(),
        testConnection: vi.fn(() => Promise.resolve({ data: { success: true } }))
    }
}))

vi.mock('sweetalert2', () => ({
    default: {
        fire: vi.fn()
    }
}))

describe('ConfigWazuh.vue', () => {
    const mockConnections = [
        { id: 1, name: 'Prod Cluster', indexer_url: 'https://prod:9200', wazuh_user: 'admin', is_active: true }
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        wazuhService.getConnections.mockResolvedValue({ data: mockConnections })
    })

    it('opens edit connection modal and populates data', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        const editBtn = wrapper.find('button[title="Editar"]')
        await editBtn.trigger('click')
        await flushPromises()

        expect(wrapper.vm.showAddModal).toBe(true)
        expect(wrapper.vm.isEditing).toBe(true)
        expect(wrapper.vm.newConn.name).toBe('Prod Cluster')
    })

    it('handles edit connection fail gracefully', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        // Mockeamos el fallo con un mensaje específico
        const errorMsg = 'Error al guardar la conexión. Verifica que los datos sean correctos.'
        wazuhService.editConnection.mockRejectedValueOnce({
            response: { data: { message: errorMsg } }
        })

        await wrapper.find('button[title="Editar"]').trigger('click')
        await flushPromises()

        // IMPORTANTE: Asignamos una contraseña para pasar la validación del frontend
        wrapper.vm.newConn.wazuh_password = 'dummy-password'

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wazuhService.editConnection).toHaveBeenCalled()
        expect(wrapper.vm.newConnError).toBe(errorMsg)
    })

    it('deletes connection successfully confirmed', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        Swal.fire.mockResolvedValueOnce({ isConfirmed: true })
        wazuhService.deleteConnection.mockResolvedValueOnce({})

        await wrapper.find('button[title="Eliminar"]').trigger('click')
        await flushPromises()

        expect(wazuhService.deleteConnection).toHaveBeenCalledWith(1)
    })

    // --- NEW TESTS FOR VALIDATION & ERROR PATHS ---

    it('shows error when name field is empty', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        wrapper.vm.newConn.name = ''
        wrapper.vm.newConn.indexer_url = 'https://test:9200'
        wrapper.vm.newConn.wazuh_user = 'admin'
        wrapper.vm.newConn.wazuh_password = 'password123'

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.newConnError).toBe('Por favor, completa todos los campos requeridos.')
        expect(wazuhService.createConnection).not.toHaveBeenCalled()
    })

    it('shows error when indexer_url field is empty', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        wrapper.vm.newConn.name = 'Test Connection'
        wrapper.vm.newConn.indexer_url = ''
        wrapper.vm.newConn.wazuh_user = 'admin'
        wrapper.vm.newConn.wazuh_password = 'password123'

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.newConnError).toBe('Por favor, completa todos los campos requeridos.')
        expect(wazuhService.createConnection).not.toHaveBeenCalled()
    })

    it('shows error when wazuh_user field is empty', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        wrapper.vm.newConn.name = 'Test Connection'
        wrapper.vm.newConn.indexer_url = 'https://test:9200'
        wrapper.vm.newConn.wazuh_user = ''
        wrapper.vm.newConn.wazuh_password = 'password123'

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.newConnError).toBe('Por favor, completa todos los campos requeridos.')
        expect(wazuhService.createConnection).not.toHaveBeenCalled()
    })

    it('shows error when wazuh_password field is empty on create', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        wrapper.vm.newConn.name = 'Test Connection'
        wrapper.vm.newConn.indexer_url = 'https://test:9200'
        wrapper.vm.newConn.wazuh_user = 'admin'
        wrapper.vm.newConn.wazuh_password = ''

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.newConnError).toBe('Por favor, completa todos los campos requeridos.')
        expect(wazuhService.createConnection).not.toHaveBeenCalled()
    })

    it('creates new connection with valid data', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        expect(wrapper.vm.isEditing).toBe(false)

        wrapper.vm.newConn.name = 'New Connection'
        wrapper.vm.newConn.indexer_url = 'https://new:9200'
        wrapper.vm.newConn.wazuh_user = 'newadmin'
        wrapper.vm.newConn.wazuh_password = 'newpass123'

        wazuhService.createConnection.mockResolvedValueOnce({ data: {} })

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wazuhService.createConnection).toHaveBeenCalledWith({
            name: 'New Connection',
            indexer_url: 'https://new:9200',
            wazuh_user: 'newadmin',
            wazuh_password: 'newpass123'
        })
        expect(wrapper.vm.showAddModal).toBe(false)
    })

    it('allows empty password on edit', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        await wrapper.find('button[title="Editar"]').trigger('click')
        await flushPromises()

        wrapper.vm.newConn.wazuh_password = ''

        wazuhService.editConnection.mockResolvedValueOnce({ data: {} })

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wazuhService.editConnection).toHaveBeenCalled()
    })

    it('shows error message when test connection fails with ok: false', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wazuhService.testConnection.mockResolvedValueOnce({ data: { ok: false } })

        await wrapper.vm.handleTestConnection(1)
        await flushPromises()

        expect(Swal.fire).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Conexión Fallida',
                text: 'No se pudo conectar al clúster de Wazuh.'
            })
        )
    })

    it('shows success message when test connection succeeds', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wazuhService.testConnection.mockResolvedValueOnce({ data: { ok: true } })

        await wrapper.vm.handleTestConnection(1)
        await flushPromises()

        expect(Swal.fire).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Conexión exitosa',
                text: 'La prueba de conexión se realizó correctamente.'
            })
        )
    })

    it('shows error when test connection throws exception', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        const errorDetail = 'Connection timeout'
        wazuhService.testConnection.mockRejectedValueOnce({
            response: { data: { detail: errorDetail } }
        })

        await wrapper.vm.handleTestConnection(1)
        await flushPromises()

        expect(Swal.fire).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Error',
                text: errorDetail
            })
        )
    })

    it('does nothing when delete is cancelled', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        Swal.fire.mockResolvedValueOnce({ isConfirmed: false })

        await wrapper.vm.deleteConn(1)
        await flushPromises()

        expect(wazuhService.deleteConnection).not.toHaveBeenCalled()
    })

    it('shows error when delete fails', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        Swal.fire.mockResolvedValueOnce({ isConfirmed: true })
        wazuhService.deleteConnection.mockRejectedValueOnce({
            response: { data: { detail: 'Permission denied' } }
        })

        await wrapper.vm.deleteConn(1)
        await flushPromises()

        expect(Swal.fire).toHaveBeenLastCalledWith(
            expect.objectContaining({
                title: 'Error',
                text: 'Permission denied'
            })
        )
    })

    it('formatDate returns "Nunca" for null/undefined dates', () => {
        const wrapper = mount(ConfigWazuh)

        expect(wrapper.vm.formatDate(null)).toBe('Nunca')
        expect(wrapper.vm.formatDate(undefined)).toBe('Nunca')
        expect(wrapper.vm.formatDate('')).toBe('Nunca')
    })

    it('formatDate formats valid date strings correctly', () => {
        const wrapper = mount(ConfigWazuh)
        const testDate = '2025-03-09T10:00:00'

        const result = wrapper.vm.formatDate(testDate)
        expect(result).not.toBe('Nunca')
        expect(result).toContain('2025')
        // Check for March (03 or 3) and 9th (09 or 9)
        expect(result).toMatch(/(03|3)/)
        expect(result).toMatch(/(09|9)/)
    })

    it('closes modal and clears form on closeModal', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        wrapper.vm.newConn.name = 'Test'
        wrapper.vm.newConnError = 'Some error'
        wrapper.vm.isEditing = true

        wrapper.vm.closeModal()
        await flushPromises()

        expect(wrapper.vm.showAddModal).toBe(false)
        expect(wrapper.vm.newConn.name).toBe('')
        expect(wrapper.vm.newConnError).toBe('')
        expect(wrapper.vm.isEditing).toBe(false)
    })

    it('trims input fields before submission', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        wrapper.vm.newConn.name = '  Padded Name  '
        wrapper.vm.newConn.indexer_url = '  https://test:9200  '
        wrapper.vm.newConn.wazuh_user = '  admin  '
        wrapper.vm.newConn.wazuh_password = '  password  '

        wazuhService.createConnection.mockResolvedValueOnce({ data: {} })

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wazuhService.createConnection).toHaveBeenCalledWith({
            name: 'Padded Name',
            indexer_url: 'https://test:9200',
            wazuh_user: 'admin',
            wazuh_password: 'password'
        })
    })

    it('handles API error without detail property', async () => {
        const wrapper = mount(ConfigWazuh)
        await flushPromises()

        wrapper.vm.openAddModal()
        await flushPromises()

        wrapper.vm.newConn.name = 'Test'
        wrapper.vm.newConn.indexer_url = 'https://test:9200'
        wrapper.vm.newConn.wazuh_user = 'admin'
        wrapper.vm.newConn.wazuh_password = 'pass'

        wazuhService.createConnection.mockRejectedValueOnce({
            response: { data: {} }
        })

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.newConnError).toBe('Error al guardar la conexión. Verifica que los datos sean correctos.')
    })
})
