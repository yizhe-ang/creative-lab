<script>
	// https://github.com/mrdoob/three.js/blob/master/examples/webgl_gpgpu_birds.html
	import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
	import { T, extend, useFrame, useThrelte } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import birdFragment from './shaders/birdFragment.glsl';
	import birdVertex from './shaders/birdVertex.glsl';
	import positionFragment from './shaders/positionFragment.glsl';
	import velocityFragment from './shaders/velocityFragment.glsl';
	import * as THREE from 'three';

	const { pointer } = interactivity();

	const { scene, renderer } = useThrelte();

	const WIDTH = 32;
	const BIRDS = WIDTH * WIDTH;
	const BOUNDS = 800,
		BOUNDS_HALF = BOUNDS / 2;

	// INIT BIRD

	class BirdGeometry extends THREE.BufferGeometry {
		constructor() {
			super();

			const trianglesPerBird = 3;
			const triangles = BIRDS * trianglesPerBird;
			const points = triangles * 3;

			const vertices = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
			const birdColors = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
			const references = new THREE.BufferAttribute(new Float32Array(points * 2), 2);
			const birdVertex = new THREE.BufferAttribute(new Float32Array(points), 1);

			this.setAttribute('position', vertices);
			this.setAttribute('birdColor', birdColors);
			this.setAttribute('reference', references);
			this.setAttribute('birdVertex', birdVertex);

			// this.setAttribute( 'normal', new Float32Array( points * 3 ), 3 );

			let v = 0;

			function verts_push() {
				for (let i = 0; i < arguments.length; i++) {
					vertices.array[v++] = arguments[i];
				}
			}

			const wingsSpan = 20;

			for (let f = 0; f < BIRDS; f++) {
				// Body

				verts_push(0, -0, -20, 0, 4, -20, 0, 0, 30);

				// Wings

				verts_push(0, 0, -15, -wingsSpan, 0, 0, 0, 0, 15);

				verts_push(0, 0, 15, wingsSpan, 0, 0, 0, 0, -15);
			}

			for (let v = 0; v < triangles * 3; v++) {
				const triangleIndex = ~~(v / 3);
				const birdIndex = ~~(triangleIndex / trianglesPerBird);
				const x = (birdIndex % WIDTH) / WIDTH;
				const y = ~~(birdIndex / WIDTH) / WIDTH;

				const c = new THREE.Color(0x666666 + (~~(v / 9) / BIRDS) * 0x666666);

				birdColors.array[v * 3 + 0] = c.r;
				birdColors.array[v * 3 + 1] = c.g;
				birdColors.array[v * 3 + 2] = c.b;

				references.array[v * 2] = x;
				references.array[v * 2 + 1] = y;

				birdVertex.array[v] = v % 9;
			}

			this.scale(0.2, 0.2, 0.2);
		}
	}

	extend({
		BirdGeometry
	});

	const birdUniforms = {
		color: { value: new THREE.Color(0xff2200) },
		texturePosition: { value: null },
		textureVelocity: { value: null },
		time: { value: 1.0 },
		delta: { value: 0.0 }
	};

	let birdMesh;

	$: if (birdMesh) birdMesh.updateMatrix();

	// INIT COMPUTE RENDERER
	const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

	const dtPosition = gpuCompute.createTexture();
	const dtVelocity = gpuCompute.createTexture();
	fillPositionTexture(dtPosition);
	fillVelocityTexture(dtVelocity);

	function fillPositionTexture(texture) {
		const theArray = texture.image.data;

		for (let k = 0, kl = theArray.length; k < kl; k += 4) {
			const x = Math.random() * BOUNDS - BOUNDS_HALF;
			const y = Math.random() * BOUNDS - BOUNDS_HALF;
			const z = Math.random() * BOUNDS - BOUNDS_HALF;

			theArray[k + 0] = x;
			theArray[k + 1] = y;
			theArray[k + 2] = z;
			theArray[k + 3] = 1;
		}
	}

	function fillVelocityTexture(texture) {
		const theArray = texture.image.data;

		for (let k = 0, kl = theArray.length; k < kl; k += 4) {
			const x = Math.random() - 0.5;
			const y = Math.random() - 0.5;
			const z = Math.random() - 0.5;

			theArray[k + 0] = x * 10;
			theArray[k + 1] = y * 10;
			theArray[k + 2] = z * 10;
			theArray[k + 3] = 1;
		}
	}

	const velocityVariable = gpuCompute.addVariable('textureVelocity', velocityFragment, dtVelocity);
	const positionVariable = gpuCompute.addVariable('texturePosition', positionFragment, dtPosition);

	gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
	gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);

	const positionUniforms = positionVariable.material.uniforms;
	const velocityUniforms = velocityVariable.material.uniforms;

	positionUniforms['time'] = { value: 0.0 };
	positionUniforms['delta'] = { value: 0.0 };
	velocityUniforms['time'] = { value: 1.0 };
	velocityUniforms['delta'] = { value: 0.0 };
	velocityUniforms['testing'] = { value: 1.0 };
	velocityUniforms['separationDistance'] = { value: 1.0 };
	velocityUniforms['alignmentDistance'] = { value: 1.0 };
	velocityUniforms['cohesionDistance'] = { value: 1.0 };
	velocityUniforms['freedomFactor'] = { value: 1.0 };
	velocityUniforms['predator'] = { value: new THREE.Vector3() };
	velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed(2);

	// FIXME: Why repeat wrapping?
	velocityVariable.wrapS = THREE.RepeatWrapping;
	velocityVariable.wrapT = THREE.RepeatWrapping;
	positionVariable.wrapS = THREE.RepeatWrapping;
	positionVariable.wrapT = THREE.RepeatWrapping;

	gpuCompute.init();

	useFrame(({ clock }, delta) => {
		const now = clock.getElapsedTime();

		positionUniforms['time'].value = now;
		positionUniforms['delta'].value = delta;
		velocityUniforms['time'].value = now;
		velocityUniforms['delta'].value = delta;
		birdUniforms['time'].value = now;
		birdUniforms['delta'].value = delta;

		velocityUniforms['predator'].value.set($pointer.x * 0.5, $pointer.y * 0.5, 0);

		gpuCompute.compute();

		birdUniforms['texturePosition'].value =
			gpuCompute.getCurrentRenderTarget(positionVariable).texture;
		birdUniforms['textureVelocity'].value =
			gpuCompute.getCurrentRenderTarget(velocityVariable).texture;
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 350]} />

<T.Fog
	args={[0xffffff, 100, 1000]}
	on:create={({ ref }) => {
		scene.fog = ref;
	}}
/>

<!-- FIXME: Why not instanced mesh? -->
<T.Mesh bind:ref={birdMesh} rotation.y={Math.PI / 2} matrixAutoUpdate={false}>
	<T.BirdGeometry />
	<T.ShaderMaterial uniforms={birdUniforms} vertexShader={birdVertex} fragmentShader={birdFragment}>
		<T.DoubleSide attach="side" />
	</T.ShaderMaterial>
</T.Mesh>
