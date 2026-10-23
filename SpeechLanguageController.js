(() => {
 'use strict';
 const contracts=new Map(),vocabularies=new Map(),bindings=new Map();
 let selected,revision=0;
 const locale=value=>Intl.getCanonicalLocales(value)[0];
 const canonical=kind=>({clock:'time','clock-parts':'time',percent:'number'})[kind]||kind;
 const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
   Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
 };
 class SpeechLanguageController {
  static register(contract) {
   if(contract?.version!==1||typeof contract.locale!=='string'||
    !['vocabulary','normalize','parse','classify'].every(key=>typeof contract[key]==='function'))
    throw TypeError('Invalid speech language contract.');
   const code=locale(contract.locale);
   if(contracts.has(code))throw Error('Speech language contract already registered: '+code);
   contracts.set(code,freeze({...contract,locale:code}));revision++;
  }
  static get locale(){return selected||locale(globalThis.WMOFLanguagePack?.locale||'und');}
  static get revision(){return revision;}
  static get languages(){return Object.freeze([...contracts.keys()]);}
  static contract(language=SpeechLanguageController.locale) {
   const code=locale(language),contract=contracts.get(code);
   if(!contract)throw Error('No speech language contract registered for '+code);
   return contract;
  }
  static activate(language) {
   const contract=SpeechLanguageController.contract(language);
   if(globalThis.SpeechMenu?.started&&contract.locale!==SpeechLanguageController.locale)
    throw Error('Stop speech recognition before changing its language contract.');
   selected=contract.locale;revision++;
   for(const apply of bindings.values())apply();
   return contract;
  }
  static vocabulary(language) {
   const contract=SpeechLanguageController.contract(language);
   if(!vocabularies.has(contract.locale)){
    const result=contract.vocabulary();
    for(const kind of ['time','duration','number','digits','date']) {
     if(!Array.isArray(result[kind])||result[kind].some(value=>typeof value!=='string'||!value.trim()))
      throw TypeError('Invalid '+kind+' vocabulary for '+contract.locale);
    }
    vocabularies.set(contract.locale,freeze(Object.fromEntries(Object.entries(result).map(([kind,values])=>[kind,[...new Set(values)]]))));
   }
   return vocabularies.get(contract.locale);
  }
  static words(kind,language) {
   return new Set((SpeechLanguageController.vocabulary(language)[canonical(kind)]||[]).flatMap(phrase=>phrase.split(/\s+/)));
  }
  static normalize(value,kind,options) {return SpeechLanguageController.contract().normalize(value,kind,options);}
  static parse(value,kind,options) {return SpeechLanguageController.contract().parse(value,kind,options);}
  static format(value,kind,options) {
   const contract=SpeechLanguageController.contract();
   if(typeof contract.format!=='function')throw Error('No value formatter registered for '+contract.locale);
   return contract.format(value,kind,options);
  }
  static classify(value,kind,options) {return SpeechLanguageController.contract().classify(value,kind,options);}
  static constraints(kind) {
   return SpeechLanguageController.contract().contexts?.[canonical(kind)]||Object.freeze({});
  }
  static checkParity(language) {
   const contract=SpeechLanguageController.contract(language),vocabulary=SpeechLanguageController.vocabulary(language);
   const words=Object.fromEntries(Object.entries(vocabulary).map(([kind,phrases])=>[kind,new Set(phrases.flatMap(phrase=>phrase.split(/\s+/)))]));
   const failures=[];let total=0;
   const cases=contract.parityCases?contract.parityCases():contract.examples||[];
   for(const entry of cases){
    total++;
    try {
     const result=contract.classify(entry.phrase,entry.kind,{final:true});
     const normalized=contract.normalize(entry.phrase,entry.kind);
     const parsed=contract.parse(entry.phrase,entry.kind);
     const grammar=canonical(entry.kind);
     if(result.status!=='valid'||result.value!==entry.value)throw Error('Parser result differs from declared meaning.');
     if(normalized!==entry.value)throw Error('Normalizer and collector disagree.');
     if(parsed==null||(typeof parsed==='number'&&!Number.isFinite(parsed))||
      (Object.hasOwn(entry,'parsed')&&parsed!==entry.parsed))throw Error('Parsed value differs from declared meaning.');
     if(entry.recognition==='phrase'&&!vocabulary[grammar]?.includes(entry.phrase))throw Error('Complete form is absent from recognition vocabulary.');
     if(!entry.phrase.split(/\s+/).every(word=>words[grammar]?.has(word)))throw Error('Parser form contains words absent from recognition vocabulary.');
     for(const key of ['components','inferred'])if(entry[key]&&JSON.stringify(result[key])!==JSON.stringify(entry[key]))
      throw Error(key+' differ from declared interpretation.');
    } catch(error){failures.push({test:total,kind:entry.kind,phrase:entry.phrase,message:String(error.message||error)});}
   }
   return {locale:contract.locale,total,passed:total-failures.length,failures};
  }
  static bindCollectors(menu,{resolveKind=kind=>kind,toDigits}={}) {
   const binding=menu||Symbol('pending speech collectors');
   const apply=()=>{
    const target=menu||globalThis.SpeechMenu;
    if(!target?.registerValueContext)return;
    for(const kind of ['clock','clock-parts','duration','percent','keypad']) {
     const constraints=SpeechLanguageController.constraints(kind);
     target.registerValueContext(kind,(text,options)=>SpeechLanguageController.classify(text,resolveKind(kind),options),
      {...constraints,...(constraints.digitRange&&toDigits?{toDigits}:{})});
    }
   };
   bindings.set(binding,apply);apply();
   return ()=>bindings.delete(binding);
  }
  static refreshCollectors(){for(const apply of bindings.values())apply();}
 }
 globalThis.SpeechLanguageController=SpeechLanguageController;
})();
