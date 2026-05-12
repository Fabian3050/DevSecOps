import { describe, it, expect } from 'vitest'
import { alignHour, badge, fmtDDMM, fmtHour, fmtYear } from '@/presentation/views/timeline/timelineFormatters'

describe('timelineFormatters', () => {
  it('formats day and year values', () => {
    const value = new Date('2026-03-08T14:33:00').getTime()
    expect(fmtDDMM(value)).toBe('08/03')
    expect(fmtYear(value)).toBe('2026')
  })

  it('formats hour at slot start', () => {
    const value = new Date('2026-03-08T14:33:00').getTime()
    expect(fmtHour(value)).toBe('14:00')
  })

  it('returns badge labels by type', () => {
    expect(badge('detection')).toBe('NUEVA')
    expect(badge('resolution')).toBe('RESUELTA')
    expect(badge('mixed')).toBe('MIXTO')
  })

  it('aligns timestamp to the nearest hour start', () => {
    const value = new Date('2026-03-08T14:33:59').getTime()
    const aligned = alignHour(value)
    const alignedDate = new Date(aligned)
    expect(alignedDate.getMinutes()).toBe(0)
    expect(alignedDate.getSeconds()).toBe(0)
  })
})
