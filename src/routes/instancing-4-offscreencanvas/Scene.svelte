<script>
	import { T, useFrame, useThrelte } from '@threlte/core';
	import { Grid, OrbitControls } from '@threlte/extras';
	import * as THREE from 'three';
	import { palettes, sinPalettes } from '$lib/palettes.js';
	import { gsap } from 'gsap';

	const { scene } = useThrelte();

	const paletteKey = 'blue';
	const palette = palettes[paletteKey];
	const sinPalette = sinPalettes[paletteKey];

	scene.background = palette.BG;

	const uTime = { value: 0 };

	// INSTANCED BUFFER GEOMETRY
	function exampleBasicInstancedGeometry() {
		const radius = 0.66;

		const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8, 2);
		const instancedGeometry = new THREE.InstancedBufferGeometry().copy(geometry);
		const instances = 100;
		instancedGeometry.instanceCount = instances;

		const pos = new Float32Array(instances * 3);

		for (let i = 0; i < instances; i++) {
			pos[i] = Math.random() * 10 - 5;
			pos[i + 1] = Math.random() * 10 - 5;
			pos[i + 2] = Math.random() * 10 - 5;
		}

		instancedGeometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));

		const vertexShader = `
      attribute vec3 aPos;

      void main() {
        vec3 transformed = position;
        transformed += aPos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
  `;

		const fragmentShader = `
      void main() {
        gl_FragColor = vec4(1.0);
      }
  `;

		const material = new THREE.ShaderMaterial({
			fragmentShader,
			vertexShader
		});

		const mesh = new THREE.Mesh(instancedGeometry, material);
		mesh.frustumCulled = false;

		return mesh;
	}

	// INSTANCING WITH PRE-BUILT MATERIALS
	function exampleGeometryInstancedPrebuiltMaterial() {
		const radius = 0.66;

		const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8, 2);
		const instancedGeometry = new THREE.InstancedBufferGeometry().copy(geometry);
		const instances = 100;
		instancedGeometry.instanceCount = instances;

		const pos = new Float32Array(instances * 3);

		for (let i = 0; i < instances; i++) {
			pos[i] = Math.random() * 10 - 5;
			pos[i + 1] = Math.random() * 10 - 5;
			pos[i + 2] = Math.random() * 10 - 5;
		}

		instancedGeometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));

		const vertexHead = `
      attribute vec3 aPos;

      void main() {
    `;

		const vertexBody = `
      transformed += aPos;

      vec4 mvPosition = vec4(transformed, 1.0);

      mvPosition = modelViewMatrix * mvPosition;

      gl_Position = projectionMatrix * mvPosition;
    `;

		const uniforms = {};

		const material = new THREE.MeshPhysicalMaterial();
		material.onBeforeCompile = (shader) => {
			shader.vertexShader = shader.vertexShader.replace('void main() {', vertexHead);
			shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', vertexBody);
			shader.uniforms = {
				...shader.uniforms,
				...uniforms
			};
		};

		const mesh = new THREE.Mesh(instancedGeometry, material);
		mesh.frustumCulled = false;

		// Making instances work with shadows
		mesh.castShadow = true;
		mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
		mesh.customDepthMaterial.onBeforeCompile = (shader) => {
			shader.vertexShader = shader.vertexShader.replace('void main() {', vertexHead);
			shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', vertexBody);
			shader.uniforms = {
				...shader.uniforms,
				...uniforms
			};
		};
		mesh.customDepthMaterial.depthPacking = THREE.RGBADepthPacking;

		return mesh;
	}

	// THREE.JS INSTANCEDMESH
	// ThreeJS out of the box instancing solution.
	// Made to work with every material
	// However sends more data to the GPU
	// i.e. position + scale + rotation (one transformed matrix)
	function exampleInstancedMesh() {
		const grid = 10;
		const geometry = new THREE.BoxGeometry(0.75, 0.75, 0.75);
		const material = new THREE.MeshPhysicalMaterial();

		const mesh = new THREE.InstancedMesh(geometry, material, grid * grid);

		const dummy = new THREE.Object3D();

		let i = 0;
		for (let y = 0; y < grid; y++) {
			for (let x = 0; x < grid; x++) {
				dummy.position.set(x - grid / 2, y - grid / 2, 0);
				dummy.updateMatrix();

				mesh.setMatrixAt(i, dummy.matrix);
				i++;
			}
		}

		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();

		return mesh;
	}

	const mesh = exampleInstancedMesh();

	useFrame(({ clock }) => {
		uTime.value = clock.getElapsedTime();
	});
</script>

<T.PerspectiveCamera makeDefault position.z={20}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<T.DirectionalLight args={[0xffffff, 1]} position={[0, 3, 2]} castShadow />
<T.HemisphereLight args={[0x800080, 0x7000bb, 1.5]} />

<!-- TEST WALL -->
<T.Mesh
	on:create={({ ref }) => {
		ref.position.z += -3;
	}}
	receiveShadow
>
	<T.PlaneGeometry args={[20, 20]} />
	<T.MeshPhysicalMaterial />
</T.Mesh>

<T is={mesh} />
