<template>
<div>
  <div class="wrapper">
    <h1> {{ $t('guide.how') }} </h1>

    <h2> {{ $t('guide.io.heading') }} </h2>
    <p>
      {{ $t('guide.io.default') }}
      <br><br>
      {{ $t('guide.io.custom') }}
    </p>

    <h2> {{ $t('guide.score.heading' )}} </h2>
    <p>
      {{ $t('guide.score.instructions') }}
    </p>
    <p>
      <div class="green-italic"> {{ $t('guide.score.advice.heading') }} </div> <br/>
      {{ $t('guide.score.advice.content') }}
    </p>

    <h2> {{ $t('guide.perform.heading') }} </h2>
    <p>
      <i> {{ $t('guide.perform.sequence.heading') }} </i>

      <ul>
        <li>
          {{ $t('guide.perform.sequence.default') }}
        </li>
        <li>
          {{ $t('guide.perform.sequence.select') }}
        </li>
        <li>
          {{ $t('guide.perform.sequence.cursor') }}
        </li>
        <li style="display: none"> <!--This feature is not implemented yet !-->
          {{ $t('guide.perform.sequence.rewind') }}
        </li>
      </ul>
    </p>

    <h2> {{ $t('guide.export.heading') }} </h2>
    <p>
      {{ $t('guide.export.content') }}
    </p>
  </div>
</div>
</template>

<style scoped>
  h1 { text-align: center; }
  .green-italic {
    text-align: center;
    color: #0C0;
    font-style: italic;
  }
  .wrapper {
    text-align: left;
    font-size: 0.85em;
    max-width: var(--score-width);
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
