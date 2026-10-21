const small='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const tens=['','','twenty','thirty','forty','fifty'];
const words=n=>n<20?small[n]:tens[Math.floor(n/10)]+(n%10?' '+small[n%10]:'');
const two=n=>String(n).padStart(2,'0');
const raw=(h,m,s)=>`${h}${two(m)}${two(s)}`;
function* duration(){
 for(let seconds=0;seconds<=7199;seconds++){
  const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60,expected=seconds*1000,r=raw(h,m,s);
  const item=(path,input,channel='voice')=>({path,input,channel,expected,reject:seconds===0&&channel==='voice'});
  const phrase=[h?'one hour':'',m?words(m)+(m===1?' minute':' minutes'):'',s?words(s)+(s===1?' second':' seconds'):''].filter(Boolean).join(' ')||'zero seconds';
  yield item('explicit-unit-words',phrase);
  yield item('explicit-unit-numerals',`${h} hour${h===1?'':'s'} ${m} minute${m===1?'':'s'} ${s} second${s===1?'':'s'}`);
  yield item('mixed-unit-values',h?`one hour ${m} minutes ${s} seconds`:`${words(m)} minutes ${s} seconds`);
  yield item('clock-colons',`${h}:${two(m)}:${two(s)}`);
  yield item('raw-numeral-digits',r);
  yield item('spoken-digit-sequence',r.split('').map(n=>small[Number(n)]).join(' '));
  if(r.includes('0'))for(const alias of ['oh','o','naught','nought'])yield item('spoken-zero-'+alias,r.split('').map(n=>n==='0'?alias:small[Number(n)]).join(' '));
  yield item('grouped-numerals',h?`${h} ${two(m)} ${two(s)}`:`${two(m)} ${two(s)}`);
  yield item('omitted-lower-units',h?`one hour ${words(m)} and ${words(s)}`:`${words(m)} minutes and ${words(s)}`);
  yield item('short-unit-abbreviations',`${h} hr ${m} min ${s} sec`);
  yield item('long-unit-abbreviations',`${h} hrs ${m} mins ${s} secs`);
  if(h){
   yield item('article-hour-explicit',`an hour ${words(m)} minutes ${words(s)} seconds`);
   yield item('article-hour-implicit',`an hour ${words(m)} and ${words(s)}`);
   yield item('positional-three-groups',`one and ${words(m)} and ${words(s)}`);
   if(s===0){yield item('article-hour-and-minute',`an hour and ${words(m)}`);yield item('hour-numeric-minute',`one hour ${m} minutes`);yield item('hour-implicit-minute',`one hour ${words(m)}`);}
  }else{
   if(m>0)yield item('positional-two-groups',`${words(m)} and ${words(s)}`);
   if(m>=10&&s>=10)yield item('compact-cardinal-groups',words(m)+' '+words(s));
   if(m>0&&s===0)yield item('cardinal-minutes',words(m));
   if(m>=10&&s===0)yield item('zero-leading-clock-style','zero '+words(m));
   if(m===1)yield item('article-minute','a minute and '+words(s));
   if(seconds===1)yield item('article-second','a second');
  }
  const doubled=r.replace(/(\d)\1/g,(_,n)=>'double '+small[Number(n)]+' ').replace(/\d/g,n=>small[Number(n)]+' ').trim();
  if(/double/.test(doubled))yield item('double-digit',doubled);
  const tripled=r.replace(/(\d)\1\1/g,(_,n)=>'triple '+small[Number(n)]+' ').replace(/\d/g,n=>small[Number(n)]+' ').trim();
  if(/triple/.test(tripled))yield item('triple-digit',tripled);
  yield item('numberpad-full',r,'numberpad');
  yield item('numberpad-leading-zero-trim',r.replace(/^0+(?=\d)/,''),'numberpad');
 }
}
function* time(){
 for(let h=0;h<24;h++)for(let m=0;m<60;m++){
  const expected=(h*3600+m*60)*1000,hour=h%12||12,meridiem=h<12?'AM':'PM';
  const item=(path,input,channel='voice',extra={})=>({path,input,channel,expected,...extra});
  yield item('cardinal-24-hour',words(h)+' '+(m<10?'oh ':'')+words(m));
  yield item('cardinal-12-hour-meridiem',words(hour)+' '+(m<10?'oh ':'')+words(m)+' '+meridiem);
  yield item('numeric-colon',h+':'+two(m));
  yield item('numeric-groups',h+' '+two(m));
  yield item('numeric-compact',two(h)+two(m));
  yield item('numeric-meridiem',hour+':'+two(m)+' '+meridiem);
  yield item('today-at','today at '+h+':'+two(m), 'voice',{day:'today'});
  yield item('tomorrow',h+':'+two(m)+' tomorrow','voice',{day:'tomorrow'});
  if(m<10)for(const alias of ['o','naught','nought'])yield item('clock-zero-'+alias,words(h)+' '+alias+' '+words(m));
  if(m===0)yield item('oclock',words(hour)+" o'clock "+meridiem);
  if(m===15)yield item('quarter-past','quarter past '+words(hour)+' '+meridiem);
  if(m===30)yield item('half-past','half past '+words(hour)+' '+meridiem);
  if(m>0){yield item('quantity-past',words(m)+' past '+words(hour)+' '+meridiem);yield item('quantity-after',words(m)+' after '+words(hour)+' '+meridiem);}
  if(m>=1&&m<=59){const next=(h+1)%24,nextHour=next%12||12,nextPeriod=next<12?'AM':'PM';for(const connector of ['to','till','until'])yield item('quantity-'+connector,words(60-m)+' '+connector+' '+words(nextHour)+' '+nextPeriod);}
  if(h===0&&m===0)yield item('midnight','midnight');
  if(h===12&&m===0)yield item('noon','noon');
  yield item('numberpad-hour-minute',String(h)+two(m),'numberpad');
  yield item('numberpad-am-pm',String(hour)+two(m),'numberpad',{meridiem});
 }
 for(let seconds=0;seconds<86400;seconds++){
  const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
  yield {path:'numberpad-seconds',channel:'numberpad',input:raw(h,m,s),expected:seconds*1000};
 }
}
module.exports={locale:'en-US',duration,time};
