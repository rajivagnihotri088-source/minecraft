
import * as THREE from
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

import { PointerLockControls } from
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 25, 65);

// CAMERA
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 4, 7);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// LIGHTS
scene.add(new THREE.HemisphereLight(0xffffff, 0x667744, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(15, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// MATERIALS
const materials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x58a832 }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x87512f }),
  stone: new THREE.MeshLambertMaterial({ color: 0x888888 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x79502c }),
  leaves: new THREE.MeshLambertMaterial({
    color: 0x267d28,
    transparent: true,
    opacity: 0.95
  })
};

const geometry = new THREE.BoxGeometry(1, 1, 1);
const blocks = new Map();
const blockMeshes = [];
const raycaster = new THREE.Raycaster();
raycaster.far = 6;

function key(x, y, z) {
  return `${x},${y},${z}`;
}

function addBlock(x, y, z, type) {
  const k = key(x, y, z);
  if (blocks.has(k)) return;

  const mesh = new THREE.Mesh(geometry, materials[type]);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { x, y, z, type };

  scene.add(mesh);
  blocks.set(k, mesh);
  blockMeshes.push(mesh);
}

function removeBlock(mesh) {
  const { x, y, z } = mesh.userData;
  scene.remove(mesh);
  blocks.delete(key(x, y, z));

  const index = blockMeshes.indexOf(mesh);
  if (index !== -1) blockMeshes.splice(index, 1);
}

// RANDOM TERRAIN
function terrainHeight(x, z) {
  return Math.floor(
    Math.sin(x * 0.35) * 1.2 +
    Math.cos(z * 0.3) * 1.2 +
    Math.sin((x + z) * 0.2) * 0.7
  );
}

for (let x = -18; x <= 18; x++) {
  for (let z = -18; z <= 18; z++) {
    const h = terrainHeight(x, z);

    for (let y = -3; y < h; y++) {
      addBlock(x, y, z, y < h - 2 ? 'stone' : 'dirt');
    }

    addBlock(x, h, z, 'grass');
  }
}

// TREES
function makeTree(x, z) {
  const h = terrainHeight(x, z);

  for (let y = 1; y <= 3; y++) {
    addBlock(x, h + y, z, 'wood');
  }

  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 2; dy <= 4; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 3) <= 4) {
          addBlock(x + dx, h + dy, z + dz, 'leaves');
        }
      }
    }
  }
}

for (let x = -15; x <= 15; x += 5) {
  for (let z = -15; z <= 15; z += 5) {
    if (Math.random() > 0.45 && (Math.abs(x) > 4 || Math.abs(z) > 4)) {
      makeTree(x, z);
    }
  }
}

// PLAYER CONTROLS
const controls = new PointerLockControls(camera, document.body);

const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('startBtn');
const message = document.getElementById('message');

startBtn.addEventListener('click', () => controls.lock());

controls.addEventListener('lock', () => {
  overlay.style.display = 'none';
  hud.style.display = 'block';
});

controls.addEventListener('unlock', () => {
  overlay.style.display = 'flex';
  hud.style.display = 'none';
});

const keys = {};
let velocityY = 0;
let onGround = false;
let selectedBlock = 'grass';

window.addEventListener('keydown', e => {
  keys[e.code] = true;

  if (e.code.startsWith('Digit')) {
    const number = Number(e.code.slice(5));
    const slots = document.querySelectorAll('.slot');

    if (number >= 1 && number <= 5) {
      selectedBlock = slots[number - 1].dataset.block;

      slots.forEach(s => s.classList.remove('selected'));
      slots[number - 1].classList.add('selected');
    }
  }

  if (e.code === 'Space') e.preventDefault();
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

document.querySelectorAll('.slot').forEach(slot => {
  slot.addEventListener('click', () => {
    selectedBlock = slot.dataset.block;
    document.querySelectorAll('.slot')
      .forEach(s => s.classList.remove('selected'));
    slot.classList.add('selected');
  });
});

// FIND GROUND HEIGHT
function groundHeight(x, z) {
  const bx = Math.round(x);
  const bz = Math.round(z);

  for (let y = 20; y >= -5; y--) {
    if (blocks.has(key(bx, y, bz))) return y + 0.5;
  }

  return -3;
}

// BREAK AND PLACE BLOCKS
function targetBlock() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(blockMeshes, false);
  return hits.length ? hits[0] : null;
}

window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('mousedown', e => {
  if (!controls.isLocked) return;

  const hit = targetBlock();
  if (!hit) return;

  const mesh = hit.object;

  if (e.button === 0) {
    // LEFT CLICK: BREAK BLOCK
    if (mesh.userData.y <= -2) {
      message.textContent = 'Bedrock ko nahi tod sakte!';
      return;
    }

    removeBlock(mesh);
    message.textContent = 'Block tod diya!';
  }

  if (e.button === 2) {
    // RIGHT CLICK: PLACE BLOCK
    const normal = hit.face.normal.clone()
      .transformDirection(mesh.matrixWorld);

    const p = mesh.position.clone().add(
      new THREE.Vector3(
        Math.round(normal.x),
        Math.round(normal.y),
        Math.round(normal.z)
      )
    );

    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const pz = Math.round(p.z);

    // Player ke andar block place nahi hoga
    const insidePlayer =
      Math.abs(px - camera.position.x) < 0.8 &&
      Math.abs(pz - camera.position.z) < 0.8 &&
      py + 0.5 > camera.position.y - 1.7 &&
      py - 0.5 < camera.position.y + 0.2;

    if (!insidePlayer) {
      addBlock(px, py, pz, selectedBlock);
      message.textContent = selectedBlock + ' block placed!';
    }
  }
});

// GAME LOOP
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  if (controls.isLocked) {
    const direction = new THREE.Vector3();
    controls.getDirection(direction);
    direction.y = 0;
    direction.normalize();

    const right = new THREE.Vector3()
      .crossVectors(direction, camera.up)
      .normalize();

    const move = new THREE.Vector3();

    if (keys['KeyW']) move.add(direction);
    if (keys['KeyS']) move.sub(direction);
    if (keys['KeyD']) move.sub(right);
    if (keys['KeyA']) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(5 * delta);

      const nx = camera.position.x + move.x;
      const nz = camera.position.z + move.z;

      if (Math.abs(nx) < 20) camera.position.x = nx;
      if (Math.abs(nz) < 20) camera.position.z = nz;
    }

    const floor = groundHeight(
      camera.position.x,
      camera.position.z
    ) + 1.2;

    if (keys['Space'] && onGround) {
      velocityY = 7;
      onGround = false;
    }

    velocityY -= 18 * delta;
    camera.position.y += velocityY * delta;

    if (camera.position.y <= floor) {
      camera.position.y = floor;
      velocityY = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    camera.position.y = Math.min(camera.position.y, 25);

    const hit = targetBlock();
    if (hit) {
      const b = hit.object.userData;
      document.getElementById('info').textContent =
        'Block: ' + b.type.toUpperCase();
    } else {
      document.getElementById('info').textContent = 'BLOCK WORLD 3D';
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
