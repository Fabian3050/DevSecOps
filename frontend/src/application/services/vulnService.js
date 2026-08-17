import apiClient from '../../infrastructure/http/apiClient';

export default {
  getVulns: async (params = {}) => {
    const queryParams = {}

    const fields = ['limit', 'offset', 'connection_id', 'cve_id', 'year', 'severity', 'os_platform', 'status', 'days', 'agent_id', 'reincident']
    fields.forEach(f => {
      if (params[f] !== undefined && params[f] !== null && params[f] !== '') {
        queryParams[f] = params[f]
      }
    })
    
    if (params.connectionId !== undefined && params.connectionId !== null && params.connectionId !== '') {
      queryParams.connection_id = params.connectionId
    }

    return apiClient.get('/vulnerabilities', {
      params: queryParams,
    })
  },

  getTimelineVulns: async (params = {}) => {
    return apiClient.get('/vulnerabilities/timeline', {
      params: {
        connection_id: params.connectionId,
        limit: params.limit
      }
    })
  },

  syncVulns: async () => {
    return apiClient.post('/vulns/sync-all')
  },

  getAssetsByCve: async (cveId, params = {}) => {
    return apiClient.get(`/vulnerabilities/${cveId}/assets`, {
      params: { limit: params.limit || 1000 }
    })
  },

  getAnalyticsSummary: async (params = {}) => {
    const queryParams = {}
    const fields = ['connection_id', 'cve_id', 'year', 'severity', 'os_platform', 'status', 'days']
    fields.forEach(f => {
      if (params[f] !== undefined && params[f] !== null && params[f] !== '') {
        queryParams[f] = params[f]
      }
    })
    return apiClient.get('/analytics/summary', { params: queryParams })
  }
}
