const bind=()=>{const form=document.getElementById('loginForm');if(!form)return;for(const id of ['email','password']){const input=document.getElementById(id);const label=input?.closest('.field')?.querySelector('label');if(input&&label){label.htmlFor=id}}};
bind();
new MutationObserver(bind).observe(document.body,{subtree:true,childList:true});
