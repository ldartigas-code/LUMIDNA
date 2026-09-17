// ---- Peças pra comprar (pedidos de reposição, Fase 2 do "Reportar problema") ----
async function checkReposicaoBadge(){
  const r=await sb.from("solicitacoes_reposicao").select("id",{count:"exact",head:true}).eq("status","Aguardando compra");
  const n=r.count||0;
  const resumo=q("#reposicaoResumo");
  if(!resumo) return;
  resumo.textContent = n>0 ? `${n} peça(s) aguardando compra` : "Pedidos de reposição reportados pela página pública, antes da manutenção";
}

function renderReposicaoCard(p,resolvida){
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
        <div>
          <b>${esc(p.luminarias?.lumidna_id)}</b> — ${esc(p.luminarias?.modelo)||"—"} ${p.luminarias?.empreendimento?"· "+esc(p.luminarias.empreendimento):""}${p.luminarias?.cliente?" · "+esc(p.luminarias.cliente):""}
          <div class="small">Reportado ${p.solicitante_nome?"por <b>"+esc(p.solicitante_nome)+"</b> ":""}em ${new Date(p.criado_em).toLocaleString('pt-BR')}${p.solicitante_contato?" — contato: "+esc(p.solicitante_contato):""}</div>
        </div>
        <span class="pill" style="${resolvida?"background:#e9f7ee;color:#257944":"background:#fff4e0;color:#c98a12"}">${resolvida?"Comprado":"Aguardando compra"}</span>
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>Sintoma relatado</label><div class="small">${esc(p.sintoma)||"—"}</div></div>
        <div class="field"><label>Componente sugerido</label><div class="small">${esc(p.componente_sugerido)||"— não deu pra saber pelo sintoma —"}</div></div>
        <div class="field span2"><label>Peça recomendada</label><div class="small">${p.peca_recomendada_modelo?`<b>${esc(p.peca_recomendada_modelo)}</b>${p.peca_recomendada_fabricante?" — "+esc(p.peca_recomendada_fabricante):""}`:"— nenhuma peça homologada encontrada pra esse caso —"}</div></div>
      </div>
      ${resolvida?"":`<div class="actions" style="margin-top:12px"><button type="button" class="primary" onclick="marcarReposicaoComprada(${p.id})">✓ Marcar como comprado</button></div>`}
    </div>`;
}

async function loadReposicoes(){
  const box=q("#reposicaoList");
  const r=await sb.from("solicitacoes_reposicao").select("*,luminarias(lumidna_id,modelo,cliente,empreendimento)").eq("status","Aguardando compra").order("criado_em",{ascending:false});
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML = rows.length ? rows.map(p=>renderReposicaoCard(p,false)).join("") : "<div class='small'>Nenhum pedido de reposição pendente no momento.</div>";
}

async function loadReposicoesResolvidas(){
  const box=q("#reposicaoResolvidasList");
  const r=await sb.from("solicitacoes_reposicao").select("*,luminarias(lumidna_id,modelo,cliente,empreendimento)").eq("status","Comprado").order("criado_em",{ascending:false}).limit(300);
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML = rows.length ? rows.map(p=>renderReposicaoCard(p,true)).join("") : "<div class='small'>Nenhuma compra resolvida ainda.</div>";
}

async function marcarReposicaoComprada(id){
  const r=await sb.from("solicitacoes_reposicao").update({status:"Comprado"}).eq("id",id);
  if(r.error) return msg("Erro: "+r.error.message,false);
  msg("Marcado como comprado. Quando a peça for instalada, confirme em \"Registrar manutenção\".");
  loadReposicoes();loadReposicoesResolvidas();checkReposicaoBadge();
}
