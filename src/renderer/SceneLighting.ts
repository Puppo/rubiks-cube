import * as THREE from 'three';

export function setupSceneLighting(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffffff, 1.35);
  scene.add(ambient);

  const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.9);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
  keyLight.position.set(8, 14, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
  fillLight.position.set(-9, -6, -8);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfde047, 0.45);
  rimLight.position.set(0, -10, 8);
  scene.add(rimLight);

  const shadowPlaneGeo = new THREE.PlaneGeometry(18, 18);
  const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.22 });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -2.65;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);
}
