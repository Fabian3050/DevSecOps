import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TimelineKpiStrip from '@/presentation/views/timeline/components/TimelineKpiStrip.vue'

describe('TimelineKpiStrip.vue', () => {
  it('renders all KPI cards with correct values', () => {
    const wrapper = mount(TimelineKpiStrip, {
      props: {
        hasBuilt: true,
        paintedCount: 15,
        latestSnap: {
          pending: 8,
          resolved: 12,
          total: 20
        }
      }
    })

    expect(wrapper.text()).toContain('Registros de eventos')
    expect(wrapper.text()).toContain('15')
    
    expect(wrapper.text()).toContain('Pendientes')
    expect(wrapper.text()).toContain('8')
    
    expect(wrapper.text()).toContain('Resueltos')
    expect(wrapper.text()).toContain('12')
    
    expect(wrapper.text()).toContain('Total')
    expect(wrapper.text()).toContain('20')
  })

  it('displays zero values correctly', () => {
    const wrapper = mount(TimelineKpiStrip, {
      props: {
        hasBuilt: true,
        paintedCount: 0,
        latestSnap: {
          pending: 0,
          resolved: 0,
          total: 0
        }
      }
    })

    const kpiValues = wrapper.findAll('.kpi-val')
    expect(kpiValues).toHaveLength(4)
    
    kpiValues.forEach(value => {
      expect(value.text()).toBe('0')
    })
  })

  it('applies correct danger styling to pending card', () => {
    const wrapper = mount(TimelineKpiStrip, {
      props: {
        hasBuilt: true,
        paintedCount: 5,
        latestSnap: {
          pending: 3,
          resolved: 2,
          total: 5
        }
      }
    })

    const cards = wrapper.findAll('.kpi-card')
    expect(cards.length).toBe(4)
    
    // Second card should be "Pendientes" with danger class
    const pendingCard = cards[1]
    expect(pendingCard.classes()).toContain('kpi-card')
    expect(pendingCard.text()).toContain('Pendientes')
  })

  it('applies correct success styling to resolved card', () => {
    const wrapper = mount(TimelineKpiStrip, {
      props: {
        hasBuilt: true,
        paintedCount: 5,
        latestSnap: {
          pending: 1,
          resolved: 4,
          total: 5
        }
      }
    })

    const cards = wrapper.findAll('.kpi-card')
    
    // Third card should be "Resueltos" with success class
    const resolvedCard = cards[2]
    expect(resolvedCard.text()).toContain('Resueltos')
    expect(resolvedCard.text()).toContain('4')
  })

  it('handles large numbers correctly', () => {
    const wrapper = mount(TimelineKpiStrip, {
      props: {
        hasBuilt: true,
        paintedCount: 1523,
        latestSnap: {
          pending: 856,
          resolved: 2341,
          total: 3197
        }
      }
    })

    expect(wrapper.text()).toContain('1523')
    expect(wrapper.text()).toContain('856')
    expect(wrapper.text()).toContain('2341')
    expect(wrapper.text()).toContain('3197')
  })

  it('renders kpi cards with hover animation classes', () => {
    const wrapper = mount(TimelineKpiStrip, {
      props: {
        paintedCount: 10,
        latestSnap: {
          pending: 5,
          resolved: 5,
          total: 10
        }
      }
    })

    const cards = wrapper.findAll('.kpi-card')
    cards.forEach(card => {
      expect(card.classes()).toContain('kpi-card')
    })
  })

  it('maintains correct order of KPI cards', () => {
    const wrapper = mount(TimelineKpiStrip, {
      props: {
        hasBuilt: true,
        paintedCount: 10,
        latestSnap: {
          pending: 5,
          resolved: 5,
          total: 10
        }
      }
    })

    const labels = wrapper.findAll('.kpi-label')
    expect(labels[0].text()).toBe('Registros de eventos')
    expect(labels[1].text()).toBe('Pendientes')
    expect(labels[2].text()).toBe('Resueltos')
    expect(labels[3].text()).toBe('Total')
  })
})
