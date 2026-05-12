const clickOutside = {
  mounted(el, binding) {
    el.__clickOutsideHandler__ = event => {
      if (!el.contains(event.target) && typeof binding.value === 'function') {
        binding.value(event)
      }
    }
    document.addEventListener('click', el.__clickOutsideHandler__)
  },
  unmounted(el) {
    document.removeEventListener('click', el.__clickOutsideHandler__)
    delete el.__clickOutsideHandler__
  }
}

export default clickOutside
