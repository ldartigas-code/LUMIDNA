// ---- Aprovações pendentes (manutenção enviada por técnico em campo) ----
async function checkPendentesBadge(){
  const r=await sb.from("manutencoes_pendentes").select("id",{count:"exact",head:true}).eq("status","Aguardando aprovação");
  const n=r.count||0;
  const resumo=q("#aprovacoesResumo");
  if(!resumo) return;
  resumo.innerHTML = n>0 ? `<b style="color:var(--red)">${n} manutenção(ões) aguardando sua confirmação</b>` : "Manutenções enviadas por técnicos em campo, aguardando sua confirmação";
}

async function loadPendentes(){
  const box=q("#aprovacoesList");
  const r=await sb.from("manutencoes_pendentes").select("*,luminarias(lumidna_id,modelo,cliente)").eq("status","Aguardando aprovação").order("criado_em",{ascending:false});
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML = rows.length ? rows.map(p=>`
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
        <div>
          <b>${esc(p.luminarias?.lumidna_id)}</b> — ${esc(p.luminarias?.modelo)||"—"} ${p.luminarias?.cliente?"· "+esc(p.luminarias.cliente):""}
          <div class="small">Enviado por <b>${esc(p.responsavel)}</b> (${esc(p.empresa)}) em ${new Date(p.criado_em).toLocaleString('pt-BR')}</div>
        </div>
        <span class="pill">${esc(p.tipo)}</span>
      </div>
      <div class="grid" style="margin-top:10px">
        <div class="field span2"><label>Problema</label><div class="small">${esc(p.problema)||"—"}</div></div>
        <div class="field span2"><label>Serviço realizado</label><div class="small">${esc(p.servico_realizado)||"—"}</div></div>
        ${p.componente_removido?`<div class="field"><label>Componente removido</label><div class="small">${esc(p.componente_removido)}</div></div>`:""}
        ${p.componente_instalado_tipo?`<div class="field"><label>Componente instalado</label><div class="small">${esc(p.componente_instalado_tipo)}${p.componente_instalado_tipo==="Outro"?` — ${esc(p.componente_instalado)} (${esc(p.componente_instalado_fabricante)})`:p.componente_instalado_tipo==="Homologado"?` — ${esc(p.componente_instalado)}`:""}</div></div>`:""}
        ${p.componente_instalado_foto_url?`<div class="field span2"><label>Foto enviada</label><a href="${esc(p.componente_instalado_foto_url)}" target="_blank"><img src="${esc(p.componente_instalado_foto_url)}" alt="" style="max-width:160px;border-radius:8px;border:1px solid var(--line)"></a></div>`:""}
      </div>
      ${p.componente_instalado_tipo==="Outro"?`<div class="alert" style="margin-top:10px">⚠️ Componente fora do catálogo — confira a foto e o fabricante antes de aprovar.</div>`:""}
      <div class="actions" style="margin-top:12px">
        <button type="button" class="primary" onclick="aprovarPendente(${p.id})">✓ Aprovar</button>
        <button type="button" class="secondary" onclick="rejeitarPendente(${p.id})">Rejeitar</button>
      </div>
    </div>`).join("") : "<div class='small'>Nenhuma aprovação pendente no momento.</div>";
}

async function aprovarPendente(id){
  const r=await sb.from("manutencoes_pendentes").select("*").eq("id",id).single();
  if(r.error) return msg("Erro: "+r.error.message,false);
  const p=r.data;
  const instaladoDesc = p.componente_instalado_tipo==="Outro" ? `${p.componente_instalado_tipo}: ${p.componente_instalado} (${p.componente_instalado_fabricante})` : `${p.componente_instalado_tipo}${p.componente_instalado&&p.componente_instalado!=="Original"?": "+p.componente_instalado:""}`;
  const ins={luminaria_id:p.luminaria_id,tipo:p.tipo,problema:p.problema,servico_realizado:p.servico_realizado,responsavel:`${p.responsavel} (${p.empresa})`,status:"Concluída",componente_removido:p.componente_removido,componente_instalado:instaladoDesc};
  const insR=await sb.from("manutencoes").insert(ins);
  if(insR.error) return msg("Erro ao aprovar: "+insR.error.message,false);

  if(p.componente_removido && p.componente_instalado_tipo){
    const compR=await sb.from("componentes").select("id,modelo").eq("luminaria_id",p.luminaria_id).eq("tipo",p.componente_removido).eq("ativo_atual",true).maybeSingle();
    const modeloAnterior=compR.data?compR.data.modelo:null;
    const novoModelo=p.componente_instalado||"Original";
    if(compR.data) await sb.from("componentes").update({modelo:novoModelo}).eq("id",compR.data.id);
    else await sb.from("componentes").insert({luminaria_id:p.luminaria_id,tipo:p.componente_removido,modelo:novoModelo,original:false,ativo_atual:true});
    if((p.componente_instalado_tipo==="Outro"||p.componente_instalado_tipo==="Homologado") && modeloAnterior && modeloAnterior!=="Original") await registerFieldEvidence(modeloAnterior,p.componente_instalado);
  }

  await sb.from("manutencoes_pendentes").update({status:"Aprovada",revisado_por:currentUserEmail,revisado_em:new Date().toISOString()}).eq("id",id);
  msg("Manutenção aprovada e registrada no histórico oficial da peça.");
  loadPendentes();loadAprovadas();checkPendentesBadge();
}

async function rejeitarPendente(id){
  const motivo=prompt("Motivo da rejeição (opcional):")||null;
  const r=await sb.from("manutencoes_pendentes").update({status:"Rejeitada",motivo_rejeicao:motivo,revisado_por:currentUserEmail,revisado_em:new Date().toISOString()}).eq("id",id);
  if(r.error) return msg("Erro: "+r.error.message,false);
  msg("Envio rejeitado e anotado. Os dados oficiais da peça não foram alterados.");
  loadPendentes();loadRejeitadas();checkPendentesBadge();
}

function renderDecididaCard(p,tipo){
  const cor=tipo==="Aprovada"?{bg:"#e9f7ee",fg:"#257944"}:{bg:"#fdecec",fg:"#a33"};
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
        <div>
          <b>${esc(p.luminarias?.lumidna_id)}</b> — ${esc(p.luminarias?.modelo)||"—"} ${p.luminarias?.cliente?"· "+esc(p.luminarias.cliente):""}
          <div class="small">Enviado por <b>${esc(p.responsavel)}</b> (${esc(p.empresa)}) em ${new Date(p.criado_em).toLocaleString('pt-BR')} — ${tipo.toLowerCase()} em ${p.revisado_em?new Date(p.revisado_em).toLocaleString('pt-BR'):"—"}</div>
          ${p.motivo_rejeicao?`<div class="small">Motivo: ${esc(p.motivo_rejeicao)}</div>`:""}
        </div>
        <span class="pill" style="background:${cor.bg};color:${cor.fg}">${tipo}</span>
      </div>
      <div class="grid" style="margin-top:10px">
        ${p.componente_removido?`<div class="field"><label>Componente removido</label><div class="small">${esc(p.componente_removido)}</div></div>`:""}
        ${p.componente_instalado_tipo?`<div class="field"><label>Componente instalado${tipo==="Rejeitada"?" (proposto)":""}</label><div class="small">${esc(p.componente_instalado_tipo)}${p.componente_instalado?" — "+esc(p.componente_instalado):""}</div></div>`:""}
      </div>
      <div class="actions" style="margin-top:12px">
        <button type="button" class="secondary" onclick="gerarEmailManutencao(${p.id})">✉ Gerar e-mail pro cliente</button>
      </div>
    </div>`;
}

async function loadAprovadas(){
  const box=q("#aprovadasList");
  const r=await sb.from("manutencoes_pendentes").select("*,luminarias(lumidna_id,modelo,cliente,cliente_email)").eq("status","Aprovada").order("revisado_em",{ascending:false}).limit(300);
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML = rows.length ? rows.map(p=>renderDecididaCard(p,"Aprovada")).join("") : "<div class='small'>Nenhuma aprovação registrada ainda.</div>";
}

async function loadRejeitadas(){
  const box=q("#rejeitadasList");
  const r=await sb.from("manutencoes_pendentes").select("*,luminarias(lumidna_id,modelo,cliente,cliente_email)").eq("status","Rejeitada").order("revisado_em",{ascending:false}).limit(300);
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML = rows.length ? rows.map(p=>renderDecididaCard(p,"Rejeitada")).join("") : "<div class='small'>Nenhuma rejeição registrada ainda.</div>";
}

function gerarEmailManutencao(id){
  sb.from("manutencoes_pendentes").select("*,luminarias(lumidna_id,cliente,cliente_email,empreendimento,edificio)").eq("id",id).single().then(r=>{
    if(r.error) return msg("Erro: "+r.error.message,false);
    const p=r.data;
    const lum=p.luminarias||{};
    const local=lum.empreendimento?" ("+lum.empreendimento+(lum.edificio?" — "+lum.edificio:"")+")":"";
    const aprovado=p.status==="Aprovada";
    const assunto=`LumiDNA — manutenção ${aprovado?"aprovada":"NÃO aprovada"} na luminária ${lum.lumidna_id||""}`;
    const corpo=`Prezado(a) ${lum.cliente||"cliente"},

${aprovado
  ? `Foi realizada e aprovada pela LumiDNA uma manutenção na luminária ${lum.lumidna_id||""}${local}. A alteração já consta no histórico oficial da peça.`
  : `Foi enviado um pedido de manutenção para a luminária ${lum.lumidna_id||""}${local}, mas a LumiDNA NÃO aprovou a alteração proposta.`}

Detalhes do envio:
- Enviado por: ${p.responsavel||"—"} (${p.empresa||"—"})
- Data do envio: ${new Date(p.criado_em).toLocaleString('pt-BR')}
- Componente removido: ${p.componente_removido||"—"}
- Componente ${aprovado?"instalado":"proposto para instalação"}: ${p.componente_instalado_tipo||"—"}${p.componente_instalado?" — "+p.componente_instalado:""}
${aprovado?"":`- Motivo da não aprovação: ${p.motivo_rejeicao||"não homologado / não avaliado como equivalente seguro"}\n\nRecomendamos verificar a situação atual dessa luminária e, se necessário, entrar em contato com a LumiDNA antes de qualquer nova intervenção.`}

Atenciosamente,
LumiDNA`;
    const mailto=`mailto:${encodeURIComponent(lum.cliente_email||"")}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.location.href=mailto;
    if(!lum.cliente_email) msg("E-mail do cliente não está cadastrado nessa peça — abri seu programa de e-mail mesmo assim, só preenche o destinatário.",false);
  });
}

async function addReplacement(){const p={componente_origem:q("#rep_comp").value,fabricante_original:norm(q("#rep_fab_orig").value),modelo_original:norm(q("#rep_mod_orig").value),fabricante_equivalente:norm(q("#rep_fab_eq").value),modelo_equivalente:norm(q("#rep_mod_eq").value),especificacao:norm(q("#rep_spec").value),nivel:q("#rep_nivel").value,preco_referencia:norm(q("#rep_preco").value),disponibilidade:q("#rep_disp").value,homologado_por:"LumiDNA"};const r=await sb.from("equivalentes").insert(p);if(r.error)return msg("Erro no equivalente: "+r.error.message,false);loadReplacement();msg("Equivalente adicionado.")}
async function loadReplacement(){const r=await sb.from("equivalentes").select("*").order("id",{ascending:false}).limit(20);q("#repList").innerHTML=(r.data&&r.data.length)?`<table><tr><th>Origem</th><th>Equivalente</th><th>Nível</th><th>Preço</th><th>Evidências de campo</th></tr>${r.data.map(x=>`<tr><td>${x.modelo_original||""}</td><td>${x.modelo_equivalente||""}</td><td>${x.nivel||""}</td><td>${x.preco_referencia||""}</td><td>${x.evidencias_campo||0}</td></tr>`).join("")}</table>`:"<div class='small'>Nenhum equivalente cadastrado.</div>"}
