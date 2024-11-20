<template>
  <div class="channel-manager-container">
    <div class="global-icons">
      <div class="grid-cell">
        <img
          :src="`pics/piano_icon_${areAllChannelsPerformed? 'off' : 'on'}_normal.png`"
          @click="areAllChannelsPerformed ? performNoChannels() : performAllChannels()"
        />
      </div>
      <div class="grid-cell">
        <img
          :src="`pics/volume_icon_${areAllChannelsUnmuted ? 'off' : 'on'}_normal.png`"
          @click="areAllChannelsUnmuted ? muteAllChannels() : unmuteAllChannels()"
        />
      </div>
      <div class="placeholder"></div>
    </div>

    <div class="channel-list">
      <div class="channel"
           v-show="fileIncludesChannel(parseInt(parseInt(index)+1, 10))"
           v-for="(velocityOffset, index) in currentChannelControls.channelVelocityOffsets">

        <ToggleSwitch
          class="vertical-toggle"
          :modelValue="currentChannelControls.channelPerformed[index]"
          @update:modelValue="newValue => updateChannelPerformed(parseInt(index), newValue)"
        />

        <OptionTabs
          class="tabs"
          :allowNone="true"
          :vertical="true"
          :routerMode="false"
          :roundBottom="true"
          :items="muteAndSolo"
          :modelValue="muteOrSolo[index]"
          @update:modelValue="newValue => updateChannelActive(parseInt(index), newValue)"
        />

        <!-- Yes, the double parseInt *is* needed. -->

        <scroll-bar class="velocity-scroll"
          :class="currentChannelControls.channelActive[index] ? '' : 'muted-channel'"
          :hasBounds="false"
          :start="-64"
          :end="64"
          :index="velocityOffset"
          :size="129"
          :indexLabel="$t('settings.io.channelVelocities.channel')+parseInt(parseInt(index)+1, 10)"

          @index="updateVelocityOffset(parseInt(index), $event)"
          @reset="updateVelocityOffset(parseInt(index), defaultChannelControls.channelVelocityOffsets[index])"
        />
      </div>
    </div>
  </div>
</template>

<style lang="css" scoped>

.channel-list > *:not(:last-child) {
  padding-bottom: 1em;
}

img {
  width: 30px;
  height: 30px;
  cursor: pointer;
}

.tabs {
  color: #888;
}

.channel, .global-icons {
  display: grid;
  align-content: center;
}

.channel {
  grid-template-columns: 8% 5% 87%;
}

.global-icons {
  grid-template-columns: 6.5% 5% 89%;
  margin-left: 0.95em;
}

.vertical-toggle {
  transform: rotate(-90deg);
}

.velocity-scroll {
  width: 100%;
}

.muted-channel {
  opacity: 0.4
}

</style>

<script>
import { toRaw } from 'vue'
import { mapState, mapMutations, mapGetters } from 'vuex'

import OptionTabs from './OptionTabs.vue'
import ScrollBar from './ScrollBar.vue'
import ToggleSwitch from './ToggleSwitch.vue'

const isEqual = require('lodash.isequal')

const DRUM_CHANNEL = 9

export default {
  components: { ScrollBar, ToggleSwitch, OptionTabs },

  data() {
    return {
      muteOrSolo: new Array(16).fill(null)
    }
  },

  computed: {
    ...mapState(['currentChannelControls', 'defaultChannelControls']),
    ...mapGetters(['fileIncludesChannel']),

    muteAndSolo() {
      return [
        {id: 'mute', text: "M"},
        {id: 'solo', text: "S"}
      ]
    },

    areAllChannelsPerformed() {
      return this.currentChannelControls.channelPerformed.filter(
        (_, index) => index !== DRUM_CHANNEL && this.fileIncludesChannel(index+1)
      ).every(
        isPerformed => isPerformed
      )
    },

    areAllChannelsUnmuted() {
      return this.currentChannelControls.channelActive.filter(
        (_, index) => index !== DRUM_CHANNEL && this.fileIncludesChannel(index+1)
      ).every(
        isActive => isActive
      )
    }
  },

  watch: {
    currentChannelControls(newControls, oldControls) {
      if(isEqual(newControls.channelActive, oldControls.channelActive)) return

      this.updateMuteOrSolo()
    }
  },

  created() {
    this.updateMuteOrSolo()
  },

  methods: {

    ...mapMutations(['updateChannelControls']),

    updateVelocityOffset(index, offset) {
      const clonedVelocityOffsets = structuredClone(toRaw(this.currentChannelControls.channelVelocityOffsets))

      clonedVelocityOffsets[index] = offset

      this.updateChannelControls({
        ...this.currentChannelControls,
        channelVelocityOffsets: clonedVelocityOffsets
      })
    },

    updateChannelPerformed(index, value) {
      const clonedChannelPerformed = structuredClone(toRaw(this.currentChannelControls.channelPerformed))

      clonedChannelPerformed[index] = value

      this.updateChannelControls({
        ...this.currentChannelControls,
        channelPerformed: clonedChannelPerformed
      })
    },

    toggleSoloIfOneUnmuted() {
      if(
        this.muteOrSolo.filter(
          (which, index) => this.fileIncludesChannel(index+1) && which === null
        ).length === 1
      )
        this.muteOrSolo[this.muteOrSolo.indexOf(null)] = "solo"
    },

    updateChannelActive(index, value) {

      const clonedChannelActive = structuredClone(toRaw(this.currentChannelControls.channelActive))

      let specialNoEndUpdate = false

      switch(value)  {
        case "mute":
          // Just mute. Can only happen outside solo, so no big deal.
          clonedChannelActive[index] = false
          break

        case "solo":
          // Mute every channel but this one.
          clonedChannelActive.forEach((_, otherIndex) => {
            clonedChannelActive[otherIndex] = (otherIndex === index) ? true : false
            this.muteOrSolo[otherIndex] = (otherIndex === index) ? "solo" : "mute"
          })
          break

        case null:
          // Unmute channel.
          clonedChannelActive[index] = true

          // If a channel was solo, it no longer is,
          // Because we have at least two unmuted channels now.
          const soloIndex = this.muteOrSolo.findIndex(value => value === "solo")

          // So, mark that channel as now simply unmuted...
          if(soloIndex >= 0) {
            // ...except the drum channel. We don't like the drum channel. It's always muted after a solo.
            this.muteOrSolo[soloIndex] = soloIndex === DRUM_CHANNEL ? "mute" : null
            // And make sure we remember it's muted at the end.
            if(soloIndex === DRUM_CHANNEL) specialNoEndUpdate = true
          }

          // If the solo channel was the one we unmuted,
          // All channels must now be unmuted.
          if(soloIndex === index) this.muteOrSolo.forEach(
            (_, otherIndex) => {
              // ...except the drum channel, of course.
              if(otherIndex === DRUM_CHANNEL) {
                clonedChannelActive[otherIndex] = false
                return
              }

              clonedChannelActive[otherIndex] = true
              this.muteOrSolo[otherIndex] = null
            }
          )
      }

      if(!specialNoEndUpdate) this.muteOrSolo[index] = value
      // If we muted all channels but one, it's a de facto solo.
      this.toggleSoloIfOneUnmuted()

      this.updateChannelControls({
        ...this.currentChannelControls,
        channelActive: clonedChannelActive
      })
    },

    updateMuteOrSolo() {
      this.currentChannelControls.channelActive.forEach((isActive, index) => {
        this.muteOrSolo[index] = isActive ? null : "mute"
      })

      this.toggleSoloIfOneUnmuted()
    },

    muteAllChannels() {
      this.updateChannelControls({
        ...this.currentChannelControls,
        channelActive: new Array(16).fill(false)
      })
    },

    unmuteAllChannels() {
      this.updateChannelControls({
        ...this.currentChannelControls,
        channelActive: this.defaultChannelControls.channelActive
      })
    },

    performNoChannels() {
      this.updateChannelControls({
        ...this.currentChannelControls,
        channelPerformed: new Array(16).fill(false)
      })
    },

    performAllChannels() {
      this.updateChannelControls({
        ...this.currentChannelControls,
        channelPerformed: this.defaultChannelControls.channelPerformed
      })
    }
  }
}
</script>
