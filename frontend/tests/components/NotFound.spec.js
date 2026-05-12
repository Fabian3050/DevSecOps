import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NotFound from '@/presentation/views/NotFound.vue'

describe('NotFound.vue', () => {
    it('renders correctly', () => {
        // Simulamos el router-link para el componente
        const wrapper = mount(NotFound, {
            global: {
                stubs: {
                    'router-link': true
                }
            }
        })

        // Validamos que el texto esperado aparezca en el DOM
        expect(wrapper.text()).toContain('404 - No Encontrado')
        expect(wrapper.text()).toContain('La página que buscas no existe.')
    })
})
