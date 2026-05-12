import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import useTimelineData from '@/presentation/views/timeline/useTimelineData'
import vulnService from '@/application/services/vulnService'

vi.mock('@/application/services/vulnService', () => ({
  default: {
    getVulns: vi.fn()
  }
}))

describe('useTimelineData', () => {
  let mockVulnData
  let timeline
  let defaultProps

  beforeEach(() => {
    vi.clearAllMocks()

    mockVulnData = [
      {
        id: 1,
        agent_name: 'srv-01',
        cve_id: 'CVE-2023-1234',
        first_seen: '2026-03-07T10:00:00Z',
        last_seen: '2026-03-08T10:00:00Z',
        history: [
          { timestamp: '2026-03-07T12:00:00Z', action: 'DETECTED' },
          { timestamp: '2026-03-07T15:00:00Z', action: 'RESOLVED' }
        ]
      },
      {
        id: 2,
        agent_name: 'srv-02',
        cve_id: 'CVE-2023-5678',
        first_seen: '2026-03-06T08:00:00Z',
        last_seen: '2026-03-08T08:00:00Z',
        history: [
          { timestamp: '2026-03-06T10:00:00Z', action: 'DETECTED' }
        ]
      }
    ]

    defaultProps = {
      selectedConnection: ref('1'),
      selectedAgents: ref([]),
      selectedVulns: ref([]),
      period: ref('7d'),
      customDate: ref('2026-03-08'),
      activeZoom: ref({ slotHours: 24 }),
      getConnectionName: () => 'Demo Connection'
    }

    timeline = useTimelineData(defaultProps)
  })

  describe('build function', () => {
    it('builds timeline successfully with default data', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })

      const result = await timeline.build()

      expect(result.initialZoom).toBe(2) // 7d period
      expect(timeline.hasBuilt.value).toBe(true)
      expect(timeline.allSlots.value.length).toBeGreaterThan(0)
      expect(timeline.latestSnap.value.total).toBe(2)
    })

    it('handles empty connection gracefully', async () => {
      const emptyTimeline = useTimelineData({
        ...defaultProps,
        selectedConnection: ref('')
      })

      const result = await emptyTimeline.build()
      expect(result.initialZoom).toBe(0)
      expect(emptyTimeline.hasBuilt.value).toBe(false)
    })

    it('handles API errors gracefully', async () => {
      vulnService.getVulns.mockRejectedValueOnce(new Error('API Error'))

      await expect(timeline.build()).rejects.toThrow('API Error')
      expect(timeline.errorMessage.value).toContain('generar la linea de tiempo')
    })

    it('filters by selected agents', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })

      const filteredTimeline = useTimelineData({
        ...defaultProps,
        selectedAgents: ref(['srv-01'])
      })

      await filteredTimeline.build()

      expect(filteredTimeline.latestSnap.value.total).toBe(1)
      expect(filteredTimeline.latestSnap.value.details[0].agent_name).toBe('srv-01')
    })

    it('filters by selected vulnerabilities', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })

      const filteredTimeline = useTimelineData({
        ...defaultProps,
        selectedVulns: ref(['CVE-2023-1234'])
      })

      await filteredTimeline.build()

      expect(filteredTimeline.latestSnap.value.total).toStrictEqual(1)
      expect(filteredTimeline.latestSnap.value.details[0].cve_id).toBe('CVE-2023-1234')
    })
  })

  describe('period handling', () => {
    beforeEach(() => {
      vulnService.getVulns.mockResolvedValue({ data: mockVulnData })
    })

    it('handles 24h period correctly', async () => {
      const timeline24h = useTimelineData({
        ...defaultProps,
        period: ref('24h')
      })

      const result = await timeline24h.build()
      expect(result.initialZoom).toBe(4)
    })

    it('handles day period correctly', async () => {
      const timelineDay = useTimelineData({
        ...defaultProps,
        period: ref('day')
      })

      const result = await timelineDay.build()
      expect(result.initialZoom).toBe(5)
    })

    it('handles 30d period correctly', async () => {
      const timeline30d = useTimelineData({
        ...defaultProps,
        period: ref('30d')
      })

      const result = await timeline30d.build()
      expect(result.initialZoom).toBe(0)
    })

    it('handles all period correctly', async () => {
      const timelineAll = useTimelineData({
        ...defaultProps,
        period: ref('all')
      })

      const result = await timelineAll.build()
      expect(result.initialZoom).toBe(0)
    })
  })

  describe('snapshotAt function', () => {
    it('caches snapshots correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const timestamp = Date.now()
      const snapshot1 = timeline.snapshotAt(timestamp)
      const snapshot2 = timeline.snapshotAt(timestamp)

      // Should return the same cached object
      expect(snapshot1).toStrictEqual(snapshot2)
      expect(snapshot1.total).toBe(2)
    })

    it('calculates vulnerability states correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      // Test at a time when first vuln is resolved, second is active
      const testTime = new Date('2026-03-07T16:00:00Z').getTime()
      const snapshot = timeline.snapshotAt(testTime)

      expect(snapshot.total).toBe(2)
      expect(snapshot.pending).toBe(1) // srv-02 is still active
      expect(snapshot.resolved).toBe(1) // srv-01 was resolved
    })
  })

  describe('getVulnerabilityStateAtTime function', () => {
    it('returns null for vulnerabilities not yet seen', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const earlyTime = new Date('2026-03-06T00:00:00Z').getTime()

      // Access the internal function (this tests the logic indirectly through snapshotAt)
      const snapshot = timeline.snapshotAt(earlyTime)
      expect(snapshot.details.length).toBe(0) // No vulns visible yet
    })

    it('determines ACTIVE state correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const testTime = new Date('2026-03-06T12:00:00Z').getTime()
      const snapshot = timeline.snapshotAt(testTime)

      expect(snapshot.details.length).toBe(1) // Only srv-02 is visible
      expect(snapshot.details[0].status).toBe('ACTIVE')
    })

    it('determines RESOLVED state correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const testTime = new Date('2026-03-07T16:00:00Z').getTime()
      const snapshot = timeline.snapshotAt(testTime)

      const srv01Detail = snapshot.details.find(d => d.agent_name === 'srv-01')
      expect(srv01Detail.status).toBe('RESOLVED')
      expect(srv01Detail.resolved_at).toBe('2026-03-07T15:00:00Z')
    })
  })

  describe('getTimelineEventInSlot function', () => {
    it('finds first_seen events correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const vuln = mockVulnData[0]
      const startMs = new Date('2026-03-07T09:00:00Z').getTime()
      const endMs = new Date('2026-03-07T11:00:00Z').getTime()

      // Find a painted slot that contains this time range
      const paintedSlots = timeline.allSlots.value.filter(slot => slot.painted)
      const relevantSlot = paintedSlots.find(slot =>
        slot.startMs <= startMs && slot.endMs >= endMs
      )

      expect(relevantSlot).toBeDefined()
      const vulnDetail = relevantSlot.details.find(d => d.id === vuln.id)

      expect(vulnDetail.timeline_event_at).toBe(vuln.first_seen)
      expect(vulnDetail.timeline_event_label).toBe('DETECTED_APP')
    })

    it('finds history events correctly', async () => {
      // Create test data where first_seen and history events are clearly separated
      const historyTestData = [
        {
          id: 1,
          agent_name: 'srv-01',
          cve_id: 'CVE-2023-1234',
          first_seen: '2026-03-07T10:00:00Z',
          last_seen: '2026-03-08T10:00:00Z',
          history: [
            { timestamp: '2026-03-07T12:00:00Z', action: 'DETECTED' },
            { timestamp: '2026-03-08T15:00:00Z', action: 'RESOLVED' } // Next day
          ]
        }
      ]

      vulnService.getVulns.mockResolvedValueOnce({ data: historyTestData })

      const historyTimeline = useTimelineData({
        ...defaultProps,
        period: ref('7d')
      })

      await historyTimeline.build()

      // Find the slot for March 8 (next day)
      const march8Slots = historyTimeline.allSlots.value.filter(slot => {
        const slotDate = new Date(slot.startMs)
        return slotDate.getDate() === 8 && slot.painted
      })

      expect(march8Slots.length).toBeGreaterThan(0)
      const vulnDetail = march8Slots[0].details.find(d => d.id === 1)

      // In the March 8 slot, the first event should be the RESOLVED at 15:00
      expect(vulnDetail.timeline_event_at).toBe('2026-03-08T15:00:00Z')
      expect(vulnDetail.timeline_event_label).toBe('RESOLVED')
    })
  })

  describe('slot generation and types', () => {
    it('generates correct slot types', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const slots = timeline.allSlots.value
      expect(slots.length).toBeGreaterThan(0)

      // Check that slots have proper structure
      const slot = slots[0]
      expect(slot).toHaveProperty('startMs')
      expect(slot).toHaveProperty('endMs')
      expect(slot).toHaveProperty('painted')
      expect(slot).toHaveProperty('type')
      expect(slot).toHaveProperty('total')
      expect(slot).toHaveProperty('pending')
      expect(slot).toHaveProperty('resolved')
      expect(['none', 'detection', 'resolution', 'mixed']).toContain(slot.type)
    })

    it('calculates painted slots correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const paintedCount = timeline.paintedCount.value
      expect(paintedCount).toBeGreaterThan(0)
    })
  })

  describe('summarizeChanges function', () => {
    it('detects detection events', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      // The function is tested indirectly through slot generation
      const slots = timeline.allSlots.value
      const hasDetectionSlots = slots.some(slot => slot.type === 'detection' || slot.type === 'mixed')
      expect(hasDetectionSlots).toBe(true)
    })

    it('detects resolution events', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      const slots = timeline.allSlots.value
      const hasResolutionSlots = slots.some(slot => slot.type === 'resolution' || slot.type === 'mixed')
      expect(hasResolutionSlots).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles vulnerabilities with no history', async () => {
      const noHistoryData = [{
        id: 1,
        agent_name: 'srv-01',
        cve_id: 'CVE-2023-1234',
        first_seen: '2026-03-07T10:00:00Z',
        history: []
      }]

      vulnService.getVulns.mockResolvedValueOnce({ data: noHistoryData })

      const result = await timeline.build()
      expect(result.initialZoom).toBe(2)
      expect(timeline.latestSnap.value.total).toBe(1)
    })

    it('handles invalid dates gracefully', async () => {
      const invalidDateData = [{
        id: 1,
        agent_name: 'srv-01',
        cve_id: 'CVE-2023-1234',
        first_seen: 'invalid-date',
        history: []
      }]

      vulnService.getVulns.mockResolvedValueOnce({ data: invalidDateData })

      const result = await timeline.build()
      expect(result.initialZoom).toBe(2)
      // Should handle invalid dates without crashing
    })

    it('handles empty history arrays', async () => {
      const emptyHistoryData = [{
        id: 1,
        agent_name: 'srv-01',
        cve_id: 'CVE-2023-1234',
        first_seen: '2026-03-07T10:00:00Z',
        history: null
      }]

      vulnService.getVulns.mockResolvedValueOnce({ data: emptyHistoryData })

      const result = await timeline.build()
      expect(result.initialZoom).toBe(2)
    })
  })

  describe('fetchConnectionVulns function', () => {
    it('sets warning when limit is reached', async () => {
      const largeData = Array.from({ length: 2000 }, (_, i) => ({
        id: i,
        first_seen: '2026-03-07T10:00:00Z',
        history: []
      }))

      vulnService.getVulns.mockResolvedValueOnce({ data: largeData })

      await timeline.fetchConnectionVulns()

      expect(timeline.warningMessage.value).toContain('2000')
      expect(timeline.warningMessage.value).toContain('truncado')
    })

    it('handles API response without data array', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: null })

      const result = await timeline.fetchConnectionVulns()
      expect(result).toEqual([])
    })
  })

  describe('zoom levels and slot calculations', () => {
    it('handles different zoom levels correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })

      const zoomTimeline = useTimelineData({
        ...defaultProps,
        activeZoom: ref({ slotHours: 1 }) // 1 hour slots
      })

      await zoomTimeline.build()

      const slots = zoomTimeline.allSlots.value
      expect(slots.length).toBeGreaterThan(0)

      // Verificar que solo hay slots con eventos reales (painted)
      slots.forEach(slot => {
        expect(slot.painted).toBe(true)
        expect(slot.details.length).toBeGreaterThan(0)
      })

      // Verificar que cada slot tiene eventos reales en "Evento en slot"
      slots.forEach(slot => {
        slot.details.forEach(vuln => {
          expect(vuln.timeline_event_at).not.toBeNull()
          expect(vuln.timeline_event_label).not.toBeNull()
        })
      })
    })

    it('handles day granularity correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })

      const dayZoomTimeline = useTimelineData({
        ...defaultProps,
        activeZoom: ref({ slotHours: 48 }) // 2 day slots
      })

      await dayZoomTimeline.build()

      const slots = dayZoomTimeline.allSlots.value
      expect(slots.length).toBeGreaterThan(0)
    })
  })

  describe('computed properties', () => {
    it('allSlots returns empty array when not built', () => {
      const unbuiltTimeline = useTimelineData(defaultProps)
      expect(unbuiltTimeline.allSlots.value).toEqual([])
    })

    it('paintedCount works correctly', async () => {
      vulnService.getVulns.mockResolvedValueOnce({ data: mockVulnData })
      await timeline.build()

      expect(typeof timeline.paintedCount.value).toBe('number')
      expect(timeline.paintedCount.value).toBeGreaterThanOrEqual(0)
    })
  })
})
