// ---- Catálogo de Componentes (Driver / LED / Óptica) ----
let compModelosTodos=[];
let compModelosSelecionados=new Set();

async function carregarModelosParaCompat(){
  try{ compModelosTodos=await fetchAllRows((de,ate)=>sb.from("modelos").select("id,fabricante,codigo,linha").order("fabricante").order("codigo").order("id").range(de,ate)); }catch(e){ compModelosTodos=[]; }
  renderCompModelosLista();
}

let compModelosBuscaTimer=null;
function onCompModelosBuscaInput(){clearTimeout(compModelosBuscaTimer);compModelosBuscaTimer=setTimeout(renderCompModelosLista,200)}

function renderCompModelosLista(){
  const box=q("#comp_modelos_lista");
  if(!box) return;
  const termo=(q("#comp_modelos_busca").value||"").toLowerCase().trim();
  const filtrados=termo ? compModelosTodos.filter(m=>
    (m.fabricante||"").toLowerCase().includes(termo) || (m.codigo||"").toLowerCase().includes(termo) || (m.linha||"").toLowerCase().includes(termo)
  ) : compModelosTodos;
  const lista=filtrados.slice(0,150);
  const aviso=filtrados.length>150?`<div class="small" style="margin-top:6px">Mostrando 150 de ${filtrados.length} — use a busca pra achar os outros.</div>`:"";
  box.innerHTML = lista.length ? lista.map(m=>{
    const checked=compModelosSelecionados.has(m.codigo)?"checked":"";
    return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer"><input type="checkbox" value="${esc(m.codigo)}" ${checked} onchange="toggleCompModelo('${esc(m.codigo)}',this.checked)"> <span>${esc(m.fabricante)||"?"} — ${esc(m.codigo)}${m.linha?" ("+esc(m.linha)+")":""}</span></label>`;
  }).join("")+aviso : "<div class='small'>Nenhum modelo encontrado. Cadastre o modelo primeiro em \"Cadastrar modelo novo\".</div>";
  if(!compModelosTodos.length) box.innerHTML="<div class='small'>Carregando modelos...</div>";
}

function toggleCompModelo(codigo,checked){
  if(checked) compModelosSelecionados.add(codigo); else compModelosSelecionados.delete(codigo);
  atualizarResumoCompModelos();
}

function atualizarResumoCompModelos(){
  const n=compModelosSelecionados.size;
  q("#comp_modelos_selecionados").innerHTML = n
    ? `<b>${n} modelo(s) selecionado(s)</b> — <a href="#" onclick="limparCompModelos();return false">limpar seleção</a>`
    : "Nenhum selecionado = compatível com qualquer modelo.";
}

function limparCompModelos(){
  compModelosSelecionados.clear();
  renderCompModelosLista();
  atualizarResumoCompModelos();
}

function onCompTipoChange(){
  const tipo=q("#comp_tipo").value;
  q("#comp_potencia_field").classList.toggle("hidden", tipo==="Óptica");
  q("#comp_corrente_field").classList.toggle("hidden", tipo!=="Driver");
  q("#comp_cct_field").classList.toggle("hidden", tipo!=="LED");
  q("#comp_fluxo_field").classList.toggle("hidden", tipo!=="LED");
  q("#comp_facho_field").classList.toggle("hidden", tipo!=="Óptica");
  carregarCodigosComponentes();
}

// Sugestões (autocompletar) de fabricante e código já usados no catálogo de
// componentes, pra não precisar lembrar/digitar tudo do zero toda vez.
async function carregarFabricantesComponentes(){
  const dl=q("#comp_fabricantes_dl");
  if(!dl) return;
  const r=await sb.from("equivalentes").select("fabricante_equivalente").not("fabricante_equivalente","is",null);
  const distintos=[...new Set((r.data||[]).map(x=>x.fabricante_equivalente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  dl.innerHTML=distintos.map(f=>`<option value="${esc(f)}">`).join("");
}

async function carregarCodigosComponentes(){
  const dl=q("#comp_codigos_dl");
  if(!dl) return;
  const tipo=q("#comp_tipo").value;
  const r=await sb.from("equivalentes").select("modelo_equivalente").eq("componente_origem",tipo);
  const distintos=[...new Set((r.data||[]).map(x=>x.modelo_equivalente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  dl.innerHTML=distintos.map(c=>`<option value="${esc(c)}">`).join("");
}

let compSearchTimer=null;
function onCompSearchInput(){clearTimeout(compSearchTimer);compSearchTimer=setTimeout(loadComponentesCatalogo,300)}

async function loadComponentesCatalogo(){
  const term=q("#compSearch").value.trim();
  const box=q("#compList");
  let query=sb.from("equivalentes").select("*").order("componente_origem").order("modelo_equivalente");
  if(term) query=query.or(`modelo_equivalente.ilike.%${term}%,fabricante_equivalente.ilike.%${term}%`);
  const r=await query;
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML = rows.length ? `<table><tr><th>Tipo</th><th>Fabricante</th><th>Código</th><th>Specs</th><th>Nível</th><th>Modelos compatíveis</th></tr>${rows.map(c=>{
    const specs=[c.potencia_w?c.potencia_w+"W":"",c.corrente_ma?c.corrente_ma+"mA":"",c.cct_k?c.cct_k+"K":"",c.fluxo_lm?c.fluxo_lm+"lm":"",c.facho_graus?c.facho_graus+"°":""].filter(Boolean).join(" · ");
    return `<tr><td>${esc(c.componente_origem)}</td><td>${esc(c.fabricante_equivalente)||"—"}</td><td>${esc(c.modelo_equivalente)}</td><td>${specs||"—"}</td><td>${esc(c.nivel)||"—"}</td><td>${esc(c.modelo_original)||"— qualquer modelo —"}</td></tr>`;
  }).join("")}</table>` : "<div class='small'>Nenhum componente encontrado.</div>";
}

async function addComponenteCatalogo(){
  const codigo=q("#comp_codigo").value.trim();
  if(!codigo) return msg("Informe o código/modelo do componente.",false);
  const tipo=q("#comp_tipo").value;
  const p={
    componente_origem:tipo,
    modelo_equivalente:codigo,
    modelo_original:compModelosSelecionados.size?[...compModelosSelecionados].join(", "):null,
    fabricante_equivalente:norm(q("#comp_fabricante").value.trim()),
    potencia_w:tipo!=="Óptica"&&q("#comp_potencia").value?Number(q("#comp_potencia").value):null,
    corrente_ma:tipo==="Driver"&&q("#comp_corrente").value?Number(q("#comp_corrente").value):null,
    cct_k:tipo==="LED"&&q("#comp_cct").value?Number(q("#comp_cct").value):null,
    fluxo_lm:tipo==="LED"&&q("#comp_fluxo").value?Number(q("#comp_fluxo").value):null,
    facho_graus:tipo==="Óptica"&&q("#comp_facho").value?Number(q("#comp_facho").value):null,
    nivel:q("#comp_nivel").value,
    preco_referencia:q("#comp_preco").value?Number(q("#comp_preco").value):null,
    disponibilidade:norm(q("#comp_disp").value.trim()),
    especificacao:norm(q("#comp_obs").value.trim()),
    homologado_por:"LumiDNA"
  };
  const r=await sb.from("equivalentes").insert(p);
  if(r.error) return msg("Erro: "+r.error.message,false);
  q("#comp_fabricante").value="";q("#comp_codigo").value="";q("#comp_potencia").value="";q("#comp_corrente").value="";q("#comp_cct").value="";q("#comp_fluxo").value="";q("#comp_facho").value="";q("#comp_obs").value="";
  limparCompModelos();
  msg("Componente salvo no catálogo.");
  loadComponentesCatalogo();
}

// Garante que um componente (Driver/LED/Óptica) existe no Catálogo central
// (tabela "equivalentes"), criando se for novo. Usado pela Importação
// completa — como ali a origem é um pedido real (fabricante/código
// conferidos), entra direto como "Compatível Verificado", não como palpite.
// Se já existir, só acrescenta o modelo de luminária ao "compatível com",
// sem sobrescrever specs que alguém já tenha ajustado manualmente.
async function garantirComponenteNoCatalogo(c){
  if(!c.codigo) return {erro:"sem código"};
  const ex=await sb.from("equivalentes").select("id,modelo_original").eq("componente_origem",c.tipo).ilike("modelo_equivalente",likeLiteral(c.codigo)).limit(1);
  if(ex.error) return {erro:ex.error.message};
  if(ex.data&&ex.data.length){
    const atual=ex.data[0].modelo_original;
    const lista=atual?atual.split(",").map(s=>s.trim()):[];
    if(c.modelo_original && !lista.includes(c.modelo_original)){
      await sb.from("equivalentes").update({modelo_original:[...lista,c.modelo_original].filter(Boolean).join(", ")}).eq("id",ex.data[0].id);
    }
    return {id:ex.data[0].id,criado:false};
  }
  const r=await sb.from("equivalentes").insert({
    componente_origem:c.tipo, modelo_equivalente:c.codigo, modelo_original:c.modelo_original||null,
    fabricante_equivalente:c.fabricante||null,
    potencia_w:c.potencia_w??null, corrente_ma:c.corrente_ma??null, cct_k:c.cct_k??null,
    fluxo_lm:c.fluxo_lm??null, facho_graus:c.facho_graus??null,
    nivel:"Compatível Verificado", disponibilidade:"Sob consulta", homologado_por:"Importação"
  }).select("id").single();
  if(r.error) return {erro:r.error.message};
  return {id:r.data.id,criado:true};
}

function parseCSV(text){
  const firstLine=text.trim().split(/\r?\n/)[0]||"";
  const delim=(firstLine.split(";").length>firstLine.split(",").length)?";":",";
  const lines=text.trim().split(/\r?\n/).filter(l=>l.trim().length);
  const rows=lines.map(line=>{
    const out=[]; let cur=""; let inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(inQ){
        if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else inQ=false; }
        else cur+=c;
      }else{
        if(c==='"') inQ=true;
        else if(c===delim){out.push(cur);cur="";}
        else cur+=c;
      }
    }
    out.push(cur);
    return out.map(s=>s.trim());
  });
  const header=rows[0].map(h=>h.toLowerCase().trim());
  return rows.slice(1).map(r=>{
    const obj={};
    header.forEach((h,i)=>obj[h]=(r[i]!==undefined&&r[i]!=="")?r[i]:null);
    return obj;
  });
}

// ---- Kits (Driver + LED + Óptica que costumam vir juntos numa remessa) ----
async function carregarOpcoesKit(){
  const tipos=[["Driver","kit_driver_opcoes"],["LED","kit_led_opcoes"],["Óptica","kit_optica_opcoes"]];
  for(const [tipo,dlId] of tipos){
    const dl=q("#"+dlId);
    if(!dl) continue;
    const r=await sb.from("equivalentes").select("modelo_equivalente").eq("componente_origem",tipo);
    const distintos=[...new Set((r.data||[]).map(x=>x.modelo_equivalente).filter(Boolean))];
    dl.innerHTML=`<option value="Integrada">`+distintos.map(x=>`<option value="${esc(x)}">`).join("");
  }
}

async function addKit(){
  const nome=q("#kit_nome").value.trim();
  if(!nome) return msg("Informe o nome do kit.",false);
  const p={
    nome,
    driver_modelo:norm(q("#kit_driver").value.trim()),
    led_modelo:norm(q("#kit_led").value.trim()),
    optica_modelo:norm(q("#kit_optica").value.trim()),
    modelo_luminaria:norm(q("#kit_modelo_luminaria").value.trim())
  };
  const r=await sb.from("kits_componentes").insert(p);
  if(r.error) return msg("Erro: "+r.error.message,false);
  q("#kit_nome").value="";q("#kit_driver").value="";q("#kit_led").value="";q("#kit_optica").value="";q("#kit_modelo_luminaria").value="";
  msg("Kit salvo.");
  loadKits();
}

async function loadKits(){
  const box=q("#kitsList");
  if(!box) return;
  const r=await sb.from("kits_componentes").select("*").order("nome");
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML=rows.length?`<table><tr><th>Nome</th><th>Driver</th><th>LED</th><th>Óptica</th><th>Modelo</th><th></th></tr>${rows.map(k=>`<tr><td>${esc(k.nome)}</td><td>${esc(k.driver_modelo)||"—"}</td><td>${esc(k.led_modelo)||"—"}</td><td>${esc(k.optica_modelo)||"—"}</td><td>${esc(k.modelo_luminaria)||"—"}</td><td><button type="button" class="secondary" onclick="excluirKit(${k.id})">Excluir</button></td></tr>`).join("")}</table>`:"<div class='small'>Nenhum kit cadastrado ainda.</div>";
}

async function excluirKit(id){
  if(!confirm("Excluir este kit? Isso não afeta peças já cadastradas com ele.")) return;
  const r=await sb.from("kits_componentes").delete().eq("id",id);
  if(r.error) return msg("Erro: "+r.error.message,false);
  msg("Kit excluído.");
  loadKits();
}

async function importModelosCSV(){
  const text=q("#modelosCsvInput").value.trim();
  if(!text) return msg("Cole o CSV primeiro.",false);
  const rows=parseCSV(text);
  if(!rows.length) return msg("Nenhuma linha encontrada no CSV.",false);
  const num=v=>v!=null&&v!==""?Number(v):null;
  const payload=rows.map(r=>({
    fabricante:r.fabricante||null, linha:r.linha||null, codigo:r.codigo,
    descricao:r.descricao||null,
    potencia_w:num(r.potencia_w), cct_k:num(r.cct_k), irc:num(r.irc),
    fluxo_lm:num(r.fluxo_lm), facho_graus:num(r.facho_graus),
    ip:r.ip||null, ik:r.ik||null, tensao:r.tensao||null,
    vida_util_h:r.vida_util_h||null, observacoes:r.observacoes||null,
    tipo_montagem:r.tipo_montagem||null
  })).filter(r=>r.codigo);
  if(!payload.length) return msg("Nenhuma linha com 'codigo' preenchido.",false);
  const res=await sb.from("modelos").upsert(payload,{onConflict:"fabricante,codigo"}).select();
  if(res.error) return msg("Erro na importação: "+res.error.message,false);
  let pecasAtualizadas=0;
  try{ pecasAtualizadas=await propagarModelosParaPecas(res.data); }catch(e){ msg(`${res.data.length} modelo(s) importado(s), mas não consegui atualizar as peças ligadas a eles: ${e.message||e}`,false); loadModelos();populateModeloPicker(); return; }
  msg(`${res.data.length} modelo(s) importado(s)/atualizado(s).${pecasAtualizadas?` ${pecasAtualizadas} peça(s) ligada(s) a eles foram atualizadas.`:""}`);
  loadModelos();populateModeloPicker();
}
