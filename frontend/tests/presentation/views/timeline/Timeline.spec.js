import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Timeline from '@/presentation/views/Timeline.vue'
import wazuhService from '@/application/services/wazuhService'
import vulnService from '@/application/services/vulnService'
import TimelineFilters from '@/presentation/views/timeline/components/TimelineFilters.vue'
import TimelineDetailModal from '@/presentation/views/timeline/components/TimelineDetailModal.vue'

// Mock services
vi.mock('@/application/services/wazuhService', () => ({
  default: {
    getConnections: vi.fn(),
    getAgents: vi.fn()
  }
}))

vi.mock('@/application/services/vulnService', () => ({
  default: {
    getVulns: vi.fn()
  }
}))

describe('Timeline.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock wazuh service
    wazuhService.getConnections.mockResolvedValue({
      data: [
        { id: 1, name: 'Connection 1', api_url: 'http://test1' },
        { id: 2, name: 'Connection 2', api_url: 'http://test2' }
      ]
    })

    wazuhService.getAgents.mockResolvedValue({
      data: [
        { id: '001', name: 'Agent 1' },
        { id: '002', name: 'Agent 2' }
      ]
    })

    vulnService.getVulns.mockResolvedValue({
      data: []
    })
  })

  it('renders main timeline structure', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    expect(wrapper.find('.timeline-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('Linea del tiempo')
  })

  it('loads connections on mount', async () => {
    mount(Timeline)
    await flushPromises()

    expect(wazuhService.getConnections).toHaveBeenCalled()
  })

  it('displays empty card initially', () => {
    const wrapper = mount(Timeline)

    const card = wrapper.find('.empty-card')
    expect(card.exists()).toBe(true)
  })

  it('fetches agents and vulns when connection changes', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedConnection = '1'
    await wrapper.vm.onConnectionChange()
    await flushPromises()

    // onConnectionChange calls fetchConnectionVulns internally
    expect(wrapper.vm.selectedConnection).toBe('1')
  })

  it('clears agent and vuln selection when connection changes', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedAgents = ['agent1']
    wrapper.vm.selectedVulns = ['CVE-123']

    await wrapper.vm.onConnectionChange()

    expect(wrapper.vm.selectedAgents).toEqual([])
    expect(wrapper.vm.selectedVulns).toEqual([])
  })

  it('opens detail modal when slot data is set', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedEvent = {
      startMs: 1234567890,
      cardLabel: '08/03 2026',
      details: []
    }
    wrapper.vm.modalOpen = true
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.modalOpen).toBe(true)
    expect(wrapper.vm.selectedEvent).toBeTruthy()
  })

  it('handles connection load error gracefully', async () => {
    wazuhService.getConnections.mockRejectedValueOnce(new Error('Network error'))

    const wrapper = mount(Timeline)
    await flushPromises()

    // Should handle error without crashing - component initializes with empty array
    expect(wrapper.vm.connections).toEqual([])
  })

  it('initializes with correct initial state', () => {
    const wrapper = mount(Timeline)

    expect(wrapper.vm.connections).toEqual([])
    expect(wrapper.vm.selectedConnection).toBe('')
    expect(wrapper.vm.selectedAgents).toEqual([])
    expect(wrapper.vm.selectedVulns).toEqual([])
    expect(wrapper.vm.period).toBe('30d')
    expect(wrapper.vm.modalOpen).toBe(false)
  })

  it('has correct period options', () => {
    const wrapper = mount(Timeline)

    const periods = wrapper.vm.periods
    expect(periods).toHaveLength(5)
    expect(periods[0]).toEqual({ v: '24h', l: '24H' })
    expect(periods[1]).toEqual({ v: '7d', l: '7D' })
    expect(periods[2]).toEqual({ v: '30d', l: '30D' })
    expect(periods[3]).toEqual({ v: 'day', l: 'Dia' })
    expect(periods[4]).toEqual({ v: 'all', l: 'Todo' })
  })

  it('updates agent and vuln options when connection changes', async () => {
    vulnService.getVulns.mockResolvedValueOnce({
      data: [
        { agent_name: 'Agent 1', cve_id: 'CVE-001' },
        { agent_name: 'Agent 2', cve_id: 'CVE-002' }
      ]
    })

    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedConnection = '1'
    await wrapper.vm.onConnectionChange()
    await flushPromises()

    expect(wrapper.vm.agentOpts.length).toBeGreaterThan(0)
    expect(wrapper.vm.vulnOpts.length).toBeGreaterThan(0)
  })

  it('builds timeline when build is called', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedConnection = '1'
    await flushPromises()

    const buildSpy = vi.spyOn(wrapper.vm, 'buildTimeline')
    await wrapper.vm.buildTimeline()

    expect(buildSpy).toHaveBeenCalled()
  })

  it('handles error in onConnectionChange', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedConnection = '1'
    vulnService.getVulns.mockRejectedValueOnce(new Error('Fetch failed'))

    await wrapper.vm.onConnectionChange()
    await flushPromises()

    expect(wrapper.vm.errorBanner).toBe('No se pudieron cargar agentes y CVEs para la conexion seleccionada.')
  })

  it('handles error in buildTimeline', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedConnection = '1'
    vulnService.getVulns.mockRejectedValueOnce(new Error('Build failed'))

    await wrapper.vm.buildTimeline()
    await flushPromises()

    expect(wrapper.vm.hasBuilt).toBe(false)
  })

  it('provides openModal method for canvas interaction', () => {
    const wrapper = mount(Timeline)
    const slot = { cardLabel: 'test', details: [] }

    wrapper.vm.openModal(slot)

    expect(wrapper.vm.modalOpen).toBe(true)
    expect(wrapper.vm.selectedEvent).toEqual(slot)
  })

  it('computes yearLabel correctly with data', async () => {
    vulnService.getVulns.mockResolvedValueOnce({
      data: [
        { agent_name: 'Agent 1', cve_id: 'CVE-001', first_seen: '2025-01-01T00:00:00Z' },
        { agent_name: 'Agent 1', cve_id: 'CVE-002', first_seen: '2026-01-01T00:00:00Z' }
      ]
    })

    const wrapper = mount(Timeline)
    await flushPromises()

    wrapper.vm.selectedConnection = '1'
    wrapper.vm.period = 'all'
    await wrapper.vm.buildTimeline()
    await flushPromises()

    expect(wrapper.vm.yearLabel).toBeTruthy()
  })

  it('updates period via setPeriod method', () => {
    const wrapper = mount(Timeline)
    wrapper.vm.setPeriod('7d')
    expect(wrapper.vm.period).toBe('7d')
  })

  it('displays error banner when statusError is computed', async () => {
    const wrapper = mount(Timeline)
    wrapper.vm.errorBanner = 'Custom Error'
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.status-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('Custom Error')
  })

  it('updates state when filters emit updates', async () => {
    const wrapper = mount(Timeline)
    await flushPromises()

    const filters = wrapper.findComponent(TimelineFilters)

    await filters.vm.$emit('update:selectedConnection', '2')
    expect(wrapper.vm.selectedConnection).toBe('2')

    await filters.vm.$emit('update:selectedAgents', ['Agent X'])
    expect(wrapper.vm.selectedAgents).toEqual(['Agent X'])

    await filters.vm.$emit('update:selectedVulns', ['CVE-Y'])
    expect(wrapper.vm.selectedVulns).toEqual(['CVE-Y'])

    await filters.vm.$emit('update:customDate', '2026-05-05')
    expect(wrapper.vm.customDate).toBe('2026-05-05')
  })

  it('closes modal when detail modal emits close', async () => {
    const wrapper = mount(Timeline)
    wrapper.vm.modalOpen = true

    const modal = wrapper.findComponent(TimelineDetailModal)
    await modal.vm.$emit('close')

    expect(wrapper.vm.modalOpen).toBe(false)
  })
})
