<template>
  <div class="pop-up-container" v-bind:class="hidden ? 'hidden' : ''">
    <div class="pop-up">

      <div class="content-and-close">
        <CloseIcon class="close-button" :size="20" @close="close()"/>

        <div class="pop-up-content">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .pop-up-container {
    background-color: rgba(255, 255, 255, 0.8);

    z-index: 100000;
    position: absolute;
    top: 0;
    right: 0;
    /* For some reason, this breaks without these two redundant properties. CSS is very fun. */
    bottom: 0;
    left: 0;

    height: 1000px; /* cover basically the entire content field in background */
    /* no, 100vh does not work, I have no idea why */

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    opacity: 1;
    visibility: visible;
    transition: opacity 0.4s, visibility 0.4s;
  }
  .pop-up-container.hidden {
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.4s, visibility 0.4s;
  }
  .pop-up {
    background-color: #FFF;

    border: 2px solid var(--button-blue);
    border-radius: 20px;
    width: fit-content;
  }
  .close-button {
    position: relative;
    z-index: 1;
    top: 1em;
    left: 52em;
    width: fit-content;
  }
</style>

<script>
import CloseIcon from './CloseIcon.vue'

export default {

  components: { CloseIcon },

  data() {
    return {
      hidden: true
    };
  },

  mounted() {
    document.addEventListener('click', this.onOutsideClick)
  },

  beforeUnmount() {
    document.removeEventListener('click', this.onOutsideClick)
  },

  methods: {
    open() {
      this.hidden = false;
    },
    close(force = false) {
      if(force) {
        this.hidden = true;
        this.$emit('closed')
      } else this.$emit('requestClose')
    },

    onOutsideClick(event) {
      if(
        this.hidden // cannot close if already closed
      ) return

      // "outside the popup" means inside its background, which has been set to cover the app
      if(event.target.classList.contains("pop-up-container")) this.close()
    }
  },
};
</script>
