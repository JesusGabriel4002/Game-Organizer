# Supabase (login e sync)

## Já feito no painel
- Projeto `game-organizer` criado
- Auth por e-mail e senha ativado
- Chaves obtidas (só URL + publishable/anon no app)

## 1. Rodar o schema
1. Abra o projeto no [Supabase](https://supabase.com/dashboard)
2. Vá em **SQL** → **New query**
3. Cole o conteúdo de [migrations/001_sync.sql](migrations/001_sync.sql)
4. Clique em **Run**

## 2. Deploy da função "excluir conta"
No terminal (com [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e logado):

```bash
npx supabase login
npx supabase functions deploy delete-account --project-ref eftzzzjksokmzkyntmzn
```

A função usa `SUPABASE_SERVICE_ROLE_KEY` automaticamente no servidor do Supabase. Essa chave **nunca** vai para o app desktop.

## 3. Variáveis no app
Arquivo `.env` na raiz do repositório (não versionado):

```env
VITE_SUPABASE_URL=https://eftzzzjksokmzkyntmzn.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_publishable
```

No GitHub Actions, cadastre as mesmas como **Variables** do repositório (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## SMTP (depois)
Sem SMTP próprio o Supabase só envia e-mail para membros do projeto. Para liberar o app para outras pessoas, configure Resend ou Gmail (senha de app) em **Project Settings → Authentication → SMTP**.
