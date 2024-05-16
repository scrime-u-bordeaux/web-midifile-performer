<template>
  <div class="settings-container">
    <PopUp ref="popup" @closed="closed">

      <div class="inner-settings-container">
        <h2>{{ $t('settings.title') }}</h2>

        <div class="settings-and-buttons">
          <div class="settings-padder">

            <div class="io-manager-container">

              <h4> {{ $t('settings.iomanager.heading') }} </h4>

              <IOManager class="io-manager"
                @inputsChange="setInputs"
                @delayedInputsChange="queueSetInputs"
                @outputChange="setOutput"
              />

            </div>

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
                    @reset="setRowVelocity(currentSettings.keyboardRowVelocities[category], category)"
                  />
                </div>

              </div>
            </div>
          </div>

          <div class="buttons">
            <div class="reset-buttons">
              <button @click="resetToCurrent">
                {{ $t('settings.buttons.reset') }}
              </button>

              <button @click="resetToDefault">
                {{ $t('settings.buttons.default') }}
              </button>
            </div>

            <div class="confirm-buttons">
              <button @click="apply">
                {{ $t('settings.buttons.apply') }}
              </button>

              <button @click="applyAndClose">
                {{ $t('settings.buttons.ok') }}
              </button>
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
  height: 600px;
}

.settings-and-buttons {
  height: 87.5%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.settings-padder {
  padding: 0 4em;
  max-height: 85%;
  overflow: scroll;
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

.io-manager {
  text-align: center;
  display: flex;
  justify-content: center;
}

.velocity-slider {
  padding-bottom: 0.75em;
}

.buttons {
  display: flex;
  justify-content: space-between;
  padding-left: 1em;
  padding-right: 1em;
}

.buttons button {
  font-size: 1em;
}

.confirm-buttons, .reset-buttons {
  display: flex;
  justify-content: space-between;
}
</style>

<script>

import { toRaw } from 'vue'
import { mapGetters, mapMutations } from 'vuex';

import PopUp from './PopUp.vue'
import ScrollBar from './ScrollBar.vue'
import IOManager from '../components/IOManager.vue';

import defaultSettings from '../default_settings.json'

export default {
  components: { PopUp, IOManager, ScrollBar },

  inject: ['defaultKeyboardVelocities'],

  data() {
    return {
      // Note : no, using external consts does not work if we want to reference them in the template
      MIN_VELOCITY: 0,
      MAX_VELOCITY: 127,

      defaultSettings: defaultSettings,
      settingsBuffer: {} // computed properties can't be referenced in data.
    }
  },

  computed: {
    ...mapGetters(['currentSettings'])
  },

  methods: {

    ...mapMutations(['updateSettings']),

    // -------------------------------------------------------------------------
    // ------------------------- POPUP MANAGEMENT ------------------------------
    // -------------------------------------------------------------------------

    open() {
      this.$refs.popup.open()
      this.resetToCurrent()
    },

    close() {
      this.$refs.popup.close()
    },

    closed() {
      // Because closing logic happens in the base popup component,
      // This one has to painstakingly relay its messages over to the invoking page.
      this.$emit('closed')
    },

    // -------------------------------------------------------------------------
    // ------------------------ SETTINGS MANAGEMENT ----------------------------
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // ------------------------------ GLOBAL -----------------------------------
    // -------------------------------------------------------------------------

    apply() {
      this.updateSettings(structuredClone(toRaw(this.settingsBuffer)))
    },

    applyAndClose() {
      this.apply()
      this.close()
    },

    resetToCurrent() {
      // A deep clone should not be necessary here.
      // this.currentSettings is a *getter*. It should return a new object on every call.
      // This is probably something to do with the inner workings of mapGetters.
      // Either way, it's extremely fishy.
      this.settingsBuffer = structuredClone(this.currentSettings)

      // When inputs have been disconnected between sessions, the IOManager will have detected this.
      // But it does so before resetToCurrent() is called ; so we have queued its list of available inputs.
      // Now, we update our inputs accordingly, and force-write to the store to mark these inputs as gone in local storage.
      // (So this will not happen on other reloads)
      if(!!this.queuedInputIds) {
        this.setInputs(this.queuedInputIds)
        this.apply()
        this.queuedInputIds = null
      }
    },

    resetToDefault() {
      this.settingsBuffer = structuredClone(toRaw(this.defaultSettings))
    },

    // -------------------------------------------------------------------------
    // --------------------------- FINE-GRAINED --------------------------------
    // -------------------------------------------------------------------------

    setRowVelocity(i, category) {
      this.settingsBuffer.keyboardRowVelocities[category] = i
    },

    setInputs(ids) {
      this.settingsBuffer.io.inputIds = ids
    },

    // Queue a list of availble inputs after disconnects between sessions,
    // Courtesy of the IOManager, which detected the discrepancy.

    queueSetInputs(ids) {
      this.queuedInputIds = ids
    },

    setOutput(id) {
      this.settingsBuffer.io.outputId = id
    }
  }
}

</script>
