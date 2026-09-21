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
function showApp(user){currentUserEmail=user.email;q("#loginScreen").classList.add("hidden");q("#resetScreen").classList.add("hidden");q("#appScreen").classList.remove("hidden");q("#userEmail").textContent=user.email;q("#connStatus").textContent="Supabase conectado";checkWarrantyAlerts();checkPendentesBadge();checkReposicaoBadge();populateModeloPicker();if(!appInitialized){appInitialized=true;goScreen("home")}}

// ---- Navegação entre telas ----
// Texto literal dentro de um ilike (sem tratar % e _ como curinga).
function likeLiteral(s){return String(s).replace(/[\\%_]/g,"\\$&")}

// O Supabase devolve no máximo 1000 linhas por consulta, mesmo com .limit(5000).
// Pra listas que precisam vir completas, busca página por página.
async function fetchAllRows(montarConsulta){
  const PAGINA=1000, todas=[];
  for(let de=0;;de+=PAGINA){
    const r=await montarConsulta(de,de+PAGINA-1);
    if(r.error) throw r.error;
    const linhas=r.data||[];
    todas.push(...linhas);
    if(linhas.length<PAGINA) return todas;
  }
}

// Cada troca de tela vira uma entrada no histórico do navegador, senão o
// botão "voltar" do celular não tem pra onde voltar dentro do app e acaba
// saindo direto do site.
const SCREENS=["home","obras","obraDetalhe","wizard","copiar","search","detail","aprovacoes","catalogo","componentes","reposicao"];
function renderScreen(name){
  if(!SCREENS.includes(name)) name="home";
  SCREENS.forEach(s=>q("#screen"+s[0].toUpperCase()+s.slice(1)).classList.toggle("hidden",s!==name));
  q("#msg").innerHTML="";
  if(name==="wizard" && !wizPularParaCarrinho) wizStep(1);
  if(name==="catalogo"){q("#modelosList").innerHTML="<div class='small'>Digite algo acima pra buscar.</div>";novoModeloForm();}
  if(name==="aprovacoes"){loadPendentes();loadAprovadas();loadRejeitadas();}
  if(name==="reposicao"){loadReposicoes();loadReposicoesResolvidas();}
  if(name==="obras"){q("#obrasSearch").value="";loadObras();}
  if(name==="copiar") prepararTelaCopia();
  if(name==="componentes"){q("#compSearch").value="";q("#compList").innerHTML="<div class='small'>Digite algo acima pra buscar.</div>";onCompTipoChange();limparCompModelos();carregarModelosParaCompat();}
  if(name==="home"){checkPendentesBadge();checkReposicaoBadge();}
}
function goScreen(name){
  if(!SCREENS.includes(name)) name="home";
  history.pushState({screen:name},"","#"+name);
  renderScreen(name);
}
window.addEventListener("popstate",e=>{
  renderScreen(e.state&&e.state.screen);
});
