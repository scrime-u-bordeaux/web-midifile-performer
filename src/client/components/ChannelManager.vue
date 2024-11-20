<template>
  <div class="channel-manager-container">
    <div class="slider-and-toggle"
         v-show="fileIncludes(parseInt(parseInt(index)+1, 10))"
         v-for="(velocityOffset, index) in channelVelocityOffsets">

      <ToggleSwitch
        class="vertical-toggle"
        v-model="channelPerformed[index]"
      />

      <OptionTabs
        class="tabs"
        :allowNone="true"
        :vertical="true"
        :routerMode="false"
        :roundBottom="true"
        :items="muteAndSolo"
        :modelValue="muteOrSolo[index]"
        @update:modelValue="newValue => updateMuteOrSolo({index: parseInt(index), value: newValue})"
      />

      <!-- Yes, the double parseInt *is* needed. -->

      <scroll-bar class="velocity-scroll"
        :class="channelActive[index] ? '' : 'muted-channel'"
        :hasBounds="false"
        :start="-64"
        :end="64"
        :index="velocityOffset"
        :size="129"
        :indexLabel="$t('settings.io.channelVelocities.channel')+parseInt(parseInt(index)+1, 10)"

        @index="$emit('offsetUpdate', {index: index, innerEvent: $event})"
        @reset="$emit('offsetReset', {index: index})"
      />
    </div>
  </div>
</template>

<style lang="css" scoped>
.channel-manager-container > *:not(:last-child) {
  padding-bottom: 1em;
}

.tabs {
  color: #888;
}

.slider-and-toggle {
  display: grid;
  grid-template-columns: 8% 5% 87%;
  align-content: center;
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
import { mapGetters } from 'vuex'

import OptionTabs from './OptionTabs.vue'
import ScrollBar from './ScrollBar.vue'
import ToggleSwitch from './ToggleSwitch.vue'

const DRUM_CHANNEL = 9

export default {
  components: { ScrollBar, ToggleSwitch, OptionTabs },

  props: ['channelVelocityOffsets', 'channelActive', 'channelPerformed'],

  data() {
    return {
      muteOrSolo: new Array(16).fill(null)
    }
  },

  computed: {
    ...mapGetters(['currentSettings', 'fileIncludes']),

    muteAndSolo() {
      return [
        {id: 'mute', text: "M"},
        {id: 'solo', text: "S"}
      ]
    }
  },

  created() {
    this.channelActive.forEach((isActive, index) => {
      if(!isActive) this.muteOrSolo[index] = "mute"
    })

    this.toggleSoloIfOneUnmuted()
  },

  methods: {

    toggleSoloIfOneUnmuted() {
      if(this.muteOrSolo.filter(which => which === null).length === 1)
        this.muteOrSolo[this.muteOrSolo.indexOf(null)] = "solo"
    },

    updateMuteOrSolo({index, value}) {

      const emittedChannelActive = structuredClone(toRaw(this.channelActive))

      let specialNoEndUpdate = false

      switch(value)  {
        case "mute":
          // Just mute. Can only happen outside solo, so no big deal.
          emittedChannelActive[index] = false
          break

        case "solo":
          // Mute every channel but this one.
          emittedChannelActive.forEach((_, otherIndex) => {
            emittedChannelActive[otherIndex] = (otherIndex === index) ? true : false
            this.muteOrSolo[otherIndex] = (otherIndex === index) ? "solo" : "mute"
          })
          break

        case null:
          // Unmute channel.
          emittedChannelActive[index] = true

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
                emittedChannelActive[otherIndex] = false
                return
              }

              emittedChannelActive[otherIndex] = true
              this.muteOrSolo[otherIndex] = null
            }
          )
      }

      if(!specialNoEndUpdate) this.muteOrSolo[index] = value
      // If we muted all channels but one, it's a de facto solo.
      this.toggleSoloIfOneUnmuted()

      this.$emit("update:channelActive", emittedChannelActive)
    }
  }
}
</script>
