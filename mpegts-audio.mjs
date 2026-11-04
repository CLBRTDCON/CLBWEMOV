// Read ISO-639 descriptors from bounded MPEG-TS PAT/PMT sections.
export function transportAudioTracks(bytes){
 const states=new Map();let pmt=-1,result=[];
 function section(pid,s){
  if(pid===0&&s[0]===0){for(let i=8;i+4<=s.length-4;i+=4)if((s[i]<<8|s[i+1])!==0){pmt=(s[i+2]&31)<<8|s[i+3];break;}}
  if(pid!==pmt||s[0]!==2)return;
  const tracks=[];let i=12+((s[10]&15)<<8|s[11]);
  while(i+5<=s.length-4){const type=s[i],id=(s[i+1]&31)<<8|s[i+2],end=i+5+((s[i+3]&15)<<8|s[i+4]);if(end>s.length-4)return;let language='',audio=[3,4,15,17,129,135].includes(type);
   for(let d=i+5;d+2<=end;){const tag=s[d],n=s[d+1];if(d+2+n>end)return;if(tag===10&&n>=4){const lang=String.fromCharCode(...s.subarray(d+2,d+5)).toLowerCase();if(/^[a-z]{3}$/.test(lang))language=lang;}if(type===6&&[106,122].includes(tag))audio=true;d+=2+n;}
   if(audio)tracks.push({pid:id,language});i=end;
  }result=tracks;
 }
 function feed(pid,data,start){let pending=states.get(pid)||[];if(start){const pointer=data[0];if(pointer+1>data.length){states.delete(pid);return;}if(pending.length){pending.push(...data.subarray(1,1+pointer));drain();}pending=[];data=data.subarray(1+pointer);}pending.push(...data);drain();states.set(pid,pending);
  function drain(){while(pending.length>=3){if(pending[0]===255){pending=[];return;}const length=3+((pending[1]&15)<<8|pending[2]);if(length<8||length>1024){pending=[];return;}if(pending.length<length)return;section(pid,Uint8Array.from(pending.slice(0,length)));pending=pending.slice(length);}if(pending.length>1024)pending=[];}
 }
 let offset=0;while(offset+188<=bytes.length&&(bytes[offset]!==71||(offset+376<bytes.length&&bytes[offset+188]!==71)))offset++;
 for(let p=offset;p+188<=bytes.length;p+=188){if(bytes[p]!==71||(bytes[p+1]&128))continue;const pid=(bytes[p+1]&31)<<8|bytes[p+2],control=(bytes[p+3]>>4)&3;if((pid!==0&&pid!==pmt)||!(control&1))continue;const begin=p+4+(control&2?1+bytes[p+4]:0);if(begin>=p+188)continue;feed(pid,bytes.subarray(begin,p+188),!!(bytes[p+1]&64));}return result;
}
