<template>
  <div class="kpi-strip" v-if="hasBuilt">
    <div class="kpi-card">
      <span class="kpi-label">Registros de eventos</span>
      <span class="kpi-val">{{ paintedCount }}</span>
    </div>
    <div class="kpi-card kpi-danger">
      <span class="kpi-label">Pendientes</span>
      <span class="kpi-val">{{ latestSnap.pending }}</span>
    </div>
    <div class="kpi-card kpi-success">
      <span class="kpi-label">Resueltos</span>
      <span class="kpi-val">{{ latestSnap.resolved }}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Total</span>
      <span class="kpi-val">{{ latestSnap.total }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  hasBuilt: { type: Boolean, default: false },
  paintedCount: { type: Number, default: 0 },
  latestSnap: {
    type: Object,
    default: () => ({ total: 0, pending: 0, resolved: 0 })
  }
})
</script>

<style scoped>
.kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 2rem; }
.kpi-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}
.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary);
}
.kpi-card.kpi-danger { border-left: 4px solid var(--danger); }
.kpi-card.kpi-success { border-left: 4px solid var(--success); }
.kpi-card.kpi-danger .kpi-val { color: var(--danger); }
.kpi-card.kpi-success .kpi-val { color: var(--success); }
.kpi-val { font-size: 2rem; font-weight: 800; line-height: 1; }
.kpi-label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

@media (max-width: 1100px) {
  .kpi-strip { grid-template-columns: 1fr 1fr; }
}
</style>
