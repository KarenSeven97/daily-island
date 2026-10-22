import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountBackend} from '../dist/account-backend.js';

test('email authentication forwards only the required credentials and nickname metadata',async()=>{
  const calls=[];
  const backend=createAccountBackend(async()=>({auth:{
    signInWithPassword:async input=>{calls.push(['login',input]);return {data:{session:{user:{id:'a'}}}};},
    signUp:async input=>{calls.push(['signup',input]);return {data:{session:null}};}
  }}));
  await backend.signIn({email:'friend@example.com',password:'test-password',username:'昵称'});
  assert.deepEqual(calls[0],['login',{email:'friend@example.com',password:'test-password'}]);
  const result=await backend.signUp({email:'friend@example.com',password:'test-password',username:'昵称'});
  assert.equal(result.session,null);assert.deepEqual(calls[1][1].options.data,{display_name:'昵称'});
  assert.equal(calls[1][1].options.emailRedirectTo,'https://karenseven97.github.io/daily-island/');
});
test('cloud update filters by user and expected version; zero updated rows is a conflict',async()=>{
  const calls=[],query={
    update(value){calls.push(['update',value]);return this;},
    eq(...args){calls.push(['eq',...args]);return this;},select(){return this;},async maybeSingle(){return {data:null};}
  };
  const backend=createAccountBackend(async()=>({from:()=>query}));
  assert.deepEqual(await backend.writeSave('alice',{schemaVersion:1},5),{conflict:true});
  assert.deepEqual(calls,[['update',{snapshot:{schemaVersion:1}}],['eq','user_id','alice'],['eq','version',5]]);
});
test('a concurrent initial insert is a conflict, not an upsert that replaces data',async()=>{
  let inserted;const query={insert(value){inserted=value;return this;},select(){return this;},async maybeSingle(){return {error:{code:'23505'}};}};
  const backend=createAccountBackend(async()=>({from:()=>query}));
  assert.deepEqual(await backend.writeSave('alice',{schemaVersion:1},null),{conflict:true});
  assert.deepEqual(inserted,{user_id:'alice',snapshot:{schemaVersion:1}});
});
