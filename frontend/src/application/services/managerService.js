import apiClient from '../../infrastructure/http/apiClient';

export default {
  getManagers: async (params = {}) => {
    const queryParams = {};

    if (params.limit !== undefined && params.limit !== null) {
      queryParams.limit = params.limit;
    }

    return apiClient.get('/managers', { params: queryParams });
  },
};
