import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {join,extname} from 'node:path';
import crypto from 'node:crypto';

const PORT=process.env.PORT||10000;
const ROOT=join(process.cwd(),'public');
const MAX_ROOMS=100, RECONNECT_MS=30000;
const BUILDINGS={
 city:{name:'City Center',cost:{credits:2000,materials:700},prod:{credits:120,materials:40,power:-10}},
 farm:{name:'Farm',cost:{credits:500,materials:180},prod:{food:100}},
 mine:{name:'Mine',cost:{credits:800,materials:260},prod:{materials:100}},
 factory:{name:'Factory',cost:{credits:1200,materials:500,power:20},prod:{materials:140}},
 power:{name:'Power Plant',cost:{credits:1000,materials:350},prod:{power:90}},
 port:{name:'Port',cost:{credits:1500,materials:500,power:10},prod:{credits:90}},
 airport:{name:'Airport',cost:{credits:2000,materials:650,power:20},prod:{credits:80}},
 radar:{name:'Radar',cost:{credits:1500,materials:400,power:10},prod:{intel:60}},
 airdef:{name:'Air Defense',cost:{credits:1800,materials:500,power:20},prod:{defense:10}},
 silo:{name:'Missile Silo',cost:{credits:2400,materials:800,power:15},prod:{missiles:1}}
};
const COLORS=['#43c7ff','#ff5964','#ffd166','#62e26f','#a78bfa','#ff8c42','#45e0d0','#f472b6'];
const rooms=new Map();
const clients=new Set();
function wsAccept(key){return crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')}
function makeSocket(socket){
 const c={socket,readyState:1,isAlive:true,buffer:Buffer.alloc(0),roomId:null,playerId:null,send(data){const payload=Buffer.from(data);let head;if(payload.length<126)head=Buffer.from([0x81,payload.length]);else if(payload.length<65536){head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(payload.length,2)}else{head=Buffer.alloc(10);head[0]=0x81;head[1]=127;head.writeBigUInt64BE(BigInt(payload.length),2)}socket.write(Buffer.concat([head,payload]))},ping(){socket.write(Buffer.from([0x89,0]))},close(){c.readyState=3;socket.destroy()}};
 function parse(){while(c.buffer.length>=2){const b0=c.buffer[0],b1=c.buffer[1];const fin=!!(b0&128),op=b0&15,masked=!!(b1&128);let len=b1&127,off=2;if(len===126){if(c.buffer.length<4)return;len=c.buffer.readUInt16BE(2);off=4}else if(len===127){if(c.buffer.length<10)return;const n=c.buffer.readBigUInt64BE(2);if(n>1000000n)return c.close();len=Number(n);off=10}if(!masked)return c.close();if(c.buffer.length<off+4+len)return;const mask=c.buffer.subarray(off,off+4);off+=4;const data=Buffer.from(c.buffer.subarray(off,off+len));for(let i=0;i<data.length;i++)data[i]^=mask[i%4];c.buffer=c.buffer.subarray(off+len);if(op===8){c.close();return}if(op===9){c.socket.write(Buffer.from([0x8A,0]));continue}if(op===10){c.isAlive=true;continue}if(op===1&&fin){try{handle(c,JSON.parse(data.toString()))}catch{send(c,{type:'error',code:'BAD_MESSAGE'})}}}}
 socket.on('data',d=>{c.buffer=Buffer.concat([c.buffer,d]);parse()});socket.on('close',()=>{c.readyState=3;clients.delete(c);const r=rooms.get(c.roomId),p=r?.players.get(c.playerId);if(p&&p.ws===c){p.connected=false;p.ws=null;broadcast(r,{type:'room_update',room:publicRoom(r)});setTimeout(()=>{const rr=rooms.get(c.roomId),pp=rr?.players.get(c.playerId);if(pp&&!pp.connected)rr.players.delete(pp.id)},RECONNECT_MS)}});socket.on('error',()=>{c.readyState=3;clients.delete(c)});clients.add(c);return c;
}
const uid=(n=8)=>Math.random().toString(36).slice(2,2+n).toUpperCase();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function player(name,team,index){return {id:uid(),token:uid(20),name:name||'Commander',team,color:COLORS[index%COLORS.length],connected:true,ready:false,x:0,y:0,hp:100,resources:{credits:12450,materials:8720,food:6310,power:4280,intel:8960,missiles:4},score:0,buildings:[],cities:[],units:[],allies:[],betrayals:0};}
function map(){
 const W=44,H=28,tiles=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const nx=x/W,ny=y/H; let terrain='land';
  if(x<5&&y>18)terrain='volcano'; else if((x<7&&y<10)||(x>37&&y>17))terrain='mountain';
  else if((x>8&&x<17&&y>3&&y<13)||(x>28&&x<38&&y<5&&y<14))terrain='forest';
  else if((x>19&&x<25&&y>0&&y<28)||(x>0&&x<44&&((y===14&&x>3)||(y===15&&x<12))))terrain='water';
  else if((x>23&&x<31&&y>1&&y<8)||(x>31&&x<37&&y>20))terrain='island';
  tiles.push({x,y,terrain,owner:null,city:null,building:null});
 }
 return {w:W,h:H,tiles,seed:Date.now()>>>0};
}
function newRoom({id,name,capacity,privateRoom,permanent=false}){return {id,name,capacity:clamp(Number(capacity)||4,2,8),private:!!privateRoom,permanent,ownerId:null,players:new Map(),started:false,turn:1,objective:'Expand your territory and control the central sea lanes.',map:map(),chat:[],created:Date.now(),timer:0,waitStarted:Date.now(),extensionStarted:false};}
for(let i=1;i<=10;i++)rooms.set('SEA'+String(i).padStart(2,'0'),newRoom({id:'SEA'+String(i).padStart(2,'0'),name:['Oceanview','Redfort','Goldridge','Windfall','Ashen Peak','Northstar','Bluehaven','Ironclad','Green Horizon','Stormwatch'][i-1],capacity:4,privateRoom:false,permanent:true}));
function publicRoom(r){const now=Date.now(),base=300000,extra=180000;let remaining=Math.max(0,(r.extensionStarted?r.waitStarted+base+extra:r.waitStarted+base)-now);return {id:r.id,name:r.name,capacity:r.capacity,count:[...r.players.values()].filter(p=>p.connected).length,private:r.private,permanent:r.permanent,started:r.started,turn:r.turn,waitRemaining:remaining,extension:r.extensionStarted};}
function state(r,forId){return {type:'state',room:publicRoom(r),started:r.started,turn:r.turn,objective:r.objective,map:r.map,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,color:p.color,x:p.x,y:p.y,hp:p.hp,score:p.score,resources:p.resources,buildings:p.buildings,cities:p.cities,units:p.units,allies:p.allies,connected:p.connected})),you:forId};}
function send(ws,msg){if(ws&&ws.readyState===1)ws.send(JSON.stringify(msg));}
function broadcast(r,msg){for(const p of r.players.values())send(p.ws,msg);}
function roomsList(){return [...rooms.values()].filter(r=>!r.private).map(publicRoom);}
function spawnFor(r,p){const idx=[...r.players.values()].indexOf(p);p.x=idx%2?35:6;p.y=idx%2?20:8;const t=r.map.tiles.find(t=>t.x===p.x&&t.y===p.y);if(t){t.owner=p.id;t.city={level:1,name:p.name+' City'};p.cities=[{x:p.x,y:p.y,level:1,name:t.city.name}];}}
function start(r){if(r.started||r.players.size<2)return false;r.started=true;let i=0;for(const p of r.players.values()){spawnFor(r,p);i++;}broadcast(r,{type:'match_started',...state(r,null)});return true;}
function prod(p){for(const b of p.buildings){const pr=BUILDINGS[b.type]?.prod||{};for(const [k,v] of Object.entries(pr))p.resources[k]=(p.resources[k]||0)+v;}p.resources.power=Math.max(0,p.resources.power);}
function canAfford(p,c){return Object.entries(c).every(([k,v])=>(p.resources[k]||0)>=v)}
function spend(p,c){for(const[k,v]of Object.entries(c))p.resources[k]-=v;}
function adjacent(r,p,x,y){const t=r.map.tiles.find(t=>t.x===x&&t.y===y);if(!t)return false;return r.map.tiles.some(q=>q.owner===p.id&&Math.abs(q.x-x)+Math.abs(q.y-y)===1)}
function handle(ws,m){
 if(m.type==='list_rooms')return send(ws,{type:'room_list',rooms:roomsList()});
 if(m.type==='create_room'){const id=uid(6);const r=newRoom({id,name:(m.name||'New Front').slice(0,24),capacity:m.capacity,privateRoom:m.privateRoom});const p=player(m.playerName,'Blue',0);r.players.set(p.id,p);r.ownerId=p.id;p.ws=ws;ws.roomId=id;ws.playerId=p.id;rooms.set(id,r);return send(ws,{type:'room_created',room:publicRoom(r),playerId:p.id,token:p.token});}
 if(m.type==='join_room'){const r=rooms.get(String(m.roomId||'').toUpperCase());if(!r)return send(ws,{type:'error',code:'ROOM_NOT_FOUND'});if(r.started)return send(ws,{type:'error',code:'MATCH_ALREADY_STARTED'});if(r.players.size>=r.capacity)return send(ws,{type:'error',code:'ROOM_FULL'});const p=player(m.playerName,'Blue',r.players.size);r.players.set(p.id,p);p.ws=ws;ws.roomId=r.id;ws.playerId=p.id;broadcast(r,{type:'room_update',room:publicRoom(r)});return send(ws,{type:'joined',room:publicRoom(r),playerId:p.id,token:p.token});}
 if(m.type==='reconnect'){const r=rooms.get(String(m.roomId||''));const p=r?.players.get(m.playerId);if(!r||!p||p.token!==m.token)return send(ws,{type:'error',code:'RECONNECT_FAILED'});p.ws=ws;p.connected=true;ws.roomId=r.id;ws.playerId=p.id;send(ws,state(r,p.id));broadcast(r,{type:'room_update',room:publicRoom(r)});return;}
 const r=rooms.get(ws.roomId),p=r?.players.get(ws.playerId);if(!r||!p)return send(ws,{type:'error',code:'NOT_IN_ROOM'});
 if(m.type==='start_match'){if(r.ownerId!==p.id)return send(ws,{type:'error',code:'OWNER_ONLY'});if(!start(r))return send(ws,{type:'error',code:'NEED_TWO_PLAYERS'});return;}
 if(m.type==='chat'){const text=String(m.text||'').trim().slice(0,300);if(text){r.chat.push({from:p.name,text,team:m.channel==='team'?p.team:'Global',at:Date.now()});r.chat=r.chat.slice(-80);broadcast(r,{type:'chat',message:r.chat.at(-1)});}return;}
 if(!r.started)return;
 if(m.type==='move'){const dx=clamp(Number(m.dx)||0,-1,1),dy=clamp(Number(m.dy)||0,-1,1);p.x=clamp(p.x+dx,0,r.map.w-1);p.y=clamp(p.y+dy,0,r.map.h-1);return broadcast(r,{type:'player_moved',player:{id:p.id,x:p.x,y:p.y}});}
 if(m.type==='build'){const type=m.building;if(!BUILDINGS[type])return;const x=Number(m.x),y=Number(m.y),t=r.map.tiles.find(q=>q.x===x&&q.y===y);if(!t||t.owner!==p.id||t.building||!canAfford(p,BUILDINGS[type].cost))return send(ws,{type:'error',code:'CANNOT_BUILD'});spend(p,BUILDINGS[type].cost);t.building={type,id:uid(5),level:1};p.buildings.push({...t.building,x,y});if(type==='city'){t.city={level:1,name:['Oceanview','Windfall','Bluehaven','Seabright'][p.cities.length%4]};p.cities.push({...t.city,x,y});}p.score+=50;return broadcast(r,{type:'state_delta',state:state(r,p.id)});}
 if(m.type==='claim'){const x=Number(m.x),y=Number(m.y);if(!adjacent(r,p,x,y)||!canAfford(p,{credits:300}))return;spend(p,{credits:300});const t=r.map.tiles.find(q=>q.x===x&&q.y===y);t.owner=p.id;p.score+=10;return broadcast(r,{type:'state_delta',state:state(r,p.id)});}
 if(m.type==='attack'){const target=r.players.get(m.targetId);if(!target||target.id===p.id)return;const method=m.method;if(method==='missile'){const silo=p.buildings.find(b=>b.type==='silo');if(!silo||p.resources.missiles<1)return send(ws,{type:'error',code:'NEED_SILO_AND_MISSILE'});p.resources.missiles--;target.hp=Math.max(0,target.hp-35);}
 else if(method==='ground'){if(!p.units.length)p.units.push({id:uid(5),type:'infantry',x:p.x,y:p.y,hp:100});target.hp=Math.max(0,target.hp-12);}
 else if(method==='naval'){const port=p.buildings.find(b=>b.type==='port');if(!port)return;target.hp=Math.max(0,target.hp-20);}
 else if(method==='air'){const air=p.buildings.find(b=>b.type==='airport');if(!air)return;target.hp=Math.max(0,target.hp-25);}
 else return; p.score+=25;broadcast(r,{type:'attack',from:p.id,to:target.id,method,players:[{id:p.id,hp:p.hp,score:p.score,resources:p.resources},{id:target.id,hp:target.hp,score:target.score,resources:target.resources}]});return;}
 if(m.type==='alliance'){const target=r.players.get(m.targetId);if(!target||target.id===p.id)return; if(!p.allies.includes(target.id)){p.allies.push(target.id);target.allies.push(p.id);broadcast(r,{type:'diplomacy',kind:'alliance',a:p.id,b:target.id});}return;}
 if(m.type==='betray'){const target=r.players.get(m.targetId);if(!target||!p.allies.includes(target.id))return;p.allies=p.allies.filter(x=>x!==target.id);target.allies=target.allies.filter(x=>x!==p.id);p.betrayals++;broadcast(r,{type:'diplomacy',kind:'betray',a:p.id,b:target.id});return;}
 if(m.type==='turn_end'){r.turn++;for(const q of r.players.values())prod(q);return broadcast(r,{type:'turn',turn:r.turn,players:[...r.players.values()].map(q=>({id:q.id,resources:q.resources,score:q.score,hp:q.hp}))});}
 if(m.type==='voice_signal'){const target=r.players.get(m.to);if(target)send(target.ws,{type:'voice_signal',from:p.id,data:m.data});return;}
}
const server=http.createServer((req,res)=>{let u=new URL(req.url,'http://x');let path=u.pathname==='/'?'/index.html':u.pathname;let file=join(ROOT,path);if(!existsSync(file))return res.writeHead(404).end('Not found');const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));});
server.on('upgrade',(req,socket)=>{if(req.headers.upgrade?.toLowerCase()!=='websocket'){socket.destroy();return}const key=req.headers['sec-websocket-key'];if(!key){socket.destroy();return}socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+wsAccept(key)+'\r\n\r\n');makeSocket(socket)});
setInterval(()=>{for(const c of clients){if(c.isAlive===false){c.close();continue}c.isAlive=false;c.ping()}for(const r of rooms.values()){if(r.started||!r.permanent)continue;const count=[...r.players.values()].filter(p=>p.connected).length;const elapsed=Date.now()-r.waitStarted;if(elapsed>=300000&&!r.extensionStarted){r.extensionStarted=true;broadcast(r,{type:'room_update',room:publicRoom(r)});}if(elapsed>=480000&&r.extensionStarted&&count>=2){start(r);}}},1000);
server.listen(PORT,()=>console.log(`TIDELANDS listening on ${PORT}`));
