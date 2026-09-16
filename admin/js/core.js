const sb=supabase.createClient(LUMIDNA_SUPABASE_URL,LUMIDNA_SUPABASE_KEY);
let LID=null, luminariaDbId=null, currentUserEmail=null, originalData=null;
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
function esc(s){return (s??"").toString().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

// ---- Auth ----
function loginMsg(t,ok=true){q("#loginMsg").innerHTML=`<div class="${ok?"success":"alert"}">${t}</div>`}
q("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  const email=q("#loginEmail").value.trim(), password=q("#loginPassword").value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error) loginMsg("Erro ao entrar: "+error.message,false);
};
function logout(){sb.auth.signOut()}
function showLogin(){q("#loginScreen").classList.remove("hidden");q("#resetScreen").classList.add("hidden");q("#appScreen").classList.add("hidden")}
let appInitialized=false;
function showApp(user){currentUserEmail=user.email;q("#loginScreen").classList.add("hidden");q("#resetScreen").classList.add("hidden");q("#appScreen").classList.remove("hidden");q("#userEmail").textContent=user.email;q("#connStatus").textContent="Supabase conectado";checkWarrantyAlerts();checkPendentesBadge();populateModeloPicker();if(!appInitialized){appInitialized=true;goScreen("home")}}

// ---- Navegação entre telas ----
const SCREENS=["home","obras","obraDetalhe","wizard","avulsa","search","detail","aprovacoes","catalogo","componentes"];
function goScreen(name){
  SCREENS.forEach(s=>q("#screen"+s[0].toUpperCase()+s.slice(1)).classList.toggle("hidden",s!==name));
  q("#msg").innerHTML="";
  if(name==="wizard" && !wizPularParaCarrinho) wizStep(1);
  if(name==="catalogo") q("#modelosList").innerHTML="<div class='small'>Digite algo acima pra buscar.</div>";
  if(name==="aprovacoes"){loadPendentes();loadAprovadas();loadRejeitadas();}
  if(name==="obras"){q("#obrasSearch").value="";loadObras();}
  if(name==="componentes"){q("#compSearch").value="";q("#compList").innerHTML="<div class='small'>Digite algo acima pra buscar.</div>";onCompTipoChange();}
}
