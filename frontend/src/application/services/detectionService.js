import apiClient from '../../infrastructure/http/apiClient';

export default {
  getVulnerabilityDetections: async (params = {}) => {
    const queryParams = {};

    if (params.limit !== undefined && params.limit !== null) {
      queryParams.limit = params.limit;
    }

    if (params.assetId !== undefined && params.assetId !== null) {
      queryParams.asset_id = params.assetId;
    }

    if (params.cveId !== undefined && params.cveId !== null) {
      queryParams.cve_id = params.cveId;
    }

    return apiClient.get('/vulnerability-detections', { params: queryParams });
  },
};
