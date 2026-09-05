import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'assets','boom-chiu');
const WEAPON_URL='https://raw.githubusercontent.com/hackinghackers/water-gun-simulator/main/addons/styloo-guns/ak47.glb';
const SOLDIER_URL='https://raw.githubusercontent.com/aar0npal/shooter-blitz/main/public/models/Character_Soldier.gltf';

await fs.mkdir(path.join(OUT,'styloo'),{recursive:true});
await fs.mkdir(path.join(OUT,'quaternius'),{recursive:true});

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:720}});
await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}canvas{display:block;width:720px;height:720px}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script></head><body><canvas id="c"></canvas>
<script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const canvas=document.querySelector('#c');
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(720,720,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
const loader=new GLTFLoader(),cache=new Map();
async function load(url){if(cache.has(url))return cache.get(url).clone(true);const gltf=await loader.loadAsync(url);cache.set(url,gltf.scene);return gltf.scene.clone(true)}
function boxInfo(root){root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);return{box,size,center}}
function normalize(root){const {size,center}=boxInfo(root);root.position.sub(center);const max=Math.max(size.x,size.y,size.z)||1;root.scale.multiplyScalar(2.4/max);root.updateMatrixWorld(true)}
function setMaterial(root){root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.metalness=Math.min(.35,m.metalness??0);m.roughness=Math.max(.55,m.roughness??.8)}}})}
function sceneBase(){const scene=new THREE.Scene();scene.background=null;scene.add(new THREE.HemisphereLight(0xffffff,0x24303b,3.2));const key=new THREE.DirectionalLight(0xffffff,4.4);key.position.set(4,7,6);scene.add(key);const rim=new THREE.DirectionalLight(0x8ec9ff,2.2);rim.position.set(-5,3,-4);scene.add(rim);return scene}
function camera(){const c=new THREE.PerspectiveCamera(31,1,.05,100);c.position.set(0,.12,5.1);c.lookAt(0,0,0);return c}
function orientWeapon(root){const {size}=boxInfo(root);let from=new THREE.Vector3(1,0,0);if(size.y>size.x&&size.y>size.z)from.set(0,1,0);else if(size.z>size.x&&size.z>size.y)from.set(0,0,1);const target=new THREE.Vector3(-.54,.18,-.82).normalize();root.quaternion.setFromUnitVectors(from,target);root.rotateOnWorldAxis(new THREE.Vector3(0,0,1),-.08)}
window.renderAsset=async function(kind,url,index=0){renderer.setClearColor(0x000000,0);renderer.clear(true,true,true);const scene=sceneBase(),cam=camera(),root=await load(url);setMaterial(root);normalize(root);if(kind==='soldier'){root.rotation.y=index*Math.PI/4;root.rotation.x=-.035;root.position.y=-.08;root.scale.multiplyScalar(1.18)}else{orientWeapon(root);root.position.set(.12,-.16,.18);root.scale.multiplyScalar(1.68);cam.position.set(.28,.24,4.75);cam.lookAt(-.02,-.04,0)}scene.add(root);renderer.render(scene,cam);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true}
window.captureCrop=function(pad=8){const src=document.createElement('canvas');src.width=720;src.height=720;const s=src.getContext('2d',{willReadFrequently:true});s.drawImage(canvas,0,0);const data=s.getImageData(0,0,720,720).data;let minX=720,minY=720,maxX=-1,maxY=-1;for(let y=0;y<720;y++)for(let x=0;x<720;x++){if(data[(y*720+x)*4+3]>5){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}}if(maxX<0)throw new Error('Rendered asset is empty');minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(719,maxX+pad);maxY=Math.min(719,maxY+pad);const w=maxX-minX+1,h=maxY-minY+1,out=document.createElement('canvas');out.width=w;out.height=h;out.getContext('2d').drawImage(src,minX,minY,w,h,0,0,w,h);return out.toDataURL('image/png')}
window.rendererReady=true;
</script></body></html>`,{waitUntil:'load'});
await page.waitForFunction(()=>window.rendererReady===true,{timeout:20000});

async function shot(kind,url,file,index=0){await page.evaluate(async({kind,url,index})=>window.renderAsset(kind,url,index),{kind,url,index});const dataUrl=await page.evaluate(pad=>window.captureCrop(pad),kind==='soldier'?6:10);await fs.writeFile(file,Buffer.from(dataUrl.split(',')[1],'base64'))}

await shot('weapon',WEAPON_URL,path.join(OUT,'styloo','ak47-fps.png'));
for(let i=0;i<8;i++)await shot('soldier',SOLDIER_URL,path.join(OUT,'quaternius',`soldier-${i}.png`),i);
await browser.close();
console.log('Rendered cropped Bùm Chíu sprites with first-person rifle perspective.');
