// ---- Auditoria ----
async function logAudit(campo,before,after){
  const b=before??"", a=after??"";
  if(String(b)===String(a)) return;
  await sb.from("auditoria").insert({luminaria_id:luminariaDbId,tabela:"luminarias",campo,valor_anterior:String(b),valor_novo:String(a),usuario_email:currentUserEmail});
}
async function loadAudit(){
  const r=await sb.from("auditoria").select("*").eq("luminaria_id",luminariaDbId).order("criado_em",{ascending:false}).limit(500);
  q("#histList").innerHTML=(r.data&&r.data.length)?`<table><tr><th>Data/hora</th><th>Usuário</th><th>Campo</th><th>De</th><th>Para</th></tr>${r.data.map(x=>`<tr><td>${new Date(x.criado_em).toLocaleString('pt-BR')}</td><td>${esc(x.usuario_email)}</td><td>${esc(x.campo)}</td><td>${esc(x.valor_anterior)}</td><td>${esc(x.valor_novo)}</td></tr>`).join("")}</table>`:"<div class='small'>Nenhuma alteração registrada ainda.</div>";
}

async function loadComponents(){
  const r=await sb.from("componentes").select("*").eq("luminaria_id",luminariaDbId).eq("ativo_atual",true);
  const byTipo={};(r.data||[]).forEach(c=>byTipo[c.tipo]=c.modelo);
  const tipos=["Driver","LED","Óptica"];
  q("#pecasInstaladasView").innerHTML = tipos.map(t=>{
    const modelo=byTipo[t]||"Original";
    const revisada=modelo!=="Original";
    return `<div class="field"><label>${t}</label><div class="${revisada?'pill':'small'}" style="${revisada?'':'padding:8px 0'}">${esc(modelo)}</div></div>`;
  }).join("");
  await mostrarDicaSpecsRetrofit(byTipo.LED);
}

// Em modelos Retrofit, potência/CCT/fluxo/facho ficam vazios na própria
// luminária de propósito — quem carrega esse dado é a lâmpada instalada
// (tabela componentes -> equivalentes), pra não duplicar informação que
// desatualiza quando a lâmpada é trocada. Isso deixa os campos "Dados
// técnicos" parecendo zerados, então aqui só mostramos o valor real da
// lâmpada como dica (placeholder), sem preencher o campo de verdade.
async function mostrarDicaSpecsRetrofit(modeloLed){
  const hint=q("#specsRetrofitHint");
  const campos={potencia_w:"input[name=potencia_w]",cct_k:"input[name=cct_k]",fluxo_lm:"input[name=fluxo_lm]",facho_graus:"input[name=facho_graus]"};
  Object.values(campos).forEach(sel=>{ const el=q(sel); if(el) el.placeholder=""; });
  if(!hint) return;
  hint.textContent="";
  if(!modeloLed||modeloLed==="Original") return;
  const eqR=await sb.from("equivalentes").select("potencia_w,cct_k,fluxo_lm,facho_graus").eq("modelo_equivalente",modeloLed).eq("componente_origem","LED").maybeSingle();
  if(!eqR.data) return;
  const d=eqR.data;
  Object.entries(campos).forEach(([campo,sel])=>{
    const el=q(sel);
    if(el && !el.value && d[campo]!=null) el.placeholder=String(d[campo]);
  });
  hint.innerHTML=`Campos vazios abaixo? Essa luminária é Retrofit — o valor real vem da lâmpada instalada (<b>${esc(modeloLed)}</b>) e já aparece assim mesmo na página pública. Só preencha aqui se quiser sobrescrever manualmente.`;
}

function onDetAutomacaoChange(){
  q("#det_protocolo_field").classList.toggle("hidden",q("#det_automacao").value!=="sim");
}

q("#formLum").onsubmit=async e=>{
  e.preventDefault();
  if(!LID) return msg("Selecione ou crie um ativo primeiro.",false);
  const p={};for(const [k,v] of new FormData(e.target).entries())p[k]=norm(v);delete p.lumidna_id;
  p.automacao = q("#det_automacao").value==="sim";
  if(!p.automacao) p.protocolo_automacao=null;
  const r=await sb.from("luminarias").update(p).eq("lumidna_id",LID);
  if(r.error) return msg("Erro: "+r.error.message,false);
  for(const k of Object.keys(p)) await logAudit(k,originalData?originalData[k]:null,p[k]);
  originalData={...originalData,...p};
  await loadAudit();
  msg(LID+" salva no Supabase.");
};

async function addWarranty(){
  if(!LID)return msg("Selecione um ativo primeiro.",false);
  const p={luminaria_id:luminariaDbId,tipo:q("#gar_tipo").value,responsavel:norm(q("#gar_resp").value),fornecedor:norm(q("#gar_forn").value),inicio:norm(q("#gar_inicio").value),fim:norm(q("#gar_fim").value),status:q("#gar_status").value};
  const r=await sb.from("garantias").insert(p);
  if(r.error)return msg("Erro na garantia: "+r.error.message,false);
  await logAudit("garantia_adicionada","",`${p.tipo} (${p.status}, até ${p.fim||"—"})`);
  loadWarranties();loadAudit();msg("Garantia adicionada.");
}
async function loadWarranties(){const r=await sb.from("garantias").select("*").eq("luminaria_id",luminariaDbId).order("id",{ascending:false});q("#garList").innerHTML=(r.data&&r.data.length)?`<table><tr><th>Tipo</th><th>Responsável</th><th>Fim</th><th>Status</th></tr>${r.data.map(x=>`<tr><td>${x.tipo||""}</td><td>${x.responsavel||""}</td><td>${x.fim||""}</td><td>${x.status||""}</td></tr>`).join("")}</table>`:"<div class='small'>Nenhuma garantia cadastrada.</div>"}

async function onManCompChange(){
  const tipo=q("#man_comp_removido").value;
  const dl=q("#man_comp_opcoes");
  dl.innerHTML="";
  if(!["Driver","LED","Óptica"].includes(tipo)) return;
  const r=await sb.rpc("listar_homologados",{p_componente:tipo,p_modelo_codigo:q("input[name=modelo]").value||null});
  if(r.error) return;
  dl.innerHTML=[`<option value="Original">`].concat((r.data||[]).map(x=>`<option value="${esc(x.modelo_equivalente)}" label="${esc(x.fabricante_equivalente||"")}">`)).join("");
}

async function addMaintenance(){
  if(!LID)return msg("Selecione um ativo primeiro.",false);
  const tipoComp=norm(q("#man_comp_removido").value), novoModelo=norm(q("#man_comp_instalado").value.trim());
  if(tipoComp&&!novoModelo) return msg("Informe o modelo instalado no lugar (ou \"Original\").",false);
  if(!tipoComp&&novoModelo) return msg("Escolha qual componente foi trocado.",false);
  const p={luminaria_id:luminariaDbId,data:norm(q("#man_data").value),tipo:q("#man_tipo").value,categoria_falha:norm(q("#man_categoria").value),problema:norm(q("#man_prob").value),servico_realizado:norm(q("#man_serv").value),responsavel:norm(q("#man_resp").value),status:q("#man_status").value,componente_removido:tipoComp,componente_instalado:novoModelo};
  const r=await sb.from("manutencoes").insert(p);
  if(r.error)return msg("Erro na manutenção: "+r.error.message,false);
  await logAudit("manutencao_registrada","",`${p.tipo} em ${p.data||"—"} (${p.status})`);

  let avisoPecas="";
  if(["Driver","LED","Óptica"].includes(tipoComp)){
    const compR=await sb.from("componentes").select("id,modelo").eq("luminaria_id",luminariaDbId).eq("tipo",tipoComp).eq("ativo_atual",true).maybeSingle();
    const modeloAnterior=compR.data?compR.data.modelo:null;
    const w=compR.data
      ? await sb.from("componentes").update({modelo:novoModelo}).eq("id",compR.data.id)
      : await sb.from("componentes").insert({luminaria_id:luminariaDbId,tipo:tipoComp,modelo:novoModelo,original:false,ativo_atual:true});
    if(w.error){
      avisoPecas=" Mas não consegui atualizar as Peças instaladas: "+w.error.message;
    }else{
      await logAudit("componente_"+tipoComp,modeloAnterior||"Original",novoModelo);
      if(modeloAnterior&&modeloAnterior!=="Original"&&novoModelo!=="Original") await registerFieldEvidence(modeloAnterior,novoModelo);
      avisoPecas=" Peças instaladas atualizadas.";
    }
  }
  q("#man_comp_removido").value="";q("#man_comp_instalado").value="";q("#man_comp_opcoes").innerHTML="";
  loadMaintenance();loadAudit();loadReplacement();loadComponents();
  msg("Manutenção registrada."+avisoPecas,!avisoPecas.includes("Mas não"));
}
async function loadMaintenance(){const r=await sb.from("manutencoes").select("*").eq("luminaria_id",luminariaDbId).order("id",{ascending:false});q("#manList").innerHTML=(r.data&&r.data.length)?`<table><tr><th>Data</th><th>Tipo</th><th>Categoria da falha</th><th>Responsável</th><th>Status</th></tr>${r.data.map(x=>`<tr><td>${x.data||""}</td><td>${x.tipo||""}</td><td>${x.categoria_falha||"—"}</td><td>${x.responsavel||""}</td><td>${x.status||""}</td></tr>`).join("")}</table>`:"<div class='small'>Nenhuma manutenção registrada.</div>"}

// Só lista (o cadastro de peças compatíveis é feito no Catálogo de componentes).
async function loadReplacement(){
  const box=q("#repList");
  const modelo=(q("input[name=modelo]").value||"").trim();
  const inst=await sb.from("componentes").select("modelo").eq("luminaria_id",luminariaDbId).eq("ativo_atual",true);
  const seguro=s=>s&&s!=="Original"&&!/[,()*]/.test(s);
  const filtros=["modelo_original.is.null"];
  if(seguro(modelo)) filtros.push(`modelo_original.ilike.*${modelo}*`);
  (inst.data||[]).map(c=>c.modelo).filter(seguro).forEach(m=>filtros.push(`modelo_original.ilike.*${m}*`));
  const r=await sb.from("equivalentes").select("*").or(filtros.join(",")).order("componente_origem").order("modelo_equivalente").limit(200);
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML=rows.length
    ? `<table><tr><th>Componente</th><th>Peça compatível</th><th>Fabricante</th><th>Nível</th><th>Preço ref.</th><th>Evidências de campo</th></tr>${rows.map(x=>`<tr><td>${esc(x.componente_origem)||"—"}</td><td>${esc(x.modelo_equivalente)||"—"}</td><td>${esc(x.fabricante_equivalente)||"—"}</td><td>${esc(x.nivel)||"—"}</td><td>${fmtPreco(x.preco_referencia)||"—"}</td><td>${x.evidencias_campo||0}</td></tr>`).join("")}</table>`
    : "<div class='small'>Nenhuma peça compatível cadastrada pra esta luminária ainda.</div>";
}

// ---- Equivalência por evidência de campo ----
async function registerFieldEvidence(modeloOriginal,modeloEquivalente){
  const existing=await sb.from("equivalentes").select("*").eq("modelo_original",modeloOriginal).eq("modelo_equivalente",modeloEquivalente).maybeSingle();
  if(existing.data){
    await sb.from("equivalentes").update({evidencias_campo:(existing.data.evidencias_campo||0)+1}).eq("id",existing.data.id);
  }else{
    await sb.from("equivalentes").insert({componente_origem:"Campo",modelo_original:modeloOriginal,modelo_equivalente:modeloEquivalente,nivel:"Alternativa possível",disponibilidade:"Sob consulta",evidencias_campo:1});
  }
}

