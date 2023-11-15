<script>
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import Particles from './Particles.svelte';
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 5]}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<Particles />
