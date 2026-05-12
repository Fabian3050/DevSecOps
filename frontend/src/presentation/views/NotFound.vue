<template>
  <div class="login-wrapper fade-in">
    <div class="card login-card">
      <div class="login-header">
        <div class="logo-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h1 class="title">404 - No Encontrado</h1>
        <p class="subtitle">La página que buscas no existe.</p>
      </div>

      <div class="not-found-body">
        <router-link to="/login" class="btn btn-primary btn-block">
          Volver al Inicio
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.login-card {
  width: 100%;
  max-width: 440px;
  padding: 3rem;
  border-top: 4px solid var(--primary);
}

.login-header {
  text-align: center;
  margin-bottom: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-box {
  width: 64px;
  height: 64px;
  background: var(--bg-hover);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  margin-bottom: 1.5rem;
  border: 1px solid var(--border);
  box-shadow: 0 0 20px rgba(135, 197, 62, 0.1);
}

.title {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.subtitle {
  margin-bottom: 0;
}

.not-found-body {
  margin-top: 2rem;
}

.btn-block {
  width: 100%;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
</style>
