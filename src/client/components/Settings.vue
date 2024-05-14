<template>
  <div class="settings-container">
    <PopUp ref="popup" @closed="closed">

      <div class="inner-settings-container">
        <h2>{{ $t('settings.title') }}</h2>

        <div class="settings-padder">

          <div class="keyboard-velocities">

            <h4> {{ $t('settings.keyboardVelocities.heading') }} </h4>

            <div class="sliders-container">

              <div class="velocity-slider"
                v-for="(velocity, category) in settingsBuffer.keyboardRowVelocities"
              >
                <scroll-bar class="velocity-scroll"
                  :hasBounds="false"
                  :start="MIN_VELOCITY"
                  :end="MAX_VELOCITY"
                  :index="velocity"
                  :size="MAX_VELOCITY+1"
                  :indexLabel="$t('settings.keyboardVelocities.velocitySliders.'+category)"

                  @index="setRowVelocity($event, category)"
                  @reset="setRowVelocity(defaultKeyboardVelocities[category], category)"
                />
              </div>

            </div>
          </div>
        </div>

      </div>

    </PopUp>
  </div>
</template>

<style scoped>
.inner-settings-container {
  min-width: var(--content-width);
  height: 500px;
}
.settings-padder {
  padding: 0 4em;
}
h2 {
  color: #666;
  text-align: center;
  font-weight: bold;
  margin-top: -0.25em;
}
h4 {
  text-align: center;
  color: #888;
  padding-bottom: 0.5em;
  border-bottom: 2px solid var(--button-blue);
}
.velocity-slider {
  padding-bottom: 0.75em;
}
</style>

<script>

import { mapGetters } from 'vuex';

import PopUp from './PopUp.vue'
import ScrollBar from './ScrollBar.vue'

export default {
  components: { PopUp, ScrollBar },

  inject: ['defaultKeyboardVelocities'],

  data() {
    return {
      // Note : no, using external consts does not work if we want to reference them in the template
      MIN_VELOCITY: 0,
      MAX_VELOCITY: 127,

      settingsBuffer: {} // computed properties can't be referenced in data.
    }
  },

  computed: {
    ...mapGetters(['currentSettings'])
  },

  methods: {

    // -------------------------------------------------------------------------
    // ------------------------- POPUP MANAGEMENT ------------------------------
    // -------------------------------------------------------------------------

    open() {
      this.$refs.popup.open()
      // A deep clone should not be necessary here.
      // this.currentSettings is a *getter*. It should return a new object on every call.
      // This is probably something to do with the inner workings of mapGetters.
      // Either way, it's extremely fishy.
      this.settingsBuffer = structuredClone(this.currentSettings)
    },

    // close() {
    //   this.$refs.popup.close()
    // },

    closed() {
      // Because closing logic happens in the base popup component,
      // This one has to painstakingly relay its messages over to the invoking page.
      this.$emit('closed')
    },

    // -------------------------------------------------------------------------
    // ------------------------ SETTINGS MANAGEMENT ----------------------------
    // -------------------------------------------------------------------------

    setRowVelocity(i, category) {
      this.settingsBuffer.keyboardRowVelocities[category] = i
      // this.ioctl.refreshVelocities(this.currentKeyboardVelocities) // maybe we'd want to delegate this to the IOManager instead of injecting the ioctl here ?
    },
  }
}

</script>
