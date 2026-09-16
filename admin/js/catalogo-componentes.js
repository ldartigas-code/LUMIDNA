// ---- Catálogo de Componentes (Driver / LED / Óptica) ----
function onCompTipoChange(){
  const tipo=q("#comp_tipo").value;
  q("#comp_potencia_field").classList.toggle("hidden", tipo==="Óptica");
  q("#comp_corrente_field").classList.toggle("hidden", tipo!=="Driver");
  q("#comp_cct_field").classList.toggle("hidden", tipo!=="LED");
  q("#comp_fluxo_field").classList.toggle("hidden", tipo!=="LED");
  q("#comp_facho_field").classList.toggle("hidden", tipo!=="Óptica");
}

let compSearchTimer=null;
function onCompSearchInput(){clearTimeout(compSearchTimer);compSearchTimer=setTimeout(loadComponentesCatalogo,300)}

async function loadComponentesCatalogo(){
  const term=q("#compSearch").value.trim();
  const box=q("#compList");
  let query=sb.from("equivalentes").select("*").order("componente_origem").order("modelo_equivalente");
  if(term) query=query.or(`modelo_equivalente.ilike.%${term}%,fabricante_equivalente.ilike.%${term}%`);
  const r=await query;
  if(r.error){box.innerHTML="<div class='small'>Erro: "+esc(r.error.message)+"</div>";return}
  const rows=r.data||[];
  box.innerHTML = rows.length ? `<table><tr><th>Tipo</th><th>Fabricante</th><th>Código</th><th>Specs</th><th>Nível</th></tr>${rows.map(c=>{
    const specs=[c.potencia_w?c.potencia_w+"W":"",c.corrente_ma?c.corrente_ma+"mA":"",c.cct_k?c.cct_k+"K":"",c.fluxo_lm?c.fluxo_lm+"lm":"",c.facho_graus?c.facho_graus+"°":""].filter(Boolean).join(" · ");
    return `<tr><td>${esc(c.componente_origem)}</td><td>${esc(c.fabricante_equivalente)||"—"}</td><td>${esc(c.modelo_equivalente)}</td><td>${specs||"—"}</td><td>${esc(c.nivel)||"—"}</td></tr>`;
  }).join("")}</table>` : "<div class='small'>Nenhum componente encontrado.</div>";
}

async function addComponenteCatalogo(){
  const codigo=q("#comp_codigo").value.trim();
  if(!codigo) return msg("Informe o código/modelo do componente.",false);
  const tipo=q("#comp_tipo").value;
  const p={
    componente_origem:tipo,
    modelo_equivalente:codigo,
    fabricante_equivalente:norm(q("#comp_fabricante").value.trim()),
    potencia_w:tipo!=="Óptica"&&q("#comp_potencia").value?Number(q("#comp_potencia").value):null,
    corrente_ma:tipo==="Driver"&&q("#comp_corrente").value?Number(q("#comp_corrente").value):null,
    cct_k:tipo==="LED"&&q("#comp_cct").value?Number(q("#comp_cct").value):null,
    fluxo_lm:tipo==="LED"&&q("#comp_fluxo").value?Number(q("#comp_fluxo").value):null,
    facho_graus:tipo==="Óptica"&&q("#comp_facho").value?Number(q("#comp_facho").value):null,
    nivel:q("#comp_nivel").value,
    preco_referencia:q("#comp_preco").value?Number(q("#comp_preco").value):null,
    disponibilidade:norm(q("#comp_disp").value.trim()),
    especificacao:norm(q("#comp_obs").value.trim()),
    homologado_por:"LumiDNA"
  };
  const r=await sb.from("equivalentes").insert(p);
  if(r.error) return msg("Erro: "+r.error.message,false);
  q("#comp_fabricante").value="";q("#comp_codigo").value="";q("#comp_potencia").value="";q("#comp_corrente").value="";q("#comp_cct").value="";q("#comp_fluxo").value="";q("#comp_facho").value="";q("#comp_obs").value="";
  msg("Componente salvo no catálogo.");
  loadComponentesCatalogo();
}

function parseCSV(text){
  const firstLine=text.trim().split(/\r?\n/)[0]||"";
  const delim=(firstLine.split(";").length>firstLine.split(",").length)?";":",";
  const lines=text.trim().split(/\r?\n/).filter(l=>l.trim().length);
  const rows=lines.map(line=>{
    const out=[]; let cur=""; let inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(inQ){
        if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else inQ=false; }
        else cur+=c;
      }else{
        if(c==='"') inQ=true;
        else if(c===delim){out.push(cur);cur="";}
        else cur+=c;
      }
    }
    out.push(cur);
    return out.map(s=>s.trim());
  });
  const header=rows[0].map(h=>h.toLowerCase().trim());
  return rows.slice(1).map(r=>{
    const obj={};
    header.forEach((h,i)=>obj[h]=(r[i]!==undefined&&r[i]!=="")?r[i]:null);
    return obj;
  });
}

async function importModelosCSV(){
  const text=q("#modelosCsvInput").value.trim();
  if(!text) return msg("Cole o CSV primeiro.",false);
  const rows=parseCSV(text);
  if(!rows.length) return msg("Nenhuma linha encontrada no CSV.",false);
  const num=v=>v!=null&&v!==""?Number(v):null;
  const payload=rows.map(r=>({
    fabricante:r.fabricante||null, linha:r.linha||null, codigo:r.codigo,
    descricao:r.descricao||null,
    potencia_w:num(r.potencia_w), cct_k:num(r.cct_k), irc:num(r.irc),
    fluxo_lm:num(r.fluxo_lm), facho_graus:num(r.facho_graus),
    ip:r.ip||null, ik:r.ik||null, tensao:r.tensao||null,
    vida_util_h:r.vida_util_h||null, observacoes:r.observacoes||null,
    tipo_montagem:r.tipo_montagem||null
  })).filter(r=>r.codigo);
  if(!payload.length) return msg("Nenhuma linha com 'codigo' preenchido.",false);
  const res=await sb.from("modelos").upsert(payload,{onConflict:"fabricante,codigo"}).select();
  if(res.error) return msg("Erro na importação: "+res.error.message,false);
  msg(`${res.data.length} modelo(s) importado(s)/atualizado(s).`);
  loadModelos();populateModeloPicker();
}

function fabCode(fabricante){
  const letters=(fabricante||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z]/g,"").toUpperCase();
  return letters.slice(0,3)||"GEN";
}
function modelBase(codigo){
  return (codigo||"").split(".")[0]||codigo||"MODELO";
}
function buildLumidnaId(modelo,num){
  return `LD-${fabCode(modelo.fabricante)}-${modelBase(modelo.codigo)}-${String(num).padStart(6,"0")}`;
}

