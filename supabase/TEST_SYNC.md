# Checklist de sync (dois aparelhos)

Pré-requisito: SQL `001_sync.sql` já rodado e `.env` com URL + anon key.

1. **Aparelho A** (dev): entre com a conta, aceite enviar a biblioteca, edite a nota de um jogo.
2. **Aparelho B** (instalado ou outra pasta de dados): entre com a mesma conta → a nota deve aparecer após sync.
3. **Offline A:** desligue a net, mude o status de um jogo, religue → deve subir.
4. **Conflito:** offline nos dois, edite o mesmo campo com valores diferentes, religue → vale o `updated_at` mais novo.
5. **Exclusão:** apague (soft) um jogo em A → some em B após sync.
6. **IGDB duplicado:** adicione o mesmo jogo offline em A e B → após sync, um só `user_games` ativo.
7. **Contas isoladas:** conta B não vê jogos da conta A.
