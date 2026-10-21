// Native static project: verify imports/assets and assemble an exact, offline build.
// No dependency install, bundler, network call, deployment or runtime-data access.
import {readFileSync,readdirSync,statSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(root,'dist'), output=resolve(root,'build');
const files=readdirSync(source).filter(name=>statSync(resolve(source,name)).isFile());
assert(files.includes('index.html'),'Missing static entrypoint');
for(const name of files){
  const content=readFileSync(resolve(source,name),'utf8');
  if(name.endsWith('.js')){
    execFileSync(process.execPath,['--check',resolve(source,name)],{stdio:'pipe'});
    for(const match of content.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)){
      assert(statSync(resolve(source,match[1])).isFile(),`Missing import in ${name}: ${match[1]}`);
    }
  }
  if(name.endsWith('.html')){
    for(const match of content.matchAll(/(?:href|src)="(\.\/[^"?#]+)"/g)){
      assert(statSync(resolve(source,match[1])).isFile(),`Missing asset: ${match[1]}`);
    }
  }
}
mkdirSync(output,{recursive:true});
// Fail on unexpected stale content rather than deleting anything automatically.
for(const name of readdirSync(output))assert(files.includes(name),`Unexpected build entry: ${name}; inspect it manually.`);
for(const name of files)copyFileSync(resolve(source,name),resolve(output,name));
console.log(`Static build OK: ${files.length} validated files → ${relative(root,output)}/ (not deployed)`);

