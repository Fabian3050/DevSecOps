import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ChangePassword from '@/presentation/views/ChangePassword.vue'
import authService from '@/application/services/authService'

vi.mock('@/application/services/authService', () => ({
    default: {
        changePassword: vi.fn()
    }
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: mockPush
    })
}))

describe('ChangePassword.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        sessionStorage.clear()
    })

    it('renders correctly and checks security message from sessionStorage', async () => {
        sessionStorage.setItem('force_password_message', 'Debes cambiar la contraseña')

        const wrapper = mount(ChangePassword)
        await flushPromises()

        expect(wrapper.text()).toContain('Debes cambiar la contraseña')
        expect(sessionStorage.getItem('force_password_message')).toBeNull() // gets cleared
    })

    it('shows error if new passwords do not match', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass123'

        await wrapper.find('form').trigger('submit.prevent')

        expect(wrapper.vm.error).toBe('Las contraseñas no coinciden.')
        expect(authService.changePassword).not.toHaveBeenCalled()
    })

    it('submits change password correctly and redirects to dashboard', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockResolvedValueOnce({})

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(authService.changePassword).toHaveBeenCalledWith({
            old_password: 'oldpass',
            new_password: 'newpass',
            confirm_password: 'newpass'
        })

        expect(wrapper.vm.success).toBe('Contraseña actualizada correctamente.')
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('handles change password error gracefully', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockRejectedValueOnce({ response: { data: { detail: 'Wrong old password' } } })

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.error).toBe('Wrong old password')
    })

    it('toggles password visibility', async () => {
        const wrapper = mount(ChangePassword)

        expect(wrapper.vm.showOldPassword).toBe(false)
        await wrapper.findAll('.eye-btn')[0].trigger('click')
        expect(wrapper.vm.showOldPassword).toBe(true)

        expect(wrapper.vm.showNewPassword).toBe(false)
        await wrapper.findAll('.eye-btn')[1].trigger('click')
        expect(wrapper.vm.showNewPassword).toBe(true)

        expect(wrapper.vm.showConfirmPassword).toBe(false)
        await wrapper.findAll('.eye-btn')[2].trigger('click')
        expect(wrapper.vm.showConfirmPassword).toBe(true)
    })

    it('handles change password error when response has no detail property', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockRejectedValueOnce({
            response: { data: {} }
        })

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.error).toBe('Error al cambiar la contraseña.')
    })

    it('handles change password error when response is missing entirely', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockRejectedValueOnce(new Error('Network error'))

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.error).toBe('Error al cambiar la contraseña.')
    })

    it('clears error message on successful password change', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.error = 'Previous error'
        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockResolvedValueOnce({})

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.error).toBe('')
    })

    it('clears success message before retry', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.success = 'Previous success'
        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass123'

        await wrapper.find('form').trigger('submit.prevent')

        expect(wrapper.vm.success).toBe('')
    })

    it('sets loading state during password change', async () => {
        const wrapper = mount(ChangePassword)

        authService.changePassword.mockImplementationOnce(
            () => new Promise(r => setTimeout(() => r({}), 50))
        )

        expect(wrapper.vm.loading).toBe(false)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        wrapper.find('form').trigger('submit.prevent')

        expect(wrapper.vm.loading).toBe(true)

        await new Promise(r => setTimeout(r, 60))

        expect(wrapper.vm.loading).toBe(false)
    })

    it('redirects to dashboard after successful password change', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockResolvedValueOnce({})

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('displays security message from sessionStorage', async () => {
        const message = 'Debes cambiar tu contraseña inmediatamente'
        sessionStorage.setItem('force_password_message', message)

        const wrapper = mount(ChangePassword)
        await flushPromises()

        expect(wrapper.vm.securityMessage).toBe(message)
        expect(sessionStorage.getItem('force_password_message')).toBeNull()
    })

    it('clears both error and success at the start of new submission', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.error = 'Some error'
        wrapper.vm.success = 'Some success'
        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        // Mock a promise that doesn't resolve yet to capture the intermediate state
        let resolvePromise;
        const pendingPromise = new Promise(resolve => { resolvePromise = resolve; });
        authService.changePassword.mockReturnValueOnce(pendingPromise)

        await wrapper.find('form').trigger('submit.prevent')

        // Immediate state should be cleared
        expect(wrapper.vm.error).toBe('')
        expect(wrapper.vm.success).toBe('')

        // Cleanup
        resolvePromise({});
        await flushPromises();
    })

    it('validates that new passwords must match exactly', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass1'
        wrapper.vm.confirmPassword = 'newpass2'

        await wrapper.find('form').trigger('submit.prevent')

        expect(wrapper.vm.error).toBe('Las contraseñas no coinciden.')
        expect(authService.changePassword).not.toHaveBeenCalled()
    })

    it('submits with exact values without trimming', async () => {
        const wrapper = mount(ChangePassword)

        wrapper.vm.oldPassword = 'old'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockResolvedValueOnce({})

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(authService.changePassword).toHaveBeenCalledWith({
            old_password: 'old',
            new_password: 'newpass',
            confirm_password: 'newpass'
        })
    })

    it('allows password change with empty security message', async () => {
        const wrapper = mount(ChangePassword)
        await flushPromises()

        expect(wrapper.vm.securityMessage).toBe('')

        wrapper.vm.oldPassword = 'oldpass'
        wrapper.vm.newPassword = 'newpass'
        wrapper.vm.confirmPassword = 'newpass'

        authService.changePassword.mockResolvedValueOnce({})

        await wrapper.find('form').trigger('submit.prevent')
        await flushPromises()

        expect(wrapper.vm.success).toBe('Contraseña actualizada correctamente.')
    })
})
