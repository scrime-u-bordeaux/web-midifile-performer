<template>
<button>
  <!-- <?xml version="1.0" encoding="UTF-8" standalone="no"?> -->
  <!-- Created with Inkscape (http://www.inkscape.org/) -->
  <input
    accept=".mid, .midi, .musicxml, .xml, .mxl"
    type="file" id="file" class="file"
    @change="$emit('change', $event)"
    @click="() => { this.value = null; }"/>
  <label for="file" :style="{ padding: padding }">
  <svg
    width="66.348343mm"
    height="45.295605mm"
    viewBox="0 0 66.348343 45.295605"
    version="1.1"
    id="svg1"
    xml:space="preserve"
    inkscape:version="1.3.1 (91b66b0, 2023-11-16)"
    sodipodi:docname="upload-monochrome.svg"
    xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
    xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:svg="http://www.w3.org/2000/svg">
    <!--
    <sodipodi:namedview
      id="namedview1"
      pagecolor="#ffffff"
      bordercolor="#000000"
      borderopacity="0.25"
      inkscape:showpageshadow="2"
      inkscape:pageopacity="0.0"
      inkscape:pagecheckerboard="0"
      inkscape:deskcolor="#d1d1d1"
      inkscape:document-units="mm"
      inkscape:zoom="1.1893044"
      inkscape:cx="105.10345"
      inkscape:cy="135.37325"
      inkscape:window-width="1728"
      inkscape:window-height="1051"
      inkscape:window-x="0"
      inkscape:window-y="38"
      inkscape:window-maximized="0"
      inkscape:current-layer="g3" /><defs
      id="defs1" />
    -->
    <g
      inkscape:label="Calque 1"
      inkscape:groupmode="layer"
      id="layer1"
      transform="translate(-65.048001,-93.947672)">
      <g
        id="g3"
        transform="translate(16.017767,59.176748)">
        <path
          style="display:inline;fill:#ffffff;fill-opacity:1"
          d="m 70.113298,80.011177 c -6.705042,-0.77588 -13.735484,-2.77177 -17.204467,-5.96937 -1.36697,-1.26002 -2.92119,-4.2185 -3.494521,-6.65186 -1.419897,-6.02639 1.174605,-12.12549 6.501098,-15.28265 1.734871,-1.0283 6.243477,-2.00504 8.248942,-2.20789 2.652349,-0.26828 3.011752,0.42289 2.960444,0.0904 -0.545617,-3.53568 -0.511865,-6.83844 3.210318,-11.98329 1.257851,-1.73862 3.837654,-2.82563 6.108319,-3.11708 2.732821,-0.35078 9.552321,0.0571 12.608321,1.49213 2.94103,1.38102 3.94948,2.60453 4.77613,5.79469 0.22943,0.88541 0.41715,1.73688 0.41715,1.89217 0,0.15528 0.55431,1.476377 -0.0617,1.642257 -3.05055,0.82143 -5.25488,2.18326 -6.65375,4.93925 -0.70505,0.65584 -1.66904,3.557393 -0.23489,3.136523 0.2729,-0.0866 0.75403,-0.68822 1.06919,-1.33692 2.17032,-4.46717 6.93714,-6.06296 13.916728,-4.65892 4.6575,0.93692 8.29241,3.59331 10.25313,7.49298 2.31814,4.61056 3.30824,9.24616 2.64019,12.36121 -0.44367,2.06872 -1.80633,4.66243 -3.20271,6.09603 -1.39253,1.42966 -5.22151,3.43726 -7.93659,4.1613 -1.92867,0.51432 -8.263718,1.77593 -11.318718,1.97168 -3.52721,0.22601 -7.189013,0.15017 -9.792323,0.17389 l -0.0556,-7.94933 v -7.72686 l 3.130053,3.62582 c 3.528276,4.087117 3.709898,4.68839 5.33661,3.09665 1.793242,-1.75469 1.448737,-1.831032 -5.02708,-8.321663 l -5.55625,-6.098127 -5.55625,6.098127 c -6.333978,6.951703 -6.454579,6.751291 -5.027083,8.321663 1.47613,1.623873 1.09386,1.818115 5.336615,-3.09665 l 3.130051,-3.62582 v 7.72686 c 0,5.99506 0.0371,7.95355 -0.2195,7.96815 z"
          id="path4"
          sodipodi:nodetypes="csssssssssssssssssssscccssscssscscc" />
      </g>
    </g>
  </svg>
  </label>
</button>
</template>

<style scoped>
svg, label {
  width: 100%;
  height: 100%;
  cursor: pointer;
  pointer-events: all;
}
button {
  pointer-events: none;
} 
input {
  position: absolute;
  width: 0;
  height: 0;
  /* display: none; */
}
</style>

<script setup>
  const props = defineProps(['padding']);
</script>