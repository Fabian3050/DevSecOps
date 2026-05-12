import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ConfigUser from '@/presentation/views/ConfigUser.vue'
import userService from '@/application/services/userService'
import Swal from 'sweetalert2'

vi.mock('@/application/services/userService', () => ({
    default: {
        getUsers: vi.fn(),
        createUser: vi.fn(),
        deleteUser: vi.fn()
    }
}))

vi.mock('sweetalert2', () => ({
    default: {
        fire: vi.fn()
    }
}))

describe('ConfigUser.vue', () => {
    const mockUsers = [
        { id: 1, username: 'admin' },
        { id: 2, username: 'analista' }
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        userService.getUsers.mockResolvedValue({ data: mockUsers })
    })

    it('fetches and displays users on mount', async () => {
        const wrapper = mount(ConfigUser)
        expect(wrapper.vm.loadingUsers).toBe(true)

        await flushPromises()

        expect(wrapper.vm.loadingUsers).toBe(false)
        expect(userService.getUsers).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.users.length).toBe(2)

        const rows = wrapper.findAll('tbody tr')
        expect(rows.length).toBe(2)
        expect(rows[0].text()).toContain('admin')
        expect(rows[1].text()).toContain('analista')
    })

    it('shows error if fetch users fails', async () => {
        userService.getUsers.mockRejectedValueOnce(new Error('Network Error'))
        const wrapper = mount(ConfigUser)

        await flushPromises()

        expect(wrapper.vm.usersError).toBe('No se pudieron cargar los administradores.')
        expect(wrapper.vm.users.length).toBe(0)
    })

    it('opens and closes add user modal', async () => {
        const wrapper = mount(ConfigUser)
        await flushPromises()

        // Open modal
        await wrapper.find('.btn-primary').trigger('click')
        expect(wrapper.vm.showAddModal).toBe(true)

        // Close modal via Cancel button
        const cancelBtn = wrapper.findAll('.btn-outline').find(b => b.text().includes('Cancelar'))
        await cancelBtn.trigger('click')
        expect(wrapper.vm.showAddModal).toBe(false)
    })

    it('submits new user correctly', async () => {
        const wrapper = mount(ConfigUser)
        await flushPromises()

        await wrapper.find('.btn-primary').trigger('click')

        wrapper.vm.newUser.username = 'new_admin'
        wrapper.vm.newUser.password = 'SuperSecret123'

        userService.createUser.mockResolvedValueOnce({})

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(userService.createUser).toHaveBeenCalledWith({
            username: 'new_admin',
            password: 'SuperSecret123'
        })
        expect(wrapper.vm.showAddModal).toBe(false)
        expect(userService.getUsers).toHaveBeenCalledTimes(2) // 1 initial, 1 after add
    })

    it('shows error when creating user without data', async () => {
        const wrapper = mount(ConfigUser)
        await flushPromises()

        await wrapper.find('.btn-primary').trigger('click')

        wrapper.vm.newUser.username = ''
        wrapper.vm.newUser.password = ''

        await wrapper.find('form').trigger('submit.prevent')

        expect(wrapper.vm.error).toContain('no pueden estar vacíos')
        expect(userService.createUser).not.toHaveBeenCalled()
    })

    it('handles user creation failure gracefully', async () => {
        const wrapper = mount(ConfigUser)
        await flushPromises()

        await wrapper.find('.btn-primary').trigger('click')
        wrapper.vm.newUser.username = 'fail_user'
        wrapper.vm.newUser.password = 'pass'

        userService.createUser.mockRejectedValueOnce({ response: { data: { detail: 'User exists' } } })

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.error).toBe('User exists')
        expect(wrapper.vm.showAddModal).toBe(true) // Should remain open
    })

    it('deletes user successfully after confirmation', async () => {
        const wrapper = mount(ConfigUser)
        await flushPromises()

        Swal.fire.mockResolvedValueOnce({ isConfirmed: true })
        userService.deleteUser.mockResolvedValueOnce({})

        const deleteBtn = wrapper.findAll('tbody tr')[0].find('.btn-icon-danger')
        await deleteBtn.trigger('click')

        await flushPromises()

        expect(userService.deleteUser).toHaveBeenCalledWith(1)
        expect(userService.getUsers).toHaveBeenCalledTimes(2)
    })

    it('does nothing if delete is cancelled', async () => {
        const wrapper = mount(ConfigUser)
        await flushPromises()

        Swal.fire.mockResolvedValueOnce({ isConfirmed: false })

        const deleteBtn = wrapper.findAll('tbody tr')[0].find('.btn-icon-danger')
        await deleteBtn.trigger('click')

        await flushPromises()

        expect(userService.deleteUser).not.toHaveBeenCalled()
    })
})
