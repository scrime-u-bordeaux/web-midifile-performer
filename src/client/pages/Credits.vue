<template>
  <div class="container">
    <div class="credits-container">
      <p>
        {{ $t('credits.metapiano') }}<br/>
        <strong>Jean Haury</strong>
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

        <br/>

        <a href="https://www.svgrepo.com/svg/509259/start" title="begin icon">
          {{ $t('credits.icons.start') }}
        </a> :
        <strong>Orchid, SvgRepo</strong>

        <br/>
        
        <a href="https://www.svgrepo.com/svg/439779/fast-forward-fill" title="fast-forward icon">
          {{ $t('credits.icons.ff') }}
        </a> :
        <strong>emblemicons, SvgRepo</strong>
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
    max-width: fit-content;
    display: flex;
    flex-direction: column;
    justify-content: center;
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
import { mapState } from 'vuex'

export default {
  computed: {
    ...mapState(['meta'])
  }
};
</script>
