import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import clickOutside from '@/presentation/directives/clickOutside'

describe('clickOutside directive', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
    container = null
  })

  it('calls handler when clicking outside element', async () => {
    const handler = vi.fn()
    
    const TestComponent = {
      directives: { clickOutside },
      template: '<div v-click-outside="onClickOutside" class="inner">Inside</div>',
      methods: {
        onClickOutside: handler
      }
    }

    mount(TestComponent, { attachTo: container })

    // Click outside
    document.body.click()
    
    expect(handler).toHaveBeenCalled()
  })

  it('does not call handler when clicking inside element', async () => {
    const handler = vi.fn()
    
    const TestComponent = {
      directives: { clickOutside },
      template: '<div v-click-outside="onClickOutside" class="inner">Inside</div>',
      methods: {
        onClickOutside: handler
      }
    }

    const wrapper = mount(TestComponent, { attachTo: container })

    // Click inside
    wrapper.find('.inner').element.click()
    
    expect(handler).not.toHaveBeenCalled()
  })

  it('properly cleans up event listener on unmount', () => {
    const handler = vi.fn()
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    
    const TestComponent = {
      directives: { clickOutside },
      template: '<div v-click-outside="onClickOutside">Content</div>',
      methods: {
        onClickOutside: handler
      }
    }

    const wrapper = mount(TestComponent, { attachTo: container })
    
    wrapper.unmount()
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function))
    
    removeEventListenerSpy.mockRestore()
  })

  it('handles multiple elements with directive independently', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    
    const TestComponent = {
      directives: { clickOutside },
      template: `
        <div>
          <div v-click-outside="onClickOutside1" class="element1">Element 1</div>
          <div v-click-outside="onClickOutside2" class="element2">Element 2</div>
        </div>
      `,
      methods: {
        onClickOutside1: handler1,
        onClickOutside2: handler2
      }
    }

    const wrapper = mount(TestComponent, { attachTo: container })

    // Click on element1 (outside element2)
    wrapper.find('.element1').element.click()
    
    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
  })

  it('works with nested elements', () => {
    const handler = vi.fn()
    
    const TestComponent = {
      directives: { clickOutside },
      template: `
        <div v-click-outside="onClickOutside" class="outer">
          <div class="inner">
            <button class="nested-btn">Button</button>
          </div>
        </div>
      `,
      methods: {
        onClickOutside: handler
      }
    }

    const wrapper = mount(TestComponent, { attachTo: container })

    // Click on nested button (inside outer)
    wrapper.find('.nested-btn').element.click()
    
    expect(handler).not.toHaveBeenCalled()

    // Click outside
    document.body.click()
    
    expect(handler).toHaveBeenCalled()
  })

  it('continues to work after handler is called', () => {
    const handler = vi.fn()
    
    const TestComponent = {
      directives: { clickOutside },
      template: '<div v-click-outside="onClickOutside">Content</div>',
      methods: {
        onClickOutside: handler
      }
    }

    mount(TestComponent, { attachTo: container })

    // First click outside
    document.body.click()
    expect(handler).toHaveBeenCalledTimes(1)

    // Second click outside
    document.body.click()
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('handles handler that is not a function gracefully', () => {
    const TestComponent = {
      directives: { clickOutside },
      template: '<div v-click-outside="notAFunction">Content</div>',
      data() {
        return {
          notAFunction: null
        }
      }
    }

    const wrapper = mount(TestComponent, { attachTo: container })
    
    // The directive should be mounted without throwing
    expect(wrapper.find('div').exists()).toBe(true)
    
    wrapper.unmount()
  })
})
