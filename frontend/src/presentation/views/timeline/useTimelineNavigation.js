import { computed, ref } from 'vue'

export const zoomLevels = [
  { label: '30D', windowHours: 720, slotHours: 24 },
  { label: '15D', windowHours: 360, slotHours: 24 },
  { label: '7D', windowHours: 168, slotHours: 24 },
  { label: '3D', windowHours: 72, slotHours: 24 },
  { label: '1D', windowHours: 24, slotHours: 24 },
  { label: '12H', windowHours: 12, slotHours: 1 },
  { label: '6H', windowHours: 6, slotHours: 1 },
  { label: '3H', windowHours: 3, slotHours: 1 },
  { label: '1H', windowHours: 1, slotHours: 1 }
]

export default function useTimelineNavigation(getSlotsLength) {
  const zoomLevelIndex = ref(0)
  const viewStartIndex = ref(0)

  const activeZoom = computed(() => zoomLevels[zoomLevelIndex.value])
  const visibleCount = computed(() => Math.max(1, Math.round(activeZoom.value.windowHours / activeZoom.value.slotHours)))
  const maxViewStart = computed(() => Math.max(0, getSlotsLength() - visibleCount.value))

  const canMoveLeft = computed(() => viewStartIndex.value > 0)
  const canMoveRight = computed(() => viewStartIndex.value < maxViewStart.value)
  const canZoomIn = computed(() => zoomLevelIndex.value < zoomLevels.length - 1)
  const canZoomOut = computed(() => zoomLevelIndex.value > 0)

  const normalizeViewIndex = () => {
    viewStartIndex.value = Math.min(viewStartIndex.value, maxViewStart.value)
  }

  const setZoomLevel = index => {
    zoomLevelIndex.value = Math.max(0, Math.min(index, zoomLevels.length - 1))
    normalizeViewIndex()
  }

  const zoomIn = () => {
    if (!canZoomIn.value) return
    zoomLevelIndex.value += 1
    normalizeViewIndex()
  }

  const zoomOut = () => {
    if (!canZoomOut.value) return
    zoomLevelIndex.value -= 1
    normalizeViewIndex()
  }

  const moveLeft = () => {
    if (!canMoveLeft.value) return
    const step = Math.max(1, Math.floor(visibleCount.value / 2))
    viewStartIndex.value = Math.max(0, viewStartIndex.value - step)
  }

  const moveRight = () => {
    if (!canMoveRight.value) return
    const step = Math.max(1, Math.floor(visibleCount.value / 2))
    viewStartIndex.value = Math.min(maxViewStart.value, viewStartIndex.value + step)
  }

  const jumpToEnd = () => {
    viewStartIndex.value = maxViewStart.value
  }

  return {
    zoomLevelIndex,
    viewStartIndex,
    activeZoom,
    visibleCount,
    maxViewStart,
    canMoveLeft,
    canMoveRight,
    canZoomIn,
    canZoomOut,
    setZoomLevel,
    zoomIn,
    zoomOut,
    moveLeft,
    moveRight,
    jumpToEnd,
    normalizeViewIndex
  }
}
