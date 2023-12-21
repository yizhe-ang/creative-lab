<script>
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
</script>

<div class="fixed inset-0">
	<Canvas colorManagementEnabled={true}>
		<Scene />
	</Canvas>
</div>
