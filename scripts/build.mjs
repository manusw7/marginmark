import { cp, mkdir, copyFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const dest = 'extension/vendor';
const {version}=JSON.parse(await readFile('extension/manifest.json','utf8'));
const artifact=`dist/marginmark-${version}.xpi`;
await mkdir(dest, {recursive:true});
for (const f of ['pdf.mjs','pdf.worker.mjs']) await copyFile(`node_modules/pdfjs-dist/build/${f}`, `${dest}/${f}`);
for (const dir of ['cmaps','standard_fonts','wasm']) await cp(`node_modules/pdfjs-dist/${dir}`, `${dest}/${dir}`, {recursive:true});
await copyFile('node_modules/pdfjs-dist/web/pdf_viewer.css', `${dest}/pdf_viewer.css`);
await copyFile('node_modules/pdfjs-dist/LICENSE', `${dest}/PDFJS-LICENSE`);
await copyFile('node_modules/pdf-lib/dist/pdf-lib.min.js', `${dest}/pdf-lib.min.js`);
await copyFile('node_modules/pdf-lib/LICENSE.md', `${dest}/PDF-LIB-LICENSE`);
await mkdir('dist', {recursive:true});
execFileSync('python3',['-c',`import zipfile,pathlib,sys
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(pathlib.Path('extension').rglob('*')):
  if p.is_file(): z.write(p,p.relative_to('extension'))
`,artifact]);
console.log(`Creato ${artifact} (non firmato).`);
