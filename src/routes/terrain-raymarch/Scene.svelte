<script>
	import { useThrelte, useFrame, T } from '@threlte/core';
	import * as THREE from 'three';

	import vertexShader from './shaders/vertexShader.glsl';
	import fragmentShader from './shaders/fragmentShader.glsl';

	const { renderer, camera, dpr } = useThrelte();
	const viewportVec = new THREE.Vector4();
	$: viewport = getViewport(renderer, $camera, viewportVec);

	const uniforms = {
		time: new THREE.Uniform(0.0),
		resolution: new THREE.Uniform(new THREE.Vector2())
	};

	let mesh;

	useFrame(({ clock }) => {
		mesh.material.uniforms.time.value = clock.getElapsedTime();
		mesh.material.uniforms.resolution.value = new THREE.Vector2(
			window.innerWidth * $dpr,
			window.innerHeight * $dpr
		);
	});

	function getViewport(renderer, camera, vec) {
		renderer.getViewport(vec);
		const ratio = renderer.getPixelRatio();
		const width = vec.z * ratio;
		const height = vec.w * ratio;
		const tempTarget = new THREE.Vector3();
		const position = new THREE.Vector3();
		const distance = camera.getWorldPosition(position).distanceTo(tempTarget);
		const fov = (camera.fov * Math.PI) / 180; // convert vertical fov to radians
		const h = 2 * Math.tan(fov / 2) * distance; // visible height
		const w = h * (width / height);

		return { width: w, height: h };
	}
</script>

<T.Mesh bind:ref={mesh} scale={[viewport.width, viewport.height, 1]}>
	<T.PlaneGeometry args={[1, 1]} />
	<T.ShaderMaterial {fragmentShader} {vertexShader} {uniforms} />
</T.Mesh>
