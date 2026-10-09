from pathlib import Path
p=Path("index.html")
s=p.read_text(encoding="utf-8")
def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit("Không tìm thấy: "+label)
    s=s.replace(old,new,1)

rep("""      <div><label>SĐT quản trị *</label><input id="orderChildAdminPhone" type="tel" inputmode="tel" placeholder="VD: 0913969688"></div>
      <div><label>PIN quản trị *</label><input id="orderChildManagerPin" type="text" inputmode="numeric" maxlength="6" placeholder="4–6 số"></div>
      <div class="full"><div class="small" style="padding:9px 11px;border:1px solid #f0c36a;background:#fff9e8;border-radius:9px">Master sẽ lưu SĐT + PIN quản trị cho app con và đưa SĐT vào link Quản trị. Việc đăng nhập online vẫn cần lõi Smart Order/API của tenant chấp nhận đúng tài khoản này.</div></div>""",
"""      <div><label>SĐT quản trị khởi tạo</label><input id="orderChildAdminPhone" type="tel" value="0913969688" readonly style="background:#f1f5f9"></div>
      <div><label>PIN quản trị khởi tạo</label><input id="orderChildManagerPin" type="text" value="1111" readonly style="background:#f1f5f9"></div>
      <div class="full"><div class="small" style="padding:9px 11px;border:1px solid #a7d7b7;background:#f1fff5;border-radius:9px"><b>App Order con dùng tài khoản khởi tạo của lõi Order:</b> 0913969688 / 1111. Sau khi vào Quản trị có thể đổi PIN trong App Order. Không đặt PIN 3 số ở Master.</div></div>""","builder defaults")

rep("""    const adminPhone=String(document.getElementById('orderChildAdminPhone')?.value||'').trim();
    const managerPin=String(document.getElementById('orderChildManagerPin')?.value||'').trim();""",
"""    const adminPhone='0913969688';
    const managerPin='1111';""","fixed bootstrap credentials")

rep("""    if(!/^0\d{8,10}$/.test(adminPhone))throw new Error('SĐT quản trị chưa đúng định dạng.');
    if(!/^\d{4,6}$/.test(managerPin))throw new Error('PIN quản trị phải gồm 4–6 số.');""",
"""    if(!/^0\d{8,10}$/.test(adminPhone))throw new Error('SĐT quản trị khởi tạo chưa đúng.');
    if(!/^\d{4}$/.test(managerPin))throw new Error('PIN quản trị khởi tạo phải đủ 4 số.');""","validation")

rep("""const rec={appId,remoteAppId:appId,appName,unitName,nppId,adminPhone,phone:adminPhone,managerPin,appType:'order-child',""",
"""const rec={appId,remoteAppId:appId,appName,unitName,nppId,adminPhone,phone:adminPhone,managerPhone:adminPhone,managerPin,appType:'order-child',""","record manager phone")



rep("""  if($('masterOrderAdminPhone'))$('masterOrderAdminPhone').value=masterIsOrder(rec)?String(rec.adminPhone||rec.phone||''):'';
  if($('masterManagerPinWrap'))$('masterManagerPinWrap').style.display='';
  if($('masterManagerPin')){const mp=String(rec.managerPin||(rec.externalKey==='an-bui'?'8579':'1234'));$('masterManagerPin').value=mp;$('masterManagerPin').dataset.initial=mp;}
  if($('masterManagerPinNote'))$('masterManagerPinNote').textContent=masterIsOrder(rec)?'PIN quản trị Order lưu trong Master để quản lý app con.':'Dùng khi chuyển sang quyền Quản lý trong app.';""",
"""  if($('masterOrderAdminPhone')){const el=$('masterOrderAdminPhone');el.value=masterIsOrder(rec)?'0913969688':'';el.readOnly=masterIsOrder(rec);if(masterIsOrder(rec))el.style.background='#f1f5f9';}
  if($('masterManagerPinWrap'))$('masterManagerPinWrap').style.display='';
  if(masterIsOrder(rec)){rec.adminPhone='0913969688';rec.phone='0913969688';rec.managerPhone='0913969688';if(!/^\\d{4,8}$/.test(String(rec.managerPin||'')))rec.managerPin='1111';}
  if($('masterManagerPin')){const mp=String(rec.managerPin||(rec.externalKey==='an-bui'?'8579':'1234'));$('masterManagerPin').value=mp;$('masterManagerPin').dataset.initial=mp;$('masterManagerPin').readOnly=masterIsOrder(rec);$('masterManagerPin').style.background=masterIsOrder(rec)?'#f1f5f9':'';}
  if($('masterManagerPinNote'))$('masterManagerPinNote').textContent=masterIsOrder(rec)?'App Order con khởi tạo bằng 0913969688 / 1111. Muốn đổi PIN, vào Cài đặt trong App Order.':'Dùng khi chuyển sang quyền Quản lý trong app.';""","render fixed credentials")

rep("""  if(masterIsOrder(rec)&&$('masterOrderAdminPhone')){const ph=String($('masterOrderAdminPhone').value||'').trim();if(ph){rec.adminPhone=ph;rec.phone=ph;}}
  if($('masterManagerPin')){const p=String($('masterManagerPin').value||'').trim();if(/^\d{4,8}$/.test(p))rec.managerPin=p}""",
"""  if(masterIsOrder(rec)){rec.adminPhone='0913969688';rec.phone='0913969688';rec.managerPhone='0913969688';if(!/^\\d{4,8}$/.test(String(rec.managerPin||'')))rec.managerPin='1111';}
  if(!masterIsOrder(rec)&&$('masterManagerPin')){const p=String($('masterManagerPin').value||'').trim();if(/^\\d{4,8}$/.test(p))rec.managerPin=p}""","collect fixed order credentials")

rep("""  const managerPin=String($('masterManagerPin')?.value||rec.managerPin||'').trim();""",
"""  const managerPin=masterIsOrder(rec)?String(rec.managerPin||'1111'):String($('masterManagerPin')?.value||rec.managerPin||'').trim();""","save fixed pin")

rep("""  rec.managerPin=managerPin;
  if(masterIsOrder(rec)){const ph=String($('masterOrderAdminPhone')?.value||rec.adminPhone||rec.phone||'').trim();if(ph){rec.adminPhone=ph;rec.phone=ph;}rec.publicUrl=masterOrderChildUrl(rec,false);rec.managerUrl=masterOrderChildUrl(rec,true);}""",
"""  rec.managerPin=managerPin;
  if(masterIsOrder(rec)){rec.adminPhone='0913969688';rec.phone='0913969688';rec.managerPhone='0913969688';rec.publicUrl=masterOrderChildUrl(rec,false);rec.managerUrl=masterOrderChildUrl(rec,true);}""","save order bootstrap")

s=s.replace("V218","V219")
p.write_text(s,encoding="utf-8")
vp=Path("VERSION.txt")
if vp.exists(): vp.write_text(vp.read_text(encoding="utf-8").replace("V218","V219"),encoding="utf-8")
