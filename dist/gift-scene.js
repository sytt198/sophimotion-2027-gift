import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// All model dimensions are millimetres. XY in the packaging drawing maps to XZ.
const clamp = THREE.MathUtils.clamp;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ramp = (p, a, b) => ease((p - a) / (b - a));
const S_PATH = 'M614 89 L590 159 H233 C229 159 226 161 223 169 C219 180 213 197 211 204 C208 212 210 216 218 219 L407 288 C411 290 413 291 412 295 L397 340 C395 347 393 350 388 350 H310 L153 294 C130 286 121 275 121 253 V239 C121 233 122 228 125 220 L144 160 C157 116 183 89 221 89 Z M335 220 C391 221 455 220 512 221 C544 221 561 240 559 266 C559 277 553 293 548 309 L520 391 C508 428 481 446 441 450 H59 L84 377 H419 C436 377 442 373 447 358 L470 289 C473 282 469 278 459 273 Z';

export async function createGiftScene({ canvas, quality = 'high', onReady } = {}) {
  if (!canvas) throw new Error('A canvas is required to display the gift box.');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, quality === 'high' ? 2 : 1.4));
  renderer.setClearColor(0x080b10, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral keeps saturated brand blue blue; ACES shifts it toward lavender.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-350, 350, 300, -300, 1, 4000);
  camera.position.set(420, 640, 790);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.28;
  room.dispose(); pmrem.dispose();
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false; controls.enableDamping = false;
  controls.enablePan = false; controls.minPolarAngle = 0.13; controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.minZoom = 0.65; controls.maxZoom = 2.5;
  controls.target.set(0, 35, 0);
  const materials = {
    box: new THREE.MeshStandardMaterial({ color: 0x06080b, roughness: 0.76, metalness: 0.08, envMapIntensity: 0.35 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x080a0e, roughness: 0.52, metalness: 0.18 }),
    lining: new THREE.MeshStandardMaterial({ color: 0x080a0e, roughness: 0.94, envMapIntensity:0.25 }),
    foam: new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.99, envMapIntensity:0.2 }),
    cavity: new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: 0.98 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xdde2ed, metalness: 0.96, roughness: 0.19, envMapIntensity:1.6 }),
    hinge: new THREE.MeshStandardMaterial({ color: 0x30343e, metalness: 0.8, roughness: 0.35 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x001bbd, metalness: 0.03, roughness: 0.4, envMapIntensity:0.35 }),
    blueDark: new THREE.MeshStandardMaterial({ color: 0x001c93, roughness: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.42 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf8f6ee, roughness: 0.91 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf4d76c, roughness: 0.91 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbce1ff, emissiveIntensity: 1.6, roughness: 0.2 }),
  };
  // r180 otherwise replaces a material's envMapIntensity with the scene default.
  for (const material of Object.values(materials)) material.envMap = environment.texture;
  const model = new THREE.Group(); scene.add(model);
  const meshes = [], textures = [];
  const mesh = (geometry, material, parent = model, pos = [0, 0, 0]) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); meshes.push(m); return m;
  };
  const box = (w, h, d, mat, parent, pos, radius = 0.8) => mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), mat, parent, pos);
  const cylinder = (r, h, mat, parent, pos, segments = 40) => mesh(new THREE.CylinderGeometry(r, r, h, segments), mat, parent, pos);
  const texture = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures.push(t); return t;
  };
  const decal = (w, d, tex, parent, pos, opacity = 1) => {
    const m = mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, opacity, side: THREE.DoubleSide }), parent, pos);
    m.rotation.x = -Math.PI / 2; m.castShadow = false; return m;
  };
  const grain=texture(384,384,(ctx,w,h)=>{const data=ctx.createImageData(w,h);let seed=2027;for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=110+(seed>>>25);data.data[i]=v;data.data[i+1]=v;data.data[i+2]=v;data.data[i+3]=255;}ctx.putImageData(data,0,0);});
  grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(4,4);materials.box.bumpMap=grain;materials.box.bumpScale=.075;materials.foam.bumpMap=grain;materials.foam.bumpScale=.11;
  function logo(parent, width, pos, mat = materials.silver) {
    const parsed = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${S_PATH}"/></svg>`);
    const group = new THREE.Group(); parent.add(group); group.position.set(...pos);
    for (const path of parsed.paths) for (const shape of SVGLoader.createShapes(path)) {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 14, bevelEnabled: true, bevelSegments: 2, bevelSize: 2.3, bevelThickness: 2.3, curveSegments: 12 });
      geo.translate(-336.5, -269.5, 0); geo.scale(width / 555, width / 555, width / 555); geo.rotateX(Math.PI / 2);
      mesh(geo, mat, group);
    }
    return group;
  }

  // Box walls leave a real 330 × 220 mm clear internal footprint.
  box(342, 6, 232, materials.box, model, [0, -3, 0], 2);
  box(6, 78, 232, materials.box, model, [-168, 39, 0], 1.5);
  box(6, 78, 232, materials.box, model, [168, 39, 0], 1.5);
  box(330, 78, 6, materials.box, model, [0, 39, -113], 1.3);
  box(330, 78, 6, materials.box, model, [0, 39, 113], 1.3);
  // A restrained cobalt reveal beneath the outer rim.
  box(330, 0.7, 0.7, materials.blue, model, [0, 73, 110.5], 0.15);
  box(330, 0.7, 0.7, materials.blue, model, [0, 73, -110.5], 0.15);
  for (const x of [-164.7, 164.7]) box(0.7, 0.7, 220, materials.blue, model, [x, 73, 0], 0.15);
  for(const x of [-169,169])for(const z of [-114,114]){
    box(4.2,16,4.2,materials.silver,model,[x,8,z],.6);
    box(12,3.2,3.2,materials.silver,model,[x-Math.sign(x)*4,1.6,z],.5);
  }
  const bodyWord = texture(1024, 160, (ctx, w, h) => { ctx.fillStyle = '#89919e'; ctx.font = '500 33px Arial'; ctx.textAlign = 'center'; ctx.fillText('S O P H I M O T I O N   /   2 0 2 7', w / 2, h / 2); });
  const frontLabel = mesh(new THREE.PlaneGeometry(154, 24), new THREE.MeshStandardMaterial({ map: bodyWord, transparent: true, roughness: 0.6 }), model, [0, 34, 116.15]);
  frontLabel.castShadow = false;

  const leftLid = new THREE.Group(), rightLid = new THREE.Group();
  model.add(leftLid, rightLid); leftLid.position.set(-171, 80, 0); rightLid.position.set(171, 80, 0);
  for (const [lid, sign] of [[leftLid, 1], [rightLid, -1]]) {
    box(170.6, 4, 232, materials.box, lid, [sign * 85.5, 0, 0], 1.15);
    box(163, 1.8, 221, materials.lining, lid, [sign * 85.5, -2.6, 0], 1.3);
    // Small brushed corner pieces, clear of the hinge.
    for (const z of [-114, 114]) {
      box(19, 0.8, 3.8, materials.silver, lid, [sign * 14, 2.25, z], 0.4);
      box(3.8, 0.8, 15, materials.silver, lid, [sign * 4.5, 2.25, z - Math.sign(z) * 6], 0.4);
    }
    for (const z of [-89, 89]) {
      const hinge = cylinder(2.2, 19, materials.hinge, model, [sign * -171, 78.8, z]); hinge.rotation.x = Math.PI / 2;
      box(6.5, 1.1, 14, materials.hinge, lid, [sign * 4, -2.6, z], 0.3);
    }
  }
  // The complete emblem belongs only to the left lid: it is never split.
  cylinder(36, 1.8, materials.edge, leftLid, [171, 3, 0], 80);
  logo(leftLid, 52, [171, 5.3, 0]);
  const lidType = texture(1200, 400, (ctx, w, h) => {
    ctx.textAlign = 'center'; ctx.fillStyle = '#66707f'; ctx.font = '400 37px Arial'; ctx.fillText('BUILD WHAT’S NEXT', w / 2, h / 2 - 20);
    ctx.fillStyle = '#234be6'; ctx.font = '500 24px Arial'; ctx.fillText('2 0 2 7', w / 2, h / 2 + 55);
  });
  const leftInside = decal(139, 46, lidType, leftLid, [85.5, -3.55, 0]); leftInside.rotation.x = Math.PI / 2; leftInside.rotation.z = Math.PI;
  const rightInside = decal(139, 46, lidType, rightLid, [-85.5, -3.55, 0]); rightInside.rotation.x = Math.PI / 2; rightInside.rotation.z = Math.PI;

  // Each contour includes a local thumb scoop. No fabric, strips or lifting tabs.
  function contour(x, z, w, d, r = 6, notch = null) {
    const p = new THREE.Path(), a = x, b = -z - d, c = x + w, e = -z;
    p.moveTo(a + r, b); p.lineTo(c - r, b); p.quadraticCurveTo(c, b, c, b + r);
    p.lineTo(c, e - r); p.quadraticCurveTo(c, e, c - r, e);
    if (notch?.side === 'back') { const n = a + w * notch.at, nr = notch.r; p.lineTo(n + nr, e); p.absarc(n, e, nr, 0, Math.PI, false); }
    p.lineTo(a + r, e); p.quadraticCurveTo(a, e, a, e - r); p.lineTo(a, b + r); p.quadraticCurveTo(a, b, a + r, b);
    if (notch?.side === 'front') {
      // Rebuild in the opposite traversal so the recess is part of the cavity.
      const q = new THREE.Path(), n = a + w * notch.at, nr = notch.r;
      q.moveTo(a + r, b); q.lineTo(n - nr, b); q.absarc(n, b, nr, Math.PI, Math.PI * 2, false); q.lineTo(c - r, b); q.quadraticCurveTo(c, b, c, b + r); q.lineTo(c, e - r); q.quadraticCurveTo(c, e, c - r, e); q.lineTo(a + r, e); q.quadraticCurveTo(a, e, a, e - r); q.lineTo(a, b + r); q.quadraticCurveTo(a, b, a + r, b); return q;
    }
    return p;
  }
  const trayShape = new THREE.Shape(); trayShape.moveTo(-165, -110); trayShape.lineTo(165, -110); trayShape.lineTo(165, 110); trayShape.lineTo(-165, 110); trayShape.closePath();
  const cavities = [
    { id: 'calendar', x: -151, z: -92, w: 180, d: 140, support: 48, r: 6, notch: { side: 'back', at: 0.35, r: 8 } },
    { id: 'car', x: 39, z: -84, w: 114, d: 116, support: 8, r: 7, notch: { side: 'back', at: 0.5, r: 8 } },
    { id: 'pen', x: -139, z: 68, w: 151, d: 24, support: 58, r: 10, notch: { side: 'front', at: 0.5, r: 8 } },
    { id: 'keychain', x: 39, z: 60, w: 114, d: 38, support: 58, r: 8, notch: { side: 'back', at: 0.6, r: 8 } },
  ];
  for (const c of cavities) { trayShape.holes.push(contour(c.x, c.z, c.w, c.d, c.r, c.notch)); box(c.w - 1, c.support, c.d - 1, materials.cavity, model, [c.x + c.w / 2, c.support / 2, c.z + c.d / 2], 1.3); }
  const trayGeo = new THREE.ExtrudeGeometry(trayShape, { depth: 64, bevelEnabled: false, curveSegments: 16 }); trayGeo.rotateX(-Math.PI / 2);
  mesh(trayGeo, materials.foam, model);
  const products = {};
  for (const c of cavities) { const g = new THREE.Group(); g.name = c.id; g.position.set(c.x + c.w / 2, c.support, c.z + c.d / 2); g.userData.home = g.position.clone(); model.add(g); products[c.id] = g; }

  // Calendar, folded flat: paper on the left, yellow notes on the right.
  const calendar = products.calendar;
  box(170, 5, 130, materials.blue, calendar, [0, 2.5, 0], 3.5);
  box(53, 2, 70, materials.blueDark, calendar, [0, 1, 7], 0.6); // folded support
  box(98, 5.8, 99, materials.paper, calendar, [-27, 8, -7], 4);
  for (let i = 0; i < 4; i++) box(98, 0.25, 97, materials.white, calendar, [-27, 5.4 + i * 0.7, -6.2], 1.4);
  box(48, 5, 58, materials.yellow, calendar, [56, 8, -9], 1.6);
  for (let i = 0; i < 4; i++) box(46, 0.2, 57, materials.yellow, calendar, [56, 5.6 + i * 0.7, -9], 0.1);
  const cover = texture(640, 640, (ctx, w, h) => {
    ctx.fillStyle = '#f8f7f2'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#073cd7';
    const path = new Path2D(S_PATH); ctx.save(); ctx.translate(160, 108); ctx.scale(0.48, 0.48); ctx.translate(-59, -89); ctx.fill(path); ctx.restore();
    ctx.textAlign = 'center'; ctx.font = '700 132px Arial'; ctx.fillText('2027', w / 2, 414); ctx.fillStyle = '#8490a9'; ctx.font = '16px Arial'; ctx.fillText('MAKE EVERY DAY COUNT', w / 2, 490);
  });
  decal(94, 95, cover, calendar, [-27, 11.01, -7]);
  for (const x of [-55, -1]) { const ring = mesh(new THREE.TorusGeometry(7.2, 1.1, 12, 36), materials.silver, calendar, [x, 13, -53]); ring.rotation.y = Math.PI / 2; }
  box(160, 6, 11, materials.blue, calendar, [0, 5, 55], 2);
  for (const x of [-45, 45]) box(8, 9, 11, materials.blue, calendar, [x, 10, 55], 1.4);
  logo(calendar, 11, [69, 8.5, 55], materials.white);

  // NFC stamp keychain: white printed body and cobalt articulated inlay.
  const keychain = products.keychain;
  box(88, 12, 28, materials.white, keychain, [10, 6, 0], 8);
  const keyTop = texture(1024, 340, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.strokeStyle = '#14217d'; ctx.lineWidth = 5; ctx.fillStyle = '#043be4';
    const poly = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    poly([[60,70],[215,68],[350,170],[300,220],[190,130],[60,130]]); poly([[386,190],[475,142],[610,172],[688,80],[780,80],[666,236],[482,206]]);
    ctx.fillStyle = '#073de0'; ctx.beginPath(); ctx.roundRect(790, 74, 161, 180, 72); ctx.fill();
    for(const [x,y,r] of [[355,165,47],[825,162,35],[914,162,35]]){ctx.fillStyle='#f8f8f5';ctx.strokeStyle='#263041';ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.stroke();ctx.strokeStyle='#003ce1';ctx.lineWidth=6;ctx.beginPath();ctx.arc(x,y,r*0.52,0,7);ctx.stroke();}
    ctx.fillStyle='#0631bb';ctx.font='bold 34px Arial';ctx.fillText('SOPHIFOLD',74,274);
  });
  decal(82, 25, keyTop, keychain, [10, 12.1, 0]);
  const ring = mesh(new THREE.TorusGeometry(10, 1.25, 12, 44), materials.silver, keychain, [-42, 7, 0]); ring.rotation.x = Math.PI / 2;
  const eye = cylinder(5.7, 4, materials.white, keychain, [-34, 7, 0]); cylinder(2.7, 4.1, materials.blueDark, keychain, [-34, 7.1, 0]);

  // Procedural exterior stays available if a browser cannot load the CAD asset.
  function makeCarExterior(parent) {
    const g = new THREE.Group(); parent.add(g);
    box(67, 21, 95, materials.blue, g, [0, 23, 0], 4);
    box(61, 5, 88, materials.blueDark, g, [0, 10, 0], 2);
    for (const x of [-42.5, 42.5]) for (const z of [-34.5, 34.5]) {
      const wheel = cylinder(16.5, 16, materials.blue, g, [x, 16.5, z], 40); wheel.rotation.z = Math.PI / 2;
      for (let i = 0; i < 15; i++) { const a = i / 15 * Math.PI * 2; const tread = box(17.4, 3.2, 5.5, materials.blue, g, [x, 16.5 + Math.cos(a) * 16.2, z + Math.sin(a) * 16.2], 0.6); tread.rotation.x = a; }
      const hub = cylinder(12.6, 1, materials.white, g, [x + Math.sign(x) * 8.2, 16.5, z]); hub.rotation.z = Math.PI / 2;
      const center = cylinder(4.8, 1.5, materials.blue, g, [x + Math.sign(x) * 8.9, 16.5, z]); center.rotation.z = Math.PI / 2;
      for(let s=0;s<6;s++){const a=s/6*Math.PI*2;const spoke=box(1.4,4.2,8,materials.white,g,[x+Math.sign(x)*9,16.5+Math.cos(a)*7.5,z+Math.sin(a)*7.5],0.5);spoke.rotation.x=-a;}
    }
    return g;
  }
  const car = products.car, carFallback = makeCarExterior(car);
  function addCarTop(parent) {
    // Two stacked brick courses replace the internal electronics mounting plate.
    // The stud peaks finish at Z=60.64, the measured complete-car envelope.
    const course = 12.59;
    box(61, 17.59, 81, materials.blue, parent, [0, 42.295, -1], 1.5);
    for(const x of [-30.55,30.55])box(.25,.35,76,materials.blueDark,parent,[x,42.3,-1],.05);
    for (const x of [-25, 25]) for (const z of [-32, 32]) {
      box(14, 7, 15, materials.white, parent, [x, 40 + course, z], 1);
      cylinder(4.6, 3, materials.white, parent, [x, 45 + course, z], 24);
    }
    box(34, 7, 65, materials.blue, parent, [0, 41.5 + course, -1], 1.2);
    for(const x of [-9,9])for(const z of [-25,-9,7,23])cylinder(4.6,3.1,materials.blue,parent,[x,46.5 + course,z],24);
    box(40, 3, 1.6, materials.lamp, parent, [0, 27, 48.2], 1.2);
    for(const x of [-27,27])for(const y of [17,31]){const screw=cylinder(1.8,0.5,materials.silver,parent,[x,y,48.5],14);screw.rotation.x=Math.PI/2;}
  }
  addCarTop(car);
  const pen = products.pen;
  const fallbackPen = new THREE.Group(); pen.add(fallbackPen);
  const penBody = mesh(new THREE.CapsuleGeometry(6.1, 115, 5, 12), materials.blue, fallbackPen, [0, 6.8, 0]); penBody.rotation.z = Math.PI / 2; penBody.scale.z = 1.2;
  const tip = mesh(new THREE.ConeGeometry(4.6, 15, 24), materials.white, fallbackPen, [-64.5, 6.8, 0]); tip.rotation.z = Math.PI / 2;
  const assetStatus = { pen: 'fallback', car: 'procedural exterior' };
  const loader = new GLTFLoader();
  async function loadCAD(name, parent, fallback) {
    try {
      const gltf = await loader.loadAsync(new URL(`./assets/${name}.glb`, import.meta.url).href);
      const root = gltf.scene; root.rotation.x = -Math.PI / 2;
      root.traverse(o => { if(o.isMesh){o.castShadow=true;o.receiveShadow=true; if(name==='pen')o.material=materials.blue; if(name==='car'){o.material=materials.blue;if(o.name==='car_STEP_solid_164')o.visible=false;}} });
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
      // Assets are exported in mm. Reject an accidental unit or full-workbench import.
      if (size.x > 1000 || size.x < 50) throw new Error('Unexpected CAD envelope');
      root.position.set(-(bounds.min.x+bounds.max.x)/2, -bounds.min.y, -(bounds.min.z+bounds.max.z)/2);
      parent.add(root); fallback.visible=false; assetStatus[name]='CAD';
      if(name==='car')for(const [z,y,xmag] of [[37.5,16.5,42],[-37.5,17.5,42.5]])for(const sign of [-1,1]){
        const x=sign*xmag;
        for(let i=0;i<15;i++){const a=i/15*Math.PI*2;const tread=box(16.1,2.4,5.4,materials.blue,parent,[x,y+Math.cos(a)*16.2,z+Math.sin(a)*16.2],.5);tread.rotation.x=a;}
        const hub=cylinder(12.5,.8,materials.white,parent,[x+sign*8.2,y,z],40);hub.rotation.z=Math.PI/2;
        const cap=cylinder(4.4,1.3,materials.blue,parent,[x+sign*8.9,y,z],30);cap.rotation.z=Math.PI/2;
        for(let s=0;s<6;s++){const a=s/6*Math.PI*2;const spoke=box(1,3.5,7,materials.white,parent,[x+sign*8.8,y+Math.cos(a)*7.5,z+Math.sin(a)*7.5],.4);spoke.rotation.x=-a;}
      }
      return root;
    } catch (error) { assetStatus[name] = `fallback: ${error.message}`; return null; }
  }
  const ready = Promise.all([loadCAD('pen', pen, fallbackPen), loadCAD('car', car, carFallback)]);

  // Soft gallery lighting and an original procedural contact shadow.
  scene.add(new THREE.HemisphereLight(0xdce5ff, 0x121722, .65));
  const key = new THREE.DirectionalLight(0xf6f4ed, 2.3); key.position.set(-250, 690, 390); key.castShadow=true;
  key.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024); key.shadow.camera.left=-500;key.shadow.camera.right=500;key.shadow.camera.top=420;key.shadow.camera.bottom=-420;key.shadow.camera.near=10;key.shadow.camera.far=1500;key.shadow.normalBias=0.55;key.shadow.bias=-0.00015;scene.add(key);
  const fill = new THREE.DirectionalLight(0xd5e0ff, .65); fill.position.set(350, 230, -420); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfafafa, 1.5); rim.position.set(-420, 300, -290); scene.add(rim);
  const shadowTex=texture(512,512,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,40,w/2,h/2,w/2);g.addColorStop(0,'rgba(0,0,0,.58)');g.addColorStop(.48,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);});
  const contact=mesh(new THREE.PlaneGeometry(750,530),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}),scene,[0,-6.1,0]);contact.rotation.x=-Math.PI/2;contact.castShadow=false;
  const shadow=mesh(new THREE.PlaneGeometry(2000,2000),new THREE.ShadowMaterial({opacity:.18}),scene,[0,-6,0]);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;

  let width=1,height=1,progress=0,explore=false,focused=null,disposed=false;
  const stages = {calendar:[.44,.50,.57],car:[.55,.62,.69],pen:[.67,.72,.78],keychain:[.75,.80,.86]};
  function update() {
    const left = ramp(progress,.12,.28), right = ramp(progress,.29,.43);
    leftLid.rotation.z = left * Math.PI; rightLid.rotation.z = -right * Math.PI;
    for (const [id,g] of Object.entries(products)) {
      const [a,b,c] = stages[id]; const lift=focused===id?1:focused?0:ramp(progress,a,b)*(1-ramp(progress,b,c));
      g.position.copy(g.userData.home);g.position.y+=lift*(id==='car'?98:75);g.rotation.set(0,0,0);
      if(id==='calendar')g.rotation.x=-lift*.18;
      if(id==='car')g.rotation.y=-lift*.18;
      if(id==='keychain')g.rotation.y=lift*.18;
      if(id==='pen')g.rotation.y=-lift*.12;
    }
    if(!explore){
      const opening=ramp(progress,.07,.32);const aspect=width/height;
      let span=THREE.MathUtils.lerp(550,830,opening);
      span=Math.max(span,THREE.MathUtils.lerp(315,405,opening)*aspect);
      const target=new THREE.Vector3(THREE.MathUtils.lerp(-22,0,opening),38,0);
      if(focused){target.copy(products[focused].position);target.y+=12;span=Math.max(focused==='calendar'?330:250,220*aspect);}
      camera.left=-span/2;camera.right=span/2;camera.top=span/aspect/2;camera.bottom=-span/aspect/2;
      camera.zoom=1;
      const dir=new THREE.Vector3(THREE.MathUtils.lerp(.62,.16,opening),THREE.MathUtils.lerp(.76,1.02,opening),1.14).normalize();
      camera.position.copy(target).addScaledVector(dir,1050);controls.target.copy(target);camera.lookAt(target);camera.updateProjectionMatrix();
    }
  }
  function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);renderer.setSize(width,height,false);const wasExplore=explore;explore=false;update();explore=wasExplore;}
  function setProgress(p){progress=clamp(Number(p)||0,0,1);focused=null;update();}
  function setExplore(enabled){const next=Boolean(enabled);explore=false;update();explore=next;controls.enabled=next;}
  function focusProduct(id){if(id && !products[id])return;focused=id||null;progress=1;explore=false;controls.enabled=false;update();explore=true;controls.enabled=true;}
  function render(){if(disposed)return;controls.update();renderer.render(scene,camera);}
  function diagnostics(){return {progress,explore,focused,lidAngles:{left:THREE.MathUtils.radToDeg(leftLid.rotation.z),right:-THREE.MathUtils.radToDeg(rightLid.rotation.z)},emblemParent:'left-lid-only',pullTabs:0,products:Object.keys(products),assets:{...assetStatus},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
  function dispose(){disposed=true;controls.dispose();environment.dispose();for(const t of textures)t.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});renderer.dispose();}
  resize(canvas.clientWidth||1200,canvas.clientHeight||800);
  await ready; update();render();onReady?.();
  return {setProgress,render,resize,setExplore,focusProduct,dispose,ready,diagnostics,scene,camera,renderer,products};
}
