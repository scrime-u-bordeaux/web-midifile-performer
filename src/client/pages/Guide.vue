<template>
<div>
  <div class="wrapper">
    <div class="pseudo-title"> {{ $t('guide.title') }} </div>

    <p> {{ $t('guide.summary') }} </p>

    <h1> {{ $t('guide.whatIs.h1' )}} </h1>

      <h2> {{ $t('guide.whatIs.midiFile.h2') }} </h2>

        <p v-html="$t('guide.whatIs.midiFile.define')"></p>
        <p v-html="$t('guide.whatIs.midiFile.limit')"></p>
        <p v-html="$t('guide.whatIs.midiFile.solution')"></p>

      <h2> {{ $t('guide.whatIs.howWork.h2') }} </h2>

        <p v-html="$t('guide.whatIs.howWork.sets')"></p>
        <p v-html="$t('guide.whatIs.howWork.playingOn')"></p>
        <p> {{ $t('guide.whatIs.howWork.playingOff') }} </p>

      <h2> {{ $t('guide.whatIs.whatCanDo.h2') }} </h2>

        <p> {{ $t('guide.whatIs.whatCanDo.describe') }} </p>

        <p> {{ $t('guide.whatIs.whatCanDo.listPossibilities.preface') }} </p>

        <ul>
          <li><p> {{ $t('guide.whatIs.whatCanDo.listPossibilities.practice') }} </p></li>
          <li><p> {{ $t('guide.whatIs.whatCanDo.listPossibilities.try') }} </p></li>
          <li><p> {{ $t('guide.whatIs.whatCanDo.listPossibilities.analyze') }} </p></li>
          <li><p> {{ $t('guide.whatIs.whatCanDo.listPossibilities.specificSection') }} </p></li>
        </ul>

        <p> {{ $t('guide.whatIs.whatCanDo.listPossibilities.withVisual') }} </p>

    <h1> {{ $t('guide.howToUse.h1' ) }} </h1>

      <h2> {{ $t('guide.howToUse.formats.h2') }} </h2>

        <p> {{ $t('guide.howToUse.formats.mxl') }} </p>

        <p> {{ $t('guide.howToUse.formats.import') }} </p>

      <h2> {{ $t('guide.howToUse.io.h2') }} </h2>

        <h3> {{ $t('guide.howToUse.io.input.h3') }} </h3>

          <p> {{ $t('guide.howToUse.io.input.keyboard.preface') }} </p>

          <ul>
            <li><p> {{ $t('guide.howToUse.io.input.keyboard.number') }} </p></li>
            <li><p> {{ $t('guide.howToUse.io.input.keyboard.firstLine') }} </p></li>
            <li><p> {{ $t('guide.howToUse.io.input.keyboard.secondLine') }} </p></li>
            <li><p> {{ $t('guide.howToUse.io.input.keyboard.thirdLine') }} </p></li>
          </ul>

          <p> {{ $t('guide.howToUse.io.input.custom') }} </p>
          <p> {{ $t('guide.howToUse.io.input.customSelect') }} </p>

        <h3> {{ $t('guide.howToUse.io.output.h3') }} </h3>

          <p> {{ $t('guide.howToUse.io.output.rundown') }} </p>

      <h2> {{ $t('guide.howToUse.modes.h2') }} </h2>

        <p v-html="$t('guide.howToUse.modes.modeList')"></p>

        <h3> {{ $t('guide.howToUse.modes.silent.h3') }} </h3>

          <p v-html="$t('guide.howToUse.modes.silent.describe')"></p>

        <h3> {{ $t('guide.howToUse.modes.playback.h3') }} </h3>

          <p v-html="$t('guide.howToUse.modes.playback.describe')"></p>

        <h3> {{ $t('guide.howToUse.modes.perform.h3') }} </h3>

          <p v-html="$t('guide.howToUse.modes.perform.describe')"></p>

      <h2> {{ $t('guide.howToUse.looping.h2') }} </h2>

        <p> {{ $t('guide.howToUse.looping.whatIs') }} </p>

        <p v-html="$t('guide.howToUse.looping.note')"></p>

      <h2> {{ $t('guide.howToUse.interface.h2') }} </h2>

        <p> {{ $t('guide.howToUse.interface.preface') }} </p>

        <h3> {{ $t('guide.howToUse.interface.keyboard.h3') }} </h3>

          <p> {{ $t('guide.howToUse.interface.keyboard.describe') }} </p>

        <h3> {{ $t('guide.howToUse.interface.progressBar.h3') }} </h3>

          <p> {{ $t('guide.howToUse.interface.progressBar.preface') }} </p>

          <ol>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.playButton')"> </p></li>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.speed')"></p></li>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.start')"></p></li>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.current')"></p></li>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.end')"></p></li>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.stop')"></p></li>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.cursor')"></p></li>
            <li><p v-html="$t('guide.howToUse.interface.progressBar.loopFlag')"></p></li>
          </ol>

        <h3> {{ $t('guide.howToUse.interface.visualizer.h3') }} </h3>

          <p v-html="$t('guide.howToUse.interface.visualizer.describe')"></p>

          <h4> {{ $t('guide.howToUse.interface.visualizer.pianoRoll.h4') }} </h4>

            <p> {{ $t('guide.howToUse.interface.visualizer.pianoRoll.describe') }} </p>

            <p> {{ $t('guide.howToUse.interface.visualizer.pianoRoll.highlight') }} </p>

            <p> {{ $t('guide.howToUse.interface.visualizer.pianoRoll.currentColor') }} </p>

            <p v-html="$t('guide.howToUse.interface.visualizer.pianoRoll.hoverClick')"></p>

            <p> {{ $t('guide.howToUse.interface.visualizer.pianoRoll.clickSelect') }} </p>

            <p> {{ $t('guide.howToUse.interface.visualizer.pianoRoll.boundaryControl') }} </p>

          <h4> {{ $t('guide.howToUse.interface.visualizer.sheetMusic.h4') }} </h4>

            <p> {{ $t('guide.howToUse.interface.visualizer.sheetMusic.describe') }} </p>

            <p> {{ $t('guide.howToUse.interface.visualizer.sheetMusic.cursor') }} </p>

            <p> {{ $t('guide.howToUse.interface.visualizer.sheetMusic.highlight') }} </p>

            <p v-html="$t('guide.howToUse.interface.visualizer.sheetMusic.hoverClick')"></p>

            <p> {{ $t('guide.howToUse.interface.visualizer.sheetMusic.clickSelect') }} </p>

            <p> {{ $t('guide.howToUse.interface.visualizer.sheetMusic.boundaryControl') }} </p>

    <!-- No need to describe a feature that hasn't been implemented yet !-->

    <!-- <h2> {{ $t('guide.export.heading') }} </h2>
    <p>
      {{ $t('guide.export.content') }}
    </p> -->
  </div>
</div>
</template>

<style scoped>
  .pseudo-title {
    width: var(--content-width);
    font-size: 2.5em;
    text-align: center;
    font-weight: bold;
  }
  .green-italic {
    text-align: center;
    color: #0C0;
    font-style: italic;
  }
  .wrapper {
    text-align: justify;
    font-size: 0.93em;
    max-width: var(--content-width);
    margin: 0 auto;
  }
</style>

<script>
export default {
  data() {
    return {
      hidden: false,
    };
  },
  methods: {
    clickedCloseBtn() {
      console.log('closing');
      this.hidden = true;
    },
  },
};
</script>
