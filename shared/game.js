export const MAX_PLAYERS=[2,4,8,16,32];
export const RESOURCES=['credits','materials','energy','population','industry'];
export const BUILDINGS={
  city:{cost:{credits:2000,materials:900},time:8,maintenance:10,cap:250},
  farm:{cost:{credits:500,materials:180},time:4,maintenance:2,production:{population:12}},
  mine:{cost:{credits:800,materials:250},time:5,maintenance:5,production:{materials:35}},
  factory:{cost:{credits:1200,materials:500},time:7,maintenance:8,production:{industry:25}},
  power:{cost:{credits:1000,materials:400},time:6,maintenance:7,production:{energy:30}},
  warehouse:{cost:{credits:700,materials:300},time:5,maintenance:3},
  port:{cost:{credits:1500,materials:650},time:9,maintenance:10,production:{credits:30}},
  airport:{cost:{credits:2000,materials:800},time:10,maintenance:12},
  radar:{cost:{credits:1500,materials:500},time:8,maintenance:8},
  defense:{cost:{credits:1300,materials:550},time:8,maintenance:10}
};
export const OBJECTIVES=[
 {id:'OCEAN_LINK',name:'Oceanic Network',desc:'Connect two cities to a port and reach 500 population.',type:'development'},
 {id:'INDUSTRIAL_HEART',name:'Industrial Heart',desc:'Build a factory and reach 100 industry.',type:'economic'},
 {id:'HORIZON',name:'Horizon Expansion',desc:'Control 12 strategic tiles and establish 2 cities.',type:'domination'},
 {id:'ENERGY_GRID',name:'Energy Grid',desc:'Build a power plant and maintain 150 energy.',type:'economic'},
 {id:'SECURE_COAST',name:'Secure the Coast',desc:'Own a port, radar and defensive infrastructure.',type:'development'}
];
export function rng(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let x=Math.imul(t^(t>>>15),1|t);x^=x+Math.imul(x^(x>>>7),61|x);return ((x^(x>>>14))>>>0)/4294967296}}
export function generateMap(seed=12345,w=42,h=28){
 const r=rng(seed), tiles=[];
 for(let y=0;y<h;y++) for(let x=0;x<w;x++){
   const edge=Math.min(x,y,w-1-x,h-1-y); let n=r();
   let terrain=edge<1?'water': n<.09?'mountain':n<.16?'forest':n<.20?'dry':'land';
   if((x-31)**2+(y-21)**2<18) terrain='snow';
   if((x-8)**2+(y-21)**2<10) terrain='volcanic';
   if(terrain==='land' && (x===4||x===18||x===34) && y%3===0) terrain='beach';
   tiles.push({x,y,terrain,owner:null,city:null,resource:['land','dry','snow','volcanic'].includes(terrain)&&r()<.045?'resource':null});
 }
 // carve channels and islands for a readable strategic map
 for(let y=8;y<21;y++) for(let x=20;x<25;x++) if((x+y)%3!==0) tiles[y*w+x].terrain='water';
 for(let y=3;y<8;y++) for(let x=27;x<34;x++) if((x+y)%4===0) tiles[y*w+x].terrain='water';
 return {seed,w,h,tiles};
}
export function initialPlayer(id,name,team,x,y){return {id,name,team,x,y,resources:{credits:7000,materials:4500,energy:2200,population:420,industry:80},cities:[],buildings:[],relations:{},ready:false,connected:true,reputation:50,score:0}};
export function canAfford(p,cost){return Object.entries(cost).every(([k,v])=>(p.resources[k]??0)>=v)}
export function spend(p,cost){for(const [k,v] of Object.entries(cost))p.resources[k]-=v}
export function applyProduction(p){p.resources.credits+=35;p.resources.materials+=18;p.resources.energy+=8;p.resources.population+=2;p.resources.industry=Math.min(500,p.resources.industry+3);}
export function objectiveProgress(match,p){const cities=p.cities.length;const ports=p.buildings.filter(b=>b.type==='port').length;const radar=p.buildings.filter(b=>b.type==='radar').length;const defense=p.buildings.filter(b=>b.type==='defense').length;const owned=match.map.tiles.filter(t=>t.owner===p.id).length;let v=0;switch(match.objective.id){case'OCEAN_LINK':v=Math.min(100,ports*35+cities*20+Math.min(30,p.resources.population/17));break;case'INDUSTRIAL_HEART':v=Math.min(100,p.buildings.some(b=>b.type==='factory')?p.resources.industry:0);break;case'HORIZON':v=Math.min(100,owned/12*70+cities/2*30);break;case'ENERGY_GRID':v=Math.min(100,p.buildings.some(b=>b.type==='power')?p.resources.energy/1.5:0);break;case'SECURE_COAST':v=Math.min(100,ports*35+radar*30+defense*35);break;}return Math.round(v)}
