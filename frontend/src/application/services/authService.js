import apiClient from '../../infrastructure/http/apiClient';

export default {

    /*
    checkFirstLogin: async () => {
        if (route.name === 'Login') return
        try {
            const res = await userService.getMe()
            if (res.data.is_default_password && route.name !== 'ChangePassword') {
            router.push('/change-password')
            }
        } catch (err) {
            if (err.response && err.response.status === 401) {
            router.push('/login')
            }
        }
    },

    */

    login: async (credentials) => {
        return apiClient.post('/auth/login', credentials, {
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded' }
        });
    },

    changePassword: async (passwords) => {
        return apiClient.post('/auth/change-password', passwords);
    }
}
