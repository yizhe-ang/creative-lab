<script>
	import { T, useFrame, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import * as THREE from 'three';
	import { gsap } from 'gsap';

	const { scene, camera } = useThrelte();

	scene.background = new THREE.Color('black');

	const uTime = { value: 0 };

	const size = 0.5;
	const grid = 55;
	const gridSize = grid * size;

	const geometry = new THREE.BoxGeometry(size, size, size);
	const material = new THREE.MeshPhysicalMaterial({ color: 0xff80f0 });
	const mesh = new THREE.InstancedMesh(geometry, material, grid * grid);
	mesh.castShadow = true;
	mesh.receiveShadow = true;

	const dummy = new THREE.Object3D();
	const color = new THREE.Color(1, 1, 1);
	const totalColor = material.color.r + material.color.g + material.color.b;
	const weights = new THREE.Vector3(material.color.r, material.color.g, material.color.b);
	weights.divideScalar(totalColor);
	weights.multiplyScalar(-0.5);
	weights.addScalar(1);

	let i = 0;
	for (let x = 0; x < grid; x++) {
		for (let y = 0; y < grid; y++) {
			dummy.position.set(x * size - gridSize / 2 + size / 2, 0, y * size - gridSize / 2 + size / 2);

			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
			const center = 1 - dummy.position.length() * 0.18;
			color.set(
				center * weights.x + (1 - weights.x),
				center * weights.y + (1 - weights.y),
				center * weights.z + (1 - weights.z)
			);
			mesh.setColorAt(i, color);
			i++;
		}
	}
	mesh.instanceMatrix.needsUpdate = true;

	const vertexHead = `
    uniform float uTime;
    uniform vec2 uPos0;
    uniform vec2 uPos1;
    uniform float uAnimate;

    float cubicInOut(float t) {
      return t < 0.5
        ? 4.0 * t * t * t
        : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0;
    }

    float cubicOut(float t) {
      float f = t - 1.0;
      return f * f * f + 1.0;
    }

    float map(float value, float min1, float max1, float min2, float max2) {
        return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
    }

    float sdSegment( in vec2 p, in vec2 a, in vec2 b )
    {
        vec2 pa = p-a, ba = b-a;
        float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
        return length( pa - ba*h );
    }

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
  `;
	const projectVertex = /* glsl */ `
    vec4 position = instanceMatrix[3];
    float toCenter = length(position.xz);

    float mouseTrail = sdSegment(position.xz, uPos0, uPos1);
    mouseTrail = smoothstep(1.0, 3.0, mouseTrail);

    transformed *= 1.0 + (1.0 - mouseTrail) * 2.0;

    float start = toCenter * 0.02;
    float end = start + (toCenter + 1.5) * 0.06;
    float anim = map(clamp(uAnimate, start, end), start, end, 0.0, 1.0);

    transformed = rotate(transformed, vec3(0.0, 1.0, 1.0), cubicInOut(anim) * 3.14 + mouseTrail * 3.14 + uTime + toCenter * 0.4);

    transformed.y += -3.0 * (1.0 - mouseTrail);
    transformed.xyz *= cubicInOut(anim);
    transformed.y += cubicOut(1.0 - anim) * 1.0;
    transformed.y += sin(toCenter + uTime * 2.0) * 0.5;

    vec4 mvPosition = vec4(transformed, 1.0);

    #ifdef USE_INSTANCING

      mvPosition = instanceMatrix * mvPosition;

    #endif

    mvPosition = modelViewMatrix * mvPosition;

    gl_Position = projectionMatrix * mvPosition;
  `;
	const uniforms = {
		uTime,
		uPos0: { value: new THREE.Vector2(0, 0) },
		uPos1: { value: new THREE.Vector2(0, 0) },
		uAnimate: { value: 0 }
	};
	mesh.material.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader.replace('void main() {', vertexHead);
		shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', projectVertex);
		shader.uniforms = {
			...shader.uniforms,
			...uniforms
		};
	};
	mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
	mesh.customDepthMaterial.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader.replace('void main() {', vertexHead);
		shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', projectVertex);
		shader.uniforms = {
			...shader.uniforms,
			...uniforms
		};
	};
	mesh.customDepthMaterial.depthPacking = THREE.RGBADepthPacking;

	// INTERACTION
	const hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
	hitPlane.rotation.x = -Math.PI / 2;
	hitPlane.scale.setScalar(20);
	hitPlane.updateWorldMatrix();

	const raycaster = new THREE.Raycaster();

	const mouse = new THREE.Vector2();
	const v2 = new THREE.Vector2();

	window.addEventListener('mousemove', (ev) => {
		const x = 2 * (ev.clientX / window.innerWidth - 0.5);
		const y = -2 * (ev.clientY / window.innerHeight - 0.5);

		v2.set(x, y);

		raycaster.setFromCamera(v2, $camera);

		let intersects = raycaster.intersectObject(hitPlane);

		if (intersects.length > 0) {
			const first = intersects[0];

			mouse.x = first.point.x;
			mouse.y = first.point.z;
		}
	});

	// ANIMATION
	const tl = gsap.timeline();
	tl.to(uniforms.uAnimate, {
		value: 1,
		duration: 3,
		ease: 'linear'
	});

	const v3 = new THREE.Vector2();
	const vel = new THREE.Vector2();
	useFrame(({ clock }, delta) => {
		v3.copy(mouse);
		v3.sub(uniforms.uPos0.value);
		v3.multiplyScalar(0.08);
		uniforms.uPos0.value.add(v3);

		v3.copy(uniforms.uPos0.value);
		v3.sub(uniforms.uPos1.value);
		v3.multiplyScalar(0.05); // target velocity

		v3.sub(vel);
		v3.multiplyScalar(0.08);

		vel.add(v3);
		uniforms.uPos1.value.add(vel);

		uTime.value = clock.getElapsedTime();
	});
</script>

<!-- Camera -->
<T.PerspectiveCamera makeDefault position={[40, 40, 40]}>
	<OrbitControls enableDamping />
</T.PerspectiveCamera>

<!-- Lights -->
<T.HemisphereLight args={[0x9f9f9f, 0xffffff, 1]} />
<T.AmbientLight args={[0xffffff, 1]} />
<T.DirectionalLight position={[-10, 5, 10]} args={[0x909090, 1]} />
<T.DirectionalLight
	let:ref
	castShadow
	args={[0xffffff, 1]}
	position={[10, 5, 10]}
	shadow.camera.left={-10}
	shadow.camera.right={10}
	shadow.camera.bottom={-10}
	shadow.camera.top={10}
	shadow.camera.far={40}
	shadow.mapSize.width={2048}
	shadow.mapSize.height={2048}
>
	<!-- <T.CameraHelper
    args={[ref.shadow.camera]}
  /> -->
</T.DirectionalLight>

<!-- Objects -->
<T is={mesh} />
