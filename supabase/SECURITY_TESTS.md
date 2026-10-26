# Testes de segurança (manuais)

Substitua `URL`, `ANON` e os tokens de duas contas de teste.

## Sem login → negado

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: ANON" -H "Authorization: Bearer ANON" \
  "URL/rest/v1/games?select=id"
# Esperado: 401 ou lista vazia (RLS). Nunca dados de outro usuário.
```

```bash
curl -s -X POST "URL/rest/v1/rpc/push_changes" \
  -H "apikey: ANON" -H "Authorization: Bearer ANON" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"games":[]}}'
# Esperado: erro not authenticated / 401
```

## Conta A não lê Conta B

1. Crie usuário A e B.
2. Com o token de A, insira um jogo.
3. Com o token de B: `GET /rest/v1/games?select=*` — não deve aparecer o jogo de A.

## Push com user_id forjado

Com token de A, chame `push_changes` incluindo `"user_id":"<uuid-de-B>"` numa linha. O trigger `force_row_owner` deve gravar como A. Confirme com select na conta B (vazio) e A (presente).

## Payload inválido

- Tabela `hackers` → erro `invalid table`
- Mais de 500 linhas numa tabela → erro `too many rows`
- Colunas extras são ignoradas (só as listadas na RPC entram)

## Build do app

```powershell
Select-String -Path "src-tauri\target\release\game-organizer.exe" -Pattern "service_role|sb_secret_" -Encoding byte
# Não deve achar a service_role. A anon/publishable pode aparecer (é pública).
```

## Sessão no PC

Com o app aberto e logado, no DevTools do webview: `localStorage` não deve ter o JWT. A sessão fica no Credential Manager (`com.gameorganizer.app` / `supabase-session`).
