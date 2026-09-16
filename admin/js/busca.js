// ---- Busca de luminárias ----
function toggleAdvSearch(){
  const box=q("#advSearch");
  box.classList.toggle("hidden");
  q("#advSearchToggle").textContent=box.classList.contains("hidden")?"busca avançada":"esconder busca avançada";
}

let searchTimer=null;
function onSearchInput(){clearTimeout(searchTimer);searchTimer=setTimeout(searchAssets,300)}

async function searchAssets(){
  const termo=q("#f_busca").value.trim();
  const fab=q("#f_fabricante").value.trim(), mod=q("#f_modelo").value.trim(), loc=q("#f_local").value.trim();
  if(!termo&&!fab&&!mod&&!loc){q("#searchResults").innerHTML="";return}
  let query=sb.from("luminarias").select("id,lumidna_id,modelo,fabricante,cliente,empreendimento,edificio,andar,ambiente,posicao,status").order("lumidna_id").limit(1000);
  if(termo) query=query.or(`lumidna_id.ilike.%${termo}%,modelo.ilike.%${termo}%,fabricante.ilike.%${termo}%,cliente.ilike.%${termo}%,empreendimento.ilike.%${termo}%,edificio.ilike.%${termo}%`);
  if(fab) query=query.ilike("fabricante",`%${fab}%`);
  if(mod) query=query.ilike("modelo",`%${mod}%`);
  if(loc) query=query.or(`edificio.ilike.%${loc}%,andar.ilike.%${loc}%,ambiente.ilike.%${loc}%,posicao.ilike.%${loc}%`);
  const r=await query;
  if(r.error) return msg("Erro na busca: "+r.error.message,false);
  renderSearchResults(r.data||[]);
}

let lastSearchRows=[];
let searchSort={col:"lumidna_id",dir:1};
const SEARCH_COLS=[["lumidna_id","ID"],["modelo","Modelo"],["fabricante","Fabricante"],["cliente","Cliente"],["_local","Local"],["status","Status"]];

function renderSearchResults(rows){
  lastSearchRows=rows;
  const box=q("#searchResults");
  if(!rows.length){box.innerHTML="<div class='small'>Nenhuma luminária encontrada com esses filtros.</div>";return}
  const withLocal=rows.map(x=>({...x,_local:[x.edificio,x.andar,x.ambiente,x.posicao].filter(Boolean).join(" / ")}));
  const sorted=[...withLocal].sort((a,b)=>{
    const av=(a[searchSort.col]||"").toString().toLowerCase(), bv=(b[searchSort.col]||"").toString().toLowerCase();
    return av<bv?-1*searchSort.dir:av>bv?1*searchSort.dir:0;
  });
  const arrow=(col)=>col!==searchSort.col?"":(searchSort.dir===1?" ▲":" ▼");
  box.innerHTML=`<table><tr>${SEARCH_COLS.map(([col,label])=>`<th style="cursor:pointer;user-select:none" onclick="sortSearchResults('${col}')">${label}${arrow(col)}</th>`).join("")}<th></th></tr>
    ${sorted.map(x=>`<tr><td>${esc(x.lumidna_id)}</td><td>${esc(x.modelo)||"—"}</td><td>${esc(x.fabricante)||"—"}</td><td>${esc(x.cliente)||"—"}</td><td>${esc(x._local)||"—"}</td><td>${esc(x.status)||"—"}</td><td><button type="button" class="secondary" onclick="loadById('${x.lumidna_id}')">Abrir</button></td></tr>`).join("")}
  </table>`;
}

function sortSearchResults(col){
  searchSort.dir=(searchSort.col===col)?-searchSort.dir:1;
  searchSort.col=col;
  renderSearchResults(lastSearchRows);
}

async function loadById(id){
  const r=await sb.from("luminarias").select("*").eq("lumidna_id",id).maybeSingle();
  if(r.error) return msg("Erro: "+r.error.message,false);
  if(!r.data) return msg(`Luminária ${id} não encontrada.`,false);
  goScreen("detail");
  await openAsset(r.data);
  msg(id+" carregada.");
}

async function createNew(){
  const id=q("#lidInput").value.trim().toUpperCase();
  if(!id) return msg("Informe um ID para o novo ativo.",false);
  const existing=await sb.from("luminarias").select("id").eq("lumidna_id",id).maybeSingle();
  if(existing.data) return msg("Já existe um ativo com esse ID. Busque por ele acima.",false);
  const c=await sb.from("luminarias").insert({lumidna_id:id,status:"Ativa",criticidade:"Média"}).select().single();
  if(c.error) return msg("Erro ao criar: "+c.error.message,false);
  q("#formLum").reset();
  goScreen("detail");
  await openAsset(c.data);
  msg(id+" criada. Preencha os dados e clique em Salvar.");
}

async function openAsset(data){
  LID=data.lumidna_id; luminariaDbId=data.id;
  originalData={...data};
  q("#formLum").classList.remove("hidden");
  fill(data);
  q("input[name=lumidna_id]").value=LID;
  q("#lidInput").value=LID;
  q("#publicLink").value=data.public_code?`${LUMIDNA_SITE_BASE}/ativo/?c=${data.public_code}`:"(salve a luminária para gerar o link)";
  q("#modeloPicker").value=data.modelo_id||"";
  q("#det_automacao").value=data.automacao?"sim":"nao";
  q("#det_protocolo_field").classList.toggle("hidden",!data.automacao);
  ["foto_principal_url","foto_instalada_url","foto_etiqueta_url"].forEach(k=>updatePhotoPreview(k,data[k]));
  await Promise.all([loadComponents(),loadWarranties(),loadMaintenance(),loadReplacement(),loadAudit()]);
}

