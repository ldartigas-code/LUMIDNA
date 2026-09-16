// ---- Upload de fotos (Supabase Storage) ----
async function uploadPhoto(e){
  if(!LID) return msg("Selecione ou crie um ativo primeiro.",false);
  const file=e.target.files[0]; if(!file) return;
  const targetName=e.target.dataset.target;
  const path=`${LID}/${targetName}_${Date.now()}_${file.name}`.replace(/\s+/g,"_");
  msg("Enviando foto...");
  const up=await sb.storage.from("fotos").upload(path,file,{upsert:true});
  if(up.error) return msg("Erro no upload: "+up.error.message,false);
  const {data}=sb.storage.from("fotos").getPublicUrl(path);
  q(`[name="${targetName}"]`).value=data.publicUrl;
  updatePhotoPreview(targetName,data.publicUrl);
  msg("Foto enviada. Clique em SALVAR para gravar o link.");
}
function updatePhotoPreview(name,url){
  const img=q(`.fotoPreview[data-preview="${name}"]`);
  if(!img) return;
  if(url){img.src=url;img.classList.remove("hidden")}else{img.classList.add("hidden")}
}

function copyPublicLink(){
  const v=q("#publicLink").value;
  if(!v||v.startsWith("(")) return;
  navigator.clipboard.writeText(v).then(()=>msg("Link copiado.")).catch(()=>msg("Não foi possível copiar. Selecione e copie manualmente.",false));
}

function fill(d){[...q("#formLum").elements].forEach(e=>{if(e.name&&d[e.name]!=null)e.value=d[e.name]})}

