# LumiDNA

Plataforma de identidade digital permanente para luminárias.
Site estático (HTML/JS) + Supabase como banco de dados.

## Estrutura

```
index.html                 → LD-000001, prova de conceito antiga (fixa, não editar)
admin/index.html            → Admin: login + cadastro/edição/manutenção de luminárias
admin/js/*.js                → JS do Admin, separado por assunto:
  core.js                      autenticação, navegação entre telas, helpers
  catalogo-modelos.js          Catálogo de modelos de luminária (importação CSV)
  catalogo-componentes.js      Catálogo de componentes compatíveis verificados (Driver/LED/Óptica)
  wizard.js                    cadastro em lote (carrinho, numeração, etiqueta)
  dashboard.js                 alerta de garantias vencendo
  busca.js                     busca e tela de detalhe de uma peça
  fotos.js                     upload de fotos (Supabase Storage)
  auditoria.js                 histórico de alterações, peças instaladas
  obras.js                     cadastro/edição de Obras
  aprovacoes.js                fila de aprovação de manutenções enviadas em campo
  reposicao.js                 fila "Peças pra comprar" (pedidos de reposição)
  relatorios.js                relatório de peça e relatório de obra por período
ativo/index.html             → Página pública do ativo (aberta via NFC/QR)
assets/supabase-config.js    → URL e chave pública do Supabase (compartilhada)
```

## URLs

- Prova de conceito: `https://ldartigas-code.github.io/LUMIDNA/`
- Admin: `https://ldartigas-code.github.io/LUMIDNA/admin/`
- Ativo público: `https://ldartigas-code.github.io/LUMIDNA/ativo/?c=<public_code>`
  (o `public_code` é um UUID opaco gerado por peça — não dá pra adivinhar o link
  de uma peça a partir da outra; o link de cada peça fica em Admin → Buscar
  peça → abrir → campo "Link público")

## Passos obrigatórios antes de usar (fazer uma vez)

1. **Rodar as migrações SQL, em ordem numérica** — Supabase Studio → SQL Editor
   → cole e execute cada arquivo de `sql/migration_01_...` até o número mais
   alto presente na pasta, na ordem. Isso cria as tabelas, RLS e funções
   públicas usadas pelo site.
2. **Criar o usuário do Admin** — Supabase Studio → Authentication → Users →
   Add user, com o e-mail e senha que vão logar no Admin. O Admin não tem
   cadastro (signup) próprio por segurança.
3. Publicar o conteúdo desta pasta (`site/`) na raiz do repositório
   `ldartigas-code/LUMIDNA` no GitHub, mantendo a estrutura de pastas —
   **sem** o prefixo `site/` (o GitHub Pages serve a partir da raiz do repo).

## Principais funcionalidades

- **Obras** — cada projeto/local é uma entidade própria (tensão, automação,
  cliente e e-mail do cliente), com sua lista de peças e aprovações pendentes.
  Cada obra recebe um número automático (Obra 1, 2, 3...) e um prefixo curto
  de 2 a 6 letras/números, sugerido a partir do nome (Parque das Cerejeiras =
  PDC) e editável, único entre as obras.
  Ao editar a obra, dá pra aplicar nome, cliente, e-mail, tensão e automação
  nas peças já cadastradas (o e-mail só é aplicado se estiver preenchido).
- **Cadastro em lote (wizard)** — escolhe a obra, monta um "pedido" com vários
  modelos e quantidades, e o sistema gera os IDs no formato
  `LD-<PREFIXO DA OBRA>-000001` (ex: `LD-PDC-000001`, contando dentro da obra,
  independente do modelo) e o QR de cada peça de uma vez. A numeração é
  reservada de forma atômica no banco (sem risco de duas peças saírem com o
  mesmo ID em cadastros simultâneos). Trocar o prefixo de uma obra só afeta as
  peças novas; as já cadastradas mantêm o ID que têm.
  Cada item do carrinho tem um campo **Ambiente** (sugere os já usados nessa
  obra, pra não nascer "Sala Reunião" numa peça e "Sala de Reunião" noutra).
  **Colar lista** aceita `código, quantidade, ambiente, fabricante` (fabricante
  só é necessário se o código existir em mais de um fabricante), separado por
  vírgula, ponto-e-vírgula ou tab — dá pra colar direto do Excel, e uma linha
  de cabeçalho colada junto é detectada e ignorada. Código igual + mesmo
  ambiente soma quantidade na mesma linha; ambiente diferente vira linha
  separada. Código não encontrado no catálogo vira um botão que abre
  "+ Modelo novo" já preenchido e, ao salvar, entra sozinho no pedido com a
  quantidade e o ambiente certos.
- **Aviso de obra parecida** — ao criar uma obra (na tela Obras ou no
  assistente), se o nome bater com uma já existente (ignorando acento,
  maiúscula, "de/da/do" e números soltos — ex: "Parque Cerejeiras" x "Parque
  das Cerejeiras 2"), aparece um aviso pedindo confirmação de novo antes de
  criar. Não bloqueia, só evita duplicidade por descuido.
- **Progresso da obra** — na tela de cada obra, uma barra mostra "X de Y
  peças já com local (ambiente) definido", calculada a partir do que já foi
  preenchido em campo.
- **Escanear QR na busca** — botão "📷 Escanear QR" em Buscar peça abre a
  câmera (traseira no celular) e lê o QR da etiqueta pra abrir a peça direto,
  sem digitar nada.
- **Catálogo de modelos** — luminárias (Retrofit ou COB), com edição (botão
  Editar em cada modelo) e importação em massa por CSV.
- **Catálogo de componentes** — Driver/LED/Óptica com compatibilidade
  verificada pela LumiDNA, com preço de referência. É o único lugar onde peças
  compatíveis são cadastradas; a tela de cada peça só lista as que servem pra
  ela.
- **Cada dado é digitado uma vez só, no lugar dono dele.** O **modelo** (Catálogo)
  guarda fabricante, código e dados técnicos (potência, CCT, IRC, fluxo, facho,
  IP, IK). A **obra** guarda nome, prefixo, cliente, e-mail, tensão e automação.
  A **peça** só guarda o que é dela: local (edifício, andar, ambiente, posição,
  quadro, circuito), número de série, lote, datas, status, criticidade, fotos e
  observações. Na tela da peça, os dados do modelo e da obra aparecem **só para
  leitura**, com atalhos "Editar este modelo no Catálogo" e "Editar a obra".
  Quando um modelo é editado no Catálogo (ou reimportado por CSV), todas as
  peças ligadas a ele acompanham.
- **Ficha de leitura x edição** — ao abrir uma peça, aparece primeiro um
  resumo simples (situação, onde está, obra, cliente, garantia, última
  manutenção, link público) pensado pra quem não é técnico. Só quem clica em
  "✏️ Editar peça" chega ao formulário técnico completo; ao SALVAR, volta
  sozinho pro resumo.
- **Um único caminho para cadastrar peças** — Cadastrar peças novas: Obra ->
  Modelo -> Quantidade. Se o modelo não existe, o botão **"+ Modelo novo"** do
  próprio pedido (fabricante e código; dados técnicos opcionais) salva no
  Catálogo e já adiciona ao pedido. Não existe mais "peça avulsa": toda peça
  nasce com modelo e obra, então nada fica solto. Fabricante e código não
  diferenciam maiúscula de minúscula (LDARTI = Ldarti). Peças antigas sem
  modelo do catálogo são ligadas sozinhas (e o modelo é cadastrado) ao
  clicar em SALVAR; peça sem obra ganha a obra escolhida na própria tela dela
  e a Buscar peça marca essas com "sem obra".
- **Criar cópia (peça nova)** — em Buscar peça (botão Copiar) ou na tela da peça,
  cria uma ou várias peças NOVAS (ID e QR novos, com o prefixo da obra de
  destino) já com os mesmos dados técnicos, só pra poupar digitação. Cliente,
  e-mail, tensão e automação vêm da obra de destino. Número de série, lote,
  datas, fotos, local, garantias, manutenções e histórico nascem em branco, e
  as peças instaladas nascem "Original" (a menos que se marque copiá-las).
  Não move nem altera a peça original — a luminária física nunca troca de obra.
- **Modelos Retrofit** — no cadastro, já dá pra escolher qual lâmpada
  compatível verificada foi instalada; potência/CCT/fluxo aparecem sozinhos (o dado mora
  na lâmpada, não é duplicado na luminária — se a lâmpada for trocada depois,
  a informação exibida acompanha a troca).
- **Etiqueta com QR code** — gerada na hora do cadastro, com logo, QR e o ID
  como identificador; pronta pra imprimir ou mandar pra um fabricante de
  etiquetas NFC.
- **Página pública (`ativo`)** — mostra dados técnicos, localização, peças
  instaladas, garantias, manutenções e equivalentes compatíveis verificados de
  uma peça, a partir do link/QR/NFC.
- **Reportar problema** — antes de qualquer manutenção, quem percebe uma
  falha relata o sintoma (sem precisar saber nada técnico) e o sistema já
  sugere o componente provável e a peça compatível verificada certa pra
  aquele modelo. É uma sugestão, não um diagnóstico técnico — o profissional
  em campo confirma a causa real antes de instalar. Esse aviso também aparece
  na própria página pública, junto de um alerta de segurança (cheiro de
  queimado, faísca ou fiação aquecida: desligar o circuito e chamar um
  profissional sem esperar a compra).
- **Peças pra comprar** — cada "Reportar problema" vira um pedido de
  reposição, com preço de referência, opção de trocar por outra peça
  compatível verificada, e botão pra gerar e-mail de compra.
- **Peças instaladas (Driver/LED/Óptica)** — na tela da peça, cada tipo é uma
  caixa de seleção com as peças compatíveis já homologadas no Catálogo de
  componentes, mais **"Integrada"** (não existe separada nesta luminária,
  vem marcada sozinha quando não há nenhuma opção homologada pro modelo) e
  **"Outro modelo"** (texto livre, pra peça ainda não homologada). Botão
  próprio "Salvar peças instaladas" — grava só nessa peça (tabela
  `componentes`), nunca no catálogo central. Se o código digitado em "Outro
  modelo" ainda não está no Catálogo de componentes, o sistema pergunta se
  quer cadastrar já pelo menos o código lá (nível "Alternativa possível" —
  dá pra completar fabricante/preço/nível depois). O botão **"📤 Aplicar a
  todas as peças iguais desta obra"** replica o Driver/LED/Óptica dessa peça
  pras outras peças do **mesmo modelo** nesta obra (não mexe em peças de
  outro modelo nem no catálogo).
- **Registrar manutenção** — enviado pela página pública, fica pendente até o
  Admin aprovar em "Aprovações pendentes"; só depois disso vira histórico
  oficial da peça. Registrada direto pelo Admin (na tela da peça), a troca de
  Driver/LED/Óptica também atualiza "Peças instaladas" e o histórico de
  alterações, igual à aprovação — os dois caminhos deixam a peça no mesmo estado.
- **Relatórios** — um PDF por relatório (Imprimir > Salvar como PDF), de uma
  peça ou de uma obra por período. Cada ocorrência mostra o horário de **cada
  etapa** — aviso do problema, pedido de compra enviado, compra confirmada,
  troca em campo e aprovação — com o tempo entre elas (o mais demorado vem
  destacado), quem avisou, a empresa e o responsável que fez o serviço, o que
  foi trocado, o valor de referência e as fotos. O relatório da obra ainda traz
  o resumo de tempo médio por trecho ("onde o tempo é gasto"), as empresas que
  atuaram e os avisos que ainda estão sem troca. Os horários de pedido e de
  compra só passam a existir a partir de quando foram introduzidos; antes
  disso o relatório mostra "não registrado".
- **Fotos do serviço** — a página pública aceita até 4 fotos ao registrar a
  manutenção, e o Admin aceita várias ao registrar direto; elas aparecem na
  aprovação e no relatório.
- **Auditoria** — toda alteração de campo, componente e manutenção fica
  registrada por peça.

## Fluxo de uso

1. Logar no Admin.
2. **Cadastrar peças novas** → escolher/criar a obra → montar o pedido (um ou
   vários modelos) → confirmar → imprimir as etiquetas.
3. No campo, escanear o QR pra abrir a página pública da peça.
4. Se algo parar de funcionar: **Reportar problema** primeiro (sintoma +
   recomendação de peça), depois **Registrar manutenção** quando a troca for
   feita de verdade.
5. No Admin, aprovar a manutenção em "Aprovações pendentes" e acompanhar
   pedidos em "Peças pra comprar".

## Segurança

- RLS ligado em todas as tabelas: leitura direta e escrita só para usuários
  autenticados (Admin).
- A página pública nunca acessa tabelas diretamente — só via funções
  `SECURITY DEFINER` que devolvem o mínimo necessário a partir do código
  opaco da peça: `get_ativo_publico`, `listar_homologados`,
  `enviar_manutencao_pendente`, `reportar_problema`.
- `reservar_numeros` (numeração de LD-ID) é a única função sensível
  intencionalmente restrita a usuários autenticados — chamada anônima deve
  retornar "permission denied".
