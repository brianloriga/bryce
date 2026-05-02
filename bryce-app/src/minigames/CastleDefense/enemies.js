import * as THREE from 'three';
import { ENEMY_TYPES } from './gameData';

/**
 * Stylized primitive fallback enemies. Used until the character GLBs load
 * (and permanently on devices where the GLTFLoader pipeline fails).
 *
 * Enemy types: goblin (fast/weak), knight (armored), giant (slow/tanky).
 */
export function buildPrimitiveEnemy(typeKey) {
  const g         = new THREE.Group();
  const type      = ENEMY_TYPES[typeKey] ?? ENEMY_TYPES.goblin;
  const baseColor = type.color;
  const mainMat   = new THREE.MeshLambertMaterial({ color: baseColor });
  const darkMat   = new THREE.MeshLambertMaterial({
    color: Math.max(0, Math.floor(baseColor * 0.55)),
  });
  const eyeMat    = new THREE.MeshLambertMaterial({
    color: 0xff2e2e, emissive: 0xff2e2e, emissiveIntensity: 0.7,
  });

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };

  if (typeKey === 'goblin') {
    add(new THREE.BoxGeometry(0.36, 0.34, 0.3), mainMat, 0, 0.17, 0);
    add(new THREE.SphereGeometry(0.21, 8, 6), mainMat, 0, 0.5, 0);
    add(new THREE.ConeGeometry(0.06, 0.18, 4), mainMat, -0.15, 0.62, 0, 0, 0,  0.45);
    add(new THREE.ConeGeometry(0.06, 0.18, 4), mainMat,  0.15, 0.62, 0, 0, 0, -0.45);
    add(new THREE.SphereGeometry(0.04, 5, 4), eyeMat, -0.07, 0.5, 0.18);
    add(new THREE.SphereGeometry(0.04, 5, 4), eyeMat,  0.07, 0.5, 0.18);

  } else if (typeKey === 'knight') {
    // Armored — dark plated body with a crest
    add(new THREE.CylinderGeometry(0.22, 0.26, 0.60, 8), mainMat, 0, 0.30, 0);
    add(new THREE.SphereGeometry(0.10, 6, 6), darkMat, -0.24, 0.45, 0);
    add(new THREE.SphereGeometry(0.10, 6, 6), darkMat,  0.24, 0.45, 0);
    add(new THREE.CylinderGeometry(0.19, 0.19, 0.34, 8), darkMat, 0, 0.76, 0);
    add(new THREE.ConeGeometry(0.09, 0.24, 5),
      new THREE.MeshLambertMaterial({ color: 0xef4444 }), 0, 1.03, 0);
    add(new THREE.BoxGeometry(0.22, 0.04, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x0f172a }), 0, 0.76, 0.20);

  } else if (typeKey === 'giant') {
    // Big and hulking — wide body, thick arms, tusks
    const bigMat = new THREE.MeshLambertMaterial({ color: baseColor });
    add(new THREE.SphereGeometry(0.44, 10, 8), bigMat, 0, 0.50, 0);       // torso
    add(new THREE.SphereGeometry(0.30, 8,  7), bigMat, 0, 1.05, 0);       // head
    add(new THREE.CylinderGeometry(0.11, 0.14, 0.62, 5), bigMat, -0.48, 0.50, 0); // left arm
    add(new THREE.CylinderGeometry(0.11, 0.14, 0.62, 5), bigMat,  0.48, 0.50, 0); // right arm
    add(new THREE.ConeGeometry(0.045, 0.18, 4),
      new THREE.MeshLambertMaterial({ color: 0xfef9c3 }), -0.11, 0.96, 0.26, -0.3); // tusk L
    add(new THREE.ConeGeometry(0.045, 0.18, 4),
      new THREE.MeshLambertMaterial({ color: 0xfef9c3 }),  0.11, 0.96, 0.26, -0.3); // tusk R
    add(new THREE.SphereGeometry(0.05, 5, 4), eyeMat, -0.11, 1.14, 0.27);
    add(new THREE.SphereGeometry(0.05, 5, 4), eyeMat,  0.11, 1.14, 0.27);

  } else if (typeKey === 'boss') {
    // Massive armored warlord — large body, shoulder plates, crown horns
    const bossMat  = new THREE.MeshLambertMaterial({ color: baseColor });
    const goldMat  = new THREE.MeshLambertMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.6 });
    const darkMat2 = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    add(new THREE.CylinderGeometry(0.38, 0.44, 0.85, 8), bossMat,  0, 0.43, 0);     // torso
    add(new THREE.SphereGeometry(0.28, 8, 7),              bossMat,  0, 1.05, 0);    // head
    add(new THREE.CylinderGeometry(0.16, 0.20, 0.80, 6),  darkMat2, -0.56, 0.42, 0); // left arm
    add(new THREE.CylinderGeometry(0.16, 0.20, 0.80, 6),  darkMat2,  0.56, 0.42, 0); // right arm
    // Shoulder pauldrons
    add(new THREE.SphereGeometry(0.22, 7, 6),              darkMat2, -0.50, 0.72, 0);
    add(new THREE.SphereGeometry(0.22, 7, 6),              darkMat2,  0.50, 0.72, 0);
    // Crown horns
    add(new THREE.ConeGeometry(0.07, 0.32, 5), goldMat, -0.18, 1.42, 0, 0, 0, -0.22);
    add(new THREE.ConeGeometry(0.07, 0.32, 5), goldMat,  0,    1.52, 0);
    add(new THREE.ConeGeometry(0.07, 0.32, 5), goldMat,  0.18, 1.42, 0, 0, 0,  0.22);
    // Glowing eyes
    add(new THREE.SphereGeometry(0.06, 5, 4), eyeMat, -0.10, 1.08, 0.26);
    add(new THREE.SphereGeometry(0.06, 5, 4), eyeMat,  0.10, 1.08, 0.26);

  } else {
    add(new THREE.SphereGeometry(0.28, 8, 6), mainMat, 0, 0, 0);
  }

  return g;
}
