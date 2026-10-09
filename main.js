(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const text = key => WMOFLanguagePack.text(WMOFMainText[key]);
    const endpoint = new URL('api/users/',document.baseURI);
    let user, csrf, busy = false, authRevision = 0;
    const permitted = mask => Boolean(Number(user?.permissions) & (mask | 4));
    const lookup = new WMOFUserLookup({baseUrl:new URL('./',document.baseURI),identityContext:WMOFIdentityContext,
        canLookup:()=>permitted(128),canEdit:()=>Boolean(user && (Number(WMOFIdentityContext.current?.userId) === Number(user.id) || permitted(2))),
        canAssignPermissions:()=>permitted(4),
        canGrantPermission:bit=>permitted(bit),
        onProfileSaved:profile=>{if(Number(profile.id)===Number(user?.id)){user=profile;render();}}});
    function render(expand = false) {
        $('signedOutActions').hidden = Boolean(user);
        $('signedInActions').hidden = !user;
        $('signedInActions').querySelector('.order-filler-link').href = 'order-filler.php?session=existing';
        $('mainUserName').textContent = user?.preferred_name || [user?.first_name,user?.last_name].filter(Boolean).join(' ') || user?.username || '';
        $('homeAdmin').hidden = !permitted(1|2|32|128);
        $('homeTrainer').hidden = !permitted(64);
        $('homeDev').hidden = !permitted(8|16);
        for (const link of $('homeDev').querySelectorAll('a[href="api/docs/"],a[href="api/admin/sql/?console=1"]')) link.hidden = !permitted(16);
        $('homeEditProfileButton').hidden = !permitted(128);
        $('homeAdmin').querySelector('a[href="api/admin/new-user/"]').hidden = !permitted(1);
        $('homeAdmin').querySelector('a[href="api/admin/access-tokens/?console=1"]').hidden = !permitted(32);
        if(expand){$('homeMenu').hidden=false;$('homeMenuButton').setAttribute('aria-expanded','true');}
        lookup.sync();
    }
    async function request(body) {
        const response=await fetch(endpoint,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
            headers:body?{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})}:{},
            ...(body?{body:JSON.stringify(body)}:{})});
        const data=await response.json();
        if(!response.ok)throw Object.assign(new Error(data.message || text('failed')),{status:response.status});
        return data;
    }
    $('mainLoginButton').addEventListener('click',()=>{$('mainLoginStatus').textContent='';$('mainLoginDialog').showModal();$('mainUsername').focus();});
    $('mainLoginCancel').addEventListener('click',()=>{$('mainPassword').value='';$('mainLoginDialog').close();});
    $('mainLoginForm').addEventListener('submit',async event=>{
        event.preventDefault();if(busy)return;busy=true;++authRevision;$('mainLoginOK').disabled=true;$('mainLoginStatus').textContent=text('loading');
        try{
            const result=await request({action:'connect',username:$('mainUsername').value.trim(),password:$('mainPassword').value});
            user=result.user;csrf=result.csrfToken;
            try{localStorage.setItem('wmof.deliberatelyLoggedOut','false');}catch{}
            $('mainPassword').value='';$('mainLoginDialog').close();render(true);
        }catch(error){$('mainLoginStatus').textContent=error.message;}
        finally{busy=false;$('mainLoginOK').disabled=false;}
    });
    $('homeMenuButton').addEventListener('click',()=>{const expanded=$('homeMenuButton').getAttribute('aria-expanded')==='true';$('homeMenu').hidden=expanded;$('homeMenuButton').setAttribute('aria-expanded',String(!expanded));});
    $('homeProfileButton').addEventListener('click',()=>{if(!user)return;WMOFIdentityContext.select(user);lookup.setMode('edit');lookup.sync();$('userLookupDialog').showModal();});
    $('homeEditProfileButton').addEventListener('click',()=>{WMOFIdentityContext.clear();lookup.setMode('edit');lookup.clearSearch();lookup.sync();$('userLookupDialog').showModal();});
    for(const button of $('userLookupDialog').querySelectorAll('[data-close-dialog]'))button.addEventListener('click',()=>$('userLookupDialog').close());
    $('homeLogoutButton').addEventListener('click',async()=>{
        if(busy)return;busy=true;++authRevision;$('homeLogoutButton').disabled=true;
        try{await request({action:'disconnect'});user=undefined;csrf=undefined;WMOFIdentityContext.clear();$('mainStatus').textContent='';render();}
        catch(error){$('mainStatus').textContent=error.message;}
        finally{busy=false;$('homeLogoutButton').disabled=false;}
    });
    render();
    const initialRevision=authRevision;
    request().then(result=>{if(authRevision!==initialRevision)return;user=result.user;csrf=result.csrfToken;render(true);}).catch(error=>{if(authRevision===initialRevision&&error.status!==401)$('mainStatus').textContent=error.message;});
})();
