/* V205: Order status/expiry UI follows its native server, not legacy Manager licensing. */
(function(){
  const ORDER_ORIGIN = new URL(MASTER_ORDER_URL).origin;
  const AUTH_KEY = 'ntMasterOrderSessionV204:';
  let authDialogPromise = null;

  function tenant(rec){
    if(rec.appId==='SMART_ORDER_NGOC_TRAI'||rec.externalKey==='smart-order'||rec.appType==='order-shared')return 'npp1';
    return masterOrderTenantId(rec.appId);
  }
  function api(rec,path){const origin=rec.loginProvisioned&&rec.appType==='order-child'?new URL(MASTER_ORDER_CHILD_URL).origin:ORDER_ORIGIN;const url=new URL(path,origin);url.searchParams.set('tenant',tenant(rec));return url.href}
  function patchRecord(rec){
    if(!rec||!masterIsOrder(rec))return rec;
    rec.usageApiUrl=api(rec,'/api/tenant-usage');
    rec.controlApiUrl=api(rec,'/api/app-control');
    rec.online=true;
    if(tenant(rec)==='npp1'){
      rec.publicUrl=MASTER_ORDER_URL+'?mode=admin&view=admin&npp=npp1';
      rec.notes='Order Ngọc Trai online • trạng thái, hạn dùng và dung lượng lấy trực tiếp từ app đang chạy.';
    }
    return rec;
  }
  async function jsonFetch(url,init={}){
    const response=await fetch(url,{cache:'no-store',...init,signal:AbortSignal.timeout(12000)});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body.ok===false){const error=new Error(body.error||'HTTP '+response.status);error.status=response.status;throw error}
    return body;
  }
  function remoteControl(rec,control){
    if(!control||!['active','locked'].includes(control.status))throw new Error('App Order chưa trả về trạng thái hợp lệ.');
    return {...(rec.remote||{}),status:control.status,expires_at:control.expiresAt||'',
      control_updated_at:control.updatedAt?new Date(control.updatedAt).toISOString():null,
      last_checked_at:new Date().toISOString(),public_url:rec.publicUrl};
  }
  const oldGet=masterControlRemoteGet;
  masterControlRemoteGet=async function(rec){
    if(!masterIsOrder(rec))return oldGet.apply(this,arguments);
    patchRecord(rec);
    const result=await jsonFetch(rec.controlApiUrl);
    return remoteControl(rec,result.control);
  };
  masterOrderUsageFetch=async function(rec){
    if(!masterIsOrder(rec))return rec;
    patchRecord(rec);
    const [usageResult,controlResult]=await Promise.allSettled([
      jsonFetch(rec.usageApiUrl),masterControlRemoteGet(rec)
    ]);
    if(controlResult.status==='fulfilled'){
      rec.remote=controlResult.value;rec.status=rec.remote.status;
      rec.expiresAt=rec.remote.expires_at||'';rec.unlimited=!rec.expiresAt;
    }
    if(usageResult.status==='rejected'){
      rec.usageError=usageResult.reason.message;rec.usageStatus='unconnected';
      throw usageResult.reason;
    }
    const usage=usageResult.value.usage||usageResult.value;
    if(String(usage.tenant||'')!==tenant(rec))throw new Error('Nguồn dung lượng trả về sai nhà phân phối.');
    const finite=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0;
    if(finite(usage.appBytes)){rec.fileBytes=Number(usage.appBytes);rec.fileMeasured=true}
    if(finite(usage.databaseBytes??usage.stateBytes)){rec.databaseBytes=Number(usage.databaseBytes??usage.stateBytes);rec.dataBytes=rec.databaseBytes;rec.databaseMeasured=true}
    if(finite(usage.imageBytes)){rec.imageBytes=Number(usage.imageBytes);rec.imageMeasured=true}
    rec.usageCheckedAt=new Date().toISOString();rec.usageError='';
    rec.usageStatus=controlResult.status==='fulfilled'&&rec.fileMeasured&&rec.databaseMeasured&&rec.imageMeasured?'ok':'partial';
    rec.version=String(usage.version||MASTER_ORDER_VERSION);rec.targetVersion=rec.version;
    rec.remote={...(rec.remote||{}),last_client_version:rec.version,last_data_bytes:rec.databaseBytes,
      last_seen_at:usage.updatedAt||null,last_checked_at:rec.usageCheckedAt};
    rec.orderCounts=usage.counts||{};
    if(controlResult.status==='rejected')throw controlResult.reason;
    return rec;
  };
  function login(rec){
    if(authDialogPromise)return authDialogPromise;
    authDialogPromise=new Promise((resolve,reject)=>{
      const dialog=document.createElement('dialog');
      dialog.style.cssText='width:min(420px,90vw);border:1px solid #cad6de;border-radius:14px;padding:22px;color:#17324d';
      dialog.innerHTML='<form><h3 style="margin:0 0 12px">Kết nối quản trị Order</h3><p style="font-size:14px">Nhập tài khoản quản trị của app Order để lưu trạng thái hoặc hạn dùng.</p><label>Số điện thoại<input name="phone" type="tel" autocomplete="username" required style="display:block;width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px"></label><label>PIN quản trị Order<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required style="display:block;width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px"></label><div role="alert" style="font-size:14px;color:#b43c3c;margin-bottom:12px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn">Hủy</button><button type="submit" class="btn primary">Kết nối</button></div></form>';
      const form=dialog.querySelector('form'),phone=form.elements.phone,pin=form.elements.pin,submit=form.querySelector('[type=submit]'),error=form.querySelector('[role=alert]');
      phone.value=rec.managerPhone||'';
      function cleanup(){pin.value='';dialog.close();dialog.remove();authDialogPromise=null}
      function cancel(event){if(event)event.preventDefault();cleanup();reject(new Error('Chưa kết nối quyền quản trị Order. Trạng thái online chưa thay đổi.'))}
      dialog.addEventListener('cancel',cancel);form.querySelector('[type=button]').onclick=cancel;
      form.onsubmit=async event=>{
        event.preventDefault();submit.disabled=true;error.textContent='Đang kiểm tra...';
        try{
          const result=await jsonFetch(api(rec,'/api/admin-state'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'login',phone:phone.value.trim(),pin:pin.value.trim()})});
          if(!result.token)throw new Error('Chưa nhận được phiên quản trị.');
          sessionStorage.setItem(AUTH_KEY+tenant(rec),result.token);cleanup();resolve(result.token);
        }catch(e){error.textContent=e.message;submit.disabled=false}
      };
      document.body.appendChild(dialog);dialog.showModal();phone.focus();
    });
    return authDialogPromise;
  }
  const oldSet=masterControlRemoteSet;
  masterControlRemoteSet=async function(rec){
    if(!masterIsOrder(rec))return oldSet.apply(this,arguments);
    patchRecord(rec);
    if(!['active','locked'].includes(rec.status))throw new Error('Trạng thái Order không hợp lệ.');
    const status=rec.status,expiresAt=rec.unlimited?'':String(rec.expiresAt||'');
    if(expiresAt&&!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))throw new Error('Ngày hết hạn không hợp lệ.');
    let token;
    try{token=sessionStorage.getItem(AUTH_KEY+tenant(rec))||await login(rec)}
    catch(e){
      try{rec.remote=await masterControlRemoteGet(rec);rec.status=rec.remote.status;rec.expiresAt=rec.remote.expires_at;rec.unlimited=!rec.expiresAt;masterRegistryUpsert(rec)}catch(_){}
      throw e;
    }
    for(let attempt=0;attempt<2;attempt++){
      try{
        const result=await jsonFetch(rec.controlApiUrl,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({status,expiresAt})});
        const remote=remoteControl(rec,result.control);
        if(remote.status!==status||remote.expires_at!==expiresAt)throw new Error('App Order chưa xác nhận đúng cài đặt.');
        rec.remote=remote;rec.status=remote.status;rec.expiresAt=remote.expires_at;
        masterRegistryUpsert(rec);return remote;
      }catch(e){
        if(e.status===401&&attempt===0){sessionStorage.removeItem(AUTH_KEY+tenant(rec));token=await login(rec);continue}
        try{rec.remote=await masterControlRemoteGet(rec);rec.status=rec.remote.status;rec.expiresAt=rec.remote.expires_at;rec.unlimited=!rec.expiresAt;masterRegistryUpsert(rec)}catch(_){}
        throw e;
      }
    }
  };
  const oldApplyStatus=masterApplyStatusOnline;
  masterApplyStatusOnline=async function(rec){
    if(!masterIsOrder(rec))return oldApplyStatus.apply(this,arguments);
    const expected=rec.status;
    await masterControlRemoteSet(rec);
    await masterVerifyControlState(rec,expected);
    masterRegistryUpsert(rec);return rec.remote;
  };
  const oldRefreshOne=masterRefreshOne;
  masterRefreshOne=async function(id){
    const rec=masterRegistryLoad().find(item=>item.appId===id);
    if(!rec||!masterIsOrder(rec))return oldRefreshOne.apply(this,arguments);
    try{await masterOrderUsageFetch(rec);masterRegistryUpsert(rec);toast('Đã đọc trạng thái và dung lượng Order online')}
    catch(e){masterRegistryUpsert(rec);toast('Chưa kết nối đủ dữ liệu Order: '+e.message)}
    renderMasterControl();if(masterSelectedAppId===id)renderMasterNpp();
  };
  masterRefreshAll=async function(){
    for(const rec of masterRegistryLoad())if(rec.online)await masterRefreshOne(rec.appId);
    renderMasterControl();if(masterSelectedAppId)renderMasterNpp();
  };
  const oldEnsure=masterEnsureOrder;
  masterEnsureOrder=function(){const rec=oldEnsure.apply(this,arguments);if(rec){patchRecord(rec);masterRegistryUpsert(rec)}return rec};
  const oldRender=renderMasterNpp;
  renderMasterNpp=function(){
    const result=oldRender.apply(this,arguments),rec=masterRegistrySelected();
    if(rec&&masterIsOrder(rec)){
      const status=document.getElementById('masterNppStatus');
      if(status)status.value=rec.remote?.status||rec.status||'active';
      const expires=document.getElementById('masterNppExpires');
      if(expires)expires.value=String(rec.remote?.expires_at??rec.expiresAt??'').slice(0,10);
      const syncNote=document.getElementById('masterNppStatusSync');
      if(syncNote&&rec.remote?.last_checked_at)syncNote.textContent=rec.remote.status==='locked'?'Máy chủ Order xác nhận: ĐÃ KHÓA. Chọn Hoạt động để mở lại.':'Máy chủ Order xác nhận: ĐANG HOẠT ĐỘNG.';
      const note=document.getElementById('masterOrderUsageStatus');
      if(note)note.textContent=rec.usageStatus==='ok'?'Đã đọc trực tiếp từ Order: App / Dữ liệu / Hình ảnh.':'Bấm Kiểm tra dung lượng thật để đọc trực tiếp app Order.';
    }
    return result;
  };
  function migrate(){
    if(!APP_CONFIG.isMaster)return;
    masterEnsureOrder(false);
    for(const rec of masterRegistryLoad())if(masterIsOrder(rec)){patchRecord(rec);masterRegistryUpsert(rec)}
    renderMasterControl();
  }
  migrate();
  // Read-only startup refresh; authentication is requested only for writes.
  setTimeout(()=>{if(APP_CONFIG.isMaster){const rec=masterRegistryLoad().find(r=>r.appId==='SMART_ORDER_NGOC_TRAI');if(rec)masterRefreshOne(rec.appId)}},1500);
})();

