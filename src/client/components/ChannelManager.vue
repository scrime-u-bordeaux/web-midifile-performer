<template>
  <div class="channel-manager-container">
    <div class="expander-container" v-show="collapsed">
      <div
        class="img-and-touch-feedback"

        @click="expand"
      >
        <img
          class="volume expander"
        />
        <div class="touch-feedback"></div>
      </div>

      <span @click="expand">{{ $t('midiFilePerformer.channels.manager') }}</span>
    </div>
    <div class="channel-manager-contents" v-show="!collapsed">
      <div class="global-icons" :class="velocitiesDisplayed ? 'with-scroll' : 'without-scroll'">
        <div
          class="img-and-touch-feedback"
          :class="{disabled: disablePerformToggles}"

          @click="areAllChannelsPerformed && !disablePerformToggles ? performNoChannels() : performAllChannels()"
        >
          <img
            class="piano"
            :class="areAllChannelsPerformed ? 'off' : 'on'"
          />
          <div class="touch-feedback"></div>
        </div>
        <div
          class="img-and-touch-feedback"

          @click="areAllChannelsUnmuted ? muteAllChannels() : unmuteAllChannels()"
        >
          <img
            class="volume"
            :class="areAllChannelsUnmuted ? 'off' : 'on'"
          />
          <div class="touch-feedback"></div>
        </div>
        <div class="icons-right">
          <img
            class="sliders"
            :class="velocitiesDisplayed ? 'displayed' : 'not-displayed'"

            @click="velocitiesDisplayed = !velocitiesDisplayed"
          />

          <CloseIcon :size="24" @close="collapse"/>
        </div>
      </div>

      <div class="channel-list">
        <div class="channel" :class="velocitiesDisplayed ? 'with-scroll' : 'without-scroll'"
             v-show="fileIncludesChannel(parseInt(parseInt(index)+1, 10))"
             v-for="(velocityOffset, index) in currentChannelControls.channelVelocityOffsets">

          <ToggleSwitch
            :vertical="true"
            :disabled="disablePerformToggles"
            :modelValue="currentChannelControls.channelPerformed[index]"
            @update:modelValue="newValue => updateChannelPerformed(parseInt(index), newValue)"
          />

          <OptionTabs
            class="tabs"
            :allowNone="true"
            :forceSize="true"
            :vertical="true"
            :routerMode="false"
            :roundBottom="true"
            :items="muteAndSolo"
            :modelValue="muteOrSolo[index]"
            @update:modelValue="newValue => updateChannelActive(parseInt(index), newValue)"
          />

          <!-- Yes, the double parseInt *is* needed. -->

          <scroll-bar v-show="velocitiesDisplayed" class="velocity-scroll"
            :class="currentChannelControls.channelActive[index] ? '' : 'muted-channel'"
            :hasBounds="false"
            :start="-64"
            :end="64"
            :index="velocityOffset"
            :size="129"
            :customBarHeight="20"
            :customCursorSize="50"
            :indexLabel="$t('midiFilePerformer.channels.channel')+parseInt(parseInt(index)+1, 10)"

            @index="updateVelocityOffset(parseInt(index), $event)"
            @reset="updateVelocityOffset(parseInt(index), defaultChannelControls.channelVelocityOffsets[index])"
          />

          <div class="channel-label" v-show="!velocitiesDisplayed">
            <span>
              {{ $t('midiFilePerformer.channels.channel')+parseInt(parseInt(index)+1, 10) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="css" scoped>

.channel-list {
  height: 75vh;
  overflow: scroll;
  /* box-shadow: 1px 1px 3px 1px #dddddd; */
}

.channel-list > *:not(:last-child) {
  padding-bottom: 1em;
}

.img-and-touch-feedback {
  position: relative;
  width: 40px;
  height: 40px;
}

img {
  position: relative;
  z-index: 100;
  width: 30px;
  height: 30px;
  cursor: pointer;
}

.img-and-touch-feedback.disabled img {
  opacity: 0.4;
  cursor: default;
}

/* I really hope these relative URLs don't break in the prod env,
Because they are the only alternative to setting URLs with event listeners,
Which is UNGODLY slow.*/

img.piano.on {
  content: url('../assets/pics/piano_icon_on_normal.png')
}

img.piano.on:hover {
  content: url('../assets/pics/piano_icon_on_hover.png')
}

img.piano.off {
  content: url('../assets/pics/piano_icon_off_normal.png')
}

.img-and-touch-feedback:not(.disabled) img.piano.off:hover {
  content: url('../assets/pics/piano_icon_off_hover.png')
}

img.volume.on, img.volume.expander {
  content: url('../assets/pics/volume_icon_on_normal.png')
}

img.volume.on:hover, img.volume.expander:hover, .img-and-touch-feedback:has(+ span:hover) img.volume.expander {
  content: url('../assets/pics/volume_icon_on_hover.png')
}

img.volume.off {
  content: url('../assets/pics/volume_icon_off_normal.png')
}

img.volume.off:hover {
  content: url('../assets/pics/volume_icon_off_hover.png')
}

img.sliders.displayed, img.sliders.not-displayed:hover {
  content: url('../assets/pics/sliders_enabled.png')
}

img.sliders.not-displayed, img.sliders.displayed:hover {
  content: url('../assets/pics/sliders_disabled.png')
}

.touch-feedback {
  background-color: var(--button-blue);

  position: absolute;
  top: -5px;
  bottom: -5px;
  left: 0px;

  width: 100%;
  height: 100%;

  border-radius: 50%;

  cursor: pointer;

  opacity: 0;
  /* transition: opacity ease-in-out 0.05s; */
}

.img-and-touch-feedback.disabled .touch-feedback {
  cursor: default;
}

.img-and-touch-feedback:not(.disabled) img:hover + .touch-feedback,
.img-and-touch-feedback:has(+ span:hover) .touch-feedback  {
  opacity: 1;
}

.tabs {
  color: #888;
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

.channel, .global-icons {
  display: grid;
  align-content: center;
}

.channel.with-scroll {
  grid-template-columns: 8% 5% 87%;
}

.channel.without-scroll {
  grid-template-columns: 20% 20% 60%;
}

.channel .channel-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.channel span {
  height: fit-content;
  width: fit-content;
  margin-right: 4em;
}

.global-icons.with-scroll {
  grid-template-columns: 6.5% 6% 87.5%;
  margin-left: 0.25em;
}

.global-icons.without-scroll {
  grid-template-columns: 20.5% 20% 59.5%;
  margin-left: 0.45em;
}

.global-icons .icons-right {
  display: flex;
  justify-content: end;
  align-items: center;
  height: fit-content;
}

.global-icons .icons-right > *:not(:first-child) {
  padding-left: 1em;
}

.muted-channel {
  opacity: 0.4
}

.expander-container {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
}

.expander-container span {
  margin-bottom: 10px;
  height: fit-content;
  font-style: italic;
  color: #777;
  cursor: pointer;
}

.expander-container span:hover, .img-and-touch-feedback:has(> img.volume.expander:hover) + span {
  color: var(--button-blue);
  /* transition: all 0.3s; */
}

/* FIXME : Webkit (Chrome et al.) scrollbars offset the icon alignment,
  but the only apparent solution would be to make them invisible,
  thereby removing any information telling the user that the compont is scrollable
  scrollbar-gutter: stable does not work either.
  Thus I prefer leaving them misaligned and give that feedback still.
*/

/* ::-webkit-scrollbar {
  width: 0px;
} */
</style>

<script>
import { toRaw } from 'vue'
import { mapState, mapMutations, mapGetters } from 'vuex'

import OptionTabs from './OptionTabs.vue'
import ScrollBar from './ScrollBar.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import CloseIcon from './CloseIcon.vue'

const isEqual = require('lodash.isequal')

const DRUM_CHANNEL = 9

export default {
  components: { ScrollBar, ToggleSwitch, OptionTabs, CloseIcon },

  data() {
    return {
      muteAndSolo: [
        {id: 'mute', text: "M"},
        {id: 'solo', text: "S"}
      ],
      muteOrSolo: new Array(16).fill(null),

      velocitiesDisplayed: false,
      // This one does not need reactivity for now.
      // previousVelocitiesDisplayed: false,
      disablePerformToggles: false,
      collapsed: true,

      isHoverPiano: false,
      isHoverVolume: false
    }
  },

  computed: {
    ...mapState(['mfpMidiFile', 'currentChannelControls', 'defaultChannelControls']),
    ...mapGetters(['fileIncludesChannel']),

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
    mfpMidiFile(newFile, oldFile) {
      this.velocitiesDisplayed = false
    },

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
    },

    // These two methods are used for MusicXML tempo-based play
    // (By measure or beat)

    // This one is used to prevent channel selection while such criteria are active

    disablePerformChoice() {
      // If some channels were unselected,
      // MFP.vue would receive the channelControls update
      // And call updatePlaybackTriggers with everything enabled
      // Therefore deactivating tempo-based play.
      // The noUpdateTriggers flag prevents that.

      this.$emit('noUpdateTriggers')

      this.performAllChannels()
      this.disablePerformToggles = true
    },

    // And this one enables them again once "every event" is selected,
    // or a MIDI file is loaded (which do not support these granularities)

    enablePerformChoice() {
      this.$emit('updateTriggers')
      this.disablePerformToggles = false
    },

    collapse() {
      this.previousVelocitiesDisplayed = this.velocitiesDisplayed
      this.velocitiesDisplayed = false
      this.collapsed = true
    },

    expand() {
      this.velocitiesDisplayed = this.previousVelocitiesDisplayed
      this.collapsed = false
    }
  }
}
</script>
