// ---- Obras ----
let obraAtual=null;
let obrasSearchTimer=null;
function onObrasSearchInput(){clearTimeout(obrasSearchTimer);obrasSearchTimer=setTimeout(loadObras,300)}

// Prefixo curto da obra (ex: Parque das Cerejeiras -> PDC): vira a parte do
// meio do ID das peças (LD-PDC-000001).
function sugerirPrefixo(nome){
  const words=(nome||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z0-9 ]/g," ").split(/\s+/).filter(Boolean);
  if(!words.length) return "";
  let p=words.map(w=>w[0]).join("");
  if(p.length<2) p=words[0].slice(0,3);
  return p.slice(0,6);
}
function normalizarPrefixo(v){return (v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)}
function onObraNomeInput(nomeId,prefId){
  const p=q("#"+prefId);
  if(p.dataset.manual) return;
  p.value=sugerirPrefixo(q("#"+nomeId).value);
}
function onObraPrefixoInput(prefId){
  const p=q("#"+prefId);
  p.value=normalizarPrefixo(p.value);
  p.dataset.manual=p.value?"1":"";
}
async function validarPrefixoObra(prefixo,ignorarId){
  if(!/^[A-Z0-9]{2,6}$/.test(prefixo)) return "O prefixo precisa ter de 2 a 6 letras ou números (ex: PDC).";
  let qy=sb.from("obras").select("id,nome").eq("prefixo",prefixo).limit(1);
  if(ignorarId) qy=qy.neq("id",ignorarId);
  const r=await qy;
  if(r.data&&r.data.length) return `O prefixo ${prefixo} já é da obra "${r.data[0].nome}". Escolha outro.`;
  return null;
}

function onNovaObraAutomacaoChange(){
  q("#obra_protocolo_field").classList.toggle("hidden",q("#obra_automacao").value!=="sim");
}

async function loadObras(){
  const term=q("#obrasSearch").value.trim();
  const box=q("#obrasList");
  let query=sb.from("obras").select("*,luminarias(count)").order("nome");
  if(term) query=query.or(`nome.ilike.%${term}%,cliente.ilike.%${term}%`);
  const r=await query;
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(o=>`<button type="button" class="bigOption" onclick="abrirObra(${o.id})"><span class="ic">📁</span><span><b style="font-size:15px">${esc(o.nome)}</b><small>Obra ${o.numero} · ${esc(o.prefixo)} · ${esc(o.cliente)||"—"} · ${o.luminarias?.[0]?.count??0} peça(s)</small></span></button>`).join(""):"<div class='small'>Nenhuma obra cadastrada ainda.</div>";
}

async function criarObra(){
  const nome=q("#obra_nome").value.trim();
  if(!nome) return msg("Informe o nome da obra.",false);
  const prefixo=normalizarPrefixo(q("#obra_prefixo").value);
  const erroPrefixo=await validarPrefixoObra(prefixo);
  if(erroPrefixo) return msg(erroPrefixo,false);
  const temAutomacao=q("#obra_automacao").value==="sim";
  const p={nome,prefixo,cliente:norm(q("#obra_cliente").value.trim()),cliente_email:norm(q("#obra_cliente_email").value.trim()),tensao_instalacao:norm(q("#obra_tensao").value),automacao:temAutomacao,protocolo_automacao:temAutomacao?q("#obra_protocolo").value:null};
  const r=await sb.from("obras").insert(p).select().single();
  if(r.error) return msg("Erro ao criar obra: "+r.error.message,false);
  q("#obra_nome").value="";q("#obra_prefixo").value="";q("#obra_prefixo").dataset.manual="";q("#obra_cliente").value="";q("#obra_cliente_email").value="";q("#obra_tensao").value="";q("#obra_automacao").value="nao";q("#obra_protocolo_field").classList.add("hidden");
  msg("Obra criada.");
  abrirObra(r.data.id);
}

async function abrirObra(id){
  if(!id) return goScreen("obras");
  const r=await sb.from("obras").select("*").eq("id",id).single();
  if(r.error) return msg(r.error.message,false);
  obraAtual=r.data;
  goScreen("obraDetalhe");
  q("#obraDetalheHeader").innerHTML=`<h2 style="margin:0 0 8px">${esc(obraAtual.nome)}</h2><div class="small" style="margin-bottom:4px">Obra ${obraAtual.numero} · prefixo <b>${esc(obraAtual.prefixo)}</b> · as peças saem como LD-${esc(obraAtual.prefixo)}-000001</div><div class="small">${obraAtual.cliente?"Cliente: "+esc(obraAtual.cliente)+" · ":""}${obraAtual.tensao_instalacao?"Tensão: "+esc(obraAtual.tensao_instalacao)+" · ":""}${obraAtual.automacao?"Automação: "+esc(obraAtual.protocolo_automacao):"Sem automação"}</div>`;
  loadObraPecas();
  loadObraPendentes();
}

function abrirEdicaoObra(){
  if(!obraAtual) return;
  q("#eo_nome").value=obraAtual.nome||"";
  q("#eo_prefixo").value=obraAtual.prefixo||"";
  q("#eo_cliente").value=obraAtual.cliente||"";
  q("#eo_cliente_email").value=obraAtual.cliente_email||"";
  q("#eo_aplicar_pecas").checked=true;
  q("#eo_tensao").value=obraAtual.tensao_instalacao||"";
  q("#eo_automacao").value=obraAtual.automacao?"sim":"nao";
  q("#eo_protocolo").value=obraAtual.protocolo_automacao||"DALI";
  onEditarObraAutomacaoChange();
  q("#editarObraCard").classList.remove("hidden");
}
function fecharEdicaoObra(){
  q("#editarObraCard").classList.add("hidden");
}
function onEditarObraAutomacaoChange(){
  q("#eo_protocolo_field").classList.toggle("hidden", q("#eo_automacao").value!=="sim");
}
async function salvarEdicaoObra(){
  const nome=q("#eo_nome").value.trim();
  if(!nome) return msg("Informe o nome da obra.",false);
  const prefixo=normalizarPrefixo(q("#eo_prefixo").value);
  const erroPrefixo=await validarPrefixoObra(prefixo,obraAtual.id);
  if(erroPrefixo) return msg(erroPrefixo,false);
  const temAutomacao=q("#eo_automacao").value==="sim";
  const p={
    nome, prefixo, cliente:norm(q("#eo_cliente").value.trim()),
    cliente_email:norm(q("#eo_cliente_email").value.trim()),
    tensao_instalacao:norm(q("#eo_tensao").value),
    automacao:temAutomacao,
    protocolo_automacao:temAutomacao?q("#eo_protocolo").value:null
  };
  const r=await sb.from("obras").update(p).eq("id",obraAtual.id);
  if(r.error) return msg("Erro: "+r.error.message,false);
  if(q("#eo_aplicar_pecas").checked){
    const nasPecas={
      empreendimento:p.nome, cliente:p.cliente,
      tensao_instalacao:p.tensao_instalacao, automacao:p.automacao, protocolo_automacao:p.protocolo_automacao
    };
    if(p.cliente_email) nasPecas.cliente_email=p.cliente_email;
    const r2=await sb.from("luminarias").update(nasPecas).eq("obra_id",obraAtual.id);
    if(r2.error) return msg("Obra atualizada, mas houve erro ao aplicar nas peças: "+r2.error.message,false);
  }
  fecharEdicaoObra();
  msg("Obra atualizada.");
  abrirObra(obraAtual.id);
}

function cadastrarMaisNestaObra(){
  if(!obraAtual) return;
  wizObraId=obraAtual.id;
  wizObraPrefixo=obraAtual.prefixo;
  wizObra=wizObraDe(obraAtual);
  wizPularParaCarrinho=true;
  goScreen("wizard");
  wizPularParaCarrinho=false;
  wizEntrarNoCarrinho();
}

async function loadObraPecas(){
  const box=q("#obraPecasList");
  const r=await sb.from("luminarias").select("lumidna_id,modelo,fabricante,status,edificio,andar,ambiente,posicao").eq("obra_id",obraAtual.id).order("lumidna_id").limit(2000);
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  if(!rows.length){box.innerHTML="<div class='small'>Nenhuma peça cadastrada nesta obra ainda.</div>";return}
  box.innerHTML=`<table><tr><th>ID</th><th>Modelo</th><th>Local</th><th>Status</th><th></th></tr>${rows.map(x=>{
    const local=[x.edificio,x.andar,x.ambiente,x.posicao].filter(Boolean).join(" / ");
    return `<tr><td>${esc(x.lumidna_id)}</td><td>${esc(x.modelo)||"—"}</td><td>${esc(local)||"—"}</td><td>${esc(x.status)||"—"}</td><td><button type="button" class="secondary" onclick="loadById('${x.lumidna_id}')">Abrir</button></td></tr>`;
  }).join("")}</table>`;
}

async function loadObraPendentes(){
  const box=q("#obraPendentesList");
  const r=await sb.from("manutencoes_pendentes").select("*,luminarias!inner(lumidna_id,modelo,cliente,obra_id)").eq("status","Aguardando aprovação").eq("luminarias.obra_id",obraAtual.id).order("criado_em",{ascending:false});
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(p=>`<div class="card"><b>${esc(p.luminarias?.lumidna_id)}</b> — enviado por ${esc(p.responsavel)} (${esc(p.empresa)})<div class="actions" style="margin-top:8px"><button type="button" class="secondary" onclick="goScreen('aprovacoes')">Ver em Aprovações pendentes</button></div></div>`).join("") : "<div class='small'>Nenhuma aprovação pendente nesta obra.</div>";
}

