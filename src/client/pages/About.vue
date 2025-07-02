<template>
  <div class="container">
    <div class="video-container">
      <iframe
        class="video"
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/Ul8dfY72TWQ"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>

    <!--
    <div class="buttons-container">
      <button @click="$router.push('/first-steps')">
        {{$t('home.firstSteps')}}
      </button>

      <button @click="$router.push('/midifile-performer')">
        {{$t('home.goFurther')}}
      </button>
    </div>
    -->


    <div class="credits-container">
      <p>
        {{ $t('credits.metapiano') }}<br/>
        <strong>Jean Haury Hee Hee</strong>
      </p>
      <p>
        <a href="https://dl.acm.org/doi/10.1145/3471872.3472968">
          {{ $t('credits.article') }}
        </a>
        <br><strong>Juliette Chabassier, Myriam Desainte-Catherine, Jean Haury, Marin Pobel, Bernard Serpette</strong>
      </p>
      <p>
        {{ $t('credits.firstImplem') }} <br/>
        <strong>Bernard Serpette</strong>
      </p>
      <p>
        <a href="https://github.com/scrime-u-bordeaux/libMidifilePerformer">
          {{ $t('credits.cppLib') }}
        </a> {{ $t('credits.website') }} <br/>
        <strong>Joseph Larralde, Raphaël Blard</strong>
      </p>
      <p>
        {{ $t('credits.samples') }} <br/>
        <strong>Joseph Larralde</strong>
      </p>

      <p>
        {{ $t('credits.icons.icons') }} <br/>

        <a href="https://www.flaticon.com/free-icons/speaker"
          title="speaker icons"
        >
          {{ $t('credits.icons.volume') }}
        </a> :
        <strong>Google, Flaticon</strong>

        <br/>

        <a href="https://www.flaticon.com/free-icons/piano"
          title="piano icons">
          {{ $t('credits.icons.piano') }}
        </a> :
        <strong>Smartline, Flaticon</strong>

        <br/>

        <a href="https://www.flaticon.com/free-icons/slider" title="slider icons">
          {{ $t('credits.icons.sliders') }}
        </a> :
        <strong>DailyPM Studio, Flaticon</strong>
      </p>
    </div>

    <div class="meta-info">
      <p v-html="$t('meta.lastCommitDate', {date: meta.lastCommitDate})"></p>
    </div>
  </div>
</template>

<style scoped>
.container {
  min-height: 500px;
  max-width: var(--content-width);
  display: flex;
  flex-direction: column;
}
.video-container {
  position: relative;
  width: 100%;
  padding-bottom: var(--youtube-video-h-w-ratio);
}
.video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: black;
}
.buttons-container {
  margin: 5px;
}
.credits-container p, .credits-container a, .meta-info {
  color: #777;
  font-style: italic;
}
a:active, a:hover {
  color: var(--button-blue);
}
.meta-info {
  text-align: right;
}
</style>

<script>
import { mapState } from 'vuex';
// import Layout from '../layouts/Layout.vue';
import Keyboard from '../components/Keyboard.vue';

export default {
  inject: [ 'performer' ],
  components: { Keyboard },
  computed: {
    ...mapState(['meta'])
  },
  data() {
    return {
      videoWidth: 800,
      videoWidthHeightRatio: 560 / 315,
    };
  },
  created() {
    // something here ?
  }
};
</script>
