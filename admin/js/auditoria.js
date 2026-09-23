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

const COMP_TIPOS=["Driver","LED","Óptica"];

// Caixa de seleção por tipo, com as peças compatíveis já homologadas no
// Catálogo de componentes + "Integrada" (não existe separada) + "Outro
// modelo" (digita livre, pra peça ainda não homologada). Só grava na peça
// (tabela componentes, por luminaria_id) — nunca no catálogo central.
async function loadComponents(){
  const r=await sb.from("componentes").select("*").eq("luminaria_id",luminariaDbId).eq("ativo_atual",true);
  const byTipo={};(r.data||[]).forEach(c=>byTipo[c.tipo]=c.modelo);
  const resultados=await Promise.all(COMP_TIPOS.map(t=>sb.rpc("listar_homologados",{p_componente:t,p_modelo_codigo:(originalData&&originalData.modelo)||null})));
  q("#pecasInstaladasEdit").innerHTML = COMP_TIPOS.map((t,i)=>{
    const atual=byTipo[t]||"";
    const rowsR=resultados[i];
    const rows=rowsR.error?[]:(rowsR.data||[]);
    const conhecidas=new Set(rows.map(x=>x.modelo_equivalente));
    const ehOutro=!!atual && atual!=="Integrada" && atual!=="Original" && !conhecidas.has(atual);
    const opcoes=rows.map(x=>`<option value="${esc(x.modelo_equivalente)}"${atual===x.modelo_equivalente?" selected":""}>${esc(x.modelo_equivalente)}${x.fabricante_equivalente?" — "+esc(x.fabricante_equivalente):""}</option>`).join("");
    return `<div class="field">
      <label>${t}</label>
      <select id="pi_${t}" onchange="onPecaInstaladaChange('${t}')">
        <option value=""${!atual||atual==="Original"?" selected":""}>— não sei / não definido —</option>
        <option value="Integrada"${atual==="Integrada"?" selected":""}>Integrada (não é peça separada)</option>
        ${opcoes}
        <option value="__outro__"${ehOutro?" selected":""}>Outro modelo (digitar)</option>
      </select>
      <input type="text" id="pi_${t}_outro" placeholder="Modelo instalado" value="${ehOutro?esc(atual):""}" class="${ehOutro?"":"hidden"}" style="margin-top:6px">
    </div>`;
  }).join("");
  await mostrarDicaSpecsRetrofit(byTipo.LED);
}

function onPecaInstaladaChange(tipo){
  q(`#pi_${tipo}_outro`).classList.toggle("hidden",q(`#pi_${tipo}`).value!=="__outro__");
}

async function salvarPecasInstaladas(){
  if(!LID) return msg("Selecione um ativo primeiro.",false);
  const avisos=[];
  let mudou=false;
  const digitados=[]; // {tipo,codigo} escolhidos em "Outro modelo" — candidatos a entrar no catálogo
  for(const tipo of COMP_TIPOS){
    const sel=q(`#pi_${tipo}`);
    if(!sel) continue;
    let valor=sel.value;
    const ehOutro=valor==="__outro__";
    if(ehOutro) valor=q(`#pi_${tipo}_outro`).value.trim();
    if(!valor) continue;
    if(ehOutro) digitados.push({tipo,codigo:valor});
    const compR=await sb.from("componentes").select("id,modelo").eq("luminaria_id",luminariaDbId).eq("tipo",tipo).eq("ativo_atual",true).maybeSingle();
    const modeloAnterior=compR.data?compR.data.modelo:null;
    if(modeloAnterior===valor) continue;
    const w=compR.data
      ? await sb.from("componentes").update({modelo:valor}).eq("id",compR.data.id)
      : await sb.from("componentes").insert({luminaria_id:luminariaDbId,tipo,modelo:valor,original:true,ativo_atual:true});
    if(w.error){ avisos.push(`Erro em ${tipo}: ${w.error.message}`); continue; }
    await logAudit("componente_"+tipo,modeloAnterior||"—",valor);
    mudou=true;
  }
  await loadComponents();
  await loadAudit();
  if(avisos.length) return msg(avisos.join(" "),false);
  msg(mudou?"Peças instaladas salvas.":"Nada mudou.");
  await ofereceCadastrarNoCatalogo(digitados);
}

// Quando o código digitado em "Outro modelo" ainda não existe no Catálogo de
// componentes, oferece cadastrar já pelo menos o código lá (nível "Alternativa
// possível" — sinaliza que ainda não foi conferido; dá pra completar
// fabricante/preço/nível depois direto no Catálogo de componentes).
async function ofereceCadastrarNoCatalogo(candidatos){
  for(const c of candidatos){
    const existe=await sb.from("equivalentes").select("id").eq("componente_origem",c.tipo).eq("modelo_equivalente",c.codigo).limit(1).maybeSingle();
    if(existe.data) continue;
    const modeloPeca=(originalData&&originalData.modelo)||null;
    if(!confirm(`O código "${c.codigo}" (${c.tipo}) ainda não está no Catálogo de componentes.\n\nQuer cadastrar já pelo menos o código? Fabricante, preço e nível dá pra completar depois direto no Catálogo de componentes.`)) continue;
    const ins=await sb.from("equivalentes").insert({componente_origem:c.tipo,modelo_equivalente:c.codigo,modelo_original:modeloPeca,nivel:"Alternativa possível",disponibilidade:"Sob consulta",homologado_por:currentUserEmail||null});
    if(ins.error) msg(`Não consegui cadastrar ${c.codigo} no catálogo: ${ins.error.message}`,false);
    else msg(`${c.codigo} cadastrado no Catálogo de componentes (nível "Alternativa possível" — complete quando puder).`);
  }
}

// Replica o Driver/LED/Óptica desta peça pras outras peças do MESMO MODELO
// nesta obra — só do mesmo modelo, porque um driver/LED de um modelo não
// serve fisicamente noutro. Grava direto em "componentes" de cada peça
// (sem tocar no catálogo central nem em peças de outro modelo).
async function aplicarPecasInstaladasNaObra(){
  if(!LID||!luminariaDbId) return msg("Selecione uma peça primeiro.",false);
  if(!originalData||!originalData.obra_id) return msg("Esta peça não está em nenhuma obra.",false);
  if(!originalData.modelo_id) return msg("Esta peça ainda não está ligada a um modelo do catálogo.",false);
  await salvarPecasInstaladas();
  const compR=await sb.from("componentes").select("tipo,modelo").eq("luminaria_id",luminariaDbId).eq("ativo_atual",true);
  const atuais=(compR.data||[]).filter(c=>c.modelo);
  if(!atuais.length) return msg("Defina ao menos um componente (Driver/LED/Óptica) antes de aplicar às outras.",false);

  const alvoR=await sb.from("luminarias").select("id").eq("obra_id",originalData.obra_id).eq("modelo_id",originalData.modelo_id).neq("id",luminariaDbId);
  if(alvoR.error) return msg("Erro ao buscar as outras peças: "+alvoR.error.message,false);
  const outras=alvoR.data||[];
  if(!outras.length) return msg(`Não há outra peça do modelo ${originalData.modelo} nesta obra.`,false);

  const resumo=atuais.map(c=>`${c.tipo}: ${c.modelo}`).join(" · ");
  if(!confirm(`Aplicar "${resumo}" em ${outras.length} outra(s) peça(s) do modelo ${originalData.modelo} nesta obra?\n\nIsso substitui o que estiver definido nelas agora. Não afeta o catálogo nem peças de outro modelo.`)) return;

  const idsAlvo=outras.map(o=>o.id);
  const tiposDefinidos=atuais.map(c=>c.tipo);
  const existentesR=await sb.from("componentes").select("id,luminaria_id,tipo").in("luminaria_id",idsAlvo).in("tipo",tiposDefinidos).eq("ativo_atual",true);
  if(existentesR.error) return msg("Erro: "+existentesR.error.message,false);
  const mapExistente={};
  (existentesR.data||[]).forEach(c=>{ mapExistente[c.luminaria_id+"|"+c.tipo]=c.id; });

  const toUpdate=[], toInsert=[];
  idsAlvo.forEach(lid=>{
    atuais.forEach(c=>{
      const existenteId=mapExistente[lid+"|"+c.tipo];
      if(existenteId) toUpdate.push({id:existenteId,modelo:c.modelo});
      else toInsert.push({luminaria_id:lid,tipo:c.tipo,modelo:c.modelo,original:true,ativo_atual:true});
    });
  });

  let erro=null;
  for(let i=0;i<toUpdate.length&&!erro;i+=500){
    const r=await sb.from("componentes").upsert(toUpdate.slice(i,i+500));
    if(r.error) erro=r.error.message;
  }
  for(let i=0;i<toInsert.length&&!erro;i+=500){
    const r=await sb.from("componentes").insert(toInsert.slice(i,i+500));
    if(r.error) erro=r.error.message;
  }
  if(erro) return msg("Erro ao aplicar nas outras peças: "+erro,false);
  msg(`Aplicado em ${outras.length} peça(s) do modelo ${originalData.modelo}.`);
}

// Em modelos Retrofit, potência/CCT/fluxo/facho ficam vazios na própria
// luminária de propósito — quem carrega esse dado é a lâmpada instalada
// (tabela componentes -> equivalentes), pra não duplicar informação que
// desatualiza quando a lâmpada é trocada. Na área "Modelo e obra" esses
// campos aparecem então com o valor da lâmpada.
async function mostrarDicaSpecsRetrofit(modeloLed){
  const hint=q("#specsRetrofitHint");
  if(!hint) return;
  hint.textContent="";
  if(!modeloLed||modeloLed==="Original") return;
  const eqR=await sb.from("equivalentes").select("potencia_w,cct_k,fluxo_lm,facho_graus").eq("modelo_equivalente",modeloLed).eq("componente_origem","LED").maybeSingle();
  if(!eqR.data) return;
  const unidades={potencia_w:"W",cct_k:"K",fluxo_lm:"lm",facho_graus:"°"};
  let usou=false;
  Object.entries(unidades).forEach(([campo,u])=>{
    const el=document.querySelector(`[data-spec="${campo}"]`);
    if(el&&el.dataset.vazio==="1"&&eqR.data[campo]!=null){ el.textContent=`${eqR.data[campo]} ${u} (da lâmpada)`; usou=true; }
  });
  if(usou) hint.innerHTML=`Esta luminária é Retrofit: potência, CCT, fluxo e facho vêm da lâmpada instalada (<b>${esc(modeloLed)}</b>) e acompanham a troca da lâmpada.`;
}

q("#formLum").onsubmit=async e=>{
  e.preventDefault();
  if(!LID) return msg("Selecione ou crie um ativo primeiro.",false);
  const p={};for(const [k,v] of new FormData(e.target).entries())p[k]=norm(v);delete p.lumidna_id;
  p.modelo_id=p.modelo_id?Number(p.modelo_id):null;
  const orig=originalData||{};
  const avisos=[];

  // Peça sem obra: a obra escolhida traz cliente, e-mail, tensão e automação.
  const obraSel=q("#obraPicker");
  if(!orig.obra_id&&obraSel&&obraSel.dataset.pronto==="1"&&obraSel.value){
    const o=await sb.from("obras").select("*").eq("id",Number(obraSel.value)).single();
    if(o.error) return msg("Erro ao ler a obra: "+o.error.message,false);
    Object.assign(p,{obra_id:o.data.id,cliente:o.data.cliente,cliente_email:o.data.cliente_email,empreendimento:o.data.nome,tensao_instalacao:o.data.tensao_instalacao,automacao:o.data.automacao,protocolo_automacao:o.data.protocolo_automacao});
    avisos.push(`Obra "${o.data.nome}" aplicada.`);
  }

  // Peça antiga sem modelo do catálogo: liga (e cadastra o modelo, se for novo).
  if(!p.modelo_id&&orig.modelo&&orig.fabricante){
    const g=await garantirModeloNoCatalogo({fabricante:orig.fabricante,codigo:orig.modelo,potencia_w:orig.potencia_w,cct_k:orig.cct_k,irc:orig.irc,fluxo_lm:orig.fluxo_lm,facho_graus:orig.facho_graus,ip:orig.ip,ik:orig.ik});
    if(g.erro){
      avisos.push("Atenção: não consegui ligar ao catálogo ("+g.erro+").");
    }else{
      p.modelo_id=g.id;
      q("input[name=modelo_id]").value=g.id;
      avisos.push(g.criado?`Modelo ${orig.modelo} (${orig.fabricante}) cadastrado no catálogo.`:`Ligada ao modelo ${orig.modelo} do catálogo.`);
      populateModeloPicker().then(()=>{q("#modeloPicker").value=String(g.id)});
    }
  }

  const r=await sb.from("luminarias").update(p).eq("lumidna_id",LID);
  if(r.error) return msg("Erro: "+r.error.message,false);
  for(const k of Object.keys(p)) await logAudit(k,orig[k],p[k]);
  originalData={...orig,...p};
  await loadAudit();
  await renderModeloEObra(originalData);
  await renderResumoPeca(originalData);
  mostrarModoLeitura();
  msg(LID+" salva."+(avisos.length?" "+avisos.join(" "):""),!avisos.some(a=>a.startsWith("Atenção")));
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
  const r=await sb.rpc("listar_homologados",{p_componente:tipo,p_modelo_codigo:(originalData&&originalData.modelo)||null});
  if(r.error) return;
  dl.innerHTML=[`<option value="Original">`].concat((r.data||[]).map(x=>`<option value="${esc(x.modelo_equivalente)}" label="${esc(x.fabricante_equivalente||"")}">`)).join("");
}

function hojeLocal(){return new Date().toLocaleDateString("sv-SE")}

async function enviarFotosManutencao(fileList){
  const arquivos=[...(fileList||[])];
  const urls=[];
  for(let i=0;i<arquivos.length;i++){
    const f=arquivos[i];
    if(!f.type.startsWith("image/")) throw new Error(`"${f.name}" não é uma imagem.`);
    if(f.size>8*1024*1024) throw new Error(`"${f.name}" passa de 8MB.`);
    const path=`${LID}/manutencao_${Date.now()}_${i}_${f.name}`.replace(/[^\w./-]+/g,"_");
    const up=await sb.storage.from("fotos").upload(path,f,{upsert:true});
    if(up.error) throw up.error;
    urls.push(sb.storage.from("fotos").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

async function addMaintenance(){
  if(!LID)return msg("Selecione um ativo primeiro.",false);
  const tipoComp=norm(q("#man_comp_removido").value), novoModelo=norm(q("#man_comp_instalado").value.trim());
  if(tipoComp&&!novoModelo) return msg("Informe o modelo instalado no lugar (ou \"Original\").",false);
  if(!tipoComp&&novoModelo) return msg("Escolha qual componente foi trocado.",false);
  let fotosUrls=[];
  try{ fotosUrls=await enviarFotosManutencao(q("#man_fotos").files); }
  catch(e){ return msg("Erro ao enviar as fotos: "+(e.message||e),false); }
  const dataServico=norm(q("#man_data").value)||hojeLocal();
  const solicitacaoId=await acharSolicitacaoParaLigar(luminariaDbId,new Date(dataServico+"T23:59:59").toISOString());
  const p={luminaria_id:luminariaDbId,data:dataServico,empresa:norm(q("#man_empresa").value.trim()),fotos:fotosUrls.length?fotosUrls:null,solicitacao_id:solicitacaoId,tipo:q("#man_tipo").value,categoria_falha:norm(q("#man_categoria").value),problema:norm(q("#man_prob").value),servico_realizado:norm(q("#man_serv").value),responsavel:norm(q("#man_resp").value),status:q("#man_status").value,componente_removido:tipoComp,componente_instalado:novoModelo};
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
  q("#man_comp_removido").value="";q("#man_comp_instalado").value="";q("#man_comp_opcoes").innerHTML="";q("#man_fotos").value="";q("#man_empresa").value="";
  loadMaintenance();loadAudit();loadReplacement();loadComponents();
  msg("Manutenção registrada."+avisoPecas,!avisoPecas.includes("Mas não"));
}
async function loadMaintenance(){const r=await sb.from("manutencoes").select("*").eq("luminaria_id",luminariaDbId).order("id",{ascending:false});q("#manList").innerHTML=(r.data&&r.data.length)?`<table><tr><th>Data</th><th>Tipo</th><th>Categoria da falha</th><th>Responsável</th><th>Status</th></tr>${r.data.map(x=>`<tr><td>${x.data||""}</td><td>${x.tipo||""}</td><td>${x.categoria_falha||"—"}</td><td>${x.responsavel||""}</td><td>${x.status||""}</td></tr>`).join("")}</table>`:"<div class='small'>Nenhuma manutenção registrada.</div>"}

// Só lista (o cadastro de peças compatíveis é feito no Catálogo de componentes).
async function loadReplacement(){
  const box=q("#repList");
  const modelo=((originalData&&originalData.modelo)||"").trim();
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

