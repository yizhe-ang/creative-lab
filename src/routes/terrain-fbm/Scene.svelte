<script>
  import { T } from "@threlte/core";
  import { OrbitControls, Sky } from "@threlte/extras"


</script>

<T.PerspectiveCamera makeDefault>
  <OrbitControls enableDamping />
</T.PerspectiveCamera>

<Sky />
