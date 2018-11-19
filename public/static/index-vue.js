Vue.component('automation-task', {
  props: [
    'img',
    'desc',
  ],

  template: `
  <div class="card" style="text-align: center; cursor: pointer;">
    <div class="card-body">
      <img class="card-img-top" :src="img" alt="Commvault_logo" /><br /><br />
      <h3 class="card-title">
        {{desc}}
      </h3>
    </div>
  </div>


  `,
});

Vue.component('automation-window', {
  props: [
    'href'
  ],

  template: `<transition name="modal">
    <div class="modal-mask">
      <div class="modal-wrapper">
        <div class="modal-container">
          <div class="modal-body">
            <slot name="body">
              <iframe :src=href style="width: 100%; height: 90%;"></iframe><br><br>
              <button class="btn btn-danger btn-block" @click="$emit('close')">
                CLOSE
              </button>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </transition>`
})

var app = new Vue({
  el: '#app',
  data: {
    showWindow: false,
    windowHref: '',
    tasks: [{
        "href": "/commvault",
        "img": "https://upload.wikimedia.org/wikipedia/en/1/12/Commvault_logo.png",
        "desc": "Generate a billing report with the Commvault License and Usage reports"
      },
      {
        "href": "/costcalc",
        "img": "https://images.pexels.com/photos/159804/accountant-accounting-adviser-advisor-159804.jpeg?auto=compress&cs=tinysrgb&h=350",
        "desc": "A cost calculator"
      }
    ]
  }
})
