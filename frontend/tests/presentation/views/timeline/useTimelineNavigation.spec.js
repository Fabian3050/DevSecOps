import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import useTimelineNavigation from '@/presentation/views/timeline/useTimelineNavigation'

describe('useTimelineNavigation', () => {
  it('calculates visibility and movement constraints', () => {
    const slotsLength = ref(120)
    const nav = useTimelineNavigation(() => slotsLength.value)

    expect(nav.visibleCount.value).toBe(30)
    expect(nav.canMoveLeft.value).toBe(false)

    nav.jumpToEnd()
    expect(nav.canMoveRight.value).toBe(false)
    expect(nav.canMoveLeft.value).toBe(true)
  })

  it('updates zoom level within bounds', () => {
    const nav = useTimelineNavigation(() => 50)

    const start = nav.zoomLevelIndex.value
    nav.zoomIn()
    expect(nav.zoomLevelIndex.value).toBe(start + 1)

    // Test zoomOut
    nav.zoomOut()
    expect(nav.zoomLevelIndex.value).toBe(start)

    // Test zoomOut boundary
    nav.zoomOut() // Should not go below 0
    expect(nav.zoomLevelIndex.value).toBe(0)

    nav.setZoomLevel(999)
    expect(nav.canZoomIn.value).toBe(false)

    // Test zoomIn boundary
    const lastIndex = nav.zoomLevelIndex.value
    nav.zoomIn() // Should not go above last index
    expect(nav.zoomLevelIndex.value).toBe(lastIndex)

    nav.setZoomLevel(-20)
    expect(nav.zoomLevelIndex.value).toBe(0)
  })

  it('handles movement boundaries', () => {
    const nav = useTimelineNavigation(() => 50) // visibleCount at zoom 0 is 30/1=30 or 720/24=30

    // Initial state: viewStartIndex = 0
    expect(nav.canMoveLeft.value).toBe(false)
    nav.moveLeft() // Should return early
    expect(nav.viewStartIndex.value).toBe(0)

    nav.jumpToEnd()
    expect(nav.viewStartIndex.value).toBe(20) // 50 - 30 = 20
    expect(nav.canMoveRight.value).toBe(false)
    nav.moveRight() // Should return early
    expect(nav.viewStartIndex.value).toBe(20)

    // Test moveLeft step
    nav.moveLeft()
    expect(nav.viewStartIndex.value).toBe(5) // 20 - floor(30/2) = 20 - 15 = 5

    // Test moveRight step
    nav.moveRight()
    expect(nav.viewStartIndex.value).toBe(20) // 5 + 15 = 20
  })

  it('handles empty timeline and normalization', () => {
    const nav = useTimelineNavigation(() => 0)

    expect(nav.maxViewStart.value).toBe(0)
    expect(nav.viewStartIndex.value).toBe(0)

    nav.jumpToEnd()
    expect(nav.viewStartIndex.value).toBe(0)

    nav.viewStartIndex.value = 10
    nav.normalizeViewIndex()
    expect(nav.viewStartIndex.value).toBe(0)
  })
})
