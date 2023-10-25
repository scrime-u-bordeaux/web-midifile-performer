<template>
<div class="container">
<div class="wrapper">
  <div>
    <h1> <i> {{ $t('lookForScores.findNew')}} </i> </h1>
  </div>

  <div class="dual">
    <div class="right-border">
      <h2> {{$t('lookForScores.pdf')}} </h2>
      <ul>
        <li> <a href="https://imslp.org/wiki/Main_Page" target="_blank"> {{ $t('lookForScores.imslp.site') }} </a> </li>
        <li>
          <a href="https://imslp.org/wiki/IMSLP:Apps" target="_blank"> {{ $t('lookForScores.imslp.application') }} </a>
        </li>
        <li> <a href="https://newzik.com/fr/" target="_blank"> Newzik </a> </li>
      </ul>
    </div>

    <div>
      <h2> {{$t('lookForScores.midi')}} </h2>
      <ul>
        <li> <a href="http://www.kunstderfuge.com" target="_blank"> KunstderFuge </a> </li>
        <li> <a href="https://www.classicalarchives.com" target="_blank"> {{ $t('lookForScores.archives') }}</a> </li>
      </ul>
    </div>
  </div>

  <div>
    <h1> {{$t('lookForScores.google.first')}} <i> <a href="https://www.google.com" target="_blank"> {{$t('lookForScores.google.second')}} </a> </i> </h1>
  </div>
</div>
</div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 450px;
}
.wrapper {
  margin: 0 20%;
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
  text-align: center;
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
