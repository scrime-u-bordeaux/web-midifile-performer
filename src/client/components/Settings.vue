<template>
  <div class="settings-container">

    <dialog ref="confirmationDialog" class="confirmation-dialog">
      <div class="confirm-dialog-message">
        <p class="confirm-dialog-title">{{ $t('settings.confirm.title') }}</p>
        <p class="confirm-dialog-question">{{ $t('settings.confirm.question') }}</p>
      </div>
      <div class="confirm-dialog-buttons">
        <button @click="confirmSave">{{ $t('settings.confirm.save') }}</button>
        <button @click="confirmCancel">{{ $t('settings.confirm.cancel') }}</button>
        <button @click="confirmNoSave">{{ $t('settings.confirm.nosave') }}</button>
      </div>
    </dialog>

    <PopUp ref="popup" @requestClose="onRequestClose" @closed="closed">

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
                    :roundBottom="true"
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

                <div class="performer-constructor-options">
                  <ToggleSwitch
                    :label="$t('settings.performer.looping')"
                    v-model="settingsBuffer.performer.looping"
                  />

                  <ToggleSwitch
                    :label="$t('settings.performer.constructorOptions.unmeet')"
                    v-model="settingsBuffer.performer.constructorOptions.unmeet"
                  />

                  <ToggleSwitch
                    :label="$t('settings.performer.constructorOptions.complete')"
                    v-model="settingsBuffer.performer.constructorOptions.complete"
                  />

                  <div class="filler"></div>
                  <NumberInput
                    :label="$t('settings.performer.constructorOptions.temporalResolution')"
                    :allowNan="true"
                    :min="0"
                    :max="100"
                    :step="1"
                    :value="settingsBuffer.performer.constructorOptions.temporalResolution"
                    @input="settingsBuffer.performer.constructorOptions.temporalResolution = $event.target.valueAsNumber"
                  />
                  <div class="filler"></div>
                </div>

                <div class="velocity-strategies">
                  <h4>{{ $t('settings.performer.velocityStrategies.heading') }}</h4>

                  <OptionTabs
                    class="tabs minor"
                    :routerMode="false"
                    :roundBottom="true"
                    :items="velocityStrategies"
                    v-model="settingsBuffer.performer.preferredVelocityStrategy"
                  />

                  <ToggleSwitch class="conserve-velocity"
                    :label="$t('settings.performer.velocityStrategies.conserve')"
                    v-model="settingsBuffer.performer.conserveVelocity"
                  />
                </div>

              </div>

            </div>
          </div>

          <div class="buttons">
            <div class="reset-buttons">
              <button @click="resetToCurrent()"> <!-- Use call syntax to specifically transmit "false" default arg val -->
                {{ $t('settings.buttons.reset') }}
              </button>

              <button @click="resetToDefault()"> <!-- Same -->
                {{ $t('settings.buttons.default') }}
              </button>
            </div>

            <div class="import-export-buttons">
              <input accept=".json" ref="importSettings" type="file" style="display: none;" @change="importSettings"/>
              <button @click="$refs.importSettings.click()">
                {{ $t('settings.buttons.import') }}
              </button>
              <button @click="exportSettings">
                {{ $t('settings.buttons.export') }}
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
  min-width: 875px;
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

.velocity-scroll::v-deep.horizontal-layout {
  grid-template-columns: 30% 70%
}
.velocity-scroll::v-deep .slider-container {
  grid-template-columns: 80% 20%;
}
.velocity-scroll::v-deep .pseudo-link {
  margin-top: 2.25em;
}

.click-play-inner {
  padding: 0 12em;
}
.click-play-inner > *:not(:last-child) {
  padding-bottom: 1em;
}

.performer-constructor-options {
  margin-top: 2em;
  padding: 0 5em;
  display: grid;
  grid-template-columns: 33% 33% 33%;
}
.performer-constructor-options > * {
  padding: 0.5em 1.25em;
}
.performer-constructor-options > *::v-deep {
  color: #888;
}

.conserve-velocity {
  margin-top: 2em;
  padding: 0 9.5em;
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

.confirmation-dialog {
  border: 2px solid var(--button-blue);
  border-radius: 20px;
  width: fit-content;
}

.confirm-dialog-message {
  text-align: center;
}

.confirm-dialog-message p {
  margin-top: 0;
  margin-bottom: 0.5em;
}

.confirm-dialog-title {
  font-size: 1em;
  font-weight: bold;
  color: #666;
}

.confirm-dialog-question {
  font-style: italic;
  color: #666;
}

.confirm-dialog-buttons {
  font-size: 0.85em;
  margin: auto;
  display: flex;
  justify-content: space-around;
}
</style>

<script>

import { toRaw } from 'vue'
import { mapGetters, mapMutations } from 'vuex';
const isEqual = require('lodash.isequal') // So apparently Vue supports require-style imports ??
// Thank God, because this package can't be used with ES6 import syntax.

import OptionTabs from './OptionTabs.vue'
import PopUp from './PopUp.vue'
import NumberInput from './NumberInput.vue'
import ScrollBar from './ScrollBar.vue'
import IOManager from './IOManager.vue';
import ToggleSwitch from './ToggleSwitch.vue'

import defaultSettings from '../default_settings.json'

export default {
  components: { OptionTabs, ToggleSwitch, PopUp, IOManager, ScrollBar, NumberInput },

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
    },

    velocityStrategies() {
      return [
        {id: 'none', text: this.$t('settings.performer.velocityStrategies.none')},
        {id: 'sameForAll', text: this.$t('settings.performer.velocityStrategies.sameForAll')},
        {id: 'clippedScaledFromMean', text: this.$t('settings.performer.velocityStrategies.clippedScaledFromMean')},
        {id: 'adjustedScaledFromMean', text: this.$t('settings.performer.velocityStrategies.adjustedScaledFromMean')},
        {id: 'clippedScaledFromMax', text: this.$t('settings.performer.velocityStrategies.clippedScaledFromMax')}
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
      this.resetToCurrent(true)
    },

    close() {
      this.$refs.popup.close(true)
    },

    onRequestClose() {
      if(!isEqual(this.settingsBuffer, this.currentSettings))
        this.$refs.confirmationDialog.showModal()

      else this.close()
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

    confirmSave() {
      this.$refs.confirmationDialog.close()
      this.applyAndClose()
    },

    confirmNoSave() {
      this.$refs.confirmationDialog.close()
      this.close()
    },

    confirmCancel() {
      this.$refs.confirmationDialog.close()
    },

    resetCommon(mode, full = false) {

      const settingsToCloneFrom =
        mode === "current" ? this.currentSettings : toRaw(this.defaultSettings)

      // A deep clone should not be necessary for current.
      // this.currentSettings is a *getter*. It should return a new object on every call.
      // This is probably something to do with the inner workings of mapGetters.
      // Either way, it's extremely fishy.
      if(full) this.settingsBuffer = structuredClone(settingsToCloneFrom)
      else this.settingsBuffer[this.visibleTab] = structuredClone(settingsToCloneFrom[this.visibleTab])

      if(this.visibleTab === 'io') this.$refs.ioManager.resetControls(mode)
    },

    resetToCurrent(full = false) {
      this.resetCommon("current", full)

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

    async importSettings(event) {
      const file = event.target.files[0]
      const fileContents = await file.text()
      let importedSettings

      try {
        importedSettings = JSON.parse(fileContents)
      } catch (e) {
        console.error("Imported settings were invalid JSON ; import was aborted.")
        return
      }

      if(this.validate(importedSettings)) this.settingsBuffer = importedSettings
      else console.error("The contents of the imported settings were invalid ; import was aborted.")
    },

    // TODO : there *has* to be a way to automate this, right ?
    // At the very least, un-inline all these comparison values...
    // Ah, well, it works for now.

    validate(importedSettings) {
      return isEqual(Object.keys(importedSettings), Object.keys(this.settingsBuffer)) &&

      isEqual(Object.keys(importedSettings.io), Object.keys(this.settingsBuffer.io)) &&

      isEqual(Object.keys(importedSettings.io.keyboardRowVelocities), Object.keys(this.settingsBuffer.io.keyboardRowVelocities)) &&
      Object.values(importedSettings.io.keyboardRowVelocities).every(value => typeof value === "number") &&
      Object.values(importedSettings.io.keyboardRowVelocities).every(value => value >= 0 && value <= 127) &&

      // TODO : it would also be nice to know if they are valid I/O IDs, but how do we determine this ?
      importedSettings.io.inputIds.every(id => typeof id === "string") &&
      typeof importedSettings.io.outputId === "string" &&

      isEqual(Object.keys(importedSettings.visualizer), Object.keys(this.settingsBuffer.visualizer)) &&

      this.availableVisualizers.map(tab => tab.id).includes(importedSettings.visualizer.preferredVisualizer) &&

      isEqual(Object.keys(importedSettings.visualizer.clickPlay), Object.keys(this.settingsBuffer.visualizer.clickPlay)) &&
      typeof importedSettings.visualizer.clickPlay.silent === "boolean" &&
      typeof importedSettings.visualizer.clickPlay.perform === "boolean" &&

      isEqual(Object.keys(importedSettings.performer), Object.keys(this.settingsBuffer.performer)) &&

      isEqual(Object.keys(importedSettings.performer.constructorOptions), Object.keys(this.settingsBuffer.performer.constructorOptions)) &&
      typeof importedSettings.performer.constructorOptions.unmeet === "boolean" &&
      typeof importedSettings.performer.constructorOptions.complete === "boolean" &&
      typeof importedSettings.performer.constructorOptions.temporalResolution === "number" &&
      importedSettings.performer.constructorOptions.temporalResolution >= 0 && importedSettings.performer.constructorOptions.temporalResolution <= 100 &&

      typeof importedSettings.performer.looping === "boolean" &&

      this.velocityStrategies.map(strategy => strategy.id).includes(importedSettings.performer.preferredVelocityStrategy) &&

      typeof importedSettings.performer.conserveVelocity === "boolean"
    },

    exportSettings() {
      const file = new File(
        [JSON.stringify(this.settingsBuffer)],
        `MidifilePerformerSettings_${(new Date()).toISOString()}.json`,
        { type: 'application/json'}
      )
      const link = document.createElement('a')

      link.href = URL.createObjectURL(file)
      link.download = file.name

      link.click()
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
