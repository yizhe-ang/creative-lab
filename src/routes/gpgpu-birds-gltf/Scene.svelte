<script>
	// https://github.com/mrdoob/three.js/blob/master/examples/webgl_gpgpu_birds_gltf.html
	import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	import { T, extend, useFrame, useThrelte } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import positionFragment from './shaders/positionFragment.glsl';
	import velocityFragment from './shaders/velocityFragment.glsl';
	import * as THREE from 'three';
	import { base } from '$app/paths';

	const { pointer } = interactivity();

	const { scene, renderer } = useThrelte();

	const WIDTH = 64;
	const BIRDS = WIDTH * WIDTH;
	const BOUNDS = 800,
		BOUNDS_HALF = BOUNDS / 2;

	// BAKE ANIMATION INTO TEXTURE and CREATE GEOMETRY FROM BASE MODEL
	const BirdGeometry = new THREE.BufferGeometry();

	function nextPowerOf2(n) {
		return Math.pow(2, Math.ceil(Math.log(n) / Math.log(2)));
	}

	Math.lerp = function (value1, value2, amount) {
		amount = Math.max(Math.min(amount, 1), 0);
		return value1 + (value2 - value1) * amount;
	};

	const gltfs = [`${base}/models/Parrot.glb`, `${base}/models/Flamingo.glb`];
	const colors = [0xccffff, 0xffdeff];
	const sizes = [0.2, 0.1];
	const selectModel = Math.floor(Math.random() * gltfs.length);

	let modelLoaded = false;
	let textureAnimation;

	new GLTFLoader().load(gltfs[selectModel], function (gltf) {
		const animations = gltf.animations;
		const durationAnimation = Math.round(animations[0].duration * 60);
		const birdGeo = gltf.scene.children[0].geometry;
		const morphAttributes = birdGeo.morphAttributes.position;
		const tHeight = nextPowerOf2(durationAnimation);
		const tWidth = nextPowerOf2(birdGeo.getAttribute('position').count);
		const indicesPerBird = birdGeo.index.count;
		const tData = new Float32Array(4 * tWidth * tHeight);

		for (let i = 0; i < tWidth; i++) {
			for (let j = 0; j < tHeight; j++) {
				const offset = j * tWidth * 4;

				const curMorph = Math.floor((j / durationAnimation) * morphAttributes.length);
				const nextMorph =
					(Math.floor((j / durationAnimation) * morphAttributes.length) + 1) %
					morphAttributes.length;
				const lerpAmount = ((j / durationAnimation) * morphAttributes.length) % 1;

				if (j < durationAnimation) {
					let d0, d1;

					d0 = morphAttributes[curMorph].array[i * 3];
					d1 = morphAttributes[nextMorph].array[i * 3];

					if (d0 !== undefined && d1 !== undefined)
						tData[offset + i * 4] = Math.lerp(d0, d1, lerpAmount);

					d0 = morphAttributes[curMorph].array[i * 3 + 1];
					d1 = morphAttributes[nextMorph].array[i * 3 + 1];

					if (d0 !== undefined && d1 !== undefined)
						tData[offset + i * 4 + 1] = Math.lerp(d0, d1, lerpAmount);

					d0 = morphAttributes[curMorph].array[i * 3 + 2];
					d1 = morphAttributes[nextMorph].array[i * 3 + 2];

					if (d0 !== undefined && d1 !== undefined)
						tData[offset + i * 4 + 2] = Math.lerp(d0, d1, lerpAmount);

					tData[offset + i * 4 + 3] = 1;
				}
			}
		}

		textureAnimation = new THREE.DataTexture(
			tData,
			tWidth,
			tHeight,
			THREE.RGBAFormat,
			THREE.FloatType
		);
		textureAnimation.needsUpdate = true;

		const vertices = [],
			color = [],
			reference = [],
			seeds = [],
			indices = [];
		const totalVertices = birdGeo.getAttribute('position').count * 3 * BIRDS;
		for (let i = 0; i < totalVertices; i++) {
			const bIndex = i % (birdGeo.getAttribute('position').count * 3);
			vertices.push(birdGeo.getAttribute('position').array[bIndex]);
			color.push(birdGeo.getAttribute('color').array[bIndex]);
		}

		let r = Math.random();
		for (let i = 0; i < birdGeo.getAttribute('position').count * BIRDS; i++) {
			const bIndex = i % birdGeo.getAttribute('position').count;
			const bird = Math.floor(i / birdGeo.getAttribute('position').count);
			if (bIndex == 0) r = Math.random();
			const j = ~~bird;
			const x = (j % WIDTH) / WIDTH;
			const y = ~~(j / WIDTH) / WIDTH;
			reference.push(x, y, bIndex / tWidth, durationAnimation / tHeight);
			seeds.push(bird, r, Math.random(), Math.random());
		}

		for (let i = 0; i < birdGeo.index.array.length * BIRDS; i++) {
			const offset =
				Math.floor(i / birdGeo.index.array.length) * birdGeo.getAttribute('position').count;
			indices.push(birdGeo.index.array[i % birdGeo.index.array.length] + offset);
		}

		BirdGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
		BirdGeometry.setAttribute('birdColor', new THREE.BufferAttribute(new Float32Array(color), 3));
		BirdGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(color), 3));
		BirdGeometry.setAttribute(
			'reference',
			new THREE.BufferAttribute(new Float32Array(reference), 4)
		);
		BirdGeometry.setAttribute('seeds', new THREE.BufferAttribute(new Float32Array(seeds), 4));

		BirdGeometry.setIndex(indices);

		modelLoaded = true;
	});

	extend({ BirdGeometry });

	scene.background = new THREE.Color(colors[selectModel]);

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

	// INIT MATERIAL
	let materialShader;

	const materialOnBeforeCompile = (shader) => {
		shader.uniforms.texturePosition = { value: null };
		shader.uniforms.textureVelocity = { value: null };
		shader.uniforms.textureAnimation = { value: textureAnimation };
		shader.uniforms.time = { value: 1.0 };
		shader.uniforms.size = { value: sizes[selectModel] };
		shader.uniforms.delta = { value: 0.0 };

		let token = '#define STANDARD';

		let insert = /* glsl */ `
      attribute vec4 reference;
      attribute vec4 seeds;
      attribute vec3 birdColor;
      uniform sampler2D texturePosition;
      uniform sampler2D textureVelocity;
      uniform sampler2D textureAnimation;
      uniform float size;
      uniform float time;
    `;

		shader.vertexShader = shader.vertexShader.replace(token, token + insert);

		token = '#include <begin_vertex>';

		insert = /* glsl */ `
      vec4 tmpPos = texture2D( texturePosition, reference.xy );

      vec3 pos = tmpPos.xyz;
      vec3 velocity = normalize(texture2D( textureVelocity, reference.xy ).xyz);
      vec3 aniPos = texture2D( textureAnimation, vec2( reference.z, mod( time + ( seeds.x ) * ( ( 0.0004 + seeds.y / 10000.0) + normalize( velocity ) / 20000.0 ), reference.w ) ) ).xyz;
      vec3 newPosition = position;

      newPosition = mat3( modelMatrix ) * ( newPosition + aniPos );
      newPosition *= size + seeds.y * size * 0.2;

      velocity.z *= -1.;
      float xz = length( velocity.xz );
      float xyz = 1.;
      float x = sqrt( 1. - velocity.y * velocity.y );

      float cosry = velocity.x / xz;
      float sinry = velocity.z / xz;

      float cosrz = x / xyz;
      float sinrz = velocity.y / xyz;

      mat3 maty =  mat3( cosry, 0, -sinry, 0    , 1, 0     , sinry, 0, cosry );
      mat3 matz =  mat3( cosrz , sinrz, 0, -sinrz, cosrz, 0, 0     , 0    , 1 );

      newPosition =  maty * matz * newPosition;
      newPosition += pos;

      vec3 transformed = vec3( newPosition );
    `;

		shader.vertexShader = shader.vertexShader.replace(token, insert);

		materialShader = shader;
	};

	useFrame(({ clock }, delta) => {
		const now = clock.getElapsedTime();

		positionUniforms['time'].value = now;
		positionUniforms['delta'].value = delta;
		velocityUniforms['time'].value = now;
		velocityUniforms['delta'].value = delta;
		if (materialShader) materialShader.uniforms['time'].value = now / 1000;
		if (materialShader) materialShader.uniforms['delta'].value = delta;

		velocityUniforms['predator'].value.set($pointer.x * 0.5, $pointer.y * 0.5, 0);

		gpuCompute.compute();

		if (materialShader)
			materialShader.uniforms['texturePosition'].value =
				gpuCompute.getCurrentRenderTarget(positionVariable).texture;
		if (materialShader)
			materialShader.uniforms['textureVelocity'].value =
				gpuCompute.getCurrentRenderTarget(velocityVariable).texture;
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 350]} />

<T.Fog
	args={[colors[selectModel], 100, 1000]}
	on:create={({ ref }) => {
		scene.fog = ref;
	}}
/>

<T.HemisphereLight
	intensity={4.5}
	color={new THREE.Color().setHSL(0.6, 1, 0.6, THREE.SRGBColorSpace)}
	groundColor={new THREE.Color().setHSL(0.095, 1, 0.75, THREE.SRGBColorSpace)}
	position={[0, 50, 0]}
/>
<T.DirectionalLight
	intensity={2.0}
	color={new THREE.Color().setHSL(0.1, 1, 0.95, THREE.SRGBColorSpace)}
	position={new THREE.Vector3(-1, 1.75, 1).multiplyScalar(30)}
/>

<!-- FIXME: Why not instanced mesh? -->
{#if modelLoaded}
	<T.Mesh rotation.y={Math.PI / 2} castShadow receiveShadow>
		<T.BirdGeometry />
		<T.MeshStandardMaterial
			vertexColors
			flatShading
			roughness={1}
			metalness={0}
			onBeforeCompile={materialOnBeforeCompile}
		/>
	</T.Mesh>
{/if}
