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

    <div class="buttons-container">
      <button @click="$router.push('/first-steps')">
        À vous d'interpréter !
      </button>

      <button @click="$router.push('/midifile-performer')">
        Aller plus loin
      </button>
    </div>
  </div>
</template>

<style scoped>
.container {
  text-align: center;
}
.video-container {
  position: relative;
  width: 100%;
  height: 0;
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
</style>

<script>
// import Layout from '../layouts/Layout.vue';
import Keyboard from '../components/Keyboard.vue';

export default {
  inject: [ 'performer' ],
  components: { Keyboard },
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