from pathlib import Path
import argparse, sys, json, struct, time

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(
    description='Export the original pen and car STEP models to lightweight web GLB assets. '
                'The original STEP files are not included in this repository.'
)
parser.add_argument('--source-dir', type=Path, required=True,
                    help='Directory containing 笔v0.step and maker小车1105.step')
parser.add_argument('--output-dir', type=Path, default=ROOT/'dist'/'assets',
                    help='Output directory (default: repository dist/assets)')
parser.add_argument('--preview', action='store_true',
                    help='Also render native VTK preview PNGs (requires a working graphics context)')
parser.add_argument('--preview-dir', type=Path, default=ROOT/'scripts',
                    help='Preview directory (default: repository scripts)')
options = parser.parse_args()
BASE = options.source_dir.expanduser().resolve()
OUT = options.output_dir.expanduser().resolve()
SCRIPT = options.preview_dir.expanduser().resolve()
for source_name in ('笔v0.step', 'maker小车1105.step'):
    if not (BASE/source_name).is_file():
        parser.error(f'Missing source file: {BASE/source_name}')
try:
    import cadquery as cq
    import vtk
    import numpy as np
    from vtk.util.numpy_support import vtk_to_numpy
    from OCP.Bnd import Bnd_Box
    from OCP.BRepBndLib import BRepBndLib
except ImportError as exc:
    raise SystemExit('CAD export requires cadquery, vtk and numpy in your Python environment. '
                     'Install them with: python -m pip install cadquery vtk numpy') from exc

OUT.mkdir(parents=True, exist_ok=True)
if options.preview:
    SCRIPT.mkdir(parents=True, exist_ok=True)

def bounds(shape):
    b=Bnd_Box(); BRepBndLib.AddOptimal_s(shape.wrapped,b,False,False)
    return list(b.Get())

def mesh(s,offset,tol=.10):
    vertices, faces=s.tessellate(tol, .22)
    pts=vtk.vtkPoints(); cells=vtk.vtkCellArray()
    for v in vertices: pts.InsertNextPoint(v.x-offset[0],v.y-offset[1],v.z-offset[2])
    for f in faces:
        cells.InsertNextCell(3)
        for j in f: cells.InsertCellPoint(j)
    poly=vtk.vtkPolyData(); poly.SetPoints(pts); poly.SetPolys(cells)
    clean=vtk.vtkCleanPolyData(); clean.SetInputData(poly); clean.Update()
    reduced=vtk.vtkQuadricDecimation(); reduced.SetInputConnection(clean.GetOutputPort()); reduced.SetTargetReduction(.70); reduced.VolumePreservationOn(); reduced.Update()
    normal=vtk.vtkPolyDataNormals(); normal.SetInputConnection(reduced.GetOutputPort()); normal.SetFeatureAngle(35); normal.SplittingOn(); normal.ConsistencyOn(); normal.Update()
    result=normal.GetOutput()
    p=vtk_to_numpy(result.GetPoints().GetData()).astype('<f4')
    n=vtk_to_numpy(result.GetPointData().GetNormals()).astype('<f4')
    raw=vtk_to_numpy(result.GetPolys().GetData())
    f=raw.reshape(-1,4)[:,1:].astype('<u4')
    assert np.isfinite(p).all() and np.isfinite(n).all()
    assert f.max()<len(p)
    return p,n,f,result

MATS=[
    {'name':'Klein blue printed polymer','pbrMetallicRoughness':{'baseColorFactor':[.009,.055,.72,1],'metallicFactor':.06,'roughnessFactor':.35}},
    {'name':'Warm white polymer','pbrMetallicRoughness':{'baseColorFactor':[.91,.935,.97,1],'metallicFactor':.03,'roughnessFactor':.37}},
    {'name':'Silver detail','pbrMetallicRoughness':{'baseColorFactor':[.62,.68,.77,1],'metallicFactor':.7,'roughnessFactor':.28}},
    {'name':'Deep blue base','pbrMetallicRoughness':{'baseColorFactor':[.008,.025,.15,1],'metallicFactor':.12,'roughnessFactor':.5}},
]

def writeglb(name,parts):
    doc={'asset':{'version':'2.0','generator':'OpenCascade CadQuery measured STEP tessellation'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':MATS,'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[]}
    data=bytearray(); stats=[]
    def acc(a,typ,target,mins=False):
        while len(data)%4:data.append(0)
        vi=len(doc['bufferViews']); doc['bufferViews'].append({'buffer':0,'byteOffset':len(data),'byteLength':a.nbytes,'target':target})
        data.extend(a.tobytes())
        ai=len(doc['accessors']); item={'bufferView':vi,'componentType':5126 if a.dtype.kind=='f' else (5123 if a.dtype.itemsize==2 else 5125),'count':a.shape[0],'type':typ}
        if mins: item.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
        doc['accessors'].append(item);return ai
    for label,p,n,f,mi,poly in parts:
        flat=f.flatten().astype('<u2' if len(p)<65536 else '<u4')
        prim={'attributes':{'POSITION':acc(p,'VEC3',34962,True),'NORMAL':acc(n,'VEC3',34962)},'indices':acc(flat,'SCALAR',34963),'material':mi}
        ix=len(doc['meshes']);doc['meshes'].append({'name':label,'primitives':[prim]});doc['nodes'].append({'name':label,'mesh':ix});doc['scenes'][0]['nodes'].append(ix)
        stats.append({'name':label,'vertices':len(p),'triangles':len(f),'material':mi,'bounds':[p.min(axis=0).tolist(),p.max(axis=0).tolist()]})
    doc['buffers'][0]['byteLength']=len(data)
    js=json.dumps(doc,separators=(',',':'),ensure_ascii=True).encode()
    while len(js)%4:js+=b' '
    while len(data)%4:data.append(0)
    payload=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data
    path=OUT/(name+'.glb');path.write_bytes(payload)
    return {'file':path.name,'bytes':len(payload),'meshes':len(parts),'vertices':sum(s['vertices'] for s in stats),'triangles':sum(s['triangles'] for s in stats),'parts':stats}

def preview(name,parts):
    ren=vtk.vtkRenderer();ren.SetBackground(.055,.065,.095)
    for label,p,n,f,mi,poly in parts:
        mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
        act=vtk.vtkActor();act.SetMapper(mapper);act.GetProperty().SetColor(*MATS[mi]['pbrMetallicRoughness']['baseColorFactor'][:3]);act.GetProperty().SetInterpolationToPhong();act.GetProperty().SetAmbient(.3);act.GetProperty().SetSpecular(.25);act.GetProperty().SetSpecularPower(32);ren.AddActor(act)
    cam=ren.GetActiveCamera();cam.SetViewUp(0,0,1);cam.ParallelProjectionOn()
    if name=='car': cam.SetPosition(180,-200,165);cam.SetFocalPoint(0,0,20);cam.SetParallelScale(88)
    else: cam.SetPosition(0,-155,70);cam.SetFocalPoint(0,0,6);cam.SetParallelScale(53)
    win=vtk.vtkRenderWindow();win.AddRenderer(ren);win.SetSize(1400,950);win.SetOffScreenRendering(1);win.SetMultiSamples(8);win.Render()
    wi=vtk.vtkWindowToImageFilter();wi.SetInput(win);wi.Update();wr=vtk.vtkPNGWriter();wr.SetFileName(str(SCRIPT/(name+'-cad-export-preview.png')));wr.SetInputConnection(wi.GetOutputPort());wr.Write();win.Finalize()

report={'coordinateSystem':'STEP axes in mm: X right/width, Y depth, Z up. XY centered on full CAD bounding box, minZ=0. Rotate root -pi/2 about X for Y-up scenes.','assets':[]}
for name,file in [('pen','笔v0.step'),('car','maker小车1105.step')]:
    t=time.time();shape=cq.importers.importStep(str(BASE/file)).val(); bb=bounds(shape);offset=[(bb[0]+bb[3])/2,(bb[1]+bb[4])/2,bb[2]]
    parts=[];solids=shape.Solids();keep=range(len(solids)) if name=='pen' else range(164,172)
    for i in keep:
        p,n,f,poly=mesh(solids[i],offset,.09 if name=='pen' else .12)
        mi=0 if name=='pen' else (1 if i==164 else 3 if i in (166,170) else 0)
        if name=='pen' and i==0:mi=2
        parts.append((f'{name}_STEP_solid_{i}',p,n,f,mi,poly))
    data=writeglb(name,parts);data.update(source=file,sourceSolidCount=len(solids),exportedSolidIndices=list(keep),sourceBounds=bb,subtractOffsetMm=offset,fullDimensionsMm=[bb[i+3]-bb[i] for i in range(3)],elapsedSeconds=time.time()-t,tessellation='Chord tolerance 0.09mm pen / 0.12mm car, angular tolerance 0.22 rad; 70% volume-preserving quadric mesh reduction for web display.')
    allp=np.concatenate([part[1] for part in parts]);data['exportBoundsMm']=[allp.min(axis=0).tolist(),allp.max(axis=0).tolist()];data['exportDimensionsMm']=(allp.max(axis=0)-allp.min(axis=0)).tolist()
    if name=='car':data['note']='Mechanical external shell and wheel CAD only. PCB/electronics omitted; photo-style studded top and white front light must be supplied by scene. Full dimensions refer to original complete assembly. The mesh is a display approximation, not a manufacturing file.'
    if options.preview:
        preview(name,parts)
    report['assets'].append(data);print(json.dumps({k:v for k,v in data.items() if k!='parts'},ensure_ascii=False),flush=True)
    (OUT/'cad-metadata.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
