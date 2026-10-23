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

## Download

Baixe o instalador mais recente na página de [Releases](https://github.com/JesusGabriel4002/Game-Organizer/releases/latest):

- `Game.Organizer_X.Y.Z_x64-setup.exe`: instalador recomendado.
- `Game.Organizer_X.Y.Z_x64_en-US.msi`: instalador MSI (alternativo).

Se o Windows SmartScreen avisar na primeira execução, clique em **Mais informações** e depois em **Executar assim mesmo**. O aviso aparece porque o app ainda não tem assinatura digital.

## Pré-requisitos para desenvolver (Windows)

- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs) (`winget install Rustlang.Rustup`)
- Visual Studio Build Tools com "Desenvolvimento para desktop com C++" (`winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"`)
- WebView2 (já vem no Windows 10/11)

## Rodando

```bash
npm install
npm run tauri dev     # abre o app em modo desenvolvimento
npm run tauri build   # gera os instaladores localmente
```

O build local gera:

| Arquivo | Caminho |
| --- | --- |
| Instalador NSIS | `src-tauri/target/release/bundle/nsis/Game Organizer_X.Y.Z_x64-setup.exe` |
| Instalador MSI | `src-tauri/target/release/bundle/msi/Game Organizer_X.Y.Z_x64_en-US.msi` |
| Executável sem instalação | `src-tauri/target/release/game-organizer.exe` |

A pasta `target/` está no `.gitignore`, então os compilados não vão para o repositório. Eles são distribuídos pelas Releases.

## Publicando uma nova versão

As releases são automáticas. O workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) roda no GitHub Actions sempre que uma tag `v*` é enviada. Ele compila o app num runner Windows e cria a release com os dois instaladores anexados.

1. Atualize a versão nos três arquivos de uma vez (`package.json`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`):

   ```bash
   npm run bump -- 0.2.0
   ```

2. Faça o commit, crie a tag e envie:

   ```bash
   git commit -am "v0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```

3. Acompanhe a compilação na aba **Actions** do GitHub (leva uns 10 minutos). Quando terminar, a release `v0.2.0` aparece em **Releases** com os instaladores.

A versão da tag precisa ser igual à dos arquivos, porque o nome dos instaladores usa a versão do `tauri.conf.json`. Para corrigir uma release com problema, apague a release e a tag no GitHub (`gh release delete v0.2.0 --cleanup-tag`) e repita o passo 2.

### Publicando manualmente (sem Actions)

```bash
npm run tauri build
gh release create v0.2.0 "src-tauri/target/release/bundle/nsis/Game Organizer_0.2.0_x64-setup.exe" "src-tauri/target/release/bundle/msi/Game Organizer_0.2.0_x64_en-US.msi" --title "Game Organizer v0.2.0" --generate-notes
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
scripts/
  bump-version.mjs atualiza a versão nos três arquivos de configuração
.github/workflows/
  release.yml      compila e publica a release quando uma tag v* é enviada
```

## Próximos passos

- Sincronização com nuvem (Supabase ou Turso). O banco já usa UUIDs, `updated_at` e exclusão lógica, o que facilita mesclar os dados.
- Importar a biblioteca da Steam.
- Tempo médio para zerar (HowLongToBeat) para avaliar se uma meta é realista.
- Notificações de prazo de metas e um sorteador de "o que jogar agora".
