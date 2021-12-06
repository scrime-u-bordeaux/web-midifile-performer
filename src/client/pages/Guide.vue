<template>
<div>
  <div class="wrapper">
    <h1> Comment utiliser Midifile Performer ? </h1>

    <h2> Gérer les entrées MIDI et les sorties audio </h2>
    <p>
      Par défaut le clavier d’ordinateur est fonctionnel et permet les nuances dynamiques selon les quatre rangées de touches : Pianissimo rangée du bas, Fortissimo rangée du haut. Le trackpad est aussi actif.
      <br><br>
      Vous pouvez aussi insérer un clavier Midi en Usb.

      Pour les sorties audio, le générateur interne est sélectionné par défaut.
      Si d’autres générateurs Vst (Pianoteq) sont installés, ils apparaissent dans la liste des sorties audio.
    </p>

    <h2> Choix / gestion des partitions à jouer </h2>
    <p>
      Importez une partition .mid pour pouvoir la jouer ensuite. Pour cela cliquez sur le bouton « Importer fichier », ou glissez directement votre fichier depuis votre ordinateur sur la case dédiée. Faites de même pour la partition PDF.
    </p>
    <p>
      <div class="green-italic"> Conseils pour gérer vos fichiers dans votre ordinateur </div>
      Créez un dossier par oeuvre/compositeur dans lequel vous placez la partition .pdf, la partition .mid et vos interprétations.
    </p>

    <h2> Jouer un morceau </h2>
    <p>
      <i> Gestion de la séquence du morceau à jouer : </i>

      <ul>
        <li>
          Par défaut, la séquence du morceau à jouer démarre à la première note, et se finit à la dernière note
        </li>
        <li>
          Vous pouvez cependant décider de sélectionner une plus petite séquence en entrant les numéros des notes de début et de fin de votre séquence dans les cases
        </li>
        <li>
          Vous pouvez aussi déplacer le curseur de la barre de progression pour reprendre à ce niveau du morceau
        </li>
        <li>
          Appuyez sur le bouton « Rejouer » pour redémarrer au début de la séquence sélectionnée (par défaut, le morceau reprend automatiquement au début de la séquence)
        </li>
      </ul>
    </p>

    <h2> Enregistrer / modifier / exporter votre interprétation </h2>
    <p>
      Vous pouvez enregistrer vos interprétations depuis MidiFile Performer pour obtenir un fichier .mid que vous pourrez ensuite exploiter à l’aide de différents outils.
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