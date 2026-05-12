import axios from 'axios';
import setupAuthInterceptor from './interceptors/authInterceptor';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

setupAuthInterceptor(apiClient);

const MOCK_DELAY = 500;

const mockData = {
    vulns: [
        {
            id: 1,
            cve_id: 'CVE-2023-1234 FALSO',
            severity: 'critical',
            agent_name: 'server-01',
            package_name: 'bash',
            package_version: '5.0-1',
            first_seen: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            last_seen: new Date().toISOString()
        },
        {
            id: 2,
            cve_id: 'CVE-2022-9876 FALSO',
            severity: 'high',
            agent_name: 'desktop-mx',
            package_name: 'openssl',
            package_version: '1.1.1',
            first_seen: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
            last_seen: new Date().toISOString()
        },
        {
            id: 3,
            cve_id: 'CVE-2021-3452 FALSO',
            severity: 'medium',
            agent_name: 'web-server-02',
            package_name: 'nginx',
            package_version: '1.18.0',
            first_seen: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
            last_seen: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
        },
        {
            id: 4,
            cve_id: 'CVE-2020-0001 FALSO',
            severity: 'low',
            agent_name: 'vpn-node',
            package_name: 'curl',
            package_version: '7.68.0',
            first_seen: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
            last_seen: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString()
        }
    ],
    user: {
        id: 1,
        username: 'admin FALSO',
        is_default_password: false // Falso para que puedas explorar el panel sin que te obligue a cambiar la password
    }
}

export default apiClient;