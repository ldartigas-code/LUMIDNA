// ---- Peças pra comprar (pedidos de reposição, Fase 2 do "Reportar problema") ----
async function checkReposicaoBadge(){
  const r=await sb.from("solicitacoes_reposicao").select("id",{count:"exact",head:true}).eq("status","Aguardando compra");
  const n=r.count||0;
  const resumo=q("#reposicaoResumo");
  if(!resumo) return;
  resumo.innerHTML = n>0 ? `<b style="color:var(--red)">${n} peça(s) aguardando compra</b>` : "Pedidos de reposição reportados pela página pública, antes da manutenção";
}

function fmtPreco(v){
  return v==null ? null : `R$ ${Number(v).toFixed(2).replace(".",",")}`;
}

function renderReposicaoCard(p,resolvida,precoAtual){
  const preco=fmtPreco(precoAtual);
  return `
    <div class="card" id="repCard${p.id}">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
        <div>
          <b>${esc(p.luminarias?.lumidna_id)}</b> — ${esc(p.luminarias?.modelo)||"—"} ${p.luminarias?.empreendimento?"· "+esc(p.luminarias.empreendimento):""}${p.luminarias?.cliente?" · "+esc(p.luminarias.cliente):""}
          <div class="small">Reportado ${p.solicitante_nome?"por <b>"+esc(p.solicitante_nome)+"</b> ":""}em ${new Date(p.criado_em).toLocaleString('pt-BR')}${p.solicitante_contato?" — contato: "+esc(p.solicitante_contato):""}</div>
          <div class="small">${resolvida
            ? (p.comprado_em?"Comprado em "+new Date(p.comprado_em).toLocaleString('pt-BR')+" — "+fmtDuracao(new Date(p.comprado_em)-new Date(p.criado_em))+" depois do aviso":"Horário da compra não registrado (compra anterior ao controle de horários)")
            : "<b style='color:var(--red)'>Aguardando há "+fmtDuracao(Date.now()-new Date(p.criado_em).getTime())+"</b>"+(p.pedido_enviado_em?" · pedido enviado em "+new Date(p.pedido_enviado_em).toLocaleString('pt-BR'):" · pedido ainda não enviado")}</div>
        </div>
        <span class="pill" style="${resolvida?"background:#e9f7ee;color:#257944":"background:#fff4e0;color:#c98a12"}">${resolvida?"Comprado":"Aguardando compra"}</span>
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field"><label>Sintoma relatado</label><div class="small">${esc(p.sintoma)||"—"}</div></div>
        <div class="field"><label>Componente sugerido</label><div class="small">${esc(p.componente_sugerido)||"— não deu pra saber pelo sintoma —"}</div></div>
        <div class="field span2">
          <label>Peça recomendada</label>
          ${resolvida
            ? `<div class="small">${p.peca_recomendada_modelo?`<b>${esc(p.peca_recomendada_modelo)}</b>${p.peca_recomendada_fabricante?" — "+esc(p.peca_recomendada_fabricante):""}${preco?" — "+preco:""}`:"—"}</div>`
            : `<select id="repPeca${p.id}" onchange="onTrocarPecaReposicao(${p.id})"><option value="">Carregando opções...</option></select>`}
        </div>
      </div>
      ${resolvida?"":`<div class="actions" style="margin-top:12px">
        <button type="button" class="primary" onclick="marcarReposicaoComprada(${p.id})">✓ Marcar como comprado</button>
        <button type="button" class="secondary" onclick="gerarEmailReposicao(${p.id})">✉ Gerar e-mail pra compra</button>
      </div>`}
    </div>`;
}

// Aviso de problema mais recente da peça que ainda não foi ligado a nenhuma
// troca — é a ele que a manutenção que está sendo registrada responde.
async function acharSolicitacaoParaLigar(luminariaId,ateISO){
  const s=await sb.from("solicitacoes_reposicao").select("id").eq("luminaria_id",luminariaId).lte("criado_em",ateISO).order("criado_em",{ascending:false}).limit(20);
  const ids=(s.data||[]).map(x=>x.id);
  if(!ids.length) return null;
  const usados=await sb.from("manutencoes").select("solicitacao_id").in("solicitacao_id",ids);
  const ocupados=new Set((usados.data||[]).map(x=>x.solicitacao_id));
  const livre=ids.find(id=>!ocupados.has(id));
  return livre==null?null:livre;
}

async function precosDe(codigos){
  const validos=[...new Set(codigos.filter(Boolean))];
  if(!validos.length) return {};
  const r=await sb.from("equivalentes").select("modelo_equivalente,preco_referencia").in("modelo_equivalente",validos);
  const map={};
  (r.data||[]).forEach(e=>map[e.modelo_equivalente]=e.preco_referencia);
  return map;
}

async function loadReposicoes(){
  const box=q("#reposicaoList");
  const r=await sb.from("solicitacoes_reposicao").select("*,luminarias(lumidna_id,modelo,cliente,empreendimento)").eq("status","Aguardando compra").order("criado_em",{ascending:false});
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  const precos=await precosDe(rows.map(p=>p.peca_recomendada_modelo));
  box.innerHTML = rows.length ? rows.map(p=>renderReposicaoCard(p,false,precos[p.peca_recomendada_modelo])).join("") : "<div class='small'>Nenhum pedido de reposição pendente no momento.</div>";
  rows.forEach(p=>preencherOpcoesReposicao(p));
}

async function loadReposicoesResolvidas(){
  const box=q("#reposicaoResolvidasList");
  const r=await sb.from("solicitacoes_reposicao").select("*,luminarias(lumidna_id,modelo,cliente,empreendimento)").eq("status","Comprado").order("criado_em",{ascending:false}).limit(300);
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  const precos=await precosDe(rows.map(p=>p.peca_recomendada_modelo));
  box.innerHTML = rows.length ? rows.map(p=>renderReposicaoCard(p,true,precos[p.peca_recomendada_modelo])).join("") : "<div class='small'>Nenhuma compra resolvida ainda.</div>";
}

// Popula o <select> de peças compatíveis verificadas com o modelo da
// luminária (mesma lista que já aparece pro técnico na página pública),
// deixando o Admin trocar por outra opção antes de mandar comprar.
async function preencherOpcoesReposicao(p){
  const sel=q(`#repPeca${p.id}`);
  if(!sel) return;
  const componente=p.componente_sugerido;
  const modeloCodigo=p.luminarias?.modelo||null;
  let opcoes=[];
  if(componente){
    const r=await sb.rpc("listar_homologados",{p_componente:componente,p_modelo_codigo:modeloCodigo});
    if(!r.error) opcoes=r.data||[];
  }else{
    for(const comp of ["Driver","LED"]){
      const r=await sb.rpc("listar_homologados",{p_componente:comp,p_modelo_codigo:modeloCodigo});
      if(!r.error) opcoes=opcoes.concat(r.data||[]);
    }
  }
  if(!q(`#repPeca${p.id}`)) return; // tela pode ter mudado enquanto carregava
  const precos=await precosDe(opcoes.map(o=>o.modelo_equivalente));
  sel.innerHTML = opcoes.length
    ? `<option value="">— nenhuma —</option>` + opcoes.map(o=>{
        const preco=fmtPreco(precos[o.modelo_equivalente]);
        return `<option value="${esc(o.modelo_equivalente)}" data-fab="${esc(o.fabricante_equivalente||"")}">${esc(o.modelo_equivalente)}${o.fabricante_equivalente?" — "+esc(o.fabricante_equivalente):""}${preco?" — "+preco:""}</option>`;
      }).join("")
    : `<option value="">— nenhuma peça compatível verificada cadastrada —</option>`;
  sel.value=p.peca_recomendada_modelo||"";
}

async function onTrocarPecaReposicao(id){
  const sel=q(`#repPeca${id}`);
  const modelo=sel.value||null;
  const fabricante=modelo?sel.selectedOptions[0].dataset.fab||null:null;
  const r=await sb.from("solicitacoes_reposicao").update({peca_recomendada_modelo:modelo,peca_recomendada_fabricante:fabricante}).eq("id",id);
  if(r.error) return msg("Erro ao trocar peça: "+r.error.message,false);
  msg("Peça recomendada atualizada.");
}

async function marcarReposicaoComprada(id){
  const r=await sb.from("solicitacoes_reposicao").update({status:"Comprado",comprado_em:new Date().toISOString()}).eq("id",id);
  if(r.error) return msg("Erro: "+r.error.message,false);
  msg("Marcado como comprado. Quando a peça for instalada, confirme em \"Registrar manutenção\".");
  loadReposicoes();loadReposicoesResolvidas();checkReposicaoBadge();
}

async function gerarEmailReposicao(id){
  const r=await sb.from("solicitacoes_reposicao").select("*,luminarias(lumidna_id,cliente,empreendimento,edificio,ambiente,posicao)").eq("id",id).single();
  if(r.error) return msg("Erro: "+r.error.message,false);
  const p=r.data;
  const lum=p.luminarias||{};
  const precos=await precosDe([p.peca_recomendada_modelo]);
  const preco=fmtPreco(precos[p.peca_recomendada_modelo]);
  const local=[lum.empreendimento,lum.edificio,lum.ambiente,lum.posicao].filter(Boolean).join(" — ");
  const assunto=`LumiDNA — compra de peça para a luminária ${lum.lumidna_id||""}`;
  const corpo=`Olá,

A luminária ${lum.lumidna_id||""}${local?" ("+local+")":""} apresentou o seguinte problema e precisa de reposição antes da manutenção:

- Sintoma relatado: ${p.sintoma||"—"}
- Componente indicado: ${p.componente_sugerido||"a confirmar"}
- Peça compatível verificada recomendada: ${p.peca_recomendada_modelo||"a definir"}${p.peca_recomendada_fabricante?" — "+p.peca_recomendada_fabricante:""}
- Valor de referência: ${preco||"consultar"}

Por favor, providenciar a compra da peça acima antes do técnico ir a campo.

Atenciosamente,
LumiDNA`;
  if(!p.pedido_enviado_em) await sb.from("solicitacoes_reposicao").update({pedido_enviado_em:new Date().toISOString()}).eq("id",id);
  const destinatario = (p.solicitante_contato&&p.solicitante_contato.includes("@")) ? p.solicitante_contato : "";
  window.location.href=`mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
