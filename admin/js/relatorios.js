// ---- Relatórios (peça individual e obra por período) ----
function imprimirRelatorio(html){
  const sheet=q("#printRelatorio");
  sheet.innerHTML=html;
  setTimeout(()=>window.print(),300);
}

async function gerarRelatorioPeca(){
  if(!luminariaDbId) return msg("Selecione uma peça primeiro.",false);
  const lumR=await sb.from("luminarias").select("*").eq("id",luminariaDbId).single();
  if(lumR.error) return msg("Erro: "+lumR.error.message,false);
  const lum=lumR.data;
  const manR=await sb.from("manutencoes").select("*").eq("luminaria_id",luminariaDbId).order("data",{ascending:false}).order("id",{ascending:false});
  const manutencoes=manR.data||[];
  const ids=manutencoes.map(m=>m.id);
  const fotosPorManutencao={};
  if(ids.length){
    const fotoR=await sb.from("fotos_manutencao").select("*").in("manutencao_id",ids);
    (fotoR.data||[]).forEach(f=>{(fotosPorManutencao[f.manutencao_id]=fotosPorManutencao[f.manutencao_id]||[]).push(f)});
  }
  const local=[lum.empreendimento,lum.edificio,lum.ambiente,lum.posicao].filter(Boolean).join(" — ");
  const html=`
    <div class="relatorio">
      <h1>Relatório de manutenções — ${esc(lum.lumidna_id)}</h1>
      <div class="sub">${esc(lum.fabricante)||""} ${esc(lum.modelo)||""}${lum.cliente?" · "+esc(lum.cliente):""}${local?" · "+esc(local):""}</div>
      ${manutencoes.length ? manutencoes.map(m=>`
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--line)">
          <b>${esc(m.data)||"—"}</b> — ${esc(m.tipo)||"—"} ${m.status?`(${esc(m.status)})`:""}
          <div class="small">${m.categoria_falha?"Categoria: "+esc(m.categoria_falha)+" · ":""}${m.responsavel?"Responsável: "+esc(m.responsavel):""}</div>
          ${m.problema?`<div class="small">Problema: ${esc(m.problema)}</div>`:""}
          ${m.servico_realizado?`<div class="small">Serviço: ${esc(m.servico_realizado)}</div>`:""}
          ${(m.componente_removido||m.componente_instalado)?`<div class="small">Componente: ${esc(m.componente_removido)||"—"} → ${esc(m.componente_instalado)||"—"}</div>`:""}
          ${(fotosPorManutencao[m.id]||[]).map(f=>`<img src="${esc(f.foto_url)}" alt="">`).join("")}
        </div>`).join("") : "<div class='small'>Nenhuma manutenção registrada pra essa peça ainda.</div>"}
    </div>`;
  imprimirRelatorio(html);
}

function wizPeriodoRapido(tipo){
  const hoje=new Date();
  let de;
  if(tipo==="semana"){ de=new Date(hoje); de.setDate(hoje.getDate()-7); }
  else { de=new Date(hoje.getFullYear(),hoje.getMonth(),1); }
  q("#rel_obra_de").value=de.toISOString().slice(0,10);
  q("#rel_obra_ate").value=hoje.toISOString().slice(0,10);
}

async function gerarRelatorioObra(){
  if(!obraAtual) return msg("Abra uma obra primeiro.",false);
  const de=q("#rel_obra_de").value, ate=q("#rel_obra_ate").value;
  const pecasR=await sb.from("luminarias").select("id,lumidna_id,modelo,fabricante").eq("obra_id",obraAtual.id);
  const pecas=pecasR.data||[];
  const porId={}; pecas.forEach(p=>porId[p.id]=p);
  const idsPecas=pecas.map(p=>p.id);
  let manutencoes=[];
  if(idsPecas.length){
    let query=sb.from("manutencoes").select("*").in("luminaria_id",idsPecas);
    if(de) query=query.gte("data",de);
    if(ate) query=query.lte("data",ate);
    const manR=await query.order("data",{ascending:false});
    manutencoes=manR.data||[];
  }
  const codigos=[...new Set(manutencoes.map(m=>(m.componente_instalado||"").split(":").pop().trim()).filter(Boolean))];
  let precos={};
  if(codigos.length){
    const eqR=await sb.from("equivalentes").select("modelo_equivalente,preco_referencia").in("modelo_equivalente",codigos);
    (eqR.data||[]).forEach(e=>precos[e.modelo_equivalente]=e.preco_referencia);
  }
  let total=0;
  manutencoes.forEach(m=>{
    const codigo=(m.componente_instalado||"").split(":").pop().trim();
    if(precos[codigo]!=null) total+=Number(precos[codigo]);
  });
  const qtdPecasComManutencao=new Set(manutencoes.map(m=>m.luminaria_id)).size;
  const html=`
    <div class="relatorio">
      <h1>Relatório da obra — ${esc(obraAtual.nome)}</h1>
      <div class="sub">${obraAtual.cliente?"Cliente: "+esc(obraAtual.cliente)+" · ":""}Período: ${de||"desde o início"} até ${ate||"hoje"}</div>
      <div class="totais">
        <b>${manutencoes.length}</b> manutenção(ões) registrada(s) em <b>${qtdPecasComManutencao}</b> peça(s) de <b>${pecas.length}</b> no total${total>0?` — valor de referência investido: <b>R$ ${total.toFixed(2).replace(".",",")}</b>`:""}
      </div>
      ${manutencoes.length ? `<table><tr><th>Peça</th><th>Data</th><th>Tipo</th><th>Componente</th></tr>${manutencoes.map(m=>`<tr><td>${esc(porId[m.luminaria_id]?.lumidna_id)||"—"}</td><td>${esc(m.data)||"—"}</td><td>${esc(m.tipo)||"—"}</td><td>${esc(m.componente_removido)||"—"} → ${esc(m.componente_instalado)||"—"}</td></tr>`).join("")}</table>` : "<div class='small'>Nenhuma manutenção nesse período.</div>"}
    </div>`;
  imprimirRelatorio(html);
}
