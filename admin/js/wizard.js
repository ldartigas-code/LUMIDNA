// ---- Assistente: cadastrar peças novas (pedido / carrinho) ----
let wizObra=null, wizObraId=null, wizCarrinho=[], wizPendingModeloId=null, wizUltimaCriacao=[], wizPularParaCarrinho=false;

function wizStep(n){
  ["wz-1","wz-2","wz-3","wz-4"].forEach((id,i)=>q("#"+id).classList.toggle("hidden",i!==n-1));
  q("#wizSteps").innerHTML=["Obra","Pedido","Confirmar"].map((l,i)=>(i===n-1?`<b>${i+1}. ${l}</b>`:`${i+1}. ${l}`)).join("  →  ");
  if(n===1){
    wizObra=null;wizObraId=null;wizCarrinho=[];
    q("#wizObraSearch").value="";
    q("#wizObraBusca").classList.remove("hidden");
    q("#wizObraEscolhida").classList.add("hidden");
    q("#wizNovaObraFields").classList.add("hidden");
    q("#wiz_cliente").value="";q("#wiz_empreendimento").value="";q("#wiz_edificio").value="";
    q("#wiz_tensao").value="";q("#wiz_automacao").value="nao";q("#wiz_protocolo_field").classList.add("hidden");
    wizFiltrarObras();
  }
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
  box.innerHTML=rows.length?rows.map(o=>`<button type="button" class="bigOption" style="padding:10px 14px" onclick="wizEscolherObraExistente(${o.id})"><span class="ic" style="font-size:20px">📁</span><span><b style="font-size:14px">${esc(o.nome)}</b><small>${esc(o.cliente)||""}</small></span></button>`).join(""):"<div class='small'>Nenhuma obra encontrada. Crie uma nova abaixo.</div>";
}

function toggleWizNovaObra(){
  q("#wizNovaObraFields").classList.toggle("hidden");
}

function montarResumoObra(){
  const temAuto=wizObra.automacao;
  q("#wizObraEscolhidaResumo").innerHTML=`Obra: <b>${esc(wizObra.empreendimento)}</b>${wizObra.cliente?" · "+esc(wizObra.cliente):""}${wizObra.tensao_instalacao?" · "+esc(wizObra.tensao_instalacao):""}${temAuto?" · Automação "+esc(wizObra.protocolo_automacao):" · Sem automação"}`;
  q("#wizObraBusca").classList.add("hidden");
  q("#wizObraEscolhida").classList.remove("hidden");
}

async function wizEscolherObraExistente(id){
  const r=await sb.from("obras").select("*").eq("id",id).single();
  if(r.error) return msg(r.error.message,false);
  const o=r.data;
  wizObraId=o.id;
  wizObra={cliente:o.cliente,empreendimento:o.nome,edificio:null,tensao_instalacao:o.tensao_instalacao,automacao:o.automacao,protocolo_automacao:o.protocolo_automacao};
  montarResumoObra();
}

async function wizCriarNovaObra(){
  const nome=q("#wiz_empreendimento").value.trim();
  if(!nome) return msg("Informe o nome da obra.",false);
  const temAutomacao=q("#wiz_automacao").value==="sim";
  const p={nome,cliente:norm(q("#wiz_cliente").value.trim()),tensao_instalacao:norm(q("#wiz_tensao").value),automacao:temAutomacao,protocolo_automacao:temAutomacao?q("#wiz_protocolo").value:null};
  const r=await sb.from("obras").insert(p).select().single();
  if(r.error) return msg("Erro ao criar obra: "+r.error.message,false);
  wizObraId=r.data.id;
  wizObra={cliente:r.data.cliente,empreendimento:r.data.nome,edificio:null,tensao_instalacao:r.data.tensao_instalacao,automacao:r.data.automacao,protocolo_automacao:r.data.protocolo_automacao};
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
  wizFiltrarModelos();
  renderWizCarrinho();
  wizStep(2);
  if(wizPendingModeloId){const id=wizPendingModeloId;wizPendingModeloId=null;wizAdicionarAoCarrinho(id)}
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

async function wizFiltrarModelos(){
  const term=q("#wizModeloSearch").value.trim();
  const box=q("#wizListaModelos");
  let query=sb.from("modelos").select("*").order("fabricante").order("codigo").limit(100);
  if(term) query=query.or(`fabricante.ilike.%${term}%,linha.ilike.%${term}%,codigo.ilike.%${term}%,descricao.ilike.%${term}%`);
  const r=await query;
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML=rows.length?rows.map(m=>`<button type="button" class="bigOption" style="padding:10px 14px" onclick="wizAdicionarAoCarrinho(${m.id})">${m.imagem_url?`<img src="${esc(m.imagem_url)}" alt="" style="width:36px;height:36px;object-fit:contain;border:1px solid #eee;border-radius:4px">`:`<span class="ic" style="font-size:20px">💡</span>`}<span><b style="font-size:14px">${esc(m.fabricante)||"?"} — ${esc(m.codigo)}</b><small>${esc(m.descricao)||""}</small></span></button>`).join(""):"<div class='small'>Nenhum modelo encontrado. Tente outro termo.</div>";
}

async function wizAdicionarAoCarrinho(modeloId){
  const existing=wizCarrinho.find(x=>x.modelo.id===modeloId);
  if(existing){existing.qty++;renderWizCarrinho();return}
  const r=await sb.from("modelos").select("*").eq("id",modeloId).single();
  if(r.error) return msg(r.error.message,false);
  wizCarrinho.push({modelo:r.data,qty:1});
  renderWizCarrinho();
}

function wizRemoverItem(idx){wizCarrinho.splice(idx,1);renderWizCarrinho()}
function wizAtualizarQtd(idx,val){
  const n=parseInt(val,10);
  wizCarrinho[idx].qty=(n&&n>0)?n:1;
  q("#wizCarrinhoTotal").textContent=wizCarrinho.reduce((s,x)=>s+x.qty,0);
}

function renderWizCarrinho(){
  const box=q("#wizCarrinhoList");
  q("#wizCarrinhoTotal").textContent=wizCarrinho.reduce((s,x)=>s+x.qty,0);
  box.innerHTML = wizCarrinho.length ? wizCarrinho.map((item,idx)=>`
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 14px">
      ${item.modelo.imagem_url?`<img src="${esc(item.modelo.imagem_url)}" alt="" style="width:36px;height:36px;object-fit:contain;border:1px solid #eee;border-radius:4px">`:""}
      <div style="flex:1"><b>${esc(item.modelo.fabricante)||""} — ${esc(item.modelo.codigo)}</b></div>
      <input type="number" min="1" value="${item.qty}" style="width:80px" onchange="wizAtualizarQtd(${idx},this.value)">
      <button type="button" class="secondary" onclick="wizRemoverItem(${idx})">Remover</button>
    </div>`).join("") : "<div class='small'>Nenhum item adicionado ainda.</div>";
}

function toggleWizColar(){
  const box=q("#wizColarBox");
  box.classList.toggle("hidden");
  q("#wizColarToggle").textContent=box.classList.contains("hidden")?"Pedido grande? Colar lista (código, quantidade)":"Esconder colagem de lista";
}

async function wizColarProcessar(){
  const texto=q("#wizColarTexto").value.trim();
  const msgBox=q("#wizColarMsg");
  if(!texto) return;
  const linhas=texto.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let achados=0, naoAchados=[];
  for(const linha of linhas){
    const [codigoRaw,qtdRaw]=linha.split(",").map(s=>s.trim());
    if(!codigoRaw) continue;
    const qty=parseInt(qtdRaw,10)||1;
    const r=await sb.from("modelos").select("*").ilike("codigo",codigoRaw).limit(1);
    if(r.error||!r.data||!r.data.length){naoAchados.push(codigoRaw);continue}
    const modelo=r.data[0];
    const existing=wizCarrinho.find(x=>x.modelo.id===modelo.id);
    if(existing) existing.qty+=qty; else wizCarrinho.push({modelo,qty});
    achados++;
  }
  renderWizCarrinho();
  q("#wizColarTexto").value="";
  msgBox.innerHTML = achados
    ? `${achados} modelo(s) adicionado(s).${naoAchados.length?` Não encontrado(s): ${naoAchados.map(esc).join(", ")}`:""}`
    : `Nenhum código reconhecido.${naoAchados.length?` Não encontrado(s): ${naoAchados.map(esc).join(", ")}`:""}`;
}

async function wizRevisar(){
  if(!wizCarrinho.length) return msg("Adicione pelo menos um modelo ao pedido.",false);
  let html="";
  let total=0;
  for(const item of wizCarrinho){
    const prefix=`LD-${fabCode(item.modelo.fabricante)}-${modelBase(item.modelo.codigo)}-`;
    const r=await sb.from("luminarias").select("lumidna_id").ilike("lumidna_id",prefix+"%").order("lumidna_id",{ascending:false}).limit(1);
    if(r.error) return msg("Erro: "+r.error.message,false);
    const last=r.data&&r.data[0]?parseInt(r.data[0].lumidna_id.slice(prefix.length),10):0;
    item.startNum=(last||0)+1;
    const firstId=buildLumidnaId(item.modelo,item.startNum), lastId=buildLumidnaId(item.modelo,item.startNum+item.qty-1);
    total+=item.qty;
    html+=`<div style="margin-bottom:10px"><b>${item.qty}×</b> ${esc(item.modelo.fabricante)} — ${esc(item.modelo.codigo)}<br><span class="small">${firstId}${item.qty>1?" até "+lastId:""}</span></div>`;
  }
  q("#wizResumo").innerHTML=`<div class="small" style="margin-bottom:10px">Obra: <b>${esc(wizObra.empreendimento)||"—"}</b>${wizObra.cliente?" · "+esc(wizObra.cliente):""}</div>${html}<div style="margin-top:6px"><b>Total: ${total} peça(s)</b></div>`;
  wizStep(3);
}

async function wizCriar(){
  const rows=[];
  for(const item of wizCarrinho){
    for(let i=0;i<item.qty;i++){
      const num=item.startNum+i;
      rows.push({
        lumidna_id:buildLumidnaId(item.modelo,num),
        modelo_id:item.modelo.id, modelo:item.modelo.codigo, fabricante:item.modelo.fabricante,
        potencia_w:item.modelo.potencia_w, cct_k:item.modelo.cct_k, irc:item.modelo.irc,
        fluxo_lm:item.modelo.fluxo_lm, facho_graus:item.modelo.facho_graus,
        ip:item.modelo.ip, ik:item.modelo.ik,
        status:"Ativa", criticidade:"Média", obra_id:wizObraId, ...wizObra
      });
    }
  }
  const r=await sb.from("luminarias").insert(rows).select("lumidna_id,public_code,numero_serie");
  if(r.error) return msg("Erro ao criar o pedido: "+r.error.message,false);
  wizUltimaCriacao=r.data;
  const ids=r.data.map(x=>x.lumidna_id);
  q("#wizSucessoTitulo").textContent=`${ids.length} peça(s) criada(s)`;
  const porModelo=wizCarrinho.map(item=>`${item.qty}× ${esc(item.modelo.fabricante)} — ${esc(item.modelo.codigo)}`).join("<br>");
  q("#wizSucessoTexto").innerHTML=`${porModelo}<br><br>De <b>${ids[0]}</b> até <b>${ids[ids.length-1]}</b>.`;
  wizStep(4);
  q("#wizSteps").innerHTML="";
}

function wizImprimirQR(){
  if(!wizUltimaCriacao.length) return;
  const sheet=q("#printQRSheet");
  sheet.innerHTML="";
  const grid=document.createElement("div");
  grid.className="qrGrid";
  sheet.appendChild(grid);
  wizUltimaCriacao.forEach(x=>{
    const url=`${LUMIDNA_SITE_BASE}/ativo/?c=${x.public_code}`;
    const item=document.createElement("div");
    item.className="qrItem";
    const qrBox=document.createElement("div");
    item.appendChild(qrBox);
    new QRCode(qrBox,{text:url,width:130,height:130});
    const label=document.createElement("b");
    label.textContent=x.lumidna_id;
    item.appendChild(label);
    const serie=document.createElement("div");
    serie.className="small";
    serie.style.marginTop="4px";
    serie.textContent = x.numero_serie ? `Nº série: ${x.numero_serie}` : "Nº série: ________________";
    item.appendChild(serie);
    grid.appendChild(item);
  });
  setTimeout(()=>window.print(),300);
}

