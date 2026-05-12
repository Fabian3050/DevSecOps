import apiClient from '../../infrastructure/http/apiClient';

const userService = {
  getUsers: async () => {
    return apiClient.get('/users')
  },

  createUser: async (userData) => {
    return apiClient.post('/users', userData)
  },

  deleteUser: async (userId) => {
    return apiClient.delete(`/users/${userId}`)
  },

  getUserMe: async () => {
    return apiClient.get('/users/me')
  }
}

export default userService