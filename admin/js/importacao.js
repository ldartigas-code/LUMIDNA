// ---- Importação completa de pedido (JSON preparado pelo Claude a partir de
// um PDF/Excel) ----
// Formato esperado:
// {
//   "obra": {"nome":"...", "cliente":"...", "cliente_email":"...", "prefixo":"..."},
//   "itens": [
//     {"fabricante":"...", "codigo":"...", "descricao":"...", "quantidade":1,
//      "ambiente":"...", "observacoes":"...",
//      "led":"Integrada" | {"fabricante":"...","codigo":"..."},
//      "driver": ..., "optica": ...}
//   ]
// }
// Faz tudo direto pelo navegador (obra, modelos, peças, componentes) usando a
// sessão já autenticada do Admin — não precisa do Supabase Studio.

function formatarComponenteTexto(val){
  if(!val) return null;
  if(typeof val==="string") return val.trim()||null;
  if(typeof val==="object"){
    const cod=(val.codigo||val.modelo||"").toString().trim();
    if(!cod) return null;
    return val.fabricante?`${val.fabricante} — ${cod}`:cod;
  }
  return null;
}

async function processarImportacaoCompleta(){
  let dados;
  try{ dados=JSON.parse(q("#importJson").value); }
  catch(e){ return msg("JSON inválido: "+e.message,false); }
  if(!dados||!Array.isArray(dados.itens)||!dados.itens.length) return msg("Nenhum item em \"itens\".",false);
  const nomeObra=((dados.obra&&dados.obra.nome)||"").toString().trim();
  if(!nomeObra) return msg('Informe o nome da obra em obra.nome.',false);

  const resBox=q("#importResultado");
  resBox.innerHTML="<div class='small'>Processando...</div>";

  // 1) Obra: acha por nome (sem diferenciar maiúscula) ou cria
  let obra;
  const existente=await sb.from("obras").select("*").ilike("nome",likeLiteral(nomeObra)).maybeSingle();
  if(existente.error){ resBox.innerHTML=""; return msg("Erro ao buscar obra: "+existente.error.message,false); }
  if(existente.data){
    obra=existente.data;
  }else{
    const prefixo=normalizarPrefixo((dados.obra.prefixo||sugerirPrefixo(nomeObra)));
    const erroPrefixo=await validarPrefixoObra(prefixo);
    if(erroPrefixo){ resBox.innerHTML=""; return msg(erroPrefixo,false); }
    const ins=await sb.from("obras").insert({
      nome:nomeObra, prefixo,
      cliente:norm(((dados.obra.cliente)||"").toString().trim()),
      cliente_email:norm(((dados.obra.cliente_email)||"").toString().trim()),
      tensao_instalacao:norm(((dados.obra.tensao_instalacao)||"").toString().trim()),
      automacao:!!dados.obra.automacao,
      protocolo_automacao:norm(((dados.obra.protocolo_automacao)||"").toString().trim())
    }).select().single();
    if(ins.error){ resBox.innerHTML=""; return msg("Erro ao criar obra: "+ins.error.message,false); }
    obra=ins.data;
  }
  const obraSpread=wizObraDe(obra);

  // 2) Garante cada modelo no catálogo (cria se não existir)
  const itensProntos=[];
  for(const item of dados.itens){
    if(!item.codigo||!item.fabricante){ resBox.innerHTML=""; return msg("Item sem código/fabricante: "+JSON.stringify(item),false); }
    const g=await garantirModeloNoCatalogo({
      fabricante:item.fabricante,codigo:item.codigo,descricao:item.descricao||null,
      potencia_w:item.potencia_w??null,cct_k:item.cct_k??null,irc:item.irc??null,
      fluxo_lm:item.fluxo_lm??null,facho_graus:item.facho_graus??null,
      ip:item.ip??null,ik:item.ik??null,tipo_montagem:item.tipo_montagem??null
    });
    if(g.erro){ resBox.innerHTML=""; return msg(`Erro no modelo ${item.codigo}: ${g.erro}`,false); }
    const mFull=await sb.from("modelos").select("*").eq("id",g.id).single();
    if(mFull.error){ resBox.innerHTML=""; return msg(`Erro ao ler o modelo ${item.codigo}: ${mFull.error.message}`,false); }
    itensProntos.push({...item,modeloRow:mFull.data});
  }

  // 3) Reserva a numeração de todas as peças de uma vez
  const total=itensProntos.reduce((s,x)=>s+(x.quantidade||1),0);
  const rNum=await sb.rpc("reservar_numeros",{p_prefix:`LD-${obra.prefixo}-`,p_qtd:total});
  if(rNum.error){ resBox.innerHTML=""; return msg("Erro ao reservar numeração: "+rNum.error.message,false); }
  let proximo=rNum.data;

  // 4) Monta as linhas das peças
  const rows=[];
  const faixas=[];
  for(const item of itensProntos){
    const qty=item.quantidade||1;
    const m=item.modeloRow;
    const startIdx=rows.length;
    for(let i=0;i<qty;i++){
      rows.push({
        lumidna_id:buildObraId(obra.prefixo,proximo+i),
        modelo_id:m.id, modelo:m.codigo, fabricante:m.fabricante,
        potencia_w:m.potencia_w, cct_k:m.cct_k, irc:m.irc, fluxo_lm:m.fluxo_lm, facho_graus:m.facho_graus, ip:m.ip, ik:m.ik,
        ambiente:norm(((item.ambiente)||"").toString().trim()), observacoes:norm(((item.observacoes)||"").toString().trim()),
        status:"Ativa", criticidade:"Média", obra_id:obra.id, ...obraSpread
      });
    }
    proximo+=qty;
    faixas.push({startIdx,qty,item});
  }

  const ins=await inserirLuminariasEmBlocos(rows);
  if(ins.erro){ resBox.innerHTML=""; return msg("Erro ao criar as peças: "+ins.erro,false); }
  const criadas=ins.criadas;

  // 5) Componentes (Driver/LED/Óptica) de cada peça
  const compRows=[];
  faixas.forEach(({startIdx,qty,item})=>{
    const ids=criadas.slice(startIdx,startIdx+qty);
    [["led","LED"],["driver","Driver"],["optica","Óptica"]].forEach(([campo,tipo])=>{
      const texto=formatarComponenteTexto(item[campo]);
      if(!texto) return;
      ids.forEach(l=>compRows.push({luminaria_id:l.id,tipo,modelo:texto,original:true,ativo_atual:true}));
    });
  });
  let avisoComp="";
  if(compRows.length){
    for(let i=0;i<compRows.length;i+=500){
      const rc=await sb.from("componentes").insert(compRows.slice(i,i+500));
      if(rc.error){ avisoComp=" Mas houve erro ao gravar componentes: "+rc.error.message; break; }
    }
  }

  const ids=criadas.map(x=>x.lumidna_id);
  wizUltimaCriacao=criadas;
  resBox.innerHTML=`<div class="alert">✓ ${criadas.length} peça(s) criada(s) na obra <b>${esc(obra.nome)}</b>, de <b>${ids[0]}</b> até <b>${ids[ids.length-1]}</b>.${avisoComp?"<br><b>"+esc(avisoComp)+"</b>":""}</div>
    <div class="actions" style="margin-top:10px">
      <button type="button" class="primary" onclick="wizImprimirQR()">🖨 Imprimir QR de todas</button>
      <button type="button" class="secondary" onclick="abrirObra(${obra.id})">Ver a obra</button>
    </div>`;
  msg(`Importação concluída: ${criadas.length} peça(s) criada(s).`,!avisoComp);
}
