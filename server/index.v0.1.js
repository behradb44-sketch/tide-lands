import express from 'express';
import {createServer} from 'http';
import {WebSocketServer} from 'ws';
import crypto from 'crypto';
import path from 'path';
import {fileURLToPath} from 'url';
import {MAX_PLAYERS,BUILDINGS,OBJECTIVES,generateMap,initialPlayer,canAfford,spend,applyProduction,objectiveProgress} from '../shared/game.js';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();app.use(express.static(path.join(__dirname,'../client')));app.use('/node_modules',express.static(path.join(__dirname,'../node_modules')));app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));app.use((req,res)=>res.sendFile(path.join(__dirname,'../client/index.html')));
const server=createServer(app), wss=new WebSocketServer({server});
const rooms=new Map();
function id(n=6){return crypto.randomBytes(n).toString('base64url').slice(0,n)}
function cleanRoom(r){return {id:r.id,name:r.name,private:r.private,maxPlayers:r.maxPlayers,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,ready:p.ready,connected:p.connected})),started:r.started}}
function send(ws,msg){if(ws.readyState===1)ws.send(JSON.stringify(msg))}
function broadcast(r,msg){for(const p of r.players.values())send(p.ws,msg)}
function snapshot(r,forPlayer){return {type:'state',tick:r.tick,room:cleanRoom(r),match:r.started?{seed:r.match.map.seed,map:r.match.map,objective:r.match.objective,players:[...r.players.values()].map(p=>({...p,ws:undefined}))}:null}}
function start(r){if(r.started)return;if(r.players.size<2)return;r.started=true;r.match={map:generateMap(Math.floor(Math.random()*2**31)),objective:OBJECTIVES[Math.floor(Math.random()*OBJECTIVES.length)],lastProduction:Date.now()};let i=0;for(const p of r.players.values()){p.x= i?35:6;p.y= i?20:8; i++;const t=r.match.map.tiles.find(t=>t.x===p.x&&t.y===p.y);t.owner=p.id;t.city={level:1,name:i===1?'Oceanview':'Redfort'};p.cities=[{x:p.x,y:p.y,level:1,name:t.city.name}]}broadcast(r,{type:'match_started',state:snapshot(r,p=>p)});}
function leave(ws){if(!ws.roomId)return;const r=rooms.get(ws.roomId);if(!r)return;const p=r.players.get(ws.playerId);if(p)r.players.delete(ws.playerId);if(r.players.size===0){rooms.delete(r.id);return}broadcast(r,{type:'room_update',room:cleanRoom(r)});ws.roomId=null}
function validName(n){return typeof n==='string'&&n.trim().length>=1&&n.trim().length<=18}
const buckets=new Map();function rate(ws,key,limit,ms){const k=ws.playerId+':'+key,now=Date.now();let a=buckets.get(k)||[];a=a.filter(t=>now-t<ms);if(a.length>=limit)return false;a.push(now);buckets.set(k,a);return true}
wss.on('connection',ws=>{ws.id=id(10);ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);send(ws,{type:'hello',serverTime:Date.now()});ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return send(ws,{type:'error',code:'BAD_JSON'})}if(!rate(ws,'msg',40,1000))return send(ws,{type:'error',code:'RATE_LIMIT'});
 if(m.type==='create_room'){if(!validName(m.name))return send(ws,{type:'error',code:'BAD_NAME'});const max=MAX_PLAYERS.includes(m.maxPlayers)?m.maxPlayers:2,r={id:id(6).toUpperCase(),name:m.name.trim(),private:!!m.private,maxPlayers:max,players:new Map(),started:false,tick:0};rooms.set(r.id,r);const p=initialPlayer(id(8),m.playerName?.trim()||'Player','Blue',0,0);p.ws=ws;r.players.set(p.id,p);ws.roomId=r.id;ws.playerId=p.id;send(ws,{type:'room_created',room:cleanRoom(r)});return}
 if(m.type==='list_rooms'){return send(ws,{type:'rooms',rooms:[...rooms.values()].filter(r=>!r.private&&!r.started).map(cleanRoom)});}
 if(m.type==='join_room'){const r=rooms.get(String(m.roomId||'').toUpperCase());if(!r)return send(ws,{type:'error',code:'ROOM_NOT_FOUND'});if(r.started)return send(ws,{type:'error',code:'MATCH_STARTED'});if(r.players.size>=r.maxPlayers)return send(ws,{type:'error',code:'ROOM_FULL'});if(!validName(m.playerName))return send(ws,{type:'error',code:'BAD_NAME'});const colors=['Red','Green','Purple','Yellow','Pink'];const p=initialPlayer(id(8),m.playerName.trim(),colors[r.players.size-1]||'Blue',0,0);p.ws=ws;r.players.set(p.id,p);ws.roomId=r.id;ws.playerId=p.id;broadcast(r,{type:'room_update',room:cleanRoom(r)});return send(ws,{type:'joined',room:cleanRoom(r)});}
 const r=rooms.get(ws.roomId);if(!r)return send(ws,{type:'error',code:'NOT_IN_ROOM'});const p=r.players.get(ws.playerId);if(!p)return;
 if(m.type==='ready'){p.ready=!!m.ready;broadcast(r,{type:'room_update',room:cleanRoom(r)});if(r.players.size>=2&&[...r.players.values()].every(x=>x.ready))start(r);}
 else if(m.type==='start'){if(r.players.size>=2)start(r)}
 else if(m.type==='leave'){leave(ws)}
 else if(m.type==='ping'){send(ws,{type:'pong',t:m.t})}
 else if(m.type==='build'){if(!r.started)return;const type=m.building;if(!BUILDINGS[type])return send(ws,{type:'error',code:'BAD_BUILDING'});const tile=r.match.map.tiles.find(t=>t.x===m.x&&t.y===m.y);if(!tile||tile.owner!==p.id||!canAfford(p,BUILDINGS[type].cost)||tile.terrain==='water')return send(ws,{type:'error',code:'BUILD_REJECTED'});spend(p,BUILDINGS[type].cost);p.buildings.push({id:id(5),type,x:m.x,y:m.y});broadcast(r,{type:'state_delta',tick:r.tick,playerId:p.id,action:{type:'building_added',building:p.buildings.at(-1)},resources:p.resources});}
 else if(m.type==='claim'){if(!r.started)return;const tile=r.match.map.tiles.find(t=>t.x===m.x&&t.y===m.y);if(!tile||tile.terrain==='water'||tile.owner)return;const near=r.match.map.tiles.some(t=>t.owner===p.id&&Math.abs(t.x-m.x)+Math.abs(t.y-m.y)<=1);if(!near)return send(ws,{type:'error',code:'CLAIM_TOO_FAR'});if(p.resources.credits<300)return send(ws,{type:'error',code:'NO_CREDITS'});p.resources.credits-=300;tile.owner=p.id;p.score+=10;broadcast(r,{type:'state_delta',tick:r.tick,playerId:p.id,action:{type:'tile_claimed',x:m.x,y:m.y},resources:p.resources});}
 else if(m.type==='chat'){if(typeof m.text!=='string'||m.text.trim().length>240)return;if(!rate(ws,'chat',5,5000))return send(ws,{type:'error',code:'CHAT_RATE'});broadcast(r,{type:'chat',from:p.name,text:m.text.trim().replace(/[<>]/g,'')});}
 else if(m.type==='resync'){send(ws,snapshot(r,p));}
 });ws.on('close',()=>{const r=rooms.get(ws.roomId);if(!r)return;const p=r.players.get(ws.playerId);if(p){p.connected=false;p.ws=ws}broadcast(r,{type:'room_update',room:cleanRoom(r)});setTimeout(()=>{const rr=rooms.get(ws.roomId);if(rr){const pp=rr.players.get(ws.playerId);if(pp&&!pp.connected)rr.players.delete(ws.playerId);if(rr.players.size===0)rooms.delete(rr.id);}},15000)})});
setInterval(()=>{for(const r of rooms.values()){r.tick++;if(r.started&&Date.now()-r.match.lastProduction>5000){r.match.lastProduction=Date.now();for(const p of r.players.values())applyProduction(p)}if(r.started&&r.tick%5===0)broadcast(r,{type:'tick',tick:r.tick,players:[...r.players.values()].map(p=>({id:p.id,x:p.x,y:p.y,resources:p.resources,objectiveProgress:objectiveProgress(r,p),score:p.score,connected:p.connected}))})}},1000);
const port=process.env.PORT||3000;server.listen(port,()=>console.log(`TIDELANDS listening on ${port}`));
