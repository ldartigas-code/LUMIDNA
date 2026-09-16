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

async function addMaintenance(){
  if(!LID)return msg("Selecione um ativo primeiro.",false);
  const compRemovido=norm(q("#man_comp_removido").value.trim()), compInstalado=norm(q("#man_comp_instalado").value.trim());
  const p={luminaria_id:luminariaDbId,data:norm(q("#man_data").value),tipo:q("#man_tipo").value,categoria_falha:norm(q("#man_categoria").value),problema:norm(q("#man_prob").value),servico_realizado:norm(q("#man_serv").value),responsavel:norm(q("#man_resp").value),status:q("#man_status").value,componente_removido:compRemovido,componente_instalado:compInstalado};
  const r=await sb.from("manutencoes").insert(p);
  if(r.error)return msg("Erro na manutenção: "+r.error.message,false);
  await logAudit("manutencao_registrada","",`${p.tipo} em ${p.data||"—"} (${p.status})`);
  if(compRemovido && compInstalado) await registerFieldEvidence(compRemovido,compInstalado);
  loadMaintenance();loadAudit();loadReplacement();
  msg("Manutenção registrada."+(compRemovido&&compInstalado?" Evidência de equivalência registrada.":""));
}
async function loadMaintenance(){const r=await sb.from("manutencoes").select("*").eq("luminaria_id",luminariaDbId).order("id",{ascending:false});q("#manList").innerHTML=(r.data&&r.data.length)?`<table><tr><th>Data</th><th>Tipo</th><th>Categoria da falha</th><th>Responsável</th><th>Status</th></tr>${r.data.map(x=>`<tr><td>${x.data||""}</td><td>${x.tipo||""}</td><td>${x.categoria_falha||"—"}</td><td>${x.responsavel||""}</td><td>${x.status||""}</td></tr>`).join("")}</table>`:"<div class='small'>Nenhuma manutenção registrada.</div>"}

// ---- Equivalência por evidência de campo ----
async function registerFieldEvidence(modeloOriginal,modeloEquivalente){
  const existing=await sb.from("equivalentes").select("*").eq("modelo_original",modeloOriginal).eq("modelo_equivalente",modeloEquivalente).maybeSingle();
  if(existing.data){
    await sb.from("equivalentes").update({evidencias_campo:(existing.data.evidencias_campo||0)+1}).eq("id",existing.data.id);
  }else{
    await sb.from("equivalentes").insert({componente_origem:"Campo",modelo_original:modeloOriginal,modelo_equivalente:modeloEquivalente,nivel:"Alternativa possível",disponibilidade:"Sob consulta",evidencias_campo:1});
  }
}

