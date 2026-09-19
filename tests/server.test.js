import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('project contains deployable client and server',()=>{assert.ok(fs.existsSync(path.join(process.cwd(),'server/index.js')));assert.ok(fs.existsSync(path.join(process.cwd(),'public/index.html')));assert.ok(fs.existsSync(path.join(process.cwd(),'public/app.js')));assert.ok(fs.existsSync(path.join(process.cwd(),'public/style.css')));});
test('client exposes core building and attack actions',()=>{const s=fs.readFileSync(path.join(process.cwd(),'public/app.js'),'utf8');for(const x of ['City Center','Missile Silo','Airport','Naval','alliance','betray','create_room','join_room'])assert.match(s,new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));});
test('server exposes authoritative room and combat messages',()=>{const s=fs.readFileSync(path.join(process.cwd(),'server/index.js'),'utf8');for(const x of ['create_room','join_room','reconnect','build','attack','alliance','betray','chat','voice_signal'])assert.match(s,new RegExp("m.type==='"+x+"'"));});
