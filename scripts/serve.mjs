import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.glb':'model/gltf-binary','.mp4':'video/mp4','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
  try{
    const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let path=resolve(root,'.'+requested);
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    if((await stat(path)).isDirectory())path=resolve(path,'index.html');
    const bytes=await readFile(path),range=req.headers.range;
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');
    res.setHeader('Accept-Ranges','bytes');
    res.setHeader('Cache-Control','no-cache');
    if(range){const m=/bytes=(\d+)-(\d*)/.exec(range);if(m){const a=Number(m[1]),b=m[2]?Math.min(Number(m[2]),bytes.length-1):bytes.length-1;if(a>b||a>=bytes.length){res.writeHead(416).end();return;}res.writeHead(206,{'Content-Range':`bytes ${a}-${b}/${bytes.length}`,'Content-Length':b-a+1});res.end(bytes.subarray(a,b+1));return;}}
    res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('文件未找到');}
}).listen(5197,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5197'));
