// ---- Relatórios (peça individual e obra por período) ----
// Cada ocorrência mostra o horário de cada etapa (aviso -> pedido de compra ->
// compra -> troca -> aprovação), o tempo entre elas e quem fez, pra achar onde
// o processo trava.

function imprimirRelatorio(html){
  const sheet=q("#printRelatorio");
  sheet.innerHTML=html;
  const imgs=[...sheet.querySelectorAll("img")];
  const carregadas=Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r})));
  Promise.race([carregadas,new Promise(r=>setTimeout(r,8000))]).then(()=>setTimeout(()=>window.print(),200));
}

// ---------- formatação ----------
function fmtDataHora(iso,soData){
  if(!iso) return "—";
  const d=new Date(iso);
  if(isNaN(d)) return "—";
  return soData
    ? d.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"})
    : d.toLocaleString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function fmtData(d){
  if(!d) return "—";
  const [a,m,dd]=String(d).slice(0,10).split("-");
  return `${dd}/${m}/${a}`;
}
function fmtDuracao(ms){
  if(ms==null||isNaN(ms)) return "—";
  if(ms<0) ms=0;
  const min=Math.round(ms/60000);
  if(min<60) return `${min} min`;
  const h=Math.floor(min/60);
  if(h<48) return `${h} h ${String(min%60).padStart(2,"0")} min`;
  return `${Math.floor(h/24)} dia(s) ${h%24} h`;
}
// O texto gravado na aprovação começa com o tipo ("Homologado: X"); no
// relatório aparece com o nome novo.
function rotuloInstalado(s){return (s||"").replace(/^Homologado(?=:|$)/,"Compatível Verificado")}
function dataLocalISO(iso){return new Date(iso).toLocaleDateString("sv-SE")}

// ---------- ligação dos dados ----------
// Envios idênticos criados em poucos segundos (duplo clique em "Aprovar" no
// sistema antigo) são unificados só na leitura do relatório.
function deduplicarManutencoes(lista){
  const out=[]; let removidas=0;
  lista.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(m=>{
    const dup=out.find(o=>o.luminaria_id===m.luminaria_id&&o.tipo===m.tipo&&o.responsavel===m.responsavel
      &&o.problema===m.problema&&o.servico_realizado===m.servico_realizado
      &&o.componente_removido===m.componente_removido&&o.componente_instalado===m.componente_instalado
      &&Math.abs(new Date(o.created_at)-new Date(m.created_at))<15000);
    if(dup) removidas++; else out.push(m);
  });
  return {lista:out,removidas};
}

function montarOcorrencias({manutencoes,pendentes,solicitacoes}){
  const pendPorId={}; pendentes.forEach(p=>pendPorId[p.id]=p);
  const solPorId={}; solicitacoes.forEach(s=>solPorId[s.id]=s);
  const pendUsados=new Set(manutencoes.map(m=>m.pendente_id).filter(Boolean));
  const solUsadas=new Set(manutencoes.map(m=>m.solicitacao_id).filter(Boolean));
  const ordenadas=manutencoes.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  const ocorrencias=ordenadas.map(m=>{
    let pend=m.pendente_id?pendPorId[m.pendente_id]||null:null;
    let ligacaoAuto=false;
    if(!pend){
      // registro antigo, sem ligação: acha o envio aprovado no mesmo instante
      pend=pendentes.find(p=>!pendUsados.has(p.id)&&p.luminaria_id===m.luminaria_id&&p.status==="Aprovada"&&p.revisado_em
        &&Math.abs(new Date(p.revisado_em)-new Date(m.created_at))<=90000
        &&m.responsavel===`${p.responsavel} (${p.empresa})`)||null;
      if(pend) pendUsados.add(pend.id);
    }
    // instante do serviço: horário do envio do técnico; senão a data digitada
    // (só data = aproximado, conta como meio-dia); senão a criação do registro
    let trocaTs, trocaAprox=false;
    if(pend&&pend.criado_em) trocaTs=new Date(pend.criado_em).getTime();
    else if(m.data){ trocaTs=new Date(m.data+"T12:00:00").getTime(); trocaAprox=true; }
    else trocaTs=new Date(m.created_at).getTime();

    let sol=m.solicitacao_id?solPorId[m.solicitacao_id]||null:null;
    if(!sol){
      const limite=trocaAprox?trocaTs+12*3600000:trocaTs;
      sol=solicitacoes.filter(s=>s.luminaria_id===m.luminaria_id&&!solUsadas.has(s.id)&&new Date(s.criado_em).getTime()<=limite)
        .sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em))[0]||null;
      if(sol){ solUsadas.add(sol.id); ligacaoAuto=true; }
    }

    const oficialTs=pend&&pend.revisado_em?new Date(pend.revisado_em).getTime():new Date(m.created_at).getTime();
    const etapas={
      aviso:sol?{ts:new Date(sol.criado_em).getTime()}:null,
      pedido:sol&&sol.pedido_enviado_em?{ts:new Date(sol.pedido_enviado_em).getTime()}:null,
      compra:sol&&sol.comprado_em?{ts:new Date(sol.comprado_em).getTime()}:null,
      troca:{ts:trocaTs,aprox:trocaAprox},
      aprovacao:{ts:oficialTs}
    };
    const empresa=m.empresa||(pend&&pend.empresa)||((m.responsavel||"").match(/\(([^)]+)\)\s*$/)||[])[1]||null;
    const responsavel=(pend&&pend.responsavel)||(m.responsavel||"").replace(/\s*\([^)]*\)\s*$/,"")||null;
    const fotos=[...new Set([...(m.fotos||[]),...((pend&&pend.fotos)||[]),...(pend&&pend.componente_instalado_foto_url?[pend.componente_instalado_foto_url]:[])])];
    const codigo=(m.componente_instalado||"").split(":").pop().trim();
    return {m,pend,sol,ligacaoAuto,etapas,empresa,responsavel,fotos,codigo,luminaria:m.luminarias||null,
      aprovadoPor:pend&&pend.revisado_por?pend.revisado_por:null};
  });
  const avisosAbertos=solicitacoes.filter(s=>!solUsadas.has(s.id));
  return {ocorrencias,avisosAbertos};
}

// Ordem fixa das etapas; o tempo é sempre entre duas etapas registradas.
const ETAPAS_ORDEM=["aviso","pedido","compra","troca","aprovacao"];
const ETAPAS_NOME={aviso:"Aviso do problema",pedido:"Pedido de compra enviado",compra:"Compra confirmada",troca:"Troca realizada em campo",aprovacao:"Aprovada e registrada"};
function temposDaOcorrencia(o){
  const presentes=ETAPAS_ORDEM.filter(k=>o.etapas[k]);
  const trechos=[];
  for(let i=1;i<presentes.length;i++){
    const a=presentes[i-1], b=presentes[i];
    const ms=o.etapas[b].ts-o.etapas[a].ts;
    trechos.push({de:a,para:b,ms:Math.max(0,ms),aprox:!!(o.etapas[a].aprox||o.etapas[b].aprox)});
  }
  return trechos;
}

// ---------- HTML ----------
function localDaPeca(l){return l?[l.edificio,l.andar,l.ambiente,l.posicao].filter(Boolean).join(" / "):""}

function htmlOcorrencia(o,precos){
  const m=o.m, l=o.luminaria||{}, p=o.pend, s=o.sol;
  const trechos=temposDaOcorrencia(o);
  const maior=trechos.reduce((a,t)=>(!a||t.ms>a.ms)?t:a,null);
  const tempoAntes={}; trechos.forEach(t=>tempoAntes[t.para]=t);
  const linha=(k,quem,extra)=>{
    const e=o.etapas[k];
    if(!e) return `<tr><td>${ETAPAS_NOME[k]}</td><td colspan="3" class="small">não registrado</td></tr>`;
    const t=tempoAntes[k];
    const destaque=t&&maior&&t===maior&&trechos.length>1;
    return `<tr><td><b>${ETAPAS_NOME[k]}</b></td><td>${fmtDataHora(new Date(e.ts).toISOString(),!!e.aprox)}${e.aprox?" <span class='small'>(só a data foi informada)</span>":""}</td><td>${quem||"—"}${extra?`<div class="small">${extra}</div>`:""}</td><td>${t?`${destaque?"<b style='color:#c2410c'>":""}${t.aprox?"≈ ":""}${fmtDuracao(t.ms)}${destaque?" ◄ mais demorado</b>":""}`:"—"}</td></tr>`;
  };
  const totalAT=(o.etapas.aviso&&o.etapas.troca)?Math.max(0,o.etapas.troca.ts-o.etapas.aviso.ts):null;
  const preco=o.codigo&&precos[o.codigo]!=null?fmtPreco(precos[o.codigo]):null;
  return `
    <div class="oc">
      <div class="oc-head"><b>${esc(l.lumidna_id)||"—"}</b> — ${esc(l.fabricante)||""} ${esc(l.modelo)||""}${localDaPeca(l)?`<span class="oc-local">${esc(localDaPeca(l))}</span>`:""}</div>
      <table>
        <tr><th>Etapa</th><th>Data e hora</th><th>Quem</th><th>Tempo desde a etapa anterior</th></tr>
        ${linha("aviso",s?`${esc(s.solicitante_nome)||"não informado"}${s.solicitante_contato?" · "+esc(s.solicitante_contato):""}`:null,s?`Sintoma: ${esc(s.sintoma)||"—"}${s.componente_sugerido?" · componente suspeito: "+esc(s.componente_sugerido):""}${s.peca_recomendada_modelo?" · peça recomendada: "+esc(s.peca_recomendada_modelo):""}`:"")}
        ${linha("pedido","LumiDNA",s&&s.peca_recomendada_modelo?"Peça: "+esc(s.peca_recomendada_modelo)+(s.peca_recomendada_fabricante?" — "+esc(s.peca_recomendada_fabricante):""):"")}
        ${linha("compra","LumiDNA","")}
        ${linha("troca",`${esc(o.empresa)||"empresa não informada"}${o.responsavel?" · "+esc(o.responsavel):""}`,`${esc(m.tipo)||""}${m.categoria_falha?" · falha: "+esc(m.categoria_falha):""}`)}
        ${linha("aprovacao",esc(o.aprovadoPor)||"Admin LumiDNA",p?"":"registrado direto pelo Admin")}
      </table>
      ${totalAT!=null?`<div class="tempos"><b>Do aviso até a troca: ${fmtDuracao(totalAT)}</b>${(o.etapas.troca.aprox)?" (aproximado — só a data da troca foi informada)":""}${o.ligacaoAuto?"<div class='small'>Aviso ligado a esta troca por proximidade de datas (registro anterior à ligação automática).</div>":""}</div>`:`<div class="tempos">Sem aviso de problema registrado antes desta troca — não há como medir o tempo de resposta.</div>`}
      <table>
        ${m.problema?`<tr><th>Problema encontrado</th><td>${esc(m.problema)}</td></tr>`:""}
        ${m.servico_realizado?`<tr><th>Serviço realizado</th><td>${esc(m.servico_realizado)}</td></tr>`:""}
        ${(m.componente_removido||m.componente_instalado)?`<tr><th>Componente</th><td>${esc(m.componente_removido)||"—"} → <b>${esc(rotuloInstalado(m.componente_instalado))||"—"}</b>${p&&p.componente_instalado_fabricante?` · fabricante: ${esc(p.componente_instalado_fabricante)}`:""}${preco?` · valor de referência: ${preco}`:""}</td></tr>`:""}
      </table>
      ${o.fotos.length?`<div class="fotos">${o.fotos.map(u=>`<img src="${esc(u)}" alt="">`).join("")}</div>`:`<div class="small">Sem fotos anexadas a esta manutenção.</div>`}
    </div>`;
}

function htmlAvisosAbertos(avisos,pecasPorId){
  if(!avisos.length) return "";
  const agora=Date.now();
  return `<h2>Avisos sem troca registrada (ainda em aberto)</h2>
    <table><tr><th>Peça</th><th>Aviso em</th><th>Quem avisou</th><th>Sintoma</th><th>Compra</th><th>Aberto há</th></tr>
    ${avisos.map(s=>{
      const l=s.luminarias||pecasPorId[s.luminaria_id]||{};
      const estagio=s.comprado_em?`comprada em ${fmtDataHora(s.comprado_em)}`:(s.pedido_enviado_em?`pedido enviado em ${fmtDataHora(s.pedido_enviado_em)}`:"sem pedido enviado");
      return `<tr><td>${esc(l.lumidna_id)||"—"}</td><td>${fmtDataHora(s.criado_em)}</td><td>${esc(s.solicitante_nome)||"—"}</td><td>${esc(s.sintoma)||"—"}${s.componente_sugerido?" ("+esc(s.componente_sugerido)+")":""}</td><td>${estagio}</td><td><b>${fmtDuracao(agora-new Date(s.criado_em).getTime())}</b></td></tr>`;
    }).join("")}</table>`;
}

function htmlResumoTempos(ocorrencias){
  const grupos={};
  ocorrencias.forEach(o=>{
    temposDaOcorrencia(o).forEach(t=>{(grupos[`${t.de}>${t.para}`]=grupos[`${t.de}>${t.para}`]||{de:t.de,para:t.para,itens:[]}).itens.push(t.ms)});
    const at=o.etapas.aviso&&o.etapas.troca?o.etapas.troca.ts-o.etapas.aviso.ts:null;
    if(at!=null){(grupos["aviso>troca(total)"]=grupos["aviso>troca(total)"]||{nome:"Aviso → troca (total)",itens:[]}).itens.push(Math.max(0,at))}
  });
  const linhas=Object.values(grupos);
  if(!linhas.length) return "";
  linhas.sort((a,b)=>(b.itens.reduce((x,y)=>x+y,0)/b.itens.length)-(a.itens.reduce((x,y)=>x+y,0)/a.itens.length));
  return `<h2>Onde o tempo é gasto</h2>
    <table><tr><th>Trecho</th><th>Casos</th><th>Tempo médio</th><th>Maior tempo</th></tr>
    ${linhas.map(g=>{
      const media=g.itens.reduce((x,y)=>x+y,0)/g.itens.length, maior=Math.max(...g.itens);
      const nome=g.nome||`${ETAPAS_NOME[g.de]} → ${ETAPAS_NOME[g.para]}`;
      return `<tr><td>${nome}</td><td>${g.itens.length}</td><td>${fmtDuracao(media)}</td><td>${fmtDuracao(maior)}</td></tr>`;
    }).join("")}</table>
    <div class="small">Ordenado do trecho mais demorado (em média) para o menos demorado. Só entram trechos em que as duas etapas foram registradas.</div>`;
}

// ---------- carga de dados ----------
async function carregarDadosRelatorio(filtroQuery,pecasSelect){
  const lumSel=`luminarias!inner(${pecasSelect})`;
  const buscar=tabela=>fetchAllRows((de,ate)=>filtroQuery(sb.from(tabela).select(`*,${lumSel}`)).order("id").range(de,ate));
  const [manutencoes,pendentes,solicitacoes]=await Promise.all([buscar("manutencoes"),buscar("manutencoes_pendentes"),buscar("solicitacoes_reposicao")]);
  return {manutencoes,pendentes,solicitacoes};
}
const PECA_COLS="id,lumidna_id,modelo,fabricante,edificio,andar,ambiente,posicao,obra_id";

async function precosDasOcorrencias(ocorrencias){
  const codigos=[...new Set(ocorrencias.map(o=>o.codigo).filter(Boolean))];
  return codigos.length?await precosDe(codigos):{};
}

function cabecalhoRelatorio(titulo,subtitulo){
  return `<h1>${titulo}</h1><div class="sub">${subtitulo}<br>Emitido em ${fmtDataHora(new Date().toISOString())}${currentUserEmail?" por "+esc(currentUserEmail):""} — LumiDNA</div>`;
}

// ---------- relatório de uma peça ----------
async function gerarRelatorioPeca(){
  if(!luminariaDbId) return msg("Selecione uma peça primeiro.",false);
  msg("Montando relatório...");
  try{
    const lumR=await sb.from("luminarias").select("*").eq("id",luminariaDbId).single();
    if(lumR.error) throw lumR.error;
    const lum=lumR.data;
    const dados=await carregarDadosRelatorio(qy=>qy.eq("luminaria_id",luminariaDbId),PECA_COLS);
    const dd=deduplicarManutencoes(dados.manutencoes);
    const {ocorrencias,avisosAbertos}=montarOcorrencias({manutencoes:dd.lista,pendentes:dados.pendentes,solicitacoes:dados.solicitacoes});
    const precos=await precosDasOcorrencias(ocorrencias);
    const ordem=ocorrencias.slice().reverse();
    const local=[lum.empreendimento,lum.edificio,lum.ambiente,lum.posicao].filter(Boolean).join(" — ");
    const html=`
      <div class="relatorio">
        ${cabecalhoRelatorio(`Relatório da peça — ${esc(lum.lumidna_id)}`,`${esc(lum.fabricante)||""} ${esc(lum.modelo)||""}${lum.cliente?" · "+esc(lum.cliente):""}${local?" · "+esc(local):""}${lum.numero_serie?" · série "+esc(lum.numero_serie):""}`)}
        <div class="totais"><b>${ocorrencias.length}</b> manutenção(ões) · <b>${avisosAbertos.length}</b> aviso(s) em aberto${dd.removidas?` · ${dd.removidas} registro(s) duplicado(s) unificado(s)`:""}</div>
        ${htmlResumoTempos(ocorrencias)}
        ${ordem.length?`<h2>Ocorrências (da mais recente para a mais antiga)</h2>`+ordem.map(o=>htmlOcorrencia(o,precos)).join(""):"<div class='small'>Nenhuma manutenção registrada pra essa peça ainda.</div>"}
        ${htmlAvisosAbertos(avisosAbertos,{})}
      </div>`;
    msg("Relatório pronto — escolha \"Salvar como PDF\" na janela de impressão.");
    imprimirRelatorio(html);
  }catch(e){ msg("Erro ao montar o relatório: "+(e.message||e),false); }
}

// ---------- relatório de uma obra ----------
function wizPeriodoRapido(tipo){
  const hoje=new Date();
  let de;
  if(tipo==="semana"){ de=new Date(hoje); de.setDate(hoje.getDate()-7); }
  else { de=new Date(hoje.getFullYear(),hoje.getMonth(),1); }
  q("#rel_obra_de").value=de.toLocaleDateString("sv-SE");
  q("#rel_obra_ate").value=hoje.toLocaleDateString("sv-SE");
}

async function gerarRelatorioObra(){
  if(!obraAtual) return msg("Abra uma obra primeiro.",false);
  const de=q("#rel_obra_de").value, ate=q("#rel_obra_ate").value;
  msg("Montando relatório...");
  try{
    const totalR=await sb.from("luminarias").select("id",{count:"exact",head:true}).eq("obra_id",obraAtual.id);
    const totalPecas=totalR.count||0;
    const dados=await carregarDadosRelatorio(qy=>qy.eq("luminarias.obra_id",obraAtual.id),PECA_COLS);
    const dd=deduplicarManutencoes(dados.manutencoes);
    const tudo=montarOcorrencias({manutencoes:dd.lista,pendentes:dados.pendentes,solicitacoes:dados.solicitacoes});
    const dentro=o=>{
      const dia=o.m.data||dataLocalISO(o.m.created_at);
      return (!de||dia>=de)&&(!ate||dia<=ate);
    };
    const ocorrencias=tudo.ocorrencias.filter(dentro);
    const precos=await precosDasOcorrencias(ocorrencias);
    const pecasAfetadas=new Set(ocorrencias.map(o=>o.m.luminaria_id)).size;
    let total=0; ocorrencias.forEach(o=>{ if(o.codigo&&precos[o.codigo]!=null) total+=Number(precos[o.codigo]); });
    const comAviso=ocorrencias.filter(o=>o.etapas.aviso&&o.etapas.troca).map(o=>Math.max(0,o.etapas.troca.ts-o.etapas.aviso.ts));
    const media=comAviso.length?comAviso.reduce((a,b)=>a+b,0)/comAviso.length:null;
    const empresas={}; ocorrencias.forEach(o=>{const e=o.empresa||"não informada"; empresas[e]=(empresas[e]||0)+1});
    const listaEmpresas=Object.entries(empresas).sort((a,b)=>b[1]-a[1]).map(([e,n])=>`${esc(e)} (${n})`).join(", ");
    const comFotos=ocorrencias.filter(o=>o.fotos.length).length;
    const html=`
      <div class="relatorio">
        ${cabecalhoRelatorio(`Relatório da obra — ${esc(obraAtual.nome)}`,`Obra ${obraAtual.numero||""} (${esc(obraAtual.prefixo)||""})${obraAtual.cliente?" · Cliente: "+esc(obraAtual.cliente):""} · Período: ${de?fmtData(de):"desde o início"} até ${ate?fmtData(ate):"hoje"}`)}
        <div class="totais">
          <b>${ocorrencias.length}</b> manutenção(ões) em <b>${pecasAfetadas}</b> peça(s) de <b>${totalPecas}</b> na obra ·
          <b>${tudo.avisosAbertos.length}</b> aviso(s) de problema em aberto ·
          tempo médio do aviso até a troca: <b>${fmtDuracao(media)}</b>${comAviso.length?` (${comAviso.length} caso(s))`:""}
          ${total>0?` · valor de referência investido: <b>R$ ${total.toFixed(2).replace(".",",")}</b>`:""}
          <div class="small" style="margin-top:6px">Empresas que atuaram: ${listaEmpresas||"—"} · ocorrências com foto: ${comFotos} de ${ocorrencias.length}${dd.removidas?` · ${dd.removidas} registro(s) duplicado(s) por duplo clique foram unificados neste relatório`:""}</div>
        </div>
        ${htmlResumoTempos(ocorrencias)}
        ${ocorrencias.length?`<h2>Ocorrências detalhadas (da mais recente para a mais antiga)</h2>`+ocorrencias.slice().reverse().map(o=>htmlOcorrencia(o,precos)).join(""):"<div class='small'>Nenhuma manutenção nesse período.</div>"}
        ${htmlAvisosAbertos(tudo.avisosAbertos,{})}
      </div>`;
    msg("Relatório pronto — escolha \"Salvar como PDF\" na janela de impressão.");
    imprimirRelatorio(html);
  }catch(e){ msg("Erro ao montar o relatório: "+(e.message||e),false); }
}
