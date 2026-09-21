// ---- Catálogo de Modelos ----

async function populateModeloPicker(){
  const sel=q("#modeloPicker");
  if(!sel) return;
  let modelos=[];
  try{ modelos=await fetchAllRows((de,ate)=>sb.from("modelos").select("id,fabricante,codigo").order("fabricante").order("codigo").order("id").range(de,ate)); }catch(e){}
  const current=sel.value;
  sel.innerHTML='<option value="">— nenhum / preencher manualmente —</option>'+modelos.map(m=>`<option value="${m.id}">${esc(m.fabricante)||"?"} — ${esc(m.codigo)}</option>`).join("");
  sel.value=current;
}

async function applyModeloToForm(){
  const id=q("#modeloPicker").value;
  if(!id) return;
  const r=await sb.from("modelos").select("*").eq("id",id).single();
  if(r.error) return msg("Erro: "+r.error.message,false);
  const m=r.data;
  q("input[name=modelo_id]").value=m.id;
  q("input[name=modelo]").value=m.codigo||"";
  q("input[name=fabricante]").value=m.fabricante||"";
  if(m.potencia_w!=null) q("input[name=potencia_w]").value=m.potencia_w;
  if(m.cct_k!=null) q("input[name=cct_k]").value=m.cct_k;
  if(m.irc!=null) q("input[name=irc]").value=m.irc;
  if(m.fluxo_lm!=null) q("input[name=fluxo_lm]").value=m.fluxo_lm;
  if(m.facho_graus!=null) q("input[name=facho_graus]").value=m.facho_graus;
  if(m.ip) q("input[name=ip]").value=m.ip;
  if(m.ik) q("input[name=ik]").value=m.ik;
  msg("Dados do modelo aplicados no formulário. Clique em SALVAR para gravar.");
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
  box.innerHTML = `<table><tr><th>Foto</th>${MODELOS_COLS.map(([col,label])=>`<th style="cursor:pointer;user-select:none" onclick="sortModelosList('${col}')">${label}${arrow(col)}</th>`).join("")}<th></th></tr>${sorted.map(m=>`<tr><td>${m.imagem_url?`<img src="${esc(m.imagem_url)}" alt="" style="width:44px;height:44px;object-fit:contain;border:1px solid #eee;border-radius:4px">`:`<span class="small" style="color:#bbb">—</span>`}</td><td>${esc(m.fabricante)}</td><td>${esc(m.linha)}</td><td>${esc(m.codigo)}</td><td>${esc(m.descricao)}</td><td>${m.potencia_w??"—"}W</td><td>${m.cct_k??"—"}</td><td>${m.fluxo_lm??"—"}lm</td><td>${m.facho_graus??"—"}°</td><td><button type="button" class="secondary" onclick="startWizardWithModelo(${m.id})">Cadastrar peças ▸</button></td></tr>`).join("")}</table>`;
}

function sortModelosList(col){
  modelosSort.dir=(modelosSort.col===col)?-modelosSort.dir:1;
  modelosSort.col=col;
  renderModelosList();
}

// Salva o Modelo/Fabricante/dados técnicos que estão na tela de uma peça como
// modelo do catálogo (ou acha o que já existe) e vincula a peça a ele. Serve
// pra peça avulsa: o modelo passa a aparecer ao cadastrar peças em qualquer obra.
async function salvarModeloNoCatalogo(){
  if(!LID) return msg("Abra uma peça primeiro.",false);
  const codigo=q("input[name=modelo]").value.trim();
  const fabricante=norm(q("input[name=fabricante]").value.trim());
  if(!codigo||!fabricante) return msg("Preencha Modelo e Fabricante da peça antes de salvar no catálogo.",false);
  const existente=await sb.from("modelos").select("id").eq("fabricante",fabricante).eq("codigo",codigo).maybeSingle();
  if(existente.error) return msg("Erro ao consultar o catálogo: "+existente.error.message,false);
  let modeloId;
  if(existente.data){
    modeloId=existente.data.id;
  }else{
    const num=n=>{const v=q(`input[name=${n}]`).value; return v?Number(v):null};
    const p={fabricante,codigo,potencia_w:num("potencia_w"),cct_k:num("cct_k"),irc:num("irc"),fluxo_lm:num("fluxo_lm"),facho_graus:num("facho_graus"),ip:norm(q("input[name=ip]").value.trim()),ik:norm(q("input[name=ik]").value.trim())};
    const r=await sb.from("modelos").insert(p).select("id").single();
    if(r.error) return msg("Erro ao salvar no catálogo: "+r.error.message,false);
    modeloId=r.data.id;
  }
  const u=await sb.from("luminarias").update({modelo_id:modeloId}).eq("id",luminariaDbId);
  if(u.error) return msg("Modelo salvo no catálogo, mas não consegui vincular esta peça: "+u.error.message,false);
  await logAudit("modelo_id",originalData?originalData.modelo_id:null,modeloId);
  if(originalData) originalData.modelo_id=modeloId;
  q("input[name=modelo_id]").value=modeloId;
  q("#salvarModeloBox").classList.add("hidden");
  populateModeloPicker().then(()=>{q("#modeloPicker").value=String(modeloId)});
  loadAudit();
  msg(existente.data?"Esse modelo já existia no catálogo — a peça foi vinculada a ele.":"Modelo salvo no catálogo e vinculado a esta peça. Agora ele aparece ao cadastrar peças em qualquer obra.");
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
  msg("Modelo salvo.");
  loadModelos();populateModeloPicker();
}

