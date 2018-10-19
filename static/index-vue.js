Vue.component('automation-task', {
  props: [
    'header',
    'href',
    'footer'
  ],

  template: `<transition name="modal">
    <div class="modal-mask">
      <div class="modal-wrapper">
        <div class="modal-container">

          <div class="modal-body">
            <slot name="body">
              <iframe :src=href style="width: 100%; height: 100%;"></iframe>
            </slot>
          </div>

          <div class="modal-footer">
            <slot name="footer">
              <button class="btn btn-primary btn-block" @click="$emit('close')">
                OK
              </button>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </transition>`,
});

var app = new Vue({
  el: '#app',
  data: {
    showModal: false
  }
})
