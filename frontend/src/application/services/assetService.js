import apiClient from '../../infrastructure/http/apiClient';

export default {
  getAssets: async (params = {}) => {
    const queryParams = {};

    if (params.limit !== undefined && params.limit !== null) {
      queryParams.limit = params.limit;
    }

    if (params.managerId !== undefined && params.managerId !== null) {
      queryParams.manager_id = params.managerId;
    }

    return apiClient.get('/assets', { params: queryParams });
  },
};
