// ---- Catálogo de Modelos ----
// O modelo é a ÚNICA fonte dos dados técnicos (potência, CCT, IRC, fluxo,
// facho, IP, IK). Cada peça guarda uma cópia desses valores (é o que a página
// pública lê), mas ninguém digita isso na peça: quando o modelo muda aqui, as
// peças ligadas a ele acompanham (propagarModelosParaPecas).

async function populateModeloPicker(){
  const sel=q("#modeloPicker");
  if(!sel) return;
  let modelos=[];
  try{ modelos=await fetchAllRows((de,ate)=>sb.from("modelos").select("id,fabricante,codigo").order("fabricante").order("codigo").order("id").range(de,ate)); }catch(e){}
  const current=sel.value;
  sel.innerHTML='<option value="">— escolha o modelo —</option>'+modelos.map(m=>`<option value="${m.id}">${esc(m.fabricante)||"?"} — ${esc(m.codigo)}</option>`).join("");
  sel.value=current;
}

const CAMPOS_DO_MODELO_NA_PECA=["potencia_w","cct_k","irc","fluxo_lm","facho_graus","ip","ik"];
function dadosDoModeloParaPeca(m){
  const d={modelo:m.codigo,fabricante:m.fabricante};
  CAMPOS_DO_MODELO_NA_PECA.forEach(k=>d[k]=m[k]??null);
  return d;
}

// Troca o modelo da peça que está aberta (grava na hora e registra no histórico).
async function trocarModeloDaPeca(){
  const id=q("#modeloPicker").value;
  if(!LID) return msg("Abra uma peça primeiro.",false);
  if(!id) return msg("Escolha o modelo na lista.",false);
  const r=await sb.from("modelos").select("*").eq("id",id).single();
  if(r.error) return msg("Erro: "+r.error.message,false);
  const m=r.data;
  if(!confirm(`Trocar o modelo desta peça para ${m.fabricante||""} ${m.codigo}?\nOs dados técnicos da peça passam a ser os desse modelo.`)) return;
  const novo={modelo_id:m.id,...dadosDoModeloParaPeca(m)};
  const u=await sb.from("luminarias").update(novo).eq("id",luminariaDbId);
  if(u.error) return msg("Erro: "+u.error.message,false);
  for(const k of Object.keys(novo)) await logAudit(k,originalData?originalData[k]:null,novo[k]);
  originalData={...originalData,...novo};
  q("input[name=modelo_id]").value=m.id;
  await renderModeloEObra(originalData);
  await loadComponents();
  await loadAudit();
  msg(`Modelo trocado para ${m.fabricante||""} ${m.codigo}.`);
}

let modeloSearchTimer=null;
function onModeloSearchInput(){
  clearTimeout(modeloSearchTimer);
  modeloSearchTimer=setTimeout(loadModelos,300);
}

async function loadModelos(){
  const term=q("#modeloSearch").value.trim();
  const box=q("#modelosList");
  try{
    lastModelosRows=await fetchAllRows((de,ate)=>{
      let query=sb.from("modelos").select("*").order("fabricante").order("codigo").order("id").range(de,ate);
      if(term) query=query.or(`fabricante.ilike.%${term}%,linha.ilike.%${term}%,codigo.ilike.%${term}%,descricao.ilike.%${term}%`);
      return query;
    });
  }catch(e){box.innerHTML="<div class='small'>Erro: "+esc(e.message)+"</div>";return}
  renderModelosList();
}

let lastModelosRows=[];
let modelosSort={col:"fabricante",dir:1};
const MODELOS_COLS=[["fabricante","Fabricante"],["linha","Linha"],["codigo","Código"],["descricao","Descrição"],["potencia_w","Potência"],["cct_k","CCT"],["fluxo_lm","Fluxo"],["facho_graus","Facho"]];

function renderModelosList(){
  const box=q("#modelosList");
  const rows=lastModelosRows;
  if(!rows.length){box.innerHTML="<div class='small'>Nenhum modelo encontrado.</div>";return}
  const sorted=[...rows].sort((a,b)=>{
    const av=(a[modelosSort.col]??"").toString().toLowerCase(), bv=(b[modelosSort.col]??"").toString().toLowerCase();
    return av<bv?-1*modelosSort.dir:av>bv?1*modelosSort.dir:0;
  });
  const arrow=(col)=>col!==modelosSort.col?"":(modelosSort.dir===1?" ▲":" ▼");
  box.innerHTML = `<table><tr><th>Foto</th>${MODELOS_COLS.map(([col,label])=>`<th style="cursor:pointer;user-select:none" onclick="sortModelosList('${col}')">${label}${arrow(col)}</th>`).join("")}<th></th></tr>${sorted.map(m=>`<tr><td>${m.imagem_url?`<img src="${esc(m.imagem_url)}" alt="" style="width:44px;height:44px;object-fit:contain;border:1px solid #eee;border-radius:4px">`:`<span class="small" style="color:#bbb">—</span>`}</td><td>${esc(m.fabricante)}</td><td>${esc(m.linha)}</td><td>${esc(m.codigo)}</td><td>${esc(m.descricao)}</td><td>${m.potencia_w??"—"}W</td><td>${m.cct_k??"—"}</td><td>${m.fluxo_lm??"—"}lm</td><td>${m.facho_graus??"—"}°</td><td><button type="button" class="secondary" onclick="editarModelo(${m.id})">Editar</button> <button type="button" class="secondary" onclick="startWizardWithModelo(${m.id})">Cadastrar peças ▸</button></td></tr>`).join("")}</table>`;
}

function sortModelosList(col){
  modelosSort.dir=(modelosSort.col===col)?-modelosSort.dir:1;
  modelosSort.col=col;
  renderModelosList();
}

// Acha o modelo pelo par fabricante + código (sem diferenciar maiúscula:
// LDARTI, Ldarti e ldarti são o mesmo fabricante); se não existir, cria.
async function garantirModeloNoCatalogo(c){
  const ex=await sb.from("modelos").select("id,fabricante").ilike("fabricante",likeLiteral(c.fabricante)).ilike("codigo",likeLiteral(c.codigo)).limit(1);
  if(ex.error) return {erro:ex.error.message};
  if(ex.data&&ex.data.length) return {id:ex.data[0].id,criado:false};
  const fab=await sb.from("modelos").select("fabricante").ilike("fabricante",likeLiteral(c.fabricante)).limit(1);
  const grafiaFabricante=(fab.data&&fab.data.length)?fab.data[0].fabricante:c.fabricante;
  const r=await sb.from("modelos").insert({
    fabricante:grafiaFabricante,codigo:c.codigo,
    potencia_w:c.potencia_w??null,cct_k:c.cct_k??null,irc:c.irc??null,fluxo_lm:c.fluxo_lm??null,facho_graus:c.facho_graus??null,
    ip:c.ip??null,ik:c.ik??null,tipo_montagem:c.tipo_montagem??null
  }).select("id").single();
  if(r.error) return {erro:r.error.message};
  return {id:r.data.id,criado:true};
}

// Quando um modelo é editado, as peças ligadas a ele recebem os dados novos.
async function propagarModelosParaPecas(modelos){
  const ids=modelos.map(m=>m.id);
  let atualizadas=0;
  for(let i=0;i<ids.length;i+=100){
    const lote=ids.slice(i,i+100);
    const ligadas=await fetchAllRows((de,ate)=>sb.from("luminarias").select("id,modelo_id").in("modelo_id",lote).order("id").range(de,ate));
    const comPecas=new Set(ligadas.map(x=>x.modelo_id));
    for(const m of modelos.filter(x=>comPecas.has(x.id))){
      const u=await sb.from("luminarias").update(dadosDoModeloParaPeca(m)).eq("modelo_id",m.id).select("id");
      atualizadas+=(u.data||[]).length;
    }
  }
  return atualizadas;
}

// ---- formulário do modelo (novo ou edição) ----
const MO_CAMPOS={mo_fabricante:"fabricante",mo_linha:"linha",mo_codigo:"codigo",mo_descricao:"descricao",mo_potencia:"potencia_w",mo_cct:"cct_k",mo_irc:"irc",mo_fluxo:"fluxo_lm",mo_facho:"facho_graus",mo_ip:"ip",mo_ik:"ik",mo_tensao:"tensao",mo_vida:"vida_util_h",mo_obs:"observacoes",mo_tipo_montagem:"tipo_montagem"};

function novoModeloForm(){
  Object.keys(MO_CAMPOS).forEach(id=>{q("#"+id).value=""});
  q("#mo_fabricante").readOnly=false; q("#mo_codigo").readOnly=false;
  q("#mo_titulo").textContent="Modelo novo";
}

async function editarModelo(id){
  const r=await sb.from("modelos").select("*").eq("id",id).single();
  if(r.error) return msg("Erro: "+r.error.message,false);
  Object.entries(MO_CAMPOS).forEach(([campo,col])=>{q("#"+campo).value=r.data[col]??""});
  // fabricante e código identificam o modelo: pra não criar um segundo por engano, não se mexe neles na edição
  q("#mo_fabricante").readOnly=true; q("#mo_codigo").readOnly=true;
  q("#mo_titulo").textContent=`Editando: ${r.data.fabricante||""} ${r.data.codigo}`;
  q("#mo_titulo").scrollIntoView({behavior:"smooth",block:"start"});
}

async function abrirModeloDaPeca(){
  if(!originalData||!originalData.modelo_id) return msg("Esta peça ainda não está ligada a um modelo do catálogo. Clique em SALVAR que ela é ligada automaticamente.",false);
  goScreen("catalogo");
  await editarModelo(originalData.modelo_id);
}

async function addModelo(){
  const codigo=q("#mo_codigo").value.trim();
  if(!codigo) return msg("Informe o código (SKU) do modelo.",false);
  const p={
    fabricante:norm(q("#mo_fabricante").value.trim()), linha:norm(q("#mo_linha").value.trim()), codigo,
    descricao:norm(q("#mo_descricao").value.trim()),
    potencia_w:q("#mo_potencia").value?Number(q("#mo_potencia").value):null,
    cct_k:q("#mo_cct").value?Number(q("#mo_cct").value):null,
    irc:q("#mo_irc").value?Number(q("#mo_irc").value):null,
    fluxo_lm:q("#mo_fluxo").value?Number(q("#mo_fluxo").value):null,
    facho_graus:q("#mo_facho").value?Number(q("#mo_facho").value):null,
    ip:norm(q("#mo_ip").value.trim()), ik:norm(q("#mo_ik").value.trim()),
    tensao:norm(q("#mo_tensao").value.trim()), vida_util_h:norm(q("#mo_vida").value.trim()),
    observacoes:norm(q("#mo_obs").value.trim()), tipo_montagem:norm(q("#mo_tipo_montagem").value)
  };
  const r=await sb.from("modelos").upsert(p,{onConflict:"fabricante,codigo"}).select();
  if(r.error) return msg("Erro: "+r.error.message,false);
  let pecas=0;
  try{ pecas=await propagarModelosParaPecas(r.data||[]); }catch(e){ return msg("Modelo salvo, mas não consegui atualizar as peças ligadas a ele: "+(e.message||e),false); }
  msg("Modelo salvo."+(pecas?` ${pecas} peça(s) ligada(s) a ele foram atualizadas.`:""));
  loadModelos();populateModeloPicker();
}
