# LumiDNA

Plataforma de identidade digital permanente para luminárias.
Site estático (HTML/JS) + Supabase como banco de dados.

## Estrutura

```
index.html          → LD-000001, prova de conceito (fixa, não editar)
admin/index.html     → Admin: login + cadastro/edição de qualquer luminária
ativo/index.html     → Página pública do ativo (aberta via NFC/QR)
assets/supabase-config.js → URL e chave pública do Supabase (compartilhada)
```

## URLs

- Prova de conceito: `https://ldartigas-code.github.io/LUMIDNA/`
- Admin: `https://ldartigas-code.github.io/LUMIDNA/admin/`
- Ativo público: `https://ldartigas-code.github.io/LUMIDNA/ativo/?id=LD-000002`

A tag NFC de cada luminária deve ser gravada com a URL `ativo/?id=<ID>` correspondente.

## Passos obrigatórios antes de usar (fazer uma vez)

1. **Rodar o SQL de segurança** — abra o Supabase Studio → SQL Editor → cole e
   execute `sql/rls_policies.sql` (na raiz do projeto, fora desta pasta `site/`).
   Isso troca as policies públicas temporárias por: leitura pública (para a
   página do ativo) e escrita só para usuários autenticados (para o Admin).
2. **Criar o usuário do Admin** — Supabase Studio → Authentication → Users →
   Add user, com o e-mail e senha que vão logar no Admin. O Admin não tem
   cadastro (signup) próprio por segurança.
3. Publicar o conteúdo desta pasta (`site/`) na raiz do repositório
   `ldartigas-code/LUMIDNA` no GitHub, mantendo a estrutura de pastas.

## Fluxo de uso

1. Logar no Admin, criar ou carregar uma luminária pelo ID (ex: `LD-000002`).
2. Preencher dados técnicos, componentes, localização, garantias, fotos.
3. Salvar.
4. Abrir `ativo/?id=LD-000002` para conferir a página pública.
5. Gravar a tag NFC com essa URL.
