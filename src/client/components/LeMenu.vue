<template>
<div class="whole-menubar">
<div class="menu-wrapper">
  <!-- icon -->
  <div class="menu-icon"
    @click="onMenuIconClicked">
    <svg viewBox="0 0 100 100">
      <rect x=0 y=0 width=100 height=20 />
      <rect x=0 y=40 width=100 height=20 />
      <rect x=0 y=80 width=100 height=20 />
    </svg>
  </div>

  <div class="main-title" @click="$router.push('/')">
    Midifile Performer
  </div>

  <div class="logo-icon">
    <a href="https://scrime.u-bordeaux.fr/" target="_blank">
      <img src="pics/scrime-ubx.png" height="50"/>
    </a>
  </div>

  <!-- menu -->
  <div class="menu-items-wrapper" v-bind:class="hidden ? 'hidden' : ''">
    <template v-for="item in items">
      <router-link :to="{ name: item.page }" class="menu-item">
        {{ item.text }}
      </router-link>
      <!--
      <div class="menu-item"
        @click="$emit('select', item.event)">
        {{ item.text }}
      </div>
      -->
    </template>
  </div>

</div>
</div>
</template>

<style scoped>
  .whole-menubar {
    position: relative;
    text-align: center;
    padding: 0 15px;
    /* background-color: var(--button-blue); */
    background-color: transparent;
    height: var(--menubar-height);
    z-index: 10000;
    border-bottom: 1px solid var(--button-blue);
  }
  .menu-wrapper {
    position: relative;
    text-align: left;
    width: 100%;
    height: 50px;
    max-width: var(--content-width);
    margin: 0 auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: left;
    /* justify-content: center; */
  }
  .menu-icon {
    /* background-color: var(--button-blue); */
    /* position: relative; */
    /* display: inline-block; */
    /* padding: 15px; */
    position: absolute;
    left: 0;
    padding: 0.4em;
    padding-left: 0;
    cursor: pointer;
    /* width: 20px; */
    /* height: 20px; */
    width: 1.2em;
    height: 1.2em;
    /* flex: 0 0 auto; */
  }
  svg {
    pointer-events: none;
  }
  svg rect {
    /* fill: white; */
    /* fill: var(--button-blue); */
    fill: black;
  }
  .main-title {
    /* background-color: var(--button-blue); */

    /* color: white; */
    /* color: var(--button-blue); */
    color: black;

    font-size: 1.5em;
    /* padding: 0.5em 0.5em; */
    padding: 0.1em 0.3em;
    padding-right: 0.3em;
    position: relative;
    display: inline-block;
    /* width: 560px; */

    /* height: 38px; */
    /* padding-top: 12px; */
    /* height: 50px; */
    margin: 0 auto;
    text-align: left;
    cursor: pointer;
    flex: 0 1 auto;
  }
  .logo-icon {
    position: absolute;
    /* text-align: right; */
    right: 0;
    height: 2em;
  }
  .logo-icon a {
    display: inline-block;
    height: 0;
  }
  .logo-icon a img {
    /* transform: scale(0.6) translateX(33%); */
    height: 2em;
  }
  .menu-items-wrapper {
    color: white;
    position: absolute;
    /*left: 0;*/
    top: var(--menubar-height);
    /*display: inline-block;*/
    border-radius: 5px;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    /*border: 1px solid white;*/
    border: 0;
    overflow: hidden;
    box-shadow: 0px 3px 3px 0px rgba(0,0,0,0.5);
    /*margin-top: 10px;*/
    z-index: 10000;

    /*visibility: visible;*/
    /*transform: translateY(0px);*/
    /*transition: transform 0.2s, visibility 0.2s;*/

    /* see .menu-item definition below : 3 * (1 + 2 * 0.3) */
    max-height: 4.8em;
    transition: max-height 0.2s;
  }
  .menu-items-wrapper.hidden {
    /*visibility: hidden;*/
    /*transform:  translateY(-100%);*/
    /*transition: transform 0.2s, visibility 0.2s;*/

    max-height: 0em;
    transition: max-height 0.2s;
  }
  .menu-item {
    display: block;
    cursor: pointer;
    text-decoration: none;
    color: white;
    background-color: var(--button-blue);
    line-height: 1em;
    padding: 0.3em 0.5em;
    z-index: 10000;
    border: 0;
    /*border-top: 0.1em solid transparent;*/
    /*transform: translateY(0px);*/
    /*transition: transform 0.2s;*/
  }
  .menu-item.selected,
  .menu-item:hover {
    background-color: #333;
  }
  .menu-item.router-link-active {
    /*background-color: var(--light-button-blue);*/
    text-decoration: underline;
  }

  .menu-items-wrapper.hidden .menu-item {
    /*transform: translateY(-300%);*/
    /*transition: transform 0.2s;*/
  }
</style>

<script>
export default {
  props: [ 'items' ],
  data() {
    return {
      hidden: true,
    };
  },
  created() {
    document.body.addEventListener('click', this.onBodyClicked, true);
  },
  beforeUnmount() {
    document.body.removeEventListener('click', this.onBodyClicked);
  },
  methods: {
    onMenuIconClicked() {
      this.hidden = !this.hidden;
    },
    onBodyClicked(e) {
      if (!this.hidden &&
          !e.target.classList.contains('menu-icon'))// &&
          //!e.target.classList.contains('menu-item'))
        this.hidden = true;
    },
  },
};
</script>
