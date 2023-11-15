<script>
	import { interactivity, useTexture } from '@threlte/extras';
	import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
	import { getSphereTexture, getVelocityTexture } from './getDataTexture';
	import simFragmentPosition from './shaders/simFragmentPosition';
	import simFragmentVelocity from './shaders/simFragmentVelocity';
	import { T, useFrame, useThrelte } from '@threlte/core';
	import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
	import { InstancedBufferAttribute, MeshMatcapMaterial, Vector3 } from 'three';
	import { patchShaders } from 'gl-noise/build/glNoise.m';
	import { base } from '$app/paths';

	const { pointer } = interactivity();
	const { renderer } = useThrelte();

	let iref;

	const SIZE = 256;

	// Load particle texture
	const map = useTexture(`${base}/matcaps/matcap4.png`);

	const gpuCompute = new GPUComputationRenderer(SIZE, SIZE, renderer);

	const pointsOnASphere = getSphereTexture(SIZE);

	const positionVariable = gpuCompute.addVariable(
		'uCurrentPosition',
		simFragmentPosition,
		getSphereTexture(SIZE)
	);
	const velocityVariable = gpuCompute.addVariable(
		'uCurrentVelocity',
		simFragmentVelocity,
		getVelocityTexture(SIZE)
	);

	gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
	gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);

	const positionUniforms = positionVariable.material.uniforms;
	const velocityUniforms = velocityVariable.material.uniforms;

	velocityUniforms.uMouse = { value: new Vector3(0, 0, 0) };
	velocityUniforms.uOriginalPosition = { value: pointsOnASphere };

	gpuCompute.init();

	// MATERIAL
	const shader = {
		vertex: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uPosition;
      uniform sampler2D uVelocity;

      attribute vec2 ref;

      vec3 rotate3D(vec3 v, vec3 vel) {
        vec3 newpos = v;
        vec3 up = vec3(0, 1, 0);
        vec3 axis = normalize(cross(up, vel));
        float angle = acos(dot(up, normalize(vel)));
        newpos = newpos * cos(angle) + cross(axis, newpos) * sin(angle) + axis * dot(axis, newpos) * (1. - cos(angle));
        return newpos;
      }

      vec3 displace(vec3 point, vec3 vel) {
        vec3 pos = texture2D(uPosition,ref).rgb;
        vec3 copypoint = rotate3D(point, vel);
        vec3 instancePosition = (instanceMatrix * vec4(copypoint, 1.)).xyz;
        return instancePosition + pos;
      }

      void main() {
        vec3 vel = texture2D(uVelocity, ref).rgb;
        vec3 p = displace(position, vel);

        csm_PositionRaw = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.);
        csm_Normal = rotate3D(normal, vel);
      }
    `,
		fragment: /* glsl */ `
      void main() {
        csm_DiffuseColor = vec4(1.);
      }
    `
	};

	const uniforms = {
		uPosition: {
			value: null
		},
		uVelocity: {
			value: null
		}
	};

	let material;
	$: if ($map) {
		material = new CustomShaderMaterial({
			baseMaterial: MeshMatcapMaterial,
			size: 0.01,
			matcap: $map,
			vertexShader: patchShaders(shader.vertex),
			fragmentShader: patchShaders(shader.fragment),
			uniforms,
			transparent: true
		});
	}

	// Unique identifier
	const ref = new Float32Array(SIZE * SIZE * 2);
	for (let i = 0; i < SIZE; i++) {
		for (let j = 0; j < SIZE; j++) {
			const k = i * SIZE + j;
			ref[k * 2 + 0] = i / (SIZE - 1);
			ref[k * 2 + 1] = j / (SIZE - 1);
		}
	}
	$: if (iref) iref.geometry.setAttribute('ref', new InstancedBufferAttribute(ref, 2));

	// Mouse interactions
	// useFrame(() => {
	// 	velocityUniforms.uMouse.value.x = ($pointer.x * $dpr.width) / 2;
	// 	velocityUniforms.uMouse.value.y = ($pointer.y * $dpr.height) / 2;
	// });

	useFrame(() => {
		gpuCompute.compute();

		if (iref) {
			iref.material.uniforms.uPosition.value =
				gpuCompute.getCurrentRenderTarget(positionVariable).texture;
			iref.material.uniforms.uVelocity.value =
				gpuCompute.getCurrentRenderTarget(velocityVariable).texture;
		}
	});
</script>

{#if material}
	<T.InstancedMesh bind:ref={iref} args={[null, null, SIZE * SIZE]}>
		<T.BoxGeometry args={[0.01, 0.03, 0.01]} />
		<T is={material} attach="material" />
	</T.InstancedMesh>
{/if}
