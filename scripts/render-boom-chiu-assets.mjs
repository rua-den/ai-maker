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
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,premultipliedAlpha:false});
renderer.setPixelRatio(1);renderer.setSize(720,720,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
const loader=new GLTFLoader();
const cache=new Map();
async function load(url){if(cache.has(url))return cache.get(url).clone(true);const gltf=await loader.loadAsync(url);cache.set(url,gltf.scene);return gltf.scene.clone(true)}
function boxInfo(root){root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);return{box,size,center}}
function normalize(root){const {size,center}=boxInfo(root);root.position.sub(center);const max=Math.max(size.x,size.y,size.z)||1;root.scale.multiplyScalar(2.4/max);root.updateMatrixWorld(true)}
function setTeamMaterial(root){root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.metalness=Math.min(.35,m.metalness??0);m.roughness=Math.max(.55,m.roughness??.8);}}})}
function sceneBase(){const scene=new THREE.Scene();scene.background=null;scene.add(new THREE.HemisphereLight(0xffffff,0x24303b,3.2));const key=new THREE.DirectionalLight(0xffffff,4.4);key.position.set(4,7,6);scene.add(key);const rim=new THREE.DirectionalLight(0x8ec9ff,2.2);rim.position.set(-5,3,-4);scene.add(rim);return scene}
function camera(){const c=new THREE.PerspectiveCamera(32,1,.05,100);c.position.set(0,.15,5.2);c.lookAt(0,0,0);return c}
window.renderAsset=async function(kind,url,index=0){renderer.setClearColor(0x000000,0);renderer.clear(true,true,true);const scene=sceneBase(),cam=camera(),root=await load(url);setTeamMaterial(root);normalize(root);if(kind==='soldier'){
  root.rotation.y=index*Math.PI/4;root.rotation.x=-.04;root.position.y=-.12;root.scale.multiplyScalar(1.15);
}else{
  // Styloo AK47: make the long body recede toward the crosshair instead of lying flat across the screen.
  root.rotation.set(-.26,-1.03,.18);root.position.set(.48,-.52,.12);root.scale.multiplyScalar(1.42);cam.position.set(0,.1,5.35);cam.lookAt(.05,-.05,0);
}
scene.add(root);renderer.render(scene,cam);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true}
window.rendererReady=true;
</script></body></html>`,{waitUntil:'load'});
await page.waitForFunction(()=>window.rendererReady===true,{timeout:20000});

async function shot(kind,url,file,index=0){
  await page.evaluate(async({kind,url,index})=>window.renderAsset(kind,url,index),{kind,url,index});
  await page.screenshot({path:file,omitBackground:true,clip:{x:0,y:0,width:720,height:720}});
}

await shot('weapon',WEAPON_URL,path.join(OUT,'styloo','ak47-fps.png'));
for(let i=0;i<8;i++)await shot('soldier',SOLDIER_URL,path.join(OUT,'quaternius',`soldier-${i}.png`),i);
await browser.close();
console.log('Rendered Bùm Chíu asset sprites from CC0 source models.');
