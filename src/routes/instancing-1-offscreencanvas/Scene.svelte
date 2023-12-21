<script>
	import { T, useFrame, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import * as THREE from 'three';
	import { palettes, sinPalettes } from '$lib/palettes.js';
	import { gsap } from 'gsap';

	const { scene } = useThrelte();

	const paletteKey = 'blue';
	const palette = palettes[paletteKey];
	const sinPalette = sinPalettes[paletteKey];

	scene.background = palette.BG;

	const uTime = { value: 0 };

	const radius = 2 / 3;
	const grid = 20;
	const cellSize = 1.66;
	const totalGridSize = grid * cellSize;

	// GEOMETRY
	const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8, 2);
	const instancedGeometry = new THREE.InstancedBufferGeometry().copy(geometry);
	const instanceCount = grid * grid;
	instancedGeometry.instanceCount = instanceCount;

	const pos = new Float32Array(instanceCount * 2);

	let i = 0;
	for (let y = 0; y < grid; y++) {
		for (let x = 0; x < grid; x++) {
			pos[i + 0] = x * cellSize - totalGridSize / 2 + cellSize / 2;
			pos[i + 1] = y * cellSize - totalGridSize / 2 + cellSize / 2;
			i += 2;
		}
	}

	instancedGeometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 2, false));

	// MATERIAL
	const vertexShader = `
    attribute vec2 aPos;
    uniform float uTime;
    uniform float uFade;

    varying vec2 vUv;
    varying float vSquish;

    void main() {
      vec3 transformed = position;

      float len = length(aPos);
      len = len * len * 0.04;
      float activation = sin(len * 0.3 - cos(uTime * 2.0 + len * 0.1) * 4.0 + uFade * 5.0);

      // float fade = smoothstep(len, 1.0, uFade);
      float squish = smoothstep(-1.0, 1.0, mix(-1.0, activation, uFade));

      transformed.y += -0.5;
      transformed.y *= smoothstep(20.0, 10.0, len);
      transformed.y += 0.5;

      // transformed *= 1.0 - len / 20.0;

      transformed.y += 0.5;
      transformed.y = transformed.y * 0.2 + transformed.y * 0.8 * squish;
      transformed.y += -0.5;

      transformed.xz += aPos;

      vUv = uv;
      vSquish = squish;

      if (position.y > 0.4999) {
        vUv.y = 1.0;
      }

      if (position.y < -0.4999) {
        vUv.y = 0.0;
      }

      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
  `;

	const fragmentShader = `
    #define PI 3.141592653589793

    varying vec2 vUv;
    varying float vSquish;

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

      vec3 paletteColor = palette(vSquish + uPaletteOffset, uPalette0, uPalette1, uPalette2, uPalette3);

      color = mix(paletteColor, uBackground, cos(vSquish * PI * 1.0));
      color = mix(uBackground, color, ease(vUv.y));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

	let material = new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			uTime: uTime,
			uFade: { value: 1 },
			uBackground: { value: palette.BG },
			uPalette0: { value: sinPalette.c0 },
			uPalette1: { value: sinPalette.c1 },
			uPalette2: { value: sinPalette.c2 },
			uPalette3: { value: sinPalette.c3 },
			uPaletteOffset: { value: sinPalette.offset }
		}
	});

	// ANIMATIONS
	const tl = gsap.timeline();
	tl.fromTo(
		material.uniforms.uFade,
		{
			value: 0
		},
		{
			value: 1,
			duration: 3,
			ease: 'power2.out'
		}
	);
  // tl.to(
  //   material.uniforms.uFade,
  //   { value: 0, duration: 3, delay: 1, ease: "power2.out"}
  // )

	useFrame(({ clock }) => {
		uTime.value = clock.getElapsedTime();
	});
</script>

<T.PerspectiveCamera makeDefault position.x={80}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<!-- Back -->
<T.Mesh scale.y={10} rotation.z={-Math.PI / 2} position.x={-totalGridSize / 2 - 5}>
	<T is={instancedGeometry} />
	<T is={material} />
</T.Mesh>

<!-- Bottom -->
<T.Mesh scale.y={10} position.y={-totalGridSize / 2 - 5}>
	<T is={instancedGeometry} />
	<T is={material} />
</T.Mesh>

<!-- Top -->
<T.Mesh scale.y={10} rotation.z={Math.PI} position.y={totalGridSize / 2 + 5}>
	<T is={instancedGeometry} />
	<T is={material} />
</T.Mesh>

<!-- Right -->
<T.Mesh scale.y={10} rotation.x={Math.PI / 2} position.z={-totalGridSize / 2 - 5}>
	<T is={instancedGeometry} />
	<T is={material} />
</T.Mesh>

<!-- Left -->
<T.Mesh scale.y={10} rotation.x={-Math.PI / 2} position.z={totalGridSize / 2 + 5}>
	<T is={instancedGeometry} />
	<T is={material} />
</T.Mesh>
