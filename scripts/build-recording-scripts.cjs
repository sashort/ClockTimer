const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'tests/recording-scripts');fs.mkdirSync(directory,{recursive:true});
for(const locale of fs.readdirSync(path.join(root,'tests/languages'))){
 const profile=require(path.join(root,'tests/languages',locale,'profile.cjs'));
 const corpus=require(path.resolve(root,'tests/languages',locale,profile.workflowCorpus));
 fs.writeFileSync(path.join(directory,locale.toLowerCase()+'.json'),JSON.stringify({format:1,locale,phrases:[...new Set(Object.values(corpus.phrases))]},null,2)+'\n');
}
