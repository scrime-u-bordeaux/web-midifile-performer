<template>
<div>
<div class="wrapper">
  <div>
    <h1> <i> Trouvez de nouvelles <br> partitions </i> </h1>
  </div>

  <div class="dual">
    <div class="right-border">
      <h2> Partitions imprimées PDF : </h2>
      <ul>
        <li> <a href="https://imslp.org/wiki/Main_Page" target="_blank"> imslp site </a> </li>
        <li>
          <a href="https://imslp.org/wiki/IMSLP:Apps" target="_blank"> imslp application </a>
          (<a href="https://apps.apple.com/us/app/imslp/id1373671782" target="_blank"> App Store </a>,
          <a href="https://play.google.com/store/apps/details?id=com.imslp.app&gl=FR" target="_blank"> Play Google </a>)
        </li>
        <li> <a href="https://newzik.com/fr/" target="_blank"> Newzik </a> </li>
      </ul>
    </div>

    <div>
      <h2> Partitions numériques MIDI : </h2>
      <ul>
        <li> <a href="http://www.kunstderfuge.com" target="_blank"> KunstderFuge </a> </li>
        <li> <a href="https://www.classicalarchives.com" target="_blank"> Classical MIDI archives </a> </li>
      </ul>
    </div>
  </div>

  <div>
    <h1> Ou faire une <i> recherche Google </i> </h1>
  </div>
</div>
</div>
</template>

<style scoped>
.wrapper {
  max-width: var(--score-width);
  margin: 0 auto;
  font-size: 0.85em;
}
ul {
  list-style-type: none;
}
.dual {
  display: flex;
}
.dual h2 {
  /*text-align: center;*/
}
.dual > div {
  text-align: left;
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  padding: 0.25em;
  margin: 0.25em;
}
.dual .right-border {
  border-right: 2px solid #555;
}
.dual > div > ul {
  margin: 0;
  padding: 0;
  /*list-style-position: outside;*/
}
.dual > div > ul a,
.dual > div > ul a:visited,
.dual > div > ul a:hover {
  display: inline-block;
  margin-bottom: 0.5em;
  font-size: 1.2em;
  text-decoration: none;
  font-weight: bold;
}
.dual > div > ul a,
.dual > div > ul a:visited {
  color: var(--hint-blue);
}
.dual > div > ul a:hover {
  color: lightskyblue;
}
</style>

<script>
export default {

};
</script>