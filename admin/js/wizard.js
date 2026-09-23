// ---- Assistente: cadastrar peças novas (pedido / carrinho) ----
let wizObra=null, wizObraId=null, wizObraPrefixo=null, wizCarrinho=[], wizPendingModeloId=null, wizUltimaCriacao=[], wizPularParaCarrinho=false;
let wizColarPendentes=[], wizPendenteAtual=null;

function wizStep(n){
  ["wz-1","wz-2","wz-3","wz-4"].forEach((id,i)=>q("#"+id).classList.toggle("hidden",i!==n-1));
  q("#wizSteps").innerHTML=["Obra","Pedido","Confirmar"].map((l,i)=>(i===n-1?`<b>${i+1}. ${l}</b>`:`${i+1}. ${l}`)).join("  →  ");
  if(n===1){
    wizObra=null;wizObraId=null;wizObraPrefixo=null;wizCarrinho=[];wizColarPendentes=[];wizPendenteAtual=null;
    q("#wiz_prefixo").value="";q("#wiz_prefixo").dataset.manual="";
    q("#wizObraSearch").value="";
    q("#wizObraBusca").classList.remove("hidden");
    q("#wizObraEscolhida").classList.add("hidden");
    q("#wizNovaObraFields").classList.add("hidden");
    q("#wiz_cliente").value="";q("#wiz_cliente_email").value="";q("#wiz_empreendimento").value="";q("#wiz_edificio").value="";
    q("#wiz_tensao").value="";q("#wiz_automacao").value="nao";q("#wiz_protocolo_field").classList.add("hidden");
    wizFiltrarObras();
  }
}

function buildObraId(prefixo,num){
  return `LD-${prefixo}-${String(num).padStart(6,"0")}`;
}

function wizObraDe(o){
  return {cliente:o.cliente,cliente_email:o.cliente_email,empreendimento:o.nome,edificio:null,tensao_instalacao:o.tensao_instalacao,automacao:o.automacao,protocolo_automacao:o.protocolo_automacao};
}

function onWizAutomacaoChange(){
  q("#wiz_protocolo_field").classList.toggle("hidden",q("#wiz_automacao").value!=="sim");
}

let wizObraSearchTimer=null;
function onWizObraSearchInput(){clearTimeout(wizObraSearchTimer);wizObraSearchTimer=setTimeout(wizFiltrarObras,300)}

async function wizFiltrarObras(){
  const term=q("#wizObraSearch").value.trim();
  const box=q("#wizObraLista");
  let query=sb.from("obras").select("*").order("nome").limit(300);
  if(term) query=query.or(`nome.ilike.%${term}%,cliente.ilike.%${term}%`);
  const r=await query;
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(o=>`<button type="button" class="bigOption" style="padding:10px 14px" onclick="wizEscolherObraExistente(${o.id})"><span class="ic" style="font-size:20px">📁</span><span><b style="font-size:14px">${esc(o.nome)}</b><small>Obra ${o.numero} · ${esc(o.prefixo)}${o.cliente?" · "+esc(o.cliente):""}</small></span></button>`).join(""):"<div class='small'>Nenhuma obra encontrada. Crie uma nova abaixo.</div>";
}

function toggleWizNovaObra(){
  q("#wizNovaObraFields").classList.toggle("hidden");
}

function montarResumoObra(){
  const temAuto=wizObra.automacao;
  q("#wizObraEscolhidaResumo").innerHTML=`Obra: <b>${esc(wizObra.empreendimento)}</b> (${esc(wizObraPrefixo)})${wizObra.cliente?" · "+esc(wizObra.cliente):""}${wizObra.tensao_instalacao?" · "+esc(wizObra.tensao_instalacao):""}${temAuto?" · Automação "+esc(wizObra.protocolo_automacao):" · Sem automação"}`;
  q("#wizObraBusca").classList.add("hidden");
  q("#wizObraEscolhida").classList.remove("hidden");
}

async function wizEscolherObraExistente(id){
  const r=await sb.from("obras").select("*").eq("id",id).single();
  if(r.error) return msg(r.error.message,false);
  const o=r.data;
  wizObraId=o.id;
  wizObraPrefixo=o.prefixo;
  wizObra=wizObraDe(o);
  montarResumoObra();
}

async function wizCriarNovaObra(){
  const nome=q("#wiz_empreendimento").value.trim();
  if(!nome) return msg("Informe o nome da obra.",false);
  const prefixo=normalizarPrefixo(q("#wiz_prefixo").value);
  const erroPrefixo=await validarPrefixoObra(prefixo);
  if(erroPrefixo) return msg(erroPrefixo,false);
  const temAutomacao=q("#wiz_automacao").value==="sim";
  const p={nome,prefixo,cliente:norm(q("#wiz_cliente").value.trim()),cliente_email:norm(q("#wiz_cliente_email").value.trim()),tensao_instalacao:norm(q("#wiz_tensao").value),automacao:temAutomacao,protocolo_automacao:temAutomacao?q("#wiz_protocolo").value:null};
  const r=await sb.from("obras").insert(p).select().single();
  if(r.error) return msg("Erro ao criar obra: "+r.error.message,false);
  wizObraId=r.data.id;
  wizObraPrefixo=r.data.prefixo;
  wizObra=wizObraDe(r.data);
  montarResumoObra();
}

function wizTrocarObra(){
  wizObraId=null;wizObra=null;
  q("#wizObraBusca").classList.remove("hidden");
  q("#wizObraEscolhida").classList.add("hidden");
  wizFiltrarObras();
}

function wizEntrarNoCarrinho(){
  q("#wizModeloSearch").value="";
  wizFabricante=null;
  wizFabricantesCache=null;
  wizFecharModeloNovo();
  q("#wizObraResumo").innerHTML=`Obra: <b>${esc(wizObra.empreendimento)}</b>${wizObraPrefixo?" ("+esc(wizObraPrefixo)+")":""}${wizObra.cliente?" · "+esc(wizObra.cliente):""}`;
  wizFiltrarModelos();
  renderWizCarrinho();
  wizCarregarAmbientesDaObra();
  wizStep(2);
  if(wizPendingModeloId){const id=wizPendingModeloId;wizPendingModeloId=null;wizAdicionarAoCarrinho(id)}
}

// Sugestões de ambiente (autocompletar) com os nomes já usados nesta obra,
// pra não nascer "Sala Reunião" numa peça e "Sala de Reunião" noutra.
async function wizCarregarAmbientesDaObra(){
  const dl=q("#wizAmbientesList");
  if(!dl||!wizObraId) return;
  const r=await sb.from("luminarias").select("ambiente").eq("obra_id",wizObraId).not("ambiente","is",null).limit(2000);
  if(r.error) return;
  const distintos=[...new Set((r.data||[]).map(x=>x.ambiente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  dl.innerHTML=distintos.map(a=>`<option value="${esc(a)}">`).join("");
}

function wizIrParaCarrinho(){
  wizObra.edificio=norm(q("#wiz_edificio").value.trim());
  wizEntrarNoCarrinho();
}

function startWizardWithModelo(id){
  wizPendingModeloId=id;
  goScreen("wizard");
}

let wizSearchTimer=null;
function onWizSearchInput(){clearTimeout(wizSearchTimer);wizSearchTimer=setTimeout(wizFiltrarModelos,300)}

const WIZ_SEM_FABRICANTE="(sem fabricante)";
let wizFabricante=null, wizFabricantesCache=null, wizFiltroSeq=0;

function wizBotaoModelo(m){
  return `<button type="button" class="bigOption" style="padding:10px 14px" onclick="wizAdicionarAoCarrinho(${m.id})">${m.imagem_url?`<img src="${esc(m.imagem_url)}" alt="" style="width:36px;height:36px;object-fit:contain;border:1px solid #eee;border-radius:4px">`:`<span class="ic" style="font-size:20px">💡</span>`}<span><b style="font-size:14px">${esc(m.fabricante)||"?"} — ${esc(m.codigo)}</b><small>${esc(m.descricao)||""}</small></span></button>`;
}

async function wizCarregarFabricantes(){
  const linhas=await fetchAllRows((de,ate)=>sb.from("modelos").select("fabricante").order("id").range(de,ate));
  const grupos={};
  linhas.forEach(l=>{
    const nome=l.fabricante||WIZ_SEM_FABRICANTE;
    const g=(grupos[nome.toLowerCase()]=grupos[nome.toLowerCase()]||{fabricante:nome,total:0});
    g.total++;
  });
  wizFabricantesCache=Object.values(grupos).sort((a,b)=>(a.fabricante===WIZ_SEM_FABRICANTE)-(b.fabricante===WIZ_SEM_FABRICANTE)||a.fabricante.localeCompare(b.fabricante,"pt-BR"));
}

function wizEscolherFabricanteIdx(i){
  wizFabricante=wizFabricantesCache[i].fabricante;
  q("#wizModeloSearch").value="";
  wizFiltrarModelos();
}
function wizVoltarFabricantes(){
  wizFabricante=null;
  q("#wizModeloSearch").value="";
  wizFiltrarModelos();
}

async function wizFiltrarModelos(){
  const seq=++wizFiltroSeq;
  const term=q("#wizModeloSearch").value.trim();
  const box=q("#wizListaModelos");
  q("#wizFabBar").classList.toggle("hidden",!wizFabricante);
  q("#wizFabNome").textContent=wizFabricante||"";
  q("#wizModeloSearch").placeholder=wizFabricante?`Buscar dentro de ${wizFabricante} (nome ou código)`:"Buscar em todos os fabricantes (nome ou código)";
  try{
    if(!wizFabricante && !term){
      if(!wizFabricantesCache){
        box.innerHTML="<div class='small'>Carregando fabricantes...</div>";
        await wizCarregarFabricantes();
        if(seq!==wizFiltroSeq) return;
      }
      box.innerHTML=wizFabricantesCache.length
        ? `<div class="small" style="margin-bottom:8px">Escolha o fabricante pra ver os modelos dele, ou busque acima em todos.</div>`+wizFabricantesCache.map((f,i)=>`<button type="button" class="bigOption" style="padding:10px 14px" onclick="wizEscolherFabricanteIdx(${i})"><span class="ic" style="font-size:20px">🏭</span><span><b style="font-size:14px">${esc(f.fabricante)}</b><small>${f.total} modelo(s)</small></span></button>`).join("")
        : "<div class='small'>Nenhum modelo cadastrado ainda. Cadastre em \"Cadastrar modelo novo\".</div>";
      return;
    }
    const consulta=(de,ate)=>{
      let query=sb.from("modelos").select("*").order("codigo").order("id").range(de,ate);
      if(wizFabricante) query = wizFabricante===WIZ_SEM_FABRICANTE ? query.is("fabricante",null) : query.ilike("fabricante",likeLiteral(wizFabricante));
      if(term) query=query.or(`fabricante.ilike.%${term}%,linha.ilike.%${term}%,codigo.ilike.%${term}%,descricao.ilike.%${term}%`);
      return query;
    };
    box.innerHTML="<div class='small'>Buscando...</div>";
    let rows, cortado=false;
    if(wizFabricante){
      rows=await fetchAllRows(consulta);
    }else{
      const r=await consulta(0,99);
      if(r.error) throw r.error;
      rows=r.data||[];
      cortado=rows.length===100;
    }
    if(seq!==wizFiltroSeq) return;
    box.innerHTML=(rows.length?rows.map(wizBotaoModelo).join(""):"<div class='small'>Nenhum modelo encontrado. Use o botão \"+ Modelo novo\" abaixo pra cadastrar — ele entra no catálogo e neste pedido.</div>")
      +(cortado?`<div class="small" style="margin-top:8px">Mostrando só os 100 primeiros. Escolha um fabricante ou refine a busca pra ver os outros.</div>`:"");
  }catch(e){
    if(seq===wizFiltroSeq) box.innerHTML="<div class='small'>Erro: "+esc(e.message)+"</div>";
  }
}

// ---- Modelo novo criado dentro do próprio pedido ----
function wizAbrirModeloNovo(){
  wizPendenteAtual=null;
  const box=q("#wizModeloNovo");
  box.classList.remove("hidden");
  q("#mn_fabricante").value=(wizFabricante&&wizFabricante!==WIZ_SEM_FABRICANTE)?wizFabricante:"";
  q("#mn_codigo").value=q("#wizModeloSearch").value.trim();
  q("#mn_fabricantes").innerHTML=(wizFabricantesCache||[]).filter(f=>f.fabricante!==WIZ_SEM_FABRICANTE).map(f=>`<option value="${esc(f.fabricante)}">`).join("");
  box.scrollIntoView({behavior:"smooth",block:"start"});
  (q("#mn_fabricante").value?q("#mn_codigo"):q("#mn_fabricante")).focus();
}

// Aberto a partir de um código "não encontrado" da lista colada: já vem com
// fabricante/código preenchidos, e ao salvar entra no pedido com a
// quantidade e o ambiente que estavam naquela linha da lista.
function wizAbrirModeloNovoDoPendente(i){
  wizPendenteAtual=wizColarPendentes[i];
  if(!wizPendenteAtual) return;
  const box=q("#wizModeloNovo");
  box.classList.remove("hidden");
  q("#mn_fabricante").value=wizPendenteAtual.fabricante||"";
  q("#mn_codigo").value=wizPendenteAtual.codigo||"";
  q("#mn_fabricantes").innerHTML=(wizFabricantesCache||[]).filter(f=>f.fabricante!==WIZ_SEM_FABRICANTE).map(f=>`<option value="${esc(f.fabricante)}">`).join("");
  box.scrollIntoView({behavior:"smooth",block:"start"});
  (q("#mn_fabricante").value?q("#mn_codigo"):q("#mn_fabricante")).focus();
}

function wizFecharModeloNovo(){
  q("#wizModeloNovo").classList.add("hidden");
  wizPendenteAtual=null;
  ["mn_fabricante","mn_codigo","mn_potencia","mn_cct","mn_irc","mn_fluxo","mn_facho","mn_ip","mn_ik"].forEach(id=>{q("#"+id).value=""});
  q("#mn_tipo").value="";
}

async function wizSalvarModeloNovo(){
  const fabricante=q("#mn_fabricante").value.trim(), codigo=q("#mn_codigo").value.trim();
  if(!fabricante||!codigo) return msg("Informe o fabricante e o código do modelo.",false);
  const num=id=>q(id).value===""?null:Number(q(id).value);
  const g=await garantirModeloNoCatalogo({fabricante,codigo,potencia_w:num("#mn_potencia"),cct_k:num("#mn_cct"),irc:num("#mn_irc"),fluxo_lm:num("#mn_fluxo"),facho_graus:num("#mn_facho"),ip:norm(q("#mn_ip").value.trim()),ik:norm(q("#mn_ik").value.trim()),tipo_montagem:norm(q("#mn_tipo").value)});
  if(g.erro) return msg("Erro ao salvar o modelo: "+g.erro,false);
  wizFabricantesCache=null;
  const pendente=wizPendenteAtual;
  if(pendente){
    await wizAdicionarAoCarrinho(g.id,pendente.qty,pendente.ambiente);
    wizColarPendentes=wizColarPendentes.filter(p=>p!==pendente);
    atualizarWizColarPendentesUI();
  }else{
    await wizAdicionarAoCarrinho(g.id);
  }
  wizFecharModeloNovo();
  msg(g.criado?`Modelo ${codigo} (${fabricante}) salvo no catálogo e adicionado ao pedido.`:`O modelo ${codigo} já existia no catálogo — foi adicionado ao pedido.`);
  q("#wizCarrinhoList").scrollIntoView({behavior:"smooth",block:"center"});
  wizFiltrarModelos();
}

// Junta no carrinho por modelo + ambiente: mesmo código no mesmo ambiente
// soma a quantidade; mesmo código em ambiente diferente vira outra linha.
function ambienteKey(a){return (a||"").trim().toLowerCase()}
function wizAddOrMergeItem(modelo,qty,ambiente){
  ambiente=norm((ambiente||"").trim());
  const existing=wizCarrinho.find(x=>x.modelo.id===modelo.id && ambienteKey(x.ambiente)===ambienteKey(ambiente));
  if(existing) existing.qty+=qty;
  else wizCarrinho.push({modelo,qty,ambiente});
  renderWizCarrinho();
}

async function wizAdicionarAoCarrinho(modeloId,qty=1,ambiente=""){
  const r=await sb.from("modelos").select("*").eq("id",modeloId).single();
  if(r.error) return msg(r.error.message,false);
  wizAddOrMergeItem(r.data,qty,ambiente);
}

function wizRemoverItem(idx){wizCarrinho.splice(idx,1);renderWizCarrinho()}
function wizAtualizarQtd(idx,val){
  const n=parseInt(val,10);
  wizCarrinho[idx].qty=(n&&n>0)?n:1;
  q("#wizCarrinhoTotal").textContent=wizCarrinho.reduce((s,x)=>s+x.qty,0);
}
function wizAtualizarAmbiente(idx,val){
  wizCarrinho[idx].ambiente=norm(val.trim());
}

function renderWizCarrinho(){
  const box=q("#wizCarrinhoList");
  q("#wizCarrinhoTotal").textContent=wizCarrinho.reduce((s,x)=>s+x.qty,0);
  box.innerHTML = wizCarrinho.length ? wizCarrinho.map((item,idx)=>`
    <div class="card" style="padding:12px 14px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        ${item.modelo.imagem_url?`<img src="${esc(item.modelo.imagem_url)}" alt="" style="width:36px;height:36px;object-fit:contain;border:1px solid #eee;border-radius:4px">`:""}
        <div style="flex:1;min-width:160px"><b>${esc(item.modelo.fabricante)||""} — ${esc(item.modelo.codigo)}</b>${item.modelo.tipo_montagem==="Retrofit"?` <span class="pill" style="background:#edf3ff;color:#355fa8">Retrofit</span>`:""}</div>
        <input type="text" placeholder="Ambiente (opcional)" list="wizAmbientesList" value="${esc(item.ambiente||"")}" style="width:170px" onchange="wizAtualizarAmbiente(${idx},this.value)">
        <input type="number" min="1" value="${item.qty}" style="width:80px" onchange="wizAtualizarQtd(${idx},this.value)">
        <button type="button" class="secondary" onclick="wizRemoverItem(${idx})">Remover</button>
      </div>
      <details class="wizCompDetails" ontoggle="onWizCompToggle(${idx},this)">
        <summary class="small" style="cursor:pointer;font-weight:700;margin-top:8px">Definir Driver / LED / Óptica instalados (opcional)</summary>
        <div class="grid3" id="wizComp${idx}" style="margin-top:10px"><div class="small">Abrindo...</div></div>
      </details>
    </div>`).join("") : "<div class='small'>Nenhum item adicionado ainda.</div>";
}

const WIZ_TIPOS_COMPONENTE=["Driver","LED","Óptica"];

function onWizCompToggle(idx,detailsEl){
  if(detailsEl.open) carregarComponentesDoItem(idx);
}

// Carrega, pra este item do pedido, as peças compatíveis verificadas de cada
// tipo (Driver/LED/Óptica) já cadastradas no Catálogo de componentes — quem
// monta o pedido escolhe o que veio de fábrica em cada peça, sem digitar nada.
async function carregarComponentesDoItem(idx){
  const item=wizCarrinho[idx];
  const box=q(`#wizComp${idx}`);
  if(!item||!box) return;
  const resultados=await Promise.all(WIZ_TIPOS_COMPONENTE.map(tipo=>sb.rpc("listar_homologados",{p_componente:tipo,p_modelo_codigo:item.modelo.codigo})));
  if(!q(`#wizComp${idx}`)) return; // carrinho pode ter mudado enquanto carregava
  box.innerHTML = WIZ_TIPOS_COMPONENTE.map((tipo,i)=>{
    const r=resultados[i];
    const rows=r.error?[]:(r.data||[]);
    const atual=(item.compSelecionado&&item.compSelecionado[tipo])?item.compSelecionado[tipo].modelo_equivalente:"";
    const opcoes = rows.length
      ? rows.map(x=>`<option value="${esc(x.modelo_equivalente)}">${esc(x.modelo_equivalente)}${x.fabricante_equivalente?" — "+esc(x.fabricante_equivalente):""}${x.especificacao?" ("+esc(x.especificacao)+")":""}</option>`).join("")
      : `<option value="" disabled>— nenhuma peça compatível verificada cadastrada —</option>`;
    return `<div class="field"><label>${tipo}</label><select id="wizComp${idx}_${tipo}" onchange="wizEscolherComponente(${idx},'${tipo}',this.value)"><option value="">— não definir agora —</option>${opcoes}</select></div>`;
  }).join("");
  WIZ_TIPOS_COMPONENTE.forEach(tipo=>{
    const atual=(item.compSelecionado&&item.compSelecionado[tipo])?item.compSelecionado[tipo].modelo_equivalente:"";
    if(atual) q(`#wizComp${idx}_${tipo}`).value=atual;
  });
}

function wizEscolherComponente(idx,tipo,codigo){
  const item=wizCarrinho[idx];
  if(!item) return;
  item.compSelecionado=item.compSelecionado||{};
  if(!codigo){ delete item.compSelecionado[tipo]; return; }
  const sel=q(`#wizComp${idx}_${tipo}`);
  const opt=sel&&sel.querySelector(`option[value="${CSS.escape(codigo)}"]`);
  item.compSelecionado[tipo]={modelo_equivalente:codigo, especificacao:opt?opt.textContent:codigo};
}

function toggleWizColar(){
  const box=q("#wizColarBox");
  box.classList.toggle("hidden");
  q("#wizColarToggle").textContent=box.classList.contains("hidden")?"Pedido grande? Colar lista (código, quantidade, ambiente)":"Esconder colagem de lista";
}

function wizDetectarSeparador(linha){
  if(linha.includes("\t")) return "\t";
  if(linha.includes(";")) return ";";
  return ",";
}
function wizParseNumero(s){
  const n=parseInt(String(s||"").replace(/[^\d-]/g,""),10);
  return (n&&n>0)?n:null;
}

// Aceita: código, quantidade, ambiente, fabricante (as 3 últimas opcionais).
// Fabricante só é necessário quando o mesmo código existe em mais de um
// fabricante no catálogo. Detecta e ignora uma linha de cabeçalho sozinho.
async function wizColarProcessar(){
  const texto=q("#wizColarTexto").value.trim();
  const msgBox=q("#wizColarMsg");
  if(!texto) return;
  let linhas=texto.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!linhas.length) return;
  const sep=wizDetectarSeparador(linhas[0]);
  const primeirasPartes=linhas[0].split(sep).map(s=>s.trim());
  if(primeirasPartes.length>=2 && !wizParseNumero(primeirasPartes[1])){
    linhas=linhas.slice(1); // 1ª linha parece cabeçalho (2ª coluna não é número)
  }
  let achados=0;
  const ambiguos=[];
  for(const linha of linhas){
    const partes=linha.split(sep).map(s=>s.trim());
    const [codigoRaw,qtdRaw,ambienteRaw,fabricanteRaw]=partes;
    if(!codigoRaw) continue;
    const qty=wizParseNumero(qtdRaw)||1;
    const ambiente=(ambienteRaw||"").trim();
    const fabricante=(fabricanteRaw||"").trim();
    let query=sb.from("modelos").select("*").ilike("codigo",likeLiteral(codigoRaw));
    if(fabricante) query=query.ilike("fabricante",likeLiteral(fabricante));
    const r=await query.limit(10);
    if(r.error){ msgBox.innerHTML="Erro: "+esc(r.error.message); return; }
    const rows=r.data||[];
    if(!rows.length){
      wizColarPendentes.push({codigo:codigoRaw,fabricante,qty,ambiente});
      continue;
    }
    if(rows.length>1){
      const fabsDistintos=[...new Set(rows.map(x=>x.fabricante||"(sem fabricante)"))];
      if(fabsDistintos.length>1){ ambiguos.push({codigo:codigoRaw,fabricantes:fabsDistintos}); continue; }
    }
    wizAddOrMergeItem(rows[0],qty,ambiente);
    achados++;
  }
  q("#wizColarTexto").value="";
  renderWizColarMsg(achados,ambiguos);
}

function renderWizColarMsg(achados,ambiguos){
  const msgBox=q("#wizColarMsg");
  let html="";
  if(achados) html+=`${achados} linha(s) adicionada(s) ao pedido.`;
  if(ambiguos&&ambiguos.length){
    html+=`<div style="margin-top:6px;color:#b33">Código existe em mais de um fabricante — inclua o fabricante na linha pra eu saber qual usar:<br>${ambiguos.map(a=>`${esc(a.codigo)} (${a.fabricantes.map(esc).join(", ")})`).join("<br>")}</div>`;
  }
  if(wizColarPendentes.length){
    html+=`<div style="margin-top:6px">Código(s) não encontrado(s) no catálogo — clique pra cadastrar e já entrar no pedido:<br>${wizColarPendentes.map((p,i)=>`<button type="button" class="secondary" style="margin:4px 4px 0 0" onclick="wizAbrirModeloNovoDoPendente(${i})">${esc(p.codigo)}${p.ambiente?" — "+esc(p.ambiente):""} (${p.qty}×)</button>`).join("")}</div>`;
  }
  msgBox.innerHTML = html || "Nenhum código reconhecido nessa lista.";
}

function atualizarWizColarPendentesUI(){
  const msgBox=q("#wizColarMsg");
  if(!msgBox) return;
  msgBox.innerHTML = wizColarPendentes.length
    ? `Ainda faltam cadastrar:<br>${wizColarPendentes.map((p,i)=>`<button type="button" class="secondary" style="margin:4px 4px 0 0" onclick="wizAbrirModeloNovoDoPendente(${i})">${esc(p.codigo)}${p.ambiente?" — "+esc(p.ambiente):""} (${p.qty}×)</button>`).join("")}`
    : "Tudo adicionado ao pedido.";
}

async function wizRevisar(){
  if(!wizCarrinho.length) return msg("Adicione pelo menos um modelo ao pedido.",false);
  if(!wizObraPrefixo) return msg("Essa obra não tem prefixo. Abra a obra, clique em Editar obra e defina um.",false);
  const total=wizCarrinho.reduce((s,x)=>s+x.qty,0);
  const r=await sb.rpc("reservar_numeros",{p_prefix:`LD-${wizObraPrefixo}-`,p_qtd:total});
  if(r.error) return msg("Erro ao reservar numeração: "+r.error.message,false);
  let proximo=r.data;
  let html="";
  for(const item of wizCarrinho){
    item.startNum=proximo;
    proximo+=item.qty;
    const firstId=buildObraId(wizObraPrefixo,item.startNum), lastId=buildObraId(wizObraPrefixo,item.startNum+item.qty-1);
    const compTxt=Object.entries(item.compSelecionado||{}).filter(([,v])=>v&&v.modelo_equivalente).map(([tipo,v])=>`${tipo}: ${esc(v.especificacao||v.modelo_equivalente)}`).join(" · ");
    html+=`<div style="margin-bottom:10px"><b>${item.qty}×</b> ${esc(item.modelo.fabricante)} — ${esc(item.modelo.codigo)}${item.ambiente?" · "+esc(item.ambiente):""}<br><span class="small">${firstId}${item.qty>1?" até "+lastId:""}</span>${compTxt?`<br><span class="small">${compTxt}</span>`:""}</div>`;
  }
  q("#wizResumo").innerHTML=`<div class="small" style="margin-bottom:10px">Obra: <b>${esc(wizObra.empreendimento)||"—"}</b>${wizObra.cliente?" · "+esc(wizObra.cliente):""}</div>${html}<div style="margin-top:6px"><b>Total: ${total} peça(s)</b></div>`;
  wizStep(3);
}

// Grava em blocos de 500 pra pedido grande não estourar o limite de linhas
// devolvidas por consulta (1000) nem o tamanho da requisição. Se um bloco
// falhar, o erro já avisa quais IDs chegaram a ser criados.
async function inserirLuminariasEmBlocos(rows){
  const criadas=[];
  for(let i=0;i<rows.length;i+=500){
    const r=await sb.from("luminarias").insert(rows.slice(i,i+500)).select("id,lumidna_id,public_code,numero_serie");
    if(r.error){
      const jaFeitas=criadas.length?` Atenção: ${criadas.length} peça(s) já tinham sido criadas antes do erro (${criadas[0].lumidna_id} até ${criadas[criadas.length-1].lumidna_id}) — confira em Buscar peça antes de refazer.`:"";
      return {criadas,erro:r.error.message+jaFeitas};
    }
    criadas.push(...r.data);
  }
  return {criadas,erro:null};
}

async function wizCriar(){
  const rows=[];
  for(const item of wizCarrinho){
    for(let i=0;i<item.qty;i++){
      const num=item.startNum+i;
      rows.push({
        lumidna_id:buildObraId(wizObraPrefixo,num),
        modelo_id:item.modelo.id, modelo:item.modelo.codigo, fabricante:item.modelo.fabricante,
        potencia_w:item.modelo.potencia_w, cct_k:item.modelo.cct_k, irc:item.modelo.irc,
        fluxo_lm:item.modelo.fluxo_lm, facho_graus:item.modelo.facho_graus,
        ip:item.modelo.ip, ik:item.modelo.ik, ambiente:item.ambiente||null,
        status:"Ativa", criticidade:"Média", obra_id:wizObraId, ...wizObra
      });
    }
  }
  const ins=await inserirLuminariasEmBlocos(rows);
  if(ins.erro) return msg("Erro ao criar o pedido: "+ins.erro,false);
  const criadas=ins.criadas;
  wizUltimaCriacao=criadas;

  // Pra itens onde foi escolhido Driver/LED/Óptica (Definir peças instaladas,
  // no passo 2), já grava isso como componente original desde a criação —
  // pra modelos Retrofit, é assim que a página pública passa a buscar
  // potência/CCT/fluxo direto do catálogo de componentes (complementares,
  // não unidos: se a peça for trocada depois, o histórico de manutenção
  // continua sendo a fonte da verdade).
  let offset=0;
  const componenteRows=[];
  for(const item of wizCarrinho){
    const idsDoItem=criadas.slice(offset,offset+item.qty);
    offset+=item.qty;
    Object.entries(item.compSelecionado||{}).forEach(([tipo,val])=>{
      if(!val||!val.modelo_equivalente) return;
      idsDoItem.forEach(l=>componenteRows.push({luminaria_id:l.id,tipo,modelo:val.modelo_equivalente,original:true,ativo_atual:true}));
    });
  }
  if(componenteRows.length){
    for(let i=0;i<componenteRows.length;i+=500){
      const rc=await sb.from("componentes").insert(componenteRows.slice(i,i+500));
      if(rc.error){ msg("Peças criadas, mas houve erro ao gravar as peças instaladas: "+rc.error.message,false); break; }
    }
  }
  const ids=criadas.map(x=>x.lumidna_id);
  q("#wizSucessoTitulo").textContent=`${ids.length} peça(s) criada(s)`;
  const porModelo=wizCarrinho.map(item=>`${item.qty}× ${esc(item.modelo.fabricante)} — ${esc(item.modelo.codigo)}`).join("<br>");
  q("#wizSucessoTexto").innerHTML=`${porModelo}<br><br>De <b>${ids[0]}</b> até <b>${ids[ids.length-1]}</b>.`;
  wizStep(4);
  q("#wizSteps").innerHTML="";
}

// Imprime QR + etiqueta de uma lista de peças ({lumidna_id, public_code}).
// Só lê dados que já existem — não cria nem reserva nenhuma peça nova. Usada
// tanto pela tela de sucesso do cadastro em lote quanto pelo botão de
// reimpressão na tela da obra.
function imprimirEtiquetasQR(lista){
  if(!lista.length) return msg("Nenhuma peça pra imprimir.",false);
  const sheet=q("#printQRSheet");
  sheet.innerHTML="";
  const grid=document.createElement("div");
  grid.className="qrGrid";
  sheet.appendChild(grid);
  lista.forEach(x=>{
    const url=`${LUMIDNA_SITE_BASE}/ativo/?c=${x.public_code}`;
    const item=document.createElement("div");
    item.className="qrItem";

    const logo=document.createElement("div");
    logo.className="qrLogo";
    logo.innerHTML=`Lumi<span>DNA</span>`;
    item.appendChild(logo);

    const nfc=document.createElement("div");
    nfc.className="qrNfc";
    nfc.innerHTML=`📶 Aproxime o celular`;
    item.appendChild(nfc);

    const qrBox=document.createElement("div");
    qrBox.className="qrCode";
    item.appendChild(qrBox);
    new QRCode(qrBox,{text:url,width:120,height:120,correctLevel:QRCode.CorrectLevel.M});

    const id=document.createElement("div");
    id.className="qrId";
    id.textContent=x.lumidna_id;
    item.appendChild(id);

    grid.appendChild(item);
  });
  setTimeout(()=>window.print(),300);
}

function wizImprimirQR(){
  imprimirEtiquetasQR(wizUltimaCriacao);
}

