<template>
  <div class="settings-container">
    <PopUp ref="popup" @closed="closed">

      <div class="inner-settings-container">
        <h2>{{ $t('settings.title') }}</h2>

        <div class="settings-and-buttons">
          <div class="settings-padder">

            <OptionTabs
              ref="tabs"
              class="tabs major"
              :routerMode="false"
              :items="tabItems"
              v-model="visibleTab"
            />

            <div class="tab-sections">

              <div class="tab-section" v-show="visibleTab === 'io'">
                <div class="io-manager-container">

                  <h4> {{ $t('settings.io.iomanager.heading') }} </h4>

                  <IOManager ref="ioManager" class="io-manager"
                    @inputsChange="setInputs"
                    @delayedInputsChange="queueSetInputs"
                    @outputChange="setOutput"
                  />

                </div>

                <div class="keyboard-velocities">

                  <h4> {{ $t('settings.io.keyboardVelocities.heading') }} </h4>

                  <div class="sliders-container">

                    <div class="velocity-slider"
                      v-for="(velocity, category) in settingsBuffer.io.keyboardRowVelocities"
                    >
                      <scroll-bar class="velocity-scroll"
                        :hasBounds="false"
                        :start="MIN_VELOCITY"
                        :end="MAX_VELOCITY"
                        :index="velocity"
                        :size="MAX_VELOCITY+1"
                        :indexLabel="$t('settings.io.keyboardVelocities.velocitySliders.'+category)"

                        @index="setRowVelocity($event, category)"
                        @reset="setRowVelocity(currentSettings.io.keyboardRowVelocities[category], category)"
                      />
                    </div>

                  </div>
                </div>
              </div>

              <div class="tab-section" v-show="visibleTab === 'visualizer'">

                <div class="preferred-visualizer">
                  <h4>{{ $t('settings.visualizer.preferredVisualizer.heading') }}</h4>

                  <OptionTabs
                    class="tabs minor"
                    :routerMode="false"
                    :fullRound="true"
                    :items="availableVisualizers"
                    v-model="settingsBuffer.visualizer.preferredVisualizer"
                  />
                </div>

                <div class="click-play">

                  <h4>{{ $t('settings.visualizer.clickPlay.heading') }}</h4>

                  <div class="click-play-inner">
                    <ToggleSwitch
                      :label="$t('settings.visualizer.clickPlay.silent')"
                      v-model="settingsBuffer.visualizer.clickPlay.silent"
                    />
                    <ToggleSwitch
                      :label="$t('settings.visualizer.clickPlay.perform')"
                      v-model="settingsBuffer.visualizer.clickPlay.perform"
                    />
                  </div>
                </div>

              </div>

              <div class="tab-section" v-show="visibleTab === 'performer'">

                <div class="performer-section-inner">
                  <ToggleSwitch
                    :label="$t('settings.performer.looping')"
                    v-model="settingsBuffer.performer.looping"
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
  height: 80%;
}

.tabs {
  color: #888;
  width: 100%;
}
.tabs.major {
  border-bottom: 2px solid var(--button-blue);
  font-weight: bold;
}
.tabs.major::v-deep .first-tab {
  margin-left: -1.9em;
}

.tab-sections {
  height: 100%;
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
  font-style: italic;
  font-weight: normal;
  padding-bottom: 0.5em;
  border-bottom: 1px solid var(--button-blue);
}

.io-manager {
  text-align: center;
  display: flex;
  justify-content: center;
}

.velocity-slider {
  padding-bottom: 0.75em;
}

.click-play-inner {
  padding: 0 12em;
}
.click-play-inner > *:not(:last-child) {
  padding-bottom: 1em;
}

.performer-section-inner {
  margin-top: 2em;
  padding: 0 16.5em;
  /* display: grid;
  grid-template-columns: 50% 50%; */
}
/* .performer-section-inner > * {
  padding: 0.5em 1.25em;
} */

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

import OptionTabs from './OptionTabs.vue'
import PopUp from './PopUp.vue'
import ScrollBar from './ScrollBar.vue'
import IOManager from './IOManager.vue';
import ToggleSwitch from './ToggleSwitch.vue'

import defaultSettings from '../default_settings.json'

export default {
  components: { OptionTabs, ToggleSwitch, PopUp, IOManager, ScrollBar },

  data() {
    return {
      // Note : no, using external consts does not work if we want to reference them in the template
      MIN_VELOCITY: 0,
      MAX_VELOCITY: 127,

      visibleTab: 'io',
      defaultSettings: defaultSettings,
      // Computed properties can't be accessed in data.
      // Thankfully, the getter is still available through this roundabout path.
      // (We could also initialize to default settings. I prefer this.)
      settingsBuffer: this.$store.getters.currentSettings
    }
  },

  computed: {
    ...mapGetters(['currentSettings']),

    // Computed because of locale change
    tabItems() {
      return [
        { id: 'io', text: this.$t('settings.tabs.io')},
        { id: 'visualizer', text: this.$t('settings.tabs.visualizer')},
        { id: 'performer', text: this.$t('settings.tabs.performer')}
      ]
    },

    availableVisualizers() {
      return [
        { id: 'piano', text: this.$t('settings.visualizer.availableVisualizers.pianoRoll')},
        { id: 'sheet', text: this.$t('settings.visualizer.availableVisualizers.sheetMusic')}
      ]
    }
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

    resetCommon(mode) {
      // A deep clone should not be necessary for current.
      // this.currentSettings is a *getter*. It should return a new object on every call.
      // This is probably something to do with the inner workings of mapGetters.
      // Either way, it's extremely fishy.
      this.settingsBuffer = structuredClone(
        mode === "current" ? this.currentSettings : toRaw(this.defaultSettings)
      )

      this.$refs.ioManager.resetControls(mode)
    },

    resetToCurrent() {
      this.resetCommon("current")

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
      this.resetCommon("default")
    },

    // -------------------------------------------------------------------------
    // --------------------------- FINE-GRAINED --------------------------------
    // -------------------------------------------------------------------------

    // There should only be update logic here where components incompatible with v-model are used.
    // This should only be the case in the I/O tab.

    setRowVelocity(i, category) {
      this.settingsBuffer.io.keyboardRowVelocities[category] = i
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
