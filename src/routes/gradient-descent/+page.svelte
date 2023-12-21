<script>
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import { World } from '@threlte/rapier';
	import { KeyboardControls, wasdConfig } from 'svelte-kbc';
</script>

<div class="fixed inset-0">
	<Canvas>
		<World>
			<KeyboardControls config={wasdConfig()}>
				<Scene />
			</KeyboardControls>
		</World>
	</Canvas>
</div>
