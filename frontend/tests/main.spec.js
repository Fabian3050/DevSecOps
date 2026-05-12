import { describe, it, expect, vi, beforeEach } from 'vitest'

const useMock = vi.fn()
const mountMock = vi.fn()
const createAppMock = vi.fn(() => ({
  use: useMock,
  mount: mountMock,
}))

vi.mock('vue', () => ({
  createApp: createAppMock,
}))

vi.mock('../src/App.vue', () => ({
  default: {},
}))

vi.mock('../src/presentation/router', () => ({
  default: { name: 'mock-router' },
}))

describe('src/main.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('inicializa Vue con App, usa router y monta la aplicación', async () => {
    const { default: App } = await import('../src/App.vue')
    const { default: router } = await import('../src/presentation/router')

    await import('../src/main.js')

    expect(createAppMock).toHaveBeenCalledWith(App)
    expect(useMock).toHaveBeenCalledWith(router)
    expect(mountMock).toHaveBeenCalledWith('#app')
  })
})