(() => {
    'use strict';
    const $=id=>document.getElementById(id);
    const endpoint='../api/admin/impersonation/';
    let csrf, busy=false;
    async function request(url,body){
        const response=await fetch(url,{cache:'no-store',credentials:'same-origin',method:body?'POST':'GET',
            headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:undefined,
            body:body?JSON.stringify(body):undefined});
        const data=await response.json();
        if(!response.ok)throw new Error(data.message||'Request failed.');
        if(data.csrfToken)csrf=data.csrfToken;
        return data;
    }
    async function refresh(){
        const data=await request(endpoint), user=data.user, state=data.impersonation;
        $('login').hidden=!!user;
        $('target').hidden=!user||!!state||!(Number(user.permissions)&(4|256));
        $('active').hidden=!state;
        $('logout').hidden=!user;
        $('return').hidden=!state?.return_user_id;
        $('fresh-login').hidden=!state||!!state.return_user_id;
        $('active-account').textContent=user?'Acting as '+user.username+'.':'';
        $('status').textContent=user?'Signed in as '+user.username+'.'+(!state&&$('target').hidden?' Impersonate permission is required.':''):'Signed out.';
        $('status').dataset.error='false';
    }
    function identityChanged(){
        if(typeof BroadcastChannel==='function'){const channel=new BroadcastChannel('wmof-identity-changed');channel.postMessage({type:'identity-changed'});channel.close();}
    }
    async function perform(action){
        if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{await action();identityChanged();await refresh();}
        catch(error){$('status').textContent=error.message;$('status').dataset.error='true';}
        finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
    }
    $('login-type').addEventListener('change',()=>{
        const pin=$('login-type').value==='pin';
        $('identity-label').textContent=pin?'Login ID':'Username';
        $('credential-label').textContent=pin?'PIN':'Password';
        $('identity').inputMode=pin?'numeric':'text';
        $('identity').maxLength=pin?4:191;
        $('identity').value='';$('credential').value='';
    });
    $('login').addEventListener('submit',event=>{
        event.preventDefault();const pin=$('login-type').value==='pin', credential=$('credential').value;
        const body=pin?{action:'connect-pin',loginId:$('identity').value,pin:credential}:{action:'connect',username:$('identity').value,password:credential};
        $('credential').value='';void perform(()=>request('../api/users/',body));
    });
    $('target').addEventListener('submit',event=>{event.preventDefault();void perform(()=>request(endpoint,{action:'start',targetUsername:$('target-username').value}));});
    $('return').addEventListener('click',()=>void perform(()=>request(endpoint,{action:'return'})));
    $('logout').addEventListener('click',()=>void perform(()=>request('../api/users/',{action:'disconnect'})));
    void refresh().catch(error=>{$('status').textContent=error.message;$('status').dataset.error='true';});
})();
