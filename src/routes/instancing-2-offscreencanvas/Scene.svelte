<script>
	import { T, useFrame, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import * as THREE from 'three';
	import { palettes, sinPalettes } from '$lib/palettes.js';
	import { gsap } from 'gsap';
	import { onMount } from 'svelte';

	const { scene } = useThrelte();

	let mesh;

	const paletteKey = 'blue';
	const palette = palettes[paletteKey];
	const sinPalette = sinPalettes[paletteKey];

	scene.background = palette.BG;

	const uTime = { value: 0 };

	// GEOMETRY
	const radius = 2 / 3;
	const rings = 40;
	const segments = 32;
	const totalInstances = rings * segments;

	const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8, 2);
	const instancedGeometry = new THREE.InstancedBufferGeometry().copy(geometry);
	instancedGeometry.instanceCount = totalInstances;

	const aInstance = new Float32Array(totalInstances * 2);

	let i = 0;
	for (let ringI = 0; ringI < rings; ringI++) {
		for (let segmentI = 0; segmentI < segments; segmentI++) {
			const angle = segmentI / segments; // range 0 to 1
			aInstance[i] = angle;
			aInstance[i + 1] = ringI;
			i += 2;
		}
	}

	instancedGeometry.setAttribute(
		'aInstance',
		new THREE.InstancedBufferAttribute(aInstance, 2, false)
	);

	// MATERIAL
	const vertexShader = `
    #define PI 3.141592653589793

    attribute vec2 aInstance;

    uniform float uTime;
    uniform float uOutro;

    varying vec2 vUv;
    varying float vDepth;
    varying float vAngle;

    mat4 rotationMatrix(vec3 axis, float angle) {
      axis = normalize(axis);
      float s = sin(angle);
      float c = cos(angle);
      float oc = 1.0 - c;

      return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
            oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
            oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
            0.0,                                0.0,                                0.0,                                1.0);
    }

    vec3 rotate(vec3 v, vec3 axis, float angle) {
      mat4 m = rotationMatrix(axis, angle);
      return (m * vec4(v, 1.0)).xyz;
    }

    void main() {
      vec3 transformed = position;

      float ringIndex = aInstance.y;
      float loop = 80.0;
      float zPos = mod(ringIndex * 2.0 - uTime * 15.0, loop);

      float angle = mod(aInstance.x + uTime * 0.1 + zPos * 0.01, 1.0);
      float radius = 10.0 + 8.0 * uOutro + sin(zPos * 0.1 + angle * PI * 2.0 + uTime) * 2.0;

      vec2 ringPos = vec2(
        cos(angle * PI * 2.0),
        sin(angle * PI * 2.0)
      ) * radius;

      transformed.y += -0.5;
      transformed.y *= 1.2 + sin(angle * PI * 12.0 + zPos * 0.08) * 0.4;
      transformed.y += 0.5;

      transformed.y += 0.5;
      transformed.y *= 2.0;
      transformed *= 1.0 + 3.0 * uOutro;
      transformed.y += -0.5;

      transformed = rotate(transformed, vec3(0.0, 0.0, 1.0), PI / 2.0);
      transformed = rotate(transformed, vec3(0.0, 1.0, 0.0), angle * PI * 2.0);

      transformed.xz += ringPos;
      transformed.y += -zPos;

      vDepth = zPos / loop;
      vAngle = angle;
      vUv = uv;

      if (position.y > 0.49999) {
        vUv.y = 1.0;
      }
      if (position.y < -0.49999) {
        vUv.y = 0.0;
      }

      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
  `;

	const fragmentShader = `
    #define PI 3.141592653589793

    varying vec2 vUv;
    varying float vDepth;
    varying float vAngle;

    uniform float uTime;

    vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ){
      return a + b*cos( 6.28318*(c*t+d) );
    }

    // Background color
    uniform vec3 uBackground;

    // Cosine palette
    uniform vec3 uPalette0;
    uniform vec3 uPalette1;
    uniform vec3 uPalette2;
    uniform vec3 uPalette3;
    uniform float uPaletteOffset;

    float ease(float t) {
      return -0.5 * (cos(PI * t) - 1.0);
    }

    void main() {
      vec3 color = vec3(0.0);
      color = vec3(vUv.y);

      vec3 colorPalette = palette(vUv.y + vDepth * 4.0 + uPaletteOffset + uTime, uPalette0, uPalette1, uPalette2, uPalette3);

      float mixVal = vDepth + vAngle;
      color = mix(colorPalette, uBackground, cos(mixVal * PI * 4.0 + uTime * 2.0));

      color = mix(color, uBackground, vDepth);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

	let material = new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			uTime: uTime,
			uOutro: { value: 0 },
			uFade: { value: 1 },
			uBackground: { value: palette.BG },
			uPalette0: { value: sinPalette.c0 },
			uPalette1: { value: sinPalette.c1 },
			uPalette2: { value: sinPalette.c2 },
			uPalette3: { value: sinPalette.c3 },
			uPaletteOffset: { value: sinPalette.offset }
		}
	});

	const config = {
		speed: 1
	};

	onMount(() => {
		// ANIMATIONS
		const tl = gsap.timeline({ delay: 1 });

		tl.to(config, {
			speed: 4,
			duration: 2,
			ease: 'power2.InOut'
		});

		tl.to(
			mesh.position,
			{
				y: 80,
				duration: 2,
				ease: 'power2.in'
			},
			1.8
		);

		tl.fromTo(
			mesh.material.uniforms.uOutro,
			{
				value: 0
			},
			{
				value: 1,
				duration: 2,
				ease: 'power4.in'
			},
			0.2
		);
	});

	useFrame(({ clock }, delta) => {
		uTime.value += delta * config.speed;
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0.1, 0]}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<!-- Back -->
<T.Mesh bind:ref={mesh} frustumCulled={false}>
	<T is={instancedGeometry} />
	<T is={material} />
</T.Mesh>
