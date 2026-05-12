import { config } from '@vue/test-utils'
import clickOutside from '@/presentation/directives/clickOutside'

config.global.directives = {
    'click-outside': clickOutside
}
