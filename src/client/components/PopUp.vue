<template>
  <div class="pop-up-container" v-bind:class="hidden ? 'hidden' : ''">
    <div class="pop-up">

      <div class="content-and-close">
        <div class="close-button">
          <svg @click="close" viewBox="0 0 100 100">
            <line x1="10" y1="10" x2="90" y2="90" />
            <line x1="90" y1="10" x2="10" y2="90" />
          </svg>
        </div>

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
    bottom: 0;
    left: 0;

    display: flex;
    flex-direction: column;
    justify-content: center;

    opacity: 1;
    visibility: visible;
    transition: opacity 0.2s, visibility 0.2s;
  }
  .pop-up-container.hidden {
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
  }
  .pop-up {
    background-color: #FFF;

    border: 2px solid var(--button-blue);
    border-radius: 20px;
  }
  .close-button {
    position: relative;
    z-index: 1;
    top: 1em;
    left: 53.75em;
    width: fit-content;
  }
  .close-button svg {
    width: 20px;

    stroke: var(--light-button-blue);
    stroke-width: 20px;
    stroke-linecap: round;
    cursor: pointer;
  }
</style>

<script>
export default {

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
    close() {
      this.hidden = true;
      this.$emit('closed')
    },

    onOutsideClick(event) {
      if(
        this.hidden || // cannot close if already closed
        event.target instanceof HTMLButtonElement // prevent closing immediately when clicking button toggle
      ) return

      if(
        event.target.classList.length === 0 || // this covers <html> and <body>, on the side
        event.target.classList.contains("pop-up-container") // this cover the center of the screen
      ) this.close()
    }
  },
};
</script>
