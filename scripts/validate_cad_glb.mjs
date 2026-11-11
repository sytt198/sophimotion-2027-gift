import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Dependency-free validation of these embedded, non-sparse CAD GLB meshes.
// This checks data integrity; browser rendering is verified separately.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sizes = {5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4};
const readers = {5120:'readInt8', 5121:'readUInt8', 5122:'readInt16LE', 5123:'readUInt16LE', 5125:'readUInt32LE', 5126:'readFloatLE'};
const widths = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4};
function check(test, message) { if (!test) throw new Error(message); }
function item(array, index, label) {
  check(Array.isArray(array) && Number.isInteger(index) && index >= 0 && index < array.length, `Invalid ${label} index`);
  return array[index];
}

function parseGLB(bytes) {
  check(bytes.length >= 28 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2, 'Invalid GLB v2 header');
  check(bytes.readUInt32LE(8) === bytes.length, 'GLB file length mismatch');
  const chunks = [];
  for (let offset = 12; offset < bytes.length;) {
    check(offset + 8 <= bytes.length, 'Truncated GLB chunk header');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    check(length % 4 === 0 && offset + 8 + length <= bytes.length, 'Invalid GLB chunk length/alignment');
    chunks.push({type, bytes:bytes.subarray(offset + 8, offset + 8 + length)});
    offset += 8 + length;
  }
  check(chunks.length === 2 && chunks[0].type === 0x4e4f534a && chunks[1].type === 0x004e4942, 'Expected JSON and embedded BIN chunks');
  const doc = JSON.parse(chunks[0].bytes.toString('utf8')), binary = chunks[1].bytes;
  check(doc.asset?.version === '2.0', 'Expected glTF 2.0');
  check(doc.buffers?.length === 1 && !doc.buffers[0].uri, 'Expected one embedded buffer');
  const length = doc.buffers[0].byteLength;
  check(Number.isInteger(length) && length >= 0 && binary.length >= length && binary.length - length <= 3, 'Embedded buffer length mismatch');
  return {doc, binary, length};
}

function accessorData(glb, index) {
  const {doc, binary, length} = glb;
  const a = item(doc.accessors, index, 'accessor'), view = item(doc.bufferViews, a.bufferView, 'bufferView');
  check(!a.sparse && view.buffer === 0, 'Expected non-sparse embedded accessor');
  const componentSize = sizes[a.componentType], components = widths[a.type];
  check(componentSize && components, 'Unsupported accessor component/type');
  check(Number.isInteger(a.count) && a.count > 0, 'Invalid accessor count');
  const viewOffset = view.byteOffset ?? 0, offset = a.byteOffset ?? 0;
  const elementSize = componentSize * components, stride = view.byteStride ?? elementSize;
  check(Number.isInteger(viewOffset) && viewOffset >= 0 && Number.isInteger(view.byteLength) && view.byteLength >= 0 && viewOffset + view.byteLength <= length, 'BufferView exceeds embedded buffer');
  check(Number.isInteger(offset) && offset >= 0 && offset % componentSize === 0 && (viewOffset + offset) % componentSize === 0, 'Invalid accessor alignment');
  check(Number.isInteger(stride) && stride >= elementSize && stride % componentSize === 0, 'Invalid accessor stride');
  check(offset + (a.count - 1) * stride + elementSize <= view.byteLength, 'Accessor exceeds BufferView');
  const values = [];
  for (let i = 0; i < a.count; i++) for (let component = 0; component < components; component++) {
    const value = binary[readers[a.componentType]](viewOffset + offset + i * stride + component * componentSize);
    check(Number.isFinite(value), 'Non-finite accessor value'); values.push(value);
  }
  return {accessor:a, values};
}

for (const name of ['pen', 'car']) {
  const bytes = await fs.readFile(path.join(root, 'dist', 'assets', `${name}.glb`));
  const glb = parseGLB(bytes), {doc} = glb;
  check(Array.isArray(doc.meshes) && doc.meshes.length > 0, 'No meshes');
  const accessors = doc.accessors.map((_, index) => accessorData(glb, index));
  const get = index => item(accessors, index, 'accessor');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let vertices = 0, triangles = 0;
  for (const mesh of doc.meshes) {
    check(Array.isArray(mesh.primitives) && mesh.primitives.length > 0, 'Mesh has no primitives');
    for (const primitive of mesh.primitives) {
      check((primitive.mode ?? 4) === 4, 'Expected triangle primitives');
      const position = get(primitive.attributes?.POSITION), normal = get(primitive.attributes?.NORMAL), indices = get(primitive.indices);
      check(position.accessor.type === 'VEC3' && position.accessor.componentType === 5126, 'Expected FLOAT VEC3 positions');
      check(normal.accessor.type === 'VEC3' && normal.accessor.componentType === 5126 && normal.accessor.count === position.accessor.count, 'Invalid normals or normal count');
      check(indices.accessor.type === 'SCALAR' && [5121,5123,5125].includes(indices.accessor.componentType) && indices.accessor.count % 3 === 0, 'Invalid triangle indices');
      for (const value of indices.values) check(value < position.accessor.count, 'Index exceeds vertex count');
      if (primitive.material !== undefined) item(doc.materials, primitive.material, 'material');
      vertices += position.accessor.count; triangles += indices.accessor.count / 3;
      for (let i = 0; i < position.values.length; i++) {
        const axis = i % 3, value = position.values[i]; min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
    }
  }
  const scene = item(doc.scenes, doc.scene ?? 0, 'scene');
  check(Array.isArray(scene.nodes) && scene.nodes.length > 0, 'Scene has no nodes');
  for (const nodeIndex of scene.nodes) item(doc.nodes, nodeIndex, 'scene node');
  for (const node of doc.nodes) {
    if (node.mesh !== undefined) item(doc.meshes, node.mesh, 'node mesh');
    for (const child of node.children ?? []) item(doc.nodes, child, 'child node');
  }
  console.log(JSON.stringify({name, pass:true, bytes:bytes.length, meshes:doc.meshes.length, vertices, triangles, bounds:{min,max}, dimensions:max.map((v,i)=>v-min[i])}));
}
