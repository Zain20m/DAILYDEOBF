#!/usr/bin/env node
const fs=require("fs");const path=require("path");
const dir=path.join(__dirname);
const parts=fs.readdirSync(dir).filter(f=>f.startsWith("part")).sort();
let out="";
for (const p of parts) out+=fs.readFileSync(path.join(dir,p),"utf8");
const dest=path.join(__dirname,"..","envlogger.luau");
fs.writeFileSync(dest,out);
console.log("assembled",dest,out.length);
