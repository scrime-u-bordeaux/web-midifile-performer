<template>
  <div class="container">
    <div class="credits-container">
      <p>
        Métapiano et vidéo de performance : <br/>
        <strong>Jean Haury</strong>
      </p>
      <p>
        <a href="https://dl.acm.org/doi/10.1145/3471872.3472968">
          Article Midifile Performer
        </a> :
        <br><strong>Juliette Chabassier, Myriam Desainte-Catherine, Jean Haury, Marin Pobel, Bernard Serpette</strong>
      </p>
      <p>
        Première implémentation : <br/>
        <strong>Bernard Serpette</strong>
      </p>
      <p>
        <a href="https://github.com/scrime-u-bordeaux/libMidifilePerformer">
          Bibliothèque C++
        </a> et site Internet : <br/>
        <strong>Joseph Larralde, Raphaël Blard</strong>
      </p>
      <p>
        Samples de piano : <br/>
        <strong>Pianoteq, <a href="https://musical-artifacts.com/artifacts?apps=ableton&formats=sf2&tags=piano">GD Craft</a></strong>
      </p>
    </div>
  </div>
</template>

<style scoped>
  .container {
    min-height: 500px;
    max-width: fit-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .credits-container, a {
    color: #777;
    font-style: italic;
  }
</style>

<script>
export default {

};
</script>
