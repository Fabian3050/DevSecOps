import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NotFound from '@/presentation/views/NotFound.vue'

describe('NotFound.vue', () => {
  it('renders 404 title and subtitle', () => {
    const wrapper = mount(NotFound, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>'
          }
        }
      }
    })

    expect(wrapper.text()).toContain('404 - No Encontrado')
    expect(wrapper.text()).toContain('La página que buscas no existe.')
  })

  it('renders a link to return to login', () => {
    const wrapper = mount(NotFound, {
      global: {
        stubs: {
          'router-link': {
            props: ['to'],
            template: '<a :href="to" class="back-link"><slot /></a>'
          }
        }
      }
    })

    const link = wrapper.find('.back-link')

    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('Volver al Inicio')
    expect(link.attributes('href')).toBe('/login')
  })

  it('renders the main not found container styles/classes', () => {
    const wrapper = mount(NotFound, {
      global: {
        stubs: {
          'router-link': {
            template: '<a><slot /></a>'
          }
        }
      }
    })

    expect(wrapper.find('.login-wrapper').exists()).toBe(true)
    expect(wrapper.find('.login-card').exists()).toBe(true)
    expect(wrapper.find('.not-found-body').exists()).toBe(true)
  })
})