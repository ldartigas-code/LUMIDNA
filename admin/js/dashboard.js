// ---- Alerta de garantias vencendo ----
async function checkWarrantyAlerts(){
  const today=new Date().toISOString().slice(0,10);
  const in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const r=await sb.from("garantias").select("tipo,fim,luminarias(lumidna_id,modelo,cliente)").eq("status","Ativa").gte("fim",today).lte("fim",in30).order("fim");
  const box=q("#alertBox");
  if(r.error||!r.data||!r.data.length){box.innerHTML="";return}
  box.innerHTML=`<div class="card" style="border-left:4px solid var(--orange)"><b>⚠️ ${r.data.length} garantia(s) vencendo nos próximos 30 dias</b><table style="margin-top:10px"><tr><th>Luminária</th><th>Cliente</th><th>Tipo</th><th>Vence em</th></tr>${r.data.map(x=>`<tr><td>${esc(x.luminarias?.lumidna_id)}</td><td>${esc(x.luminarias?.cliente)||"—"}</td><td>${esc(x.tipo)}</td><td>${esc(x.fim)}</td></tr>`).join("")}</table></div>`;
}
function showReset(){q("#loginScreen").classList.add("hidden");q("#appScreen").classList.add("hidden");q("#resetScreen").classList.remove("hidden")}
function resetMsg(t,ok=true){q("#resetMsg").innerHTML=`<div class="${ok?"success":"alert"}">${t}</div>`}
q("#resetForm").onsubmit=async e=>{
  e.preventDefault();
  const p1=q("#resetPassword").value, p2=q("#resetPassword2").value;
  if(p1!==p2) return resetMsg("As senhas não coincidem.",false);
  const {error}=await sb.auth.updateUser({password:p1});
  if(error) return resetMsg("Erro: "+error.message,false);
  resetMsg("Senha atualizada. Você já está logado.");
  setTimeout(()=>sb.auth.getSession().then(({data:{session}})=>session&&showApp(session.user)),800);
};
sb.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY") return showReset();
  session?showApp(session.user):showLogin();
});
sb.auth.getSession().then(({data:{session}})=>{session?showApp(session.user):showLogin()});

function msg(t,ok=true){q("#msg").innerHTML=`<div class="${ok?"success":"alert"}">${t}</div>`;q("#msg").scrollIntoView({behavior:"smooth",block:"center"})}
function norm(v){return v===""?null:v}
