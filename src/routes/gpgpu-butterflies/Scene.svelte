<script>
	// https://github.com/klevron/threejs-toys/blob/main/packages/toys/src/backgrounds/butterflies/index.js
	import { Color, Euler, MathUtils, Vector3 } from 'three';
	import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
	import { useThrelte, T, useFrame } from '@threlte/core';
	import { useTexture, OrbitControls, interactivity } from '@threlte/extras';
	import psrdnoise from '$lib/glsl/psrdnoise3.glsl';
	import mat3LookAt from '$lib/glsl/mat3-lookat.glsl';
	import mat4Compose from '$lib/glsl/mat4-compose.glsl';
	import positionFragment from './shaders/positionFragment.glsl';
	import velocityFragment from './shaders/velocityFragment.glsl';
	import * as THREE from 'three';
	import { base } from '$app/paths';

	const { randFloat: rnd, randFloatSpread: rndFS } = MathUtils;

	const { renderer, scene } = useThrelte();

	const { pointer } = interactivity();

	const BOUNDS = 800,
		BOUNDS_HALF = BOUNDS / 2;

	const config = {
		gpgpuSize: 32,
		background: 0xffffff,
		material: 'basic',
		materialParams: { transparent: true, alphaTest: 0.5 },
		texture: `${base}/textures/butterflies.png`,
		textureCount: 4,
		colors: [0xffffff, 0xffffff],
		lights: [
			{ type: 'ambient', params: [0xffffff, 0.5] },
			{ type: 'directional', params: [0xffffff, 1], props: { position: [0, 10, 0] } }
		],
		wingsScale: [1, 1, 1],
		wingsWidthSegments: 8,
		wingsHeightSegments: 8,
		wingsSpeed: 0.75,
		wingsDisplacementScale: 1.25,
		noiseCoordScale: 0.01,
		noiseTimeCoef: 0.0005,
		noiseIntensity: 0.0025,
		attractionRadius1: 100,
		attractionRadius2: 150,
		maxVelocity: 0.1
	};

	scene.background = new Color(config.background);

	const WIDTH = config.gpgpuSize;
	const COUNT = WIDTH * WIDTH;

	const uTexturePosition = { value: null };
	const uOldTexturePosition = { value: null };
	const uTextureVelocity = { value: null };
	const uTime = { value: 0 };
	const uNoiseCoordScale = { value: config.noiseCoordScale };
	const uNoiseIntensity = { value: config.noiseIntensity };
	const uMaxVelocity = { value: config.maxVelocity };
	const uAttractionRadius1 = { value: config.attractionRadius1 };
	const uAttractionRadius2 = { value: config.attractionRadius2 };
	const uWingsScale = { value: new Vector3(...config.wingsScale) };
	const uWingsSpeed = { value: config.wingsSpeed };
	const uWingsDisplacementScale = { value: config.wingsDisplacementScale };

	const gpuTexturesUniforms = { uTexturePosition, uOldTexturePosition, uTextureVelocity };
	const commonUniforms = {
		uTime,
		uNoiseCoordScale,
		uNoiseIntensity,
		uMaxVelocity,
		uAttractionRadius1,
		uAttractionRadius2,
		uWingsScale,
		uWingsSpeed,
		uWingsDisplacementScale
	};
	const uniforms = { ...gpuTexturesUniforms, ...commonUniforms };

	// INIT GPU
	const gpu = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

	// Init textures
	const dtPosition = gpu.createTexture();
	const dtVelocity = gpu.createTexture();
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

	const velocityVariable = gpu.addVariable('textureVelocity', velocityFragment, dtVelocity);
	const positionVariable = gpu.addVariable('texturePosition', positionFragment, dtPosition);

	gpu.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
	gpu.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);

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

	velocityVariable.wrapS = THREE.RepeatWrapping;
	velocityVariable.wrapT = THREE.RepeatWrapping;
	positionVariable.wrapS = THREE.RepeatWrapping;
	positionVariable.wrapT = THREE.RepeatWrapping;

	gpu.init();

	// INIT GEOMETRY
	const gpuUvs = new Float32Array(COUNT * 2);
	const mapIndexes = new Float32Array(COUNT);
	let i1 = 0;
	let i2 = 0;
	for (let j = 0; j < WIDTH; j++) {
		for (let i = 0; i < WIDTH; i++) {
			// [0, 1]
			gpuUvs[i1++] = i / (WIDTH - 1);
			gpuUvs[i1++] = j / (WIDTH - 1);
			mapIndexes[i2++] = Math.floor(Math.random() * config.textureCount);
		}
	}

	// INIT MATERIAL
	const map = useTexture(config.texture);

	const materialOnBeforeCompile = (shader) => {
		shader.defines = {
			COMPUTE_NORMALS: config.material !== 'basic',
			WINGS_WIDTH_SEGMENTS: config.wingsWidthSegments,
			WINGS_HEIGHT_SEGMENTS: config.wingsHeightSegments,
			WINGS_DX: (2.0 / config.wingsWidthSegments).toFixed(10),
			WINGS_DZ: (2.0 / config.wingsHeightSegments).toFixed(10),
			TEXTURE_COUNT: config.textureCount.toFixed(10)
		};
		Object.keys(uniforms).forEach((key) => {
			shader.uniforms[key] = uniforms[key];
		});
		shader.vertexShader =
			`
        uniform sampler2D uTexturePosition;
        uniform sampler2D uOldTexturePosition;
        uniform sampler2D uTextureVelocity;
        uniform vec3 uWingsScale;
        uniform float uWingsDisplacementScale;
        attribute vec2 gpuUv;
        attribute float mapIndex;
        varying vec4 vPos;
        varying vec4 vVel;
        varying float vMapIndex;
        ${mat3LookAt}
        ${mat4Compose}
      ` + shader.vertexShader;
		shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', '');
		shader.vertexShader = shader.vertexShader.replace('#include <normal_vertex>', '');
		shader.vertexShader = shader.vertexShader.replace(
			'#include <begin_vertex>',
			`
        vPos = texture2D(uTexturePosition, gpuUv);
        vec4 oldPos = texture2D(uOldTexturePosition, gpuUv);
        vVel = texture2D(uTextureVelocity, gpuUv);
        vMapIndex = float(mapIndex);

        mat3 rmat = lookAt(oldPos.xyz, vPos.xyz, vec3(0, 1, 0));
        mat4 im = compose(vPos.xyz, rmat, (0.5 + vPos.w) * uWingsScale);

        vec3 transformed = vec3(position);

        #ifdef COMPUTE_NORMALS
          vec3 transformedNormal = objectNormal;
        #endif

        float dx = abs(transformed.x);
        if (dx > 0.0) {
          float sdx = smoothstep(0.0, 1.0 + WINGS_DX, dx);
          #if WINGS_HEIGHT_SEGMENTS > 1
            float dz = transformed.z + 1.0;
            float sdz = smoothstep(0.0, 2.0 + WINGS_DZ, dz);
            transformed.y = sin(vVel.w - sdx + sdz) * sdx * uWingsDisplacementScale;
          #else
            transformed.y = sin(vVel.w - sdx) * sdx * uWingsDisplacementScale;
          #endif

          #ifdef COMPUTE_NORMALS
            #if WINGS_HEIGHT_SEGMENTS > 1
              float s = sign(transformed.x);
              float sdx1 = smoothstep(0.0, 1.0 + WINGS_DX, dx + WINGS_DX);
              float sdz1 = smoothstep(0.0, 2.0 + WINGS_DZ, dz + WINGS_DZ);
              float dvy1 = sin(vVel.w - sdx + sdz1) * sdx * uWingsDisplacementScale - transformed.y;
              float dvy2 = sin(vVel.w - sdx1 + sdz) * sdx1 * uWingsDisplacementScale - transformed.y;
              vec3 v1 = vec3(0.0, dvy1, s * WINGS_DZ);
              vec3 v2 = vec3(s * WINGS_DX, dvy2, 0.0);
              transformedNormal = -normalize(cross(v1, v2));
            #else
              float s = sign(transformed.x);
              float sdx1 = smoothstep(0.0, 1.0 + WINGS_DX, dx + WINGS_DX);
              float dvy1 = sin(vVel.w - sdx1) * sdx * uWingsDisplacementScale - transformed.y;
              vec3 v1 = vec3(0.0, 0.0, s);
              vec3 v2 = vec3(s * WINGS_DX, dvy1, 0.0);
              transformedNormal = -normalize(cross(v1, v2));
            #endif
          #endif
        }

        #ifdef COMPUTE_NORMALS
          #ifdef USE_INSTANCING
            mat3 m = mat3( im );
            transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );
            transformedNormal = m * transformedNormal;
          #endif
          transformedNormal = normalMatrix * transformedNormal;
          #ifdef FLIP_SIDED
            transformedNormal = - transformedNormal;
          #endif
          #ifdef USE_TANGENT
            vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;
            #ifdef FLIP_SIDED
              transformedTangent = - transformedTangent;
            #endif
          #endif
          #ifndef FLAT_SHADED
            vNormal = normalize( transformedNormal );
            #ifdef USE_TANGENT
              vTangent = normalize( transformedTangent );
              vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
            #endif
          #endif
        #endif
      `
		);

		shader.vertexShader = shader.vertexShader.replace(
			'#include <project_vertex>',
			`
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = im * mvPosition;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `
		);

		shader.fragmentShader =
			`
        varying float vMapIndex;
      ` + shader.fragmentShader;
		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <map_fragment>',
			`
        #ifdef USE_MAP
          vec2 vUv = vMapUv;
          vec2 uv = vUv;
          uv.x = (vMapIndex + vUv.x) / TEXTURE_COUNT;
          vec4 sampledDiffuseColor = texture2D(map, uv);
          diffuseColor *= sampledDiffuseColor;
        #endif
      `
		);
	};

	// SET COLORS
	let iMesh;

	// $: if (iMesh) {
	// 	if (Array.isArray(config.colors) && config.colors.length > 1) {
	// 		const cscale = colorScale(config.colors);
	// 		for (let i = 0; i < COUNT; i++) {
	// 			iMesh.setColorAt(i, cscale.getColorAt(i / COUNT));
	// 		}
	// 		iMesh.instanceColor.needsUpdate = true;
	// 	}
	// }

	// function colorScale(colors) {
	// 	let range = [];
	// 	setColors(colors);

	// 	const dummy = new Color();

	// 	return { setColors, getColorAt };

	// 	function setColors(colors) {
	// 		range = [];
	// 		colors.forEach((color) => {
	// 			range.push(new Color(color));
	// 		});
	// 	}

	// 	function getColorAt(progress) {
	// 		const p = Math.max(0, Math.min(1, progress)) * (colors.length - 1);
	// 		const i1 = Math.floor(p);
	// 		const c1 = range[i1];
	// 		if (i1 >= colors.length - 1) {
	// 			return c1.clone();
	// 		}
	// 		const p1 = p - i1;
	// 		const c2 = range[i1 + 1];

	// 		dummy.r = c1.r + p1 * (c2.r - c1.r);
	// 		dummy.g = c1.g + p1 * (c2.g - c1.g);
	// 		dummy.b = c1.b + p1 * (c2.b - c1.b);
	// 		return dummy.clone();
	// 	}
	// }

	useFrame(({ clock }, delta) => {
		const now = clock.getElapsedTime();

		positionUniforms['time'].value = now;
		positionUniforms['delta'].value = delta;
		velocityUniforms['time'].value = now;
		velocityUniforms['delta'].value = delta;

		velocityUniforms['predator'].value.set($pointer.x * 0.5, $pointer.y * 0.5, 0);

		uTime.value = clock.getElapsedTime() * config.noiseTimeCoef;

		gpu.compute();
		uTexturePosition.value = positionVariable.renderTargets[gpu.currentTextureIndex].texture;
		uOldTexturePosition.value =
			positionVariable.renderTargets[gpu.currentTextureIndex === 0 ? 1 : 0].texture;
		uTextureVelocity.value = velocityVariable.renderTargets[gpu.currentTextureIndex].texture;
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 50, 70]}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<T.AmbientLight args={config.lights[0].params} />
<T.DirectionalLight args={config.lights[1].params} position={config.lights[1].props.position} />

{#await map then value}
	<T.InstancedMesh bind:ref={iMesh} count={COUNT}>
		<T.PlaneGeometry
			args={[0.2, 0.2, config.wingsWidthSegments, config.wingsHeightSegments]}
			on:create={({ ref }) => {
				ref.rotateX(Math.PI / 2);
			}}
		>
			<T.InstancedBufferAttribute attach="attributes.gpuUv" args={[gpuUvs, 2]} />
			<T.InstancedBufferAttribute attach="attributes.mapIndex" args={[mapIndexes, 1]} />
		</T.PlaneGeometry>

		<T.MeshBasicMaterial
			onBeforeCompile={materialOnBeforeCompile}
			map={value}
			{...config.materialParams}
		>
			<T.DoubleSide attach="side" />
		</T.MeshBasicMaterial>
	</T.InstancedMesh>
{/await}
