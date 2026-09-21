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
  let query=sb.from("luminarias").select("id,lumidna_id,obra_id,modelo,fabricante,cliente,empreendimento,edificio,andar,ambiente,posicao,status").order("lumidna_id").limit(1000);
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
    ${sorted.map(x=>`<tr><td>${esc(x.lumidna_id)}${x.obra_id?"":`<div class="small" style="color:var(--red);font-weight:700">⚠ sem obra</div>`}</td><td>${esc(x.modelo)||"—"}</td><td>${esc(x.fabricante)||"—"}</td><td>${esc(x.cliente)||"—"}</td><td>${esc(x._local)||"—"}</td><td>${esc(x.status)||"—"}</td><td><button type="button" class="secondary" onclick="loadById('${x.lumidna_id}')">Abrir</button> <button type="button" class="secondary" onclick="abrirCopia('${x.lumidna_id}')">Copiar</button></td></tr>`).join("")}
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

async function preencherSelectObras(selId,comSemObra,rotuloVazio){
  const sel=q("#"+selId);
  const r=await sb.from("obras").select("id,numero,prefixo,nome").order("numero");
  if(r.error){sel.innerHTML=`<option value="">Erro ao carregar obras</option>`;return false}
  sel.innerHTML=`<option value="">${rotuloVazio||"— escolha a obra —"}</option>`
    +(r.data||[]).map(o=>`<option value="${o.id}">Obra ${o.numero} · ${esc(o.prefixo)} — ${esc(o.nome)}</option>`).join("")
    +(comSemObra?`<option value="sem">Sem obra (LD-AVU)</option>`:"");
  return true;
}

// ---- Modelo e obra da peça (só leitura: vêm do catálogo e da obra) ----
async function preencherObraDaPeca(){
  const sel=q("#obraPicker");
  sel.dataset.pronto="";
  const ok=await preencherSelectObras("obraPicker",false,"— escolha a obra —");
  if(ok) sel.dataset.pronto="1";
}

async function mostrarObraEscolhida(){
  const id=q("#obraPicker").value;
  await renderModeloEObra({...originalData},id?Number(id):null);
}

function abrirObraDaPeca(){
  if(originalData&&originalData.obra_id) abrirObra(originalData.obra_id);
}

async function renderModeloEObra(data,obraPendenteId){
  const box=q("#roModeloObra");
  const vazioV=v=>v===null||v===undefined||v==="";
  const val=(v,u)=>vazioV(v)?"—":esc(v)+(u?" "+u:"");
  const campo=(rot,html,spec,vazio,largo)=>`<div class="field${largo?" wide":""}"><label>${rot}</label><div style="font-weight:600;overflow-wrap:anywhere"${spec?` data-spec="${spec}" data-vazio="${vazio?1:0}"`:""}>${html}</div></div>`;
  let obra=null;
  const obraId=obraPendenteId||data.obra_id;
  if(obraId){
    const r=await sb.from("obras").select("*").eq("id",obraId).maybeSingle();
    obra=r.data||null;
  }
  box.innerHTML=`
    ${data.modelo_id?"":`<div class="alert">Esta peça ainda não está ligada a um modelo do catálogo. Ao clicar em SALVAR ela é ligada automaticamente (e o modelo é cadastrado, se for novo).</div>`}
    <div class="small" style="font-weight:700;margin-bottom:6px">Dados do modelo</div>
    <div class="ro">
      ${campo("Modelo",`${esc(data.fabricante)||"—"} — ${esc(data.modelo)||"—"}`,null,false,true)}
      ${campo("Potência",val(data.potencia_w,"W"),"potencia_w",vazioV(data.potencia_w))}
      ${campo("CCT",val(data.cct_k,"K"),"cct_k",vazioV(data.cct_k))}
      ${campo("IRC",val(data.irc))}
      ${campo("Fluxo",val(data.fluxo_lm,"lm"),"fluxo_lm",vazioV(data.fluxo_lm))}
      ${campo("Facho",val(data.facho_graus,"°"),"facho_graus",vazioV(data.facho_graus))}
      ${campo("IP / IK",`${val(data.ip)} / ${val(data.ik)}`)}
    </div>
    <div class="small" style="font-weight:700;margin:14px 0 6px">Dados da obra</div>
    ${obra
      ? `<div class="ro">
          ${campo("Obra",`${esc(obra.nome)} <span class="small">(${esc(obra.prefixo)})</span>${obraPendenteId?" <span class='small'>— será aplicada ao salvar</span>":""}`,null,false,true)}
          ${campo("Cliente",val(obra.cliente))}
          ${campo("E-mail do cliente",val(obra.cliente_email))}
          ${campo("Tensão",val(obra.tensao_instalacao))}
          ${campo("Automação",obra.automacao?"Sim"+(obra.protocolo_automacao?" — "+esc(obra.protocolo_automacao):""):"Não")}
        </div>`
      : `<div class="alert">Esta peça não está em nenhuma obra. Escolha abaixo e clique em SALVAR.</div>`}`;
  q("#boxSemObra").classList.toggle("hidden",!!data.obra_id);
  q("#btnEditarObraDaPeca").classList.toggle("hidden",!data.obra_id);
  if(!data.obra_id&&!obraPendenteId&&!q("#obraPicker").dataset.pronto) await preencherObraDaPeca();
}


// ---- Criar cópia de uma peça: só poupa digitação, sempre gera peça NOVA ----
let copiaOrigem=null, copiaPrimeiroId=null;
const COPIA_CAMPOS=["modelo_id","modelo","fabricante","potencia_w","cct_k","irc","fluxo_lm","facho_graus","ip","ik","criticidade"];

async function abrirCopia(lumidnaId){
  const r=await sb.from("luminarias").select("*").eq("lumidna_id",lumidnaId).maybeSingle();
  if(r.error||!r.data) return msg("Não consegui ler a peça "+lumidnaId+".",false);
  copiaOrigem=r.data;
  goScreen("copiar");
}

async function prepararTelaCopia(){
  q("#copiaSucesso").classList.add("hidden");
  q("#copiaForm").classList.toggle("hidden",!copiaOrigem);
  if(!copiaOrigem){
    q("#copiaOrigemResumo").textContent="Nenhuma peça selecionada. Volte à busca e use o botão Copiar numa peça.";
    return;
  }
  q("#copiaOrigemResumo").innerHTML=`Copiar a partir de: <b>${esc(copiaOrigem.lumidna_id)}</b> — ${esc(copiaOrigem.modelo)||"sem modelo"}${copiaOrigem.fabricante?" ("+esc(copiaOrigem.fabricante)+")":""}`;
  q("#copia_qtd").value=1;
  q("#copia_pecas").checked=false;
  await preencherSelectObras("copia_obra",false);
}

async function criarCopias(){
  if(!copiaOrigem) return;
  const obraId=q("#copia_obra").value;
  if(!obraId) return msg("Escolha a obra de destino.",false);
  const qtd=parseInt(q("#copia_qtd").value,10);
  if(!qtd||qtd<1||qtd>2000) return msg("Informe uma quantidade entre 1 e 2000.",false);
  const o=await sb.from("obras").select("*").eq("id",obraId).single();
  if(o.error) return msg("Erro ao ler a obra: "+o.error.message,false);
  const obra=o.data;

  let pecasCopiadas=[];
  if(q("#copia_pecas").checked){
    const rc=await sb.from("componentes").select("tipo,modelo").eq("luminaria_id",copiaOrigem.id).eq("ativo_atual",true);
    if(rc.error) return msg("Erro ao ler as peças instaladas: "+rc.error.message,false);
    pecasCopiadas=(rc.data||[]).filter(c=>c.modelo&&c.modelo!=="Original");
  }

  const rq=await sb.rpc("reservar_numeros",{p_prefix:`LD-${obra.prefixo}-`,p_qtd:qtd});
  if(rq.error) return msg("Erro ao reservar numeração: "+rq.error.message,false);

  const base={};
  COPIA_CAMPOS.forEach(k=>{ if(copiaOrigem[k]!=null) base[k]=copiaOrigem[k]; });
  const rows=[];
  for(let i=0;i<qtd;i++){
    rows.push({...base, criticidade:base.criticidade||"Média", lumidna_id:buildObraId(obra.prefixo,rq.data+i), status:"Ativa", obra_id:obra.id, ...wizObraDe(obra)});
  }
  const ins=await inserirLuminariasEmBlocos(rows);
  if(ins.erro) return msg("Erro ao criar as cópias: "+ins.erro,false);
  const criadas=ins.criadas;

  let avisoPecas="";
  if(pecasCopiadas.length){
    const compRows=[];
    criadas.forEach(l=>pecasCopiadas.forEach(c=>compRows.push({luminaria_id:l.id,tipo:c.tipo,modelo:c.modelo,original:false,ativo_atual:true})));
    for(let i=0;i<compRows.length;i+=500){
      const rc=await sb.from("componentes").insert(compRows.slice(i,i+500));
      if(rc.error){avisoPecas=" Mas houve erro ao copiar as peças instaladas: "+rc.error.message;break}
    }
  }

  wizUltimaCriacao=criadas;
  copiaPrimeiroId=criadas[0].lumidna_id;
  q("#copiaForm").classList.add("hidden");
  q("#copiaSucesso").classList.remove("hidden");
  q("#copiaSucessoTitulo").textContent=`${criadas.length} peça(s) nova(s) criada(s)`;
  q("#copiaSucessoTexto").innerHTML=`Na obra <b>${esc(obra.nome)}</b>, de <b>${esc(criadas[0].lumidna_id)}</b> até <b>${esc(criadas[criadas.length-1].lumidna_id)}</b>.<br>Preencha número de série, local e fotos de cada uma ao abrir.${avisoPecas?"<br><b>"+esc(avisoPecas)+"</b>":""}`;
}

async function openAsset(data){
  LID=data.lumidna_id; luminariaDbId=data.id;
  originalData={...data};
  q("#formLum").classList.remove("hidden");
  fill(data);
  q("input[name=lumidna_id]").value=LID;
  q("#publicLink").value=data.public_code?`${LUMIDNA_SITE_BASE}/ativo/?c=${data.public_code}`:"(salve a luminária para gerar o link)";
  q("#modeloPicker").value=data.modelo_id?String(data.modelo_id):"";
  q("#obraPicker").dataset.pronto="";
  ["foto_principal_url","foto_instalada_url","foto_etiqueta_url"].forEach(k=>updatePhotoPreview(k,data[k]));
  await renderModeloEObra(data);
  await Promise.all([loadComponents(),loadWarranties(),loadMaintenance(),loadReplacement(),loadAudit()]);
}

