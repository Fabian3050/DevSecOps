
export default function setupAuthInterceptor(apiClient) {
  apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');

    const excludedRoutes = ['/auth/login'];

    const shouldExclude = excludedRoutes.includes(config.url);

    if (token && !shouldExclude) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });
}