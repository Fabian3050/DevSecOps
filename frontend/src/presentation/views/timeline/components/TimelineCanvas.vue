<template>
  <div class="card timeline-card">
    <div class="tl-toolbar">
      <div class="tl-toolbar-left">
        <span class="tl-year">{{ yearLabel }}</span>

      </div>
      <div class="tl-toolbar-right">
        <button class="btn btn-outline btn-icon" @click="emit('move-left')" :disabled="!canMoveLeft">◀</button>
        <button class="btn btn-outline btn-icon" @click="emit('zoom-out')" :disabled="!canZoomOut">-</button>
        <span class="zoom-badge">{{ activeZoom.label }}</span>
        <button class="btn btn-outline btn-icon" @click="emit('zoom-in')" :disabled="!canZoomIn">+</button>
        <button class="btn btn-outline btn-icon" @click="emit('move-right')" :disabled="!canMoveRight">▶</button>
      </div>
    </div>

    <div class="ig-stage" :style="stageStyle">
      <div class="ig-label-row">
        <div v-for="slot in visibleSlots" :key="`l-${slot.startMs}`" class="ig-label-slot">
          <span v-if="slot.painted" class="ig-label" :class="slot.type">{{ badge(slot.type) }}</span>
        </div>
      </div>

      <div class="ig-track-wrap">
        <div class="ig-segments">
          <div
            v-for="slot in visibleSlots"
            :key="`s-${slot.startMs}`"
            class="ig-segment"
            :class="slot.painted ? slot.type : 'empty'"
          >
            <span class="segment-date">{{ slot.tickLabel }}</span>
          </div>
        </div>
      </div>

      <div class="ig-cards-row">
        <div v-for="slot in visibleSlots" :key="`c-${slot.startMs}`" class="ig-card-slot">
          <button v-if="slot.painted" class="event-card" :class="slot.type" @click="emit('open-slot', slot)">
            <div class="card-top">{{ slot.cardLabel }}</div>
            <div class="card-stats">
              <span>Total: <strong>{{ slot.total }}</strong></span>
              <span class="danger">Pendientes: <strong>{{ slot.pending }}</strong></span>
              <span class="success">Resueltos: <strong>{{ slot.resolved }}</strong></span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { badge } from '../timelineFormatters'

const props = defineProps({
  allSlots: { type: Array, required: true },
  visibleSlots: { type: Array, required: true },
  paintedCount: { type: Number, required: true },
  yearLabel: { type: String, default: '' },
  activeZoom: { type: Object, required: true },
  canMoveLeft: { type: Boolean, default: false },
  canMoveRight: { type: Boolean, default: false },
  canZoomIn: { type: Boolean, default: false },
  canZoomOut: { type: Boolean, default: false }
})

const emit = defineEmits(['move-left', 'move-right', 'zoom-in', 'zoom-out', 'open-slot'])

const stageStyle = computed(() => ({ '--slot-count': String(Math.max(1, props.visibleSlots.length)) }))
</script>

<style scoped>
.timeline-card { padding: 0; overflow: hidden; }
.tl-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1.2rem; border-bottom: 1px solid var(--border); background: var(--bg-hover); }
.tl-toolbar-left { display: flex; gap: 1rem; align-items: center; }
.tl-year { font-weight: 800; font-size: 0.95rem; }
.tl-info { font-size: 0.78rem; color: var(--text-muted); }
.tl-toolbar-right { display: flex; align-items: center; gap: 0.4rem; }
.zoom-badge { min-width: 52px; text-align: center; font-weight: 800; font-size: 0.78rem; color: var(--text-muted); }
.btn-outline { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
.btn-outline:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.btn-icon { width: 34px; height: 34px; padding: 0; }

.ig-stage {
  position: relative;
  padding: 2.2rem 1.2rem 1.5rem;
  background: linear-gradient(180deg, #f8f7f0 0%, #f1f4ee 100%);
  overflow-x: auto;
}

.ig-label-row,
.ig-cards-row,
.ig-segments {
  display: grid;
  grid-template-columns: repeat(var(--slot-count), minmax(90px, 1fr));
  gap: 0.75rem;
}

.ig-label-slot,
.ig-card-slot { display: flex; justify-content: center; }

.ig-label {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #fff;
}

.ig-label.detection { background: #6ea42a; }
.ig-label.resolution { background: #059669; }
.ig-label.mixed { background: #d97706; }

.ig-track-wrap { position: relative; margin-top: 1rem; }
.ig-segments { align-items: center; }

.ig-segment {
  min-height: 30px;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: #d1d5db;
}

.ig-segment.empty { opacity: 0.45; }
.ig-segment.detection { background: #6ea42a; color: #fff; }
.ig-segment.resolution { background: #059669; color: #fff; }
.ig-segment.mixed { background: #d97706; color: #fff; }

.segment-date { font-size: 0.72rem; font-weight: 700; }

.ig-cards-row { margin-top: 1.6rem; }

.event-card {
  width: 100%;
  max-width: 160px;
  min-height: 138px;
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  color: #fff;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.event-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
.event-card.detection { background: #6ea42a; }
.event-card.resolution { background: #059669; }
.event-card.mixed { background: #d97706; }

.card-top {
  font-size: 0.73rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.35);
  padding: 0.7rem;
}

.card-stats {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.7rem;
  font-size: 0.72rem;
}

.card-stats .danger { color: #fee2e2; }
.card-stats .success { color: #dcfce7; }

@media (max-width: 1100px) {
  .ig-segments,
  .ig-label-row,
  .ig-cards-row {
    grid-template-columns: repeat(var(--slot-count), minmax(76px, 1fr));
    gap: 0.55rem;
  }

  .event-card { max-width: 130px; min-height: 120px; }
}

@media (max-width: 768px) {
  .tl-toolbar { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .ig-stage { padding: 1.3rem 0.7rem 1rem; }
  .ig-label { font-size: 0.61rem; }
  .segment-date { font-size: 0.64rem; }
  .event-card { max-width: 112px; min-height: 108px; }
}
</style>
