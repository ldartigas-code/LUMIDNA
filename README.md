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
- **Catálogo de modelos** — luminárias (Retrofit ou COB), com importação em
  massa por CSV.
- **Catálogo de componentes** — Driver/LED/Óptica com compatibilidade
  verificada pela LumiDNA, com preço de referência. É o único lugar onde peças
  compatíveis são cadastradas; a tela de cada peça só lista as que servem pra
  ela.
- **Peça avulsa** — para peça sem modelo no catálogo. Escolhe-se a obra e a
  peça nasce com o prefixo dela (`LD-PDC-000007`), pela mesma numeração atômica
  do cadastro em lote — o ID nunca é digitado à mão, para não colidir com a
  numeração automática. Só quem marca "Sem obra" recebe `LD-AVU-000001`.
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
- **Registrar manutenção** — enviado pela página pública, fica pendente até o
  Admin aprovar em "Aprovações pendentes"; só depois disso vira histórico
  oficial da peça. Registrada direto pelo Admin (na tela da peça), a troca de
  Driver/LED/Óptica também atualiza "Peças instaladas" e o histórico de
  alterações, igual à aprovação — os dois caminhos deixam a peça no mesmo estado.
- **Relatórios** — relatório de manutenções de uma peça (linha do tempo com
  fotos) e relatório de uma obra por período (quantas peças mexidas, o que
  foi trocado, valor de referência investido).
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
