# Game Organizer

Aplicativo desktop (Windows) com visual estilo Notion para organizar seus jogos: o que está **jogando**, o que está **pra zerar** e o que já foi **zerado**, com categorias livres (Indies, Co-op, Favoritos...) e **metas** com prazo.

Tudo fica salvo localmente num banco SQLite. Nenhum dado ou chave vai para a nuvem ou para o repositório.

## Funcionalidades

- Biblioteca com três visualizações: **tabela** (edição direto na célula), **board** kanban (arraste para mudar o status) e **galeria** de capas.
- Busca de jogos no **IGDB** (base da Twitch) com `Ctrl+K`: capa, ano, gêneros e plataformas preenchidos automaticamente. Também dá para adicionar jogos manualmente.
- Categorias com cores, filtros por categoria e plataforma, e categorização automática pelos gêneros do IGDB (ex.: todos os jogos "Indie" viram "Indies").
- Página de cada jogo com status, nota (0 a 10), horas, datas de início e de quando zerou, e anotações em texto rico.
- Metas:
  - zerar um jogo até uma data (ex.: até 15/03/2026);
  - zerar um jogo em um ano (ex.: em 2026);
  - zerar N jogos em um ano ou período, opcionalmente de uma categoria (ex.: 5 indies em 2026), com ritmo necessário por mês.
- Estatísticas: zerados por mês, por categoria, por plataforma, horas e notas.
- Backup e restauração em JSON (sem as chaves de API).
- Tema claro e escuro.

## Stack

Tauri 2 (Rust) + React 19 + TypeScript + Vite, Tailwind CSS 4 com componentes no estilo shadcn/ui, TanStack Query e Table, dnd-kit, Tiptap, Recharts e SQLite via `tauri-plugin-sql`.

## Pré-requisitos (Windows)

- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs) (`winget install Rustlang.Rustup`)
- Visual Studio Build Tools com "Desenvolvimento para desktop com C++" (`winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"`)
- WebView2 (já vem no Windows 10/11)

## Rodando

```bash
npm install
npm run tauri dev     # abre o app em modo desenvolvimento
npm run tauri build   # gera o instalador em src-tauri/target/release/bundle/
```

## Configurando a busca do IGDB

1. Entre em [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) e crie um app (OAuth Redirect URL: `http://localhost`, categoria "Application Integration").
2. Gere um **Client Secret**.
3. No app, vá em **Configurações** e cole o Client ID e o Client Secret. O app valida as chaves antes de salvar.

As chaves ficam em `%APPDATA%\com.gameorganizer.app\igdb.json`, fora do repositório. Em desenvolvimento você também pode usar as variáveis de ambiente `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` (veja `.env.example`). A chamada ao IGDB é feita pelo lado Rust, então o segredo não passa pelo frontend.

## Onde ficam os dados

| O quê | Onde |
| --- | --- |
| Banco SQLite | `%APPDATA%\com.gameorganizer.app\games.db` |
| Chaves do IGDB | `%APPDATA%\com.gameorganizer.app\igdb.json` |

O `.gitignore` bloqueia `.env`, `*.db`, `*.sqlite`, `igdb.json` e arquivos de backup, para nada pessoal ir parar no GitHub.

## Estrutura

```
src/
  components/      UI base (shadcn), layout e componentes de jogo
  features/        library, categories, goals, stats, search (Ctrl+K), settings
  lib/             db.ts (SQLite), queries.ts (React Query), api.ts (comandos Tauri)
src-tauri/
  migrations/      SQL do banco
  src/commands/    igdb.rs (busca + token da Twitch), files.rs (backup)
```

## Próximos passos

- Sincronização com nuvem (Supabase ou Turso). O banco já usa UUIDs, `updated_at` e exclusão lógica, o que facilita mesclar os dados.
- Importar a biblioteca da Steam.
- Tempo médio para zerar (HowLongToBeat) para avaliar se uma meta é realista.
- Notificações de prazo de metas e um sorteador de "o que jogar agora".
