import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Dashboard from '@/presentation/views/Dashboard.vue'
import vulnService from '@/application/services/vulnService'
import wazuhService from '@/application/services/wazuhService'

vi.mock('@/application/services/vulnService', () => ({
    default: {
        getVulns: vi.fn(),
        syncVulns: vi.fn()
    }
}))

vi.mock('@/application/services/wazuhService', () => ({
    default: {
        getConnections: vi.fn()
    }
}))

describe('Dashboard.vue', () => {
    const mockVulns = [
        {
            id: 1,
            connection_name: 'Conn A',
            severity: 'critical',
            cve_id: 'CVE-2023-1234',
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(), // More recent
            agent_name: 'Agent-1',
            package_name: 'bash',
            package_version: '5.0'
        },
        {
            id: 2,
            connection_name: 'Conn B',
            severity: 'low',
            cve_id: 'CVE-2022-0001',
            first_seen: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
            last_seen: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // Older
            agent_name: 'Agent-2',
            package_name: 'curl',
            package_version: '7.0'
        }
    ]

    beforeEach(() => {
        vi.clearAllMocks()

        wazuhService.getConnections.mockResolvedValue({ data: [] })
    })

    it('renders loading state initially and then shows vulns', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)

        // Check loading indicator (might be hard to grab if it disappears instantly, but initially loading is true)
        expect(wrapper.vm.loading).toBe(true)

        // Wait for API to resolve
        await flushPromises()

        expect(wrapper.vm.loading).toBe(false)
        expect(vulnService.getVulns).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.vulns.length).toBe(2)

        // Check if table rendered with correct number of rows (excluding header)
        const rows = wrapper.findAll('tbody tr')
        expect(rows.length).toBe(2)
        // verify connection names rendered in first column
        expect(rows[0].text()).toContain('Conn A')
        expect(rows[1].text()).toContain('Conn B')
    })

    it('injects mock data when getVulns fails', async () => {
        vulnService.getVulns.mockRejectedValueOnce(new Error('Network error'))
        const wrapper = mount(Dashboard)

        await flushPromises()

        expect(wrapper.vm.loading).toBe(false)
        expect(wrapper.vm.error).toBe('')
    })

    it('syncs vulns correctly', async () => {
        vulnService.getVulns.mockResolvedValue({ data: mockVulns })
        vulnService.syncVulns.mockResolvedValueOnce({})

        const wrapper = mount(Dashboard)
        await flushPromises() // Wait for initial fetch

        expect(vulnService.getVulns).toHaveBeenCalledTimes(1)

        // Trigger sync
        await wrapper.vm.syncVulns()

        expect(wrapper.vm.syncing).toBe(false)
        expect(vulnService.syncVulns).toHaveBeenCalledTimes(1)
        expect(vulnService.getVulns).toHaveBeenCalledTimes(2) // Fetches again after sync
    })

    it('shows error when sync fails', async () => {
        vulnService.getVulns.mockResolvedValue({ data: mockVulns })
        vulnService.syncVulns.mockRejectedValueOnce(new Error('Sync error'))

        const wrapper = mount(Dashboard)
        await flushPromises() // initial fetch

        await wrapper.vm.syncVulns()
        expect(wrapper.vm.syncing).toBe(false)
        expect(wrapper.vm.error).toContain('Error durante la sincronización')
    })

    it('toggles filters visibility', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()

        expect(wrapper.vm.showFilters).toBe(false)

        // Find the button (Filtros)
        const filterBtn = wrapper.findAll('button').find(b => b.text().includes('Filtros') || b.text().includes('Ocultar'))
        await filterBtn.trigger('click')

        expect(wrapper.vm.showFilters).toBe(true)
    })

    it('filters vulnerabilities by selected agent', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()

        wrapper.vm.selectedAgents = ['Agent-1']
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.sortedVulns.length).toBe(1)
        expect(wrapper.vm.sortedVulns[0].agent_name).toBe('Agent-1')
    })


    it('sorts vulnerabilities on header click', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()

        // Default sorting is last_seen desc
        expect(wrapper.vm.sortKey).toBe('last_seen')
        expect(wrapper.vm.sortOrder).toBe('desc')

        // Call sortBy explicitly for severity
        wrapper.vm.sortBy('severity')

        expect(wrapper.vm.sortKey).toBe('severity')
        expect(wrapper.vm.sortOrder).toBe('asc')

        // Click again to reverse
        wrapper.vm.sortBy('severity')
        expect(wrapper.vm.sortOrder).toBe('desc')

        // Click a third time to clear sorting
        wrapper.vm.sortBy('severity')
        expect(wrapper.vm.sortKey).toBe('')
    })

    it('filters vulnerabilities by selected severity', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()

        wrapper.vm.selectedSeverities = ['CRITICAL']
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.sortedVulns.length).toBe(1)
        expect(wrapper.vm.sortedVulns[0].severity).toBe('critical')
    })

    it('filters vulnerabilities by selected cve', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()

        wrapper.vm.selectedVulns = ['CVE-2023-1234']
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.sortedVulns.length).toBe(1)
        expect(wrapper.vm.sortedVulns[0].cve_id).toBe('CVE-2023-1234')
    })

    it('filters vulnerabilities by selected package', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()

        wrapper.vm.selectedPackages = ['bash']
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.sortedVulns.length).toBe(1)
        expect(wrapper.vm.sortedVulns[0].package_name).toBe('bash')
    })

    it('clears filters correctly', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()

        wrapper.vm.selectedConnection = 1
        wrapper.vm.selectedAgents = ['Agent-1']
        wrapper.vm.selectedVulns = ['CVE-2023-1234']
        wrapper.vm.selectedPackages = ['bash']
        wrapper.vm.selectedSeverities = ['CRITICAL']
        wrapper.vm.scoreMin = 1
        wrapper.vm.scoreMax = 9

        wrapper.vm.clearFilters()
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.selectedConnection).toBe('')
        expect(wrapper.vm.selectedAgents).toEqual([])
        expect(wrapper.vm.selectedVulns).toEqual([])
        expect(wrapper.vm.selectedPackages).toEqual([])
        expect(wrapper.vm.selectedSeverities).toEqual([])
        expect(wrapper.vm.scoreMin).toBe('')
        expect(wrapper.vm.scoreMax).toBe('')
    })

    it('covers empty vulns, loads connections, isNew and severity badge branches', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: [] })
        wazuhService.getConnections.mockResolvedValueOnce({
            data: [
                { id: 1, name: 'Conn A' },
                { id: 2, name: 'Conn B' }
            ]
        })

        const wrapper = mount(Dashboard)
        await flushPromises()

        // line 607: when vulns API returns empty
        expect(wrapper.vm.vulns).toEqual([])

        // line 619: connections assigned
        expect(wrapper.vm.connections).toEqual([
            { id: 1, name: 'Conn A' },
            { id: 2, name: 'Conn B' }
        ])

        // lines 648-653
        expect(wrapper.vm.isNew(null)).toBe(false)
        expect(wrapper.vm.isNew(new Date().toISOString())).toBe(true)
        expect(
            wrapper.vm.isNew(new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString())
        ).toBe(false)

        // lines 665-669
        expect(wrapper.vm.getSeverityBadgeClass('critical')).toBe('badge-critical')
        expect(wrapper.vm.getSeverityBadgeClass('critica')).toBe('badge-critical')
        expect(wrapper.vm.getSeverityBadgeClass('high')).toBe('badge-high')
        expect(wrapper.vm.getSeverityBadgeClass('alta')).toBe('badge-high')
        expect(wrapper.vm.getSeverityBadgeClass('medium')).toBe('badge-medium')
        expect(wrapper.vm.getSeverityBadgeClass('media')).toBe('badge-medium')
        expect(wrapper.vm.getSeverityBadgeClass('low')).toBe('badge-low')
    })

    it('clears dependent filters on connection change', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        wazuhService.getConnections.mockResolvedValueOnce({
            data: [{ id: 1, name: 'Conn A' }]
        })

        const wrapper = mount(Dashboard)
        await flushPromises()

        wrapper.vm.selectedAgents = ['Agent-1']
        wrapper.vm.selectedVulns = ['CVE-2023-1234']
        wrapper.vm.selectedPackages = ['bash']
        wrapper.vm.selectedSeverities = ['CRITICAL']
        wrapper.vm.scoreMin = 2
        wrapper.vm.scoreMax = 9

        wrapper.vm.onConnectionChange()
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.selectedAgents).toEqual([])
        expect(wrapper.vm.selectedVulns).toEqual([])
        expect(wrapper.vm.selectedPackages).toEqual([])
        expect(wrapper.vm.selectedSeverities).toEqual([])
        expect(wrapper.vm.scoreMin).toBe('')
        expect(wrapper.vm.scoreMax).toBe('')
    })

    it('filters vulnerabilities by maximum score', async () => {
        const mockVulnsWithScore = [
            {
                id: 1,
                connection_name: 'Conn A',
                severity: 'critical',
                cve_id: 'CVE-2023-1234',
                first_seen: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                agent_name: 'Agent-1',
                package_name: 'bash',
                package_version: '5.0',
                score_base: 9.8
            },
            {
                id: 2,
                connection_name: 'Conn B',
                severity: 'low',
                cve_id: 'CVE-2022-0001',
                first_seen: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                agent_name: 'Agent-2',
                package_name: 'curl',
                package_version: '7.0',
                score_base: 4.2
            }
        ]

        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnsWithScore })
        wazuhService.getConnections.mockResolvedValueOnce({ data: [] })

        const wrapper = mount(Dashboard)
        await flushPromises()

        wrapper.vm.scoreMax = 5
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.sortedVulns.length).toBe(1)
        expect(wrapper.vm.sortedVulns[0].id).toBe(2)
    })

    it('computes visible pages and navigates across pages correctly', async () => {
        const manyVulns = Array.from({ length: 500 }, (_, i) => ({
            id: i + 1,
            connection_name: `Conn ${i + 1}`,
            severity: i % 2 === 0 ? 'critical' : 'low',
            cve_id: `CVE-2023-${String(i + 1).padStart(4, '0')}`,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            agent_name: `Agent-${i + 1}`,
            package_name: `pkg-${i + 1}`,
            package_version: '1.0',
            score_base: (i % 10) + 1
        }))

        vulnService.getVulns.mockResolvedValueOnce({ data: manyVulns })
        wazuhService.getConnections.mockResolvedValueOnce({ data: [] })

        const wrapper = mount(Dashboard)
        await flushPromises()

        // 500 / 50 = 10 páginas
        expect(wrapper.vm.totalPages).toBe(10)

        // currentPage = 1 por defecto
        // cubre visiblePages cuando total > 7
        expect(wrapper.vm.visiblePages).toEqual([1, 2, 3, 4, 5, 6, 'right-ellipsis', 10])

        // line 539: nextPage
        wrapper.vm.nextPage()
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.currentPage).toBe(2)

        // line 543: prevPage
        wrapper.vm.prevPage()
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.currentPage).toBe(1)

        // moverse a una página intermedia para cubrir left/right ellipsis
        wrapper.vm.currentPage = 5
        await wrapper.vm.$nextTick()

        expect(wrapper.vm.visiblePages).toEqual([
            1,
            'left-ellipsis',
            3,
            4,
            5,
            6,
            7,
            'right-ellipsis',
            10
        ])

        // line 547: jumpBackward
        wrapper.vm.jumpBackward()
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.currentPage).toBe(1)

        // lines 550-552: jumpForward
        wrapper.vm.jumpForward()
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.currentPage).toBe(10)

        // nextPage no debe pasar del máximo
        wrapper.vm.nextPage()
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.currentPage).toBe(10)

        // prevPage vuelve una
        wrapper.vm.prevPage()
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.currentPage).toBe(9)
    })

    it('shows all pages when total pages are 7 or fewer', async () => {
        const fewVulns = Array.from({ length: 120 }, (_, i) => ({
            id: i + 1,
            connection_name: `Conn ${i + 1}`,
            severity: 'low',
            cve_id: `CVE-2023-${i + 1}`,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            agent_name: `Agent-${i + 1}`,
            package_name: `pkg-${i + 1}`,
            package_version: '1.0',
            score_base: 3
        }))

        vulnService.getVulns.mockResolvedValueOnce({ data: fewVulns })
        wazuhService.getConnections.mockResolvedValueOnce({ data: [] })

        const wrapper = mount(Dashboard)
        await flushPromises()

        expect(wrapper.vm.totalPages).toBe(3)
        expect(wrapper.vm.visiblePages).toEqual([1, 2, 3])
    })

    it('formatDate returns formatted and N/A', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: [] })
        const wrapper = mount(Dashboard)
        await flushPromises()
        expect(wrapper.vm.formatDate(null)).toBe('N/A')
        expect(wrapper.vm.formatDate('2026-03-08T12:34:56Z')).toMatch(/\d{2}.*\d{4}/)
    })

    it('timeAgo returns all branches', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: [] })
        const wrapper = mount(Dashboard)
        await flushPromises()
        const now = new Date()
        expect(wrapper.vm.timeAgo(null)).toBe('N/A')
        expect(wrapper.vm.timeAgo(now)).toBe('Justo ahora')
        expect(wrapper.vm.timeAgo(new Date(now - 61 * 1000))).toContain('min')
        expect(wrapper.vm.timeAgo(new Date(now - 2 * 3600 * 1000))).toContain('horas')
        expect(wrapper.vm.timeAgo(new Date(now - 2 * 86400 * 1000))).toContain('días')
        expect(wrapper.vm.timeAgo(new Date(now - 2 * 2592000 * 1000))).toContain('meses')
        expect(wrapper.vm.timeAgo(new Date(now - 2 * 31536000 * 1000))).toContain('años')
    })

    it('getTimelineProgress returns 0, normal, min/max', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: [] })
        const wrapper = mount(Dashboard)
        await flushPromises()
        expect(wrapper.vm.getTimelineProgress({})).toBe(0)
        const now = new Date().toISOString()
        expect(wrapper.vm.getTimelineProgress({ first_seen: now, last_seen: now })).toBe(0)
        const first = new Date(Date.now() - 1000 * 60 * 60).toISOString()
        const last = now
        const prog = wrapper.vm.getTimelineProgress({ first_seen: first, last_seen: last })
        expect(prog).toBeGreaterThan(0)
        expect(prog).toBeLessThanOrEqual(100)
    })

    it('isRecentlySeen returns true/false/null', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: [] })
        const wrapper = mount(Dashboard)
        await flushPromises()
        expect(wrapper.vm.isRecentlySeen(null)).toBe(false)
        const now = new Date().toISOString()
        expect(wrapper.vm.isRecentlySeen(now)).toBe(true)
        const old = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        expect(wrapper.vm.isRecentlySeen(old)).toBe(false)
    })

    it('getSeverityClass returns all branches', async () => {
        vulnService.getVulns.mockResolvedValueOnce({ data: [] })
        const wrapper = mount(Dashboard)
        await flushPromises()
        expect(wrapper.vm.getSeverityClass(null)).toBe('badge badge-low')
        expect(wrapper.vm.getSeverityClass('critical')).toBe('badge badge-critical')
        expect(wrapper.vm.getSeverityClass('critica')).toBe('badge badge-critical')
        expect(wrapper.vm.getSeverityClass('high')).toBe('badge badge-critical')
        expect(wrapper.vm.getSeverityClass('alta')).toBe('badge badge-critical')
        expect(wrapper.vm.getSeverityClass('medium')).toBe('badge badge-medium')
        expect(wrapper.vm.getSeverityClass('media')).toBe('badge badge-medium')
        expect(wrapper.vm.getSeverityClass('low')).toBe('badge badge-low')
    })

    it('dropdown search and filtering', async () => {
        const mockVulns = [
            { agent_name: 'Agent-1', cve_id: 'CVE-1', package_name: 'pkg1', severity: 'critical' },
            { agent_name: 'Agent-2', cve_id: 'CVE-2', package_name: 'pkg2', severity: 'low' }
        ]
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()
        wrapper.vm.search.agent = 'Agent-1'
        expect(wrapper.vm.filteredAgents.length).toBe(1)
        wrapper.vm.search.vuln = 'CVE-2'
        expect(wrapper.vm.filteredCVEOptions.length).toBe(1)
        wrapper.vm.search.package = 'pkg1'
        expect(wrapper.vm.filteredPackages.length).toBe(1)
    })

    it('score filter min only, max only, both', async () => {
        const mockVulns = [
            { score_base: 2 },
            { score_base: 5 },
            { score_base: 8 }
        ]
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()
        wrapper.vm.scoreMin = 5
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.sortedVulns.length).toBe(2)
        wrapper.vm.scoreMin = ''
        wrapper.vm.scoreMax = 5
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.sortedVulns.length).toBe(2)
        wrapper.vm.scoreMin = 5
        wrapper.vm.scoreMax = 5
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.sortedVulns.length).toBe(1)
    })

    it('sortBy with empty sortKey returns default order', async () => {
        const mockVulns = [
            { agent_name: 'A', last_seen: '2026-03-08T12:00:00Z' },
            { agent_name: 'B', last_seen: '2026-03-08T13:00:00Z' }
        ]
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()
        wrapper.vm.sortBy('agent_name')
        wrapper.vm.sortBy('agent_name')
        wrapper.vm.sortBy('agent_name') // clears sortKey
        await wrapper.vm.$nextTick()
        expect(wrapper.vm.sortKey).toBe('')
        expect(wrapper.vm.sortedVulns.length).toBe(2)
    })

    it('dropdown open/close logic', async () => {
        const mockVulns = [
            { agent_name: 'Agent-1', cve_id: 'CVE-1', package_name: 'pkg1', severity: 'critical' }
        ]
        vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
        const wrapper = mount(Dashboard)
        await flushPromises()
        wrapper.vm.dropdowns.agents = true
        expect(wrapper.vm.dropdowns.agents).toBe(true)
        wrapper.vm.dropdowns.agents = false
        expect(wrapper.vm.dropdowns.agents).toBe(false)
        wrapper.vm.dropdowns.vulns = true
        expect(wrapper.vm.dropdowns.vulns).toBe(true)
        wrapper.vm.dropdowns.vulns = false
        expect(wrapper.vm.dropdowns.vulns).toBe(false)
        wrapper.vm.dropdowns.packages = true
        expect(wrapper.vm.dropdowns.packages).toBe(true)
        wrapper.vm.dropdowns.packages = false
        expect(wrapper.vm.dropdowns.packages).toBe(false)
        wrapper.vm.dropdowns.severity = true
        expect(wrapper.vm.dropdowns.severity).toBe(true)
        wrapper.vm.dropdowns.severity = false
        expect(wrapper.vm.dropdowns.severity).toBe(false)
    })

    // --- NEW COMPREHENSIVE UTILITY FUNCTION TESTS ---

    describe('getSeverityLevel utility function', () => {
        it('returns null/undefined handling', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.getSeverityLevel(null)).toBe(0)
            expect(wrapper.vm.getSeverityLevel(undefined)).toBe(0)
            expect(wrapper.vm.getSeverityLevel('')).toBe(0)
        })

        it('returns correct level for critical severity', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.getSeverityLevel('critical')).toBe(4)
            expect(wrapper.vm.getSeverityLevel('CRITICAL')).toBe(4)
            expect(wrapper.vm.getSeverityLevel('Critical')).toBe(4)
            expect(wrapper.vm.getSeverityLevel('critica')).toBe(4)
            expect(wrapper.vm.getSeverityLevel('CRITICA')).toBe(4)
        })

        it('returns correct level for high severity', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.getSeverityLevel('high')).toBe(3)
            expect(wrapper.vm.getSeverityLevel('HIGH')).toBe(3)
            expect(wrapper.vm.getSeverityLevel('alta')).toBe(3)
            expect(wrapper.vm.getSeverityLevel('ALTA')).toBe(3)
        })

        it('returns correct level for medium severity', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.getSeverityLevel('medium')).toBe(2)
            expect(wrapper.vm.getSeverityLevel('MEDIUM')).toBe(2)
            expect(wrapper.vm.getSeverityLevel('media')).toBe(2)
            expect(wrapper.vm.getSeverityLevel('MEDIA')).toBe(2)
        })

        it('returns default level for low and unknown', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.getSeverityLevel('low')).toBe(1)
            expect(wrapper.vm.getSeverityLevel('LOW')).toBe(1)
            expect(wrapper.vm.getSeverityLevel('unknown')).toBe(1)
            expect(wrapper.vm.getSeverityLevel('UNKNOWN')).toBe(1)
            expect(wrapper.vm.getSeverityLevel('random')).toBe(1)
        })
    })

    describe('compareValues utility function', () => {
        beforeEach(() => {
            vi.clearAllMocks()
            wazuhService.getConnections.mockResolvedValue({ data: [] })
        })

        it('compares date fields (first_seen, last_seen)', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const now = new Date().getTime()
            const past = new Date(now - 86400000).getTime()
            const future = new Date(now + 86400000).getTime()

            const obj1 = { first_seen: new Date(past).toISOString() }
            const obj2 = { first_seen: new Date(future).toISOString() }

            expect(wrapper.vm.compareValues(obj1, obj2, 'first_seen')).toBeLessThan(0)
            expect(wrapper.vm.compareValues(obj2, obj1, 'first_seen')).toBeGreaterThan(0)
        })

        it('handles null dates in comparison', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const obj1 = { last_seen: null }
            const obj2 = { last_seen: new Date().toISOString() }

            expect(wrapper.vm.compareValues(obj1, obj2, 'last_seen')).toBeLessThan(0)
            expect(wrapper.vm.compareValues(obj2, obj1, 'last_seen')).toBeGreaterThan(0)
        })

        it('compares severity levels', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const critical = { severity: 'critical' }
            const low = { severity: 'low' }

            expect(wrapper.vm.compareValues(critical, low, 'severity')).toBeGreaterThan(0)
            expect(wrapper.vm.compareValues(low, critical, 'severity')).toBeLessThan(0)
        })

        it('compares string fields case-insensitively', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const objA = { agent_name: 'Agent-A' }
            const objB = { agent_name: 'Agent-B' }

            expect(wrapper.vm.compareValues(objA, objB, 'agent_name')).toBeLessThan(0)
            expect(wrapper.vm.compareValues(objB, objA, 'agent_name')).toBeGreaterThan(0)
        })

        it('handles null/undefined string values', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const objA = { cve_id: null }
            const objB = { cve_id: 'CVE-2023-1234' }

            expect(wrapper.vm.compareValues(objA, objB, 'cve_id')).toBeLessThan(0)
        })

        it('compares numeric fields', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const obj1 = { score_base: 3.5 }
            const obj2 = { score_base: 8.9 }

            expect(wrapper.vm.compareValues(obj1, obj2, 'score_base')).toBeLessThan(0)
            expect(wrapper.vm.compareValues(obj2, obj1, 'score_base')).toBeGreaterThan(0)
        })
    })

    describe('Filter matching functions', () => {
        const mockVulns = [
            {
                id: 1,
                connection_id: 'conn-1',
                connection_name: 'Conn A',
                agent_name: 'Agent-1',
                cve_id: 'CVE-2023-1234',
                package_name: 'bash',
                severity: 'critical',
                score_base: 9.8
            },
            {
                id: 2,
                connection_id: 'conn-2',
                connection_name: 'Conn B',
                agent_name: 'Agent-2',
                cve_id: 'CVE-2022-0001',
                package_name: 'curl',
                severity: 'low',
                score_base: 4.2
            }
        ]

        beforeEach(() => {
            vi.clearAllMocks()
            wazuhService.getConnections.mockResolvedValue({ data: [] })
        })

        it('matchesConnection returns true when no connection selected', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedConnection = ''
            expect(wrapper.vm.matchesConnection(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesConnection(mockVulns[1])).toBe(true)
        })

        it('matchesConnection filters by connection_id', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedConnection = 'conn-1'
            expect(wrapper.vm.matchesConnection(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesConnection(mockVulns[1])).toBe(false)
        })

        it('matchesAgent with empty selection matches all', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedAgents = []
            expect(wrapper.vm.matchesAgent(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesAgent(mockVulns[1])).toBe(true)
        })

        it('matchesAgent filters by selected agents', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedAgents = ['Agent-1']
            expect(wrapper.vm.matchesAgent(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesAgent(mockVulns[1])).toBe(false)
        })

        it('matchesVuln filters by CVE ID', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedVulns = ['CVE-2023-1234']
            expect(wrapper.vm.matchesVuln(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesVuln(mockVulns[1])).toBe(false)
        })

        it('matchesPackage filters by package name', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedPackages = ['bash']
            expect(wrapper.vm.matchesPackage(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesPackage(mockVulns[1])).toBe(false)
        })

        it('matchesSeverity filters by severity level', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedSeverities = ['CRITICAL']
            expect(wrapper.vm.matchesSeverity(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesSeverity(mockVulns[1])).toBe(false)
        })

        it('matchesSeverity handles uppercasing', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedSeverities = ['LOW']
            const vulnWithLower = { ...mockVulns[1], severity: 'low' }
            expect(wrapper.vm.matchesSeverity(vulnWithLower)).toBe(true)
        })

        it('matchesSeverity handles null severity', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.selectedSeverities = ['UNKNOWN']
            const vulnNoSeverity = { ...mockVulns[0], severity: null }
            expect(wrapper.vm.matchesSeverity(vulnNoSeverity)).toBe(true)
        })

        it('matchesScore filters by CVSS score range', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.scoreMin = 5
            wrapper.vm.scoreMax = 10
            expect(wrapper.vm.matchesScore(mockVulns[0])).toBe(true)
            expect(wrapper.vm.matchesScore(mockVulns[1])).toBe(false)
        })

        it('matchesScore handles null score', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.scoreMin = 0
            wrapper.vm.scoreMax = 10
            const vulnNoScore = { ...mockVulns[0], score_base: null }
            expect(wrapper.vm.matchesScore(vulnNoScore)).toBe(false)
        })

        it('matchesScore with empty min returns true', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: mockVulns })
            const wrapper = mount(Dashboard)
            await flushPromises()

            wrapper.vm.scoreMin = ''
            wrapper.vm.scoreMax = ''
            expect(wrapper.vm.matchesScore(mockVulns[0])).toBe(true)
        })
    })

    describe('updateFilterOptions utility function', () => {
        it('extracts unique agents from vulnerabilities', async () => {
            const vulnsWithAgents = [
                { agent_name: 'Agent-1', cve_id: 'CVE-1', package_name: 'pkg1', severity: 'critical' },
                { agent_name: 'Agent-2', cve_id: 'CVE-2', package_name: 'pkg2', severity: 'low' },
                { agent_name: 'Agent-1', cve_id: 'CVE-3', package_name: 'pkg3', severity: 'medium' }
            ]
            vulnService.getVulns.mockResolvedValueOnce({ data: vulnsWithAgents })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.agentOptions).toEqual(['Agent-1', 'Agent-2'])
        })

        it('extracts unique CVE IDs', async () => {
            const vulnsWithCVE = [
                { agent_name: 'A1', cve_id: 'CVE-2023-1234', package_name: 'pkg1', severity: 'critical' },
                { agent_name: 'A2', cve_id: 'CVE-2022-0001', package_name: 'pkg2', severity: 'low' }
            ]
            vulnService.getVulns.mockResolvedValueOnce({ data: vulnsWithCVE })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.vulnOptions).toEqual(['CVE-2022-0001', 'CVE-2023-1234'])
        })

        it('extracts unique package names', async () => {
            const vulnsWithPackages = [
                { agent_name: 'A1', cve_id: 'CVE-1', package_name: 'bash', severity: 'critical' },
                { agent_name: 'A2', cve_id: 'CVE-2', package_name: 'curl', severity: 'low' }
            ]
            vulnService.getVulns.mockResolvedValueOnce({ data: vulnsWithPackages })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.packageOptions).toEqual(['bash', 'curl'])
        })

        it('handles missing fields gracefully', async () => {
            const vulnsWithMissing = [
                { agent_name: null, cve_id: 'CVE-1', package_name: 'pkg1', severity: 'critical' },
                { agent_name: 'Agent-2', cve_id: undefined, package_name: 'pkg2', severity: 'low' },
                { agent_name: 'Agent-3', cve_id: 'CVE-3', package_name: null, severity: 'medium' }
            ]
            vulnService.getVulns.mockResolvedValueOnce({ data: vulnsWithMissing })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.agentOptions).toEqual(['Agent-2', 'Agent-3'])
            expect(wrapper.vm.vulnOptions).toEqual(['CVE-1', 'CVE-3'])
            expect(wrapper.vm.packageOptions).toEqual(['pkg1', 'pkg2'])
        })

        it('sorts severity options by severity level (descending)', async () => {
            const vulnsWithSeverity = [
                { agent_name: 'A1', cve_id: 'CVE-1', package_name: 'pkg1', severity: 'low' },
                { agent_name: 'A2', cve_id: 'CVE-2', package_name: 'pkg2', severity: 'critical' },
                { agent_name: 'A3', cve_id: 'CVE-3', package_name: 'pkg3', severity: 'medium' },
                { agent_name: 'A4', cve_id: 'CVE-4', package_name: 'pkg4', severity: 'high' }
            ]
            vulnService.getVulns.mockResolvedValueOnce({ data: vulnsWithSeverity })
            const wrapper = mount(Dashboard)
            await flushPromises()

            // Should be sorted: CRITICAL, HIGH, MEDIUM, LOW
            expect(wrapper.vm.severityOptions[0]).toBe('CRITICAL')
            expect(wrapper.vm.severityOptions[1]).toBe('HIGH')
            expect(wrapper.vm.severityOptions[2]).toBe('MEDIUM')
            expect(wrapper.vm.severityOptions[3]).toBe('LOW')
        })

        it('uppercases severity values', async () => {
            const vulnsWithLowerSeverity = [
                { agent_name: 'A1', cve_id: 'CVE-1', package_name: 'pkg1', severity: 'critical' }
            ]
            vulnService.getVulns.mockResolvedValueOnce({ data: vulnsWithLowerSeverity })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.severityOptions).toContain('CRITICAL')
        })
    })

    describe('isNew utility function', () => {
        it('returns false for null/undefined dates', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            expect(wrapper.vm.isNew(null)).toBe(false)
            expect(wrapper.vm.isNew(undefined)).toBe(false)
        })

        it('returns true for dates within last 24 hours', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const now = new Date().toISOString()
            expect(wrapper.vm.isNew(now)).toBe(true)
        })

        it('returns true for dates 24 hours ago (boundary)', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const oneDayAgo = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            expect(wrapper.vm.isNew(oneDayAgo)).toBe(true)
        })

        it('returns false for dates older than 24 hours', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const twoDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
            expect(wrapper.vm.isNew(twoDaysAgo)).toBe(false)
        })

        it('handles edge case of exactly 1 day', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            const wrapper = mount(Dashboard)
            await flushPromises()

            const date = new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000)
            expect(wrapper.vm.isNew(date.toISOString())).toBe(true)
        })
        it('covers additional edge cases and template functions', async () => {
            vulnService.getVulns.mockResolvedValueOnce({ data: [] })
            wazuhService.getConnections.mockRejectedValueOnce(new Error('Fetch error'))

            const wrapper = mount(Dashboard, { attachTo: document.body })
            await flushPromises()

            // fetchConnections error branch
            expect(wrapper.vm.connections).toEqual([])

            // fetchVulns no data branch
            vulnService.getVulns.mockResolvedValueOnce({ data: null })
            await wrapper.vm.fetchVulns()
            expect(wrapper.vm.vulns).toEqual([])

            // Click outside functions (anonymous in template)
            wrapper.vm.dropdowns.agents = true
            wrapper.vm.dropdowns.vulns = true
            wrapper.vm.dropdowns.packages = true
            wrapper.vm.dropdowns.severity = true

            document.body.click()
            await wrapper.vm.$nextTick()

            expect(wrapper.vm.dropdowns.agents).toBe(false)
            expect(wrapper.vm.dropdowns.vulns).toBe(false)
            expect(wrapper.vm.dropdowns.packages).toBe(false)
            expect(wrapper.vm.dropdowns.severity).toBe(false)
        })
    })
})
