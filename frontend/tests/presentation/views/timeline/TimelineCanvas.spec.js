import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TimelineCanvas from '@/presentation/views/timeline/components/TimelineCanvas.vue'

const visibleSlots = [
  {
    startMs: 1,
    painted: true,
    type: 'detection',
    tickLabel: '08/03',
    cardLabel: '08/03 2026',
    total: 4,
    pending: 3,
    resolved: 1,
    details: [{ id: 1 }]
  },
  {
    startMs: 2,
    painted: false,
    type: 'none',
    tickLabel: '09/03',
    cardLabel: '09/03 2026',
    total: 0,
    pending: 0,
    resolved: 0,
    details: []
  }
]

describe('TimelineCanvas.vue', () => {
  it('emits navigation events and respects disabled states', async () => {
    const wrapper = mount(TimelineCanvas, {
      props: {
        allSlots: visibleSlots,
        visibleSlots,
        paintedCount: 1,
        yearLabel: '2026',
        activeZoom: { label: '30D' },
        canMoveLeft: true,
        canMoveRight: false,
        canZoomIn: true,
        canZoomOut: false
      }
    })

    const buttons = wrapper.findAll('.btn-icon')
    // buttons: 0: move-left, 1: zoom-out, 2: zoom-in, 3: move-right

    // Test move-left (enabled)
    await buttons[0].trigger('click')
    expect(wrapper.emitted('move-left')).toBeTruthy()

    // Test zoom-out (disabled)
    expect(buttons[1].element.disabled).toBe(true)
    await buttons[1].trigger('click')
    expect(wrapper.emitted('zoom-out')).toBeFalsy()

    // Test zoom-in (enabled)
    await buttons[2].trigger('click')
    expect(wrapper.emitted('zoom-in')).toBeTruthy()

    // Test move-right (disabled)
    expect(buttons[3].element.disabled).toBe(true)
    await buttons[3].trigger('click')
    expect(wrapper.emitted('move-right')).toBeFalsy()
  })

  it('computes stageStyle correctly', () => {
    const wrapper = mount(TimelineCanvas, {
      props: {
        allSlots: visibleSlots,
        visibleSlots,
        paintedCount: 1,
        activeZoom: { label: '30D' }
      }
    })

    const stage = wrapper.find('.ig-stage')
    expect(stage.attributes('style')).toContain('--slot-count: 2')
  })

  it('renders painted and empty slots correctly', () => {
    const wrapper = mount(TimelineCanvas, {
      props: {
        allSlots: visibleSlots,
        visibleSlots,
        paintedCount: 1,
        activeZoom: { label: '30D' }
      }
    })

    const segments = wrapper.findAll('.ig-segment')
    expect(segments[0].classes()).toContain('detection')
    expect(segments[1].classes()).toContain('empty')
  })
})
