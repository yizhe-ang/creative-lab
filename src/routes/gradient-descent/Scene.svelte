<script>
	// https://github.com/mrdoob/three.js/blob/master/examples/physics_ammo_terrain.html
	// https://stackblitz.com/edit/example-basic-wasd?file=src%2Flib%2FPlayer.svelte
	// https://threejs-journey.com/lessons/create-a-game-with-r3f#subscribe
	import { T, useFrame, useThrelte } from '@threlte/core';
	import { OrbitControls, useTexture } from '@threlte/extras';
	import { base } from '$app/paths';
	import * as THREE from 'three';
	import { RigidBody, AutoColliders, Debug, Collider } from '@threlte/rapier';
	import RAPIER from '@dimforge/rapier3d-compat';
	import { useKeyboardControls } from 'svelte-kbc';

	const { scene, camera } = useThrelte();

	scene.background = new THREE.Color(0xbfd1e5);

	let player;
	let playerMesh;
	let cameraPosition = new THREE.Vector3(0, 10, 0);
	let cameraTarget = new THREE.Vector3();

	const terrainWidthExtents = 100;
	const terrainDepthExtents = 100;
	const terrainWidth = 128;
	const terrainDepth = 128;
	const terrainHalfWidth = terrainWidth / 2;
	const terrainHalfDepth = terrainDepth / 2;
	const terrainMaxHeight = 8;
	const terrainMinHeight = -2;

	const heightData = generateHeight(terrainWidth, terrainDepth, terrainMinHeight, terrainMaxHeight);

	function generateHeight(width, depth, minHeight, maxHeight) {
		// Generates the height data (a sinus wave)

		const size = width * depth;
		const data = new Float32Array(size);

		const hRange = maxHeight - minHeight;
		const w2 = width / 2;
		const d2 = depth / 2;
		const phaseMult = 12;

		let p = 0;

		for (let j = 0; j < depth; j++) {
			for (let i = 0; i < width; i++) {
				const radius = Math.sqrt(Math.pow((i - w2) / w2, 2.0) + Math.pow((j - d2) / d2, 2.0));

				const height = (Math.sin(radius * phaseMult) + 1) * 0.5 * hRange + minHeight;

				data[p] = height;

				p++;
			}
		}

		return data;
	}

	const grid = useTexture(`${base}/textures/grid.png`, {
		transform: (texture) => {
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set(terrainWidth - 1, terrainDepth - 1);

			return texture;
		}
	});

	// KEYBOARD CONTROLS
	const { w, a, s, d, space } = useKeyboardControls();

	useFrame((_, delta) => {
		if (player) {
			const impulse = { x: 0, y: 0, z: 0 };
			const torque = { x: 0, y: 0, z: 0 };

			const impulseStrength = 50 * delta;
			const torqueStrength = 50 * delta;

			if ($w) {
				impulse.z -= impulseStrength;
				torque.x -= torqueStrength;
			}

			if ($d) {
				impulse.x += impulseStrength;
				torque.z -= torqueStrength;
			}

			if ($s) {
				impulse.z += impulseStrength;
				torque.x += torqueStrength;
			}

			if ($a) {
				impulse.x -= impulseStrength;
				torque.z += torqueStrength;
			}

			player.applyImpulse(impulse);
			// player.applyTorqueImpulse(torque);
		}

		// const playerPosition = player.translation();
		const playerPosition = playerMesh.getWorldPosition(new THREE.Vector3());

		// FIXME: UPDATE CAMERA POSITION
		// cameraPosition.copy(playerPosition);
		// cameraPosition.x += 5;
		// cameraPosition.z += 5;
		// cameraPosition.y = 50;

		// cameraTarget.copy(playerPosition);
		// cameraTarget.y += 0.2

		// $camera.position.copy(cameraPosition)
		// $camera.lookAt(cameraTarget)
	});
</script>

<T.PerspectiveCamera makeDefault position={[20, 50, 20]}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<T.AmbientLight args={[0xbbbbbb]} />
<T.DirectionalLight
	args={[0xffffff, 3]}
	position={[100, 100, 50]}
	castShadow
	on:create={({ ref: light }) => {
		const dLight = 200;
		const sLight = dLight * 0.25;

		light.shadow.camera.left = -sLight;
		light.shadow.camera.right = sLight;
		light.shadow.camera.top = sLight;
		light.shadow.camera.bottom = -sLight;

		light.shadow.camera.near = dLight / 30;
		light.shadow.camera.far = dLight;

		light.shadow.mapSize.x = 1024 * 2;
		light.shadow.mapSize.y = 1024 * 2;
	}}
/>

<Debug />

<!-- FIXME: Add walls? -->
<!-- <RigidBody type="fixed">
  <CuboidCollider args={ [ 5, 2, 0.5 ] } position={ [ 0, 1, 5.5 ] } />
  <CuboidCollider args={ [ 5, 2, 0.5 ] } position={ [ 0, 1, - 5.5 ] } />
  <CuboidCollider args={ [ 0.5, 2, 5 ] } position={ [ 5.5, 1, 0 ] } />
  <CuboidCollider args={ [ 0.5, 2, 5 ] } position={ [ - 5.5, 1, 0 ] } />
</RigidBody> -->

<!-- PLAYER -->
<T.Group position={[0, 20, 0]}>
	<RigidBody canSleep={false} bind:rigidBody={player} linearDamping={0.5} angularDamping={0.5}>
		<AutoColliders shape="ball">
			<T.Mesh castShadow receiveShadow bind:ref={playerMesh}>
				<T.IcosahedronGeometry args={[1, 1]} />
				<T.MeshStandardMaterial color={'orange'} flatShading />
			</T.Mesh>
		</AutoColliders>
	</RigidBody>
</T.Group>

<!-- FUNCTION -->
{#await grid then _}
	<RigidBody type="fixed">
		<!-- FIXME: Use HeightField collider instead? -->
		<Collider
			shape="heightfield"
			args={[
				terrainWidth - 1,
				terrainDepth - 1,
				heightData,
				new RAPIER.Vector3(terrainWidthExtents, 1, terrainDepthExtents)
			]}
		/>
		<!-- <AutoColliders shape="trimesh"> -->
		<T.Mesh receiveShadow castShadow>
			<T.PlaneGeometry
				args={[terrainWidthExtents, terrainDepthExtents, terrainWidth - 1, terrainDepth - 1]}
				on:create={({ ref }) => {
					ref.rotateX(-Math.PI / 2);

					const vertices = ref.attributes.position.array;

					for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
						// j + 1 because it is the y component that we modify
						vertices[j + 1] = heightData[i];
					}

					ref.computeVertexNormals();
				}}
			/>
			<T.MeshPhongMaterial color={'white'} map={$grid} needsUpdate>
				<T.DoubleSide attach="side" />
			</T.MeshPhongMaterial>
		</T.Mesh>
		<!-- </AutoColliders> -->
	</RigidBody>
{/await}
