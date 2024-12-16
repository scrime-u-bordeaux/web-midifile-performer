<template>
  <div>
    <svg
      :viewBox="`0 0 ${layoutVars.width} ${layoutVars.height}`">
      <!-- whites -->
      <template v-for="n in layoutVars.whiteNotes">
        <rect class="white-note"
          :class="[
          isModeSilent ? 'silent' : 'playOrPerform',
          {
            activeNote: state[n.note - minNote] > 0,
            autoplay: autoplay[n.note - minNote]
          }]"
          :x="n.x"
          :y="0"
          :width="noteDims.white.width"
          :height="noteDims.white.height"/>
        <template v-if="n.pitch === 0">
          <text
            :x="n.x"
            :y="layoutVars.height - 5"
            class="octave-text"
            :textLength="noteDims.white.width">

            {{`&nbsp; C${n.octave} &nbsp;`}}
          </text>
        </template>
      </template>
      <!-- blacks -->
      <template v-for="n in layoutVars.blackNotes">
        <rect class="black-note"
          :class="{
            activeNote: state[n.note - minNote] > 0,
            autoplay: autoplay[n.note - minNote],
            silent: isModeSilent,
            playOrPerform: !isModeSilent
          }"
          :x="n.x"
          :y="0"
          :width="noteDims.black.width"
          :height="noteDims.black.height"/>
      </template>
      <rect class="frame"
        x="0"
        y="0"
        :width="layoutVars.width"
        :height="layoutVars.height"/>
    </svg>
  </div>
</template>

<style>
.frame {
  fill: none;
  stroke: grey;
  stroke-width: 2;
  z-index: 3;
}
.white-note {
  fill: white;
  stroke: grey;
  stroke-width: 0.5;
  z-index: 1;
}
.black-note {
  fill: lightgrey;
  stroke: grey;
  stroke-width: 0.5;
  z-index: 2;
}
.activeNote.silent {
  fill: #02a7f0 !important;
}
.activeNote.playOrPerform {
  fill: #58e28e !important;
}
.activeNote.playOrPerform.autoplay {
  fill-opacity: 0.4;
  filter: contrast(3);
}
.octave-text {
  fill: grey;
  vertical-align: bottom;
  display: flex;
  font-size: 10px;
}
</style>

<script>
import { mapState, mapGetters } from 'vuex';

const whiteNoteWidthHeightRatio = 5;
const blackNoteWidthRatio = 0.65;
const blackNoteHeightRatio = 0.65;
const blackNoteCToESpacer = 1 - 2 * blackNoteWidthRatio / 3;
const blackNoteFToBSpacer = 1 - 3 * blackNoteWidthRatio / 4;

const octaveLayout = [
  0,
  blackNoteCToESpacer,
  1,
  2 * blackNoteCToESpacer + blackNoteWidthRatio,
  2,
  3,
  3 + blackNoteFToBSpacer,
  4,
  3 + 2 * blackNoteFToBSpacer + blackNoteWidthRatio,
  5,
  3 + 3 * blackNoteFToBSpacer + 2 * blackNoteWidthRatio,
  6,
];

const whites = [ 0,2,4,5,7,9,11 ];
const blacks = [  1,3,  6,8,10  ];

export default {
  props: [ 'whiteNoteWidth' ],
  computed: {
    ...mapState({
      state: 'keyboardState',
      autoplay: 'keyboardAutoplay',
      minNote: 'minKeyboardNote',
      maxNote: 'maxKeyboardNote'
    }),
    ...mapGetters(['isModeSilent']),

    noteDims() {
      const white = {
        width: this.whiteNoteWidth,
        height: this.whiteNoteWidth * whiteNoteWidthHeightRatio,
      };

      const black = {
        width: white.width * blackNoteWidthRatio,
        height: white.height * blackNoteHeightRatio,
      };

      return { white, black };
    },
    layoutVars() {
      const firstPitch = this.minNote % 12;
      const firstOctave = Math.floor(this.minNote / 12);
      const offset = octaveLayout[firstPitch] + 7 * firstOctave;

      const whiteNotes = [];
      const blackNotes = [];

      for (let i = 0; i <= this.maxNote - this.minNote; ++i) {
        const note = this.minNote + i;
        const pitch = note % 12;
        const octave = Math.floor(note / 12);

        const x = this.whiteNoteWidth *
                  (octaveLayout[pitch] + 7 * octave - offset);

        const noteData = { x, note, pitch, octave: octave - 1 };

        if (blacks.indexOf(pitch) === -1) {
          whiteNotes.push(noteData);
        } else {
          blackNotes.push(noteData);
        }
      };

      const width = Math.max(
        whiteNotes[whiteNotes.length - 1].x + this.noteDims.white.width,
        blackNotes[blackNotes.length - 1].x + this.noteDims.black.width
      );
      const height = this.whiteNoteWidth * whiteNoteWidthHeightRatio;

      return {
        width,
        height,
        whiteNotes,
        blackNotes,
      };
    },
  }
};
</script>
