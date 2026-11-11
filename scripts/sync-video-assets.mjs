import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(project, 'animation/assets/scene');
await mkdir(target, {recursive:true});
await cp(resolve(project,'dist/gift-scene.js'),resolve(target,'gift-scene.js'));
await cp(resolve(project,'dist/vendor'),resolve(target,'vendor'),{recursive:true});
await mkdir(resolve(target,'assets'),{recursive:true});
for(const file of await readdir(resolve(project,'dist/assets'))) {
  if (/\.(glb|gltf|bin|svg|png|jpg|jpeg|webp|json)$/i.test(file))
    await cp(resolve(project,'dist/assets',file),resolve(target,'assets',file));
}
console.log('Synced scene, vendor modules and model assets for video rendering.');
