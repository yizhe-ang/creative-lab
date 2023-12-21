<script>
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';

  const DPR = 1;
</script>

<div class="fixed inset-0 bg-stone-800">
	<Canvas dpr={DPR}>
		<Scene />
	</Canvas>
</div>
