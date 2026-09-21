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

// Toda peça com Modelo e Fabricante preenchidos precisa existir como modelo do
// catálogo (é de lá que o "Montar o pedido" lista). Acha o modelo pelo par
// fabricante + código; se não existir, cria com os dados técnicos da peça.
async function garantirModeloNoCatalogo(c){
  // LDARTI, Ldarti e ldarti são o mesmo fabricante: reaproveita a grafia que já está no catálogo.
  const ex=await sb.from("modelos").select("id,fabricante").ilike("fabricante",likeLiteral(c.fabricante)).ilike("codigo",likeLiteral(c.codigo)).limit(1);
  if(ex.error) return {erro:ex.error.message};
  if(ex.data&&ex.data.length) return {id:ex.data[0].id,criado:false};
  const fab=await sb.from("modelos").select("fabricante").ilike("fabricante",likeLiteral(c.fabricante)).limit(1);
  const grafiaFabricante=(fab.data&&fab.data.length)?fab.data[0].fabricante:c.fabricante;
  const r=await sb.from("modelos").insert({
    fabricante:grafiaFabricante,codigo:c.codigo,
    potencia_w:c.potencia_w??null,cct_k:c.cct_k??null,irc:c.irc??null,fluxo_lm:c.fluxo_lm??null,facho_graus:c.facho_graus??null,
    ip:c.ip??null,ik:c.ik??null
  }).select("id").single();
  if(r.error) return {erro:r.error.message};
  return {id:r.data.id,criado:true};
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

