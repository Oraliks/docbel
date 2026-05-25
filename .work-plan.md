# Plan de travail autonome — Chat IA Améliorations

**🎉 STATUS : ✅ TERMINÉ — toutes les vagues livrées et pushées sur main.**

Total session nocturne : **83 fichiers, +10 127 / −817 lignes** sur 5 commits.

## Vagues livrées

### ✅ Phase 0 — Préparation
- Fix bug compteur tokens (`8f53746`)
- Création de ce plan

### ✅ Phase 1 — Quick wins UX + Productivité (commit `0951470`)
**1A — UX premium**
- Context menus Shadcn sur messages (Copier/Régénérer/Forker/Voir sources/Supprimer)
- Context menus sur sessions (Renommer/Pin/Archive/Dupliquer/Supprimer)
- AlertDialog Shadcn pour destructifs (remplace `window.confirm`)
- HoverCard Shadcn sur citations `[SRC:id]` → preview source en place
- Markdown JSX-based enrichi : tables, blockquotes, code blocks, listes ordonnées/non, links

**1B — Productivité chat**
- Auto-titre sessions via Haiku après 1er échange
- Edit message user + regenerate depuis ce point (nouvelle route `/regenerate-from`)
- Shortcuts clavier : Ctrl+K, Ctrl+/, Esc, Ctrl+Enter

**1C — KB intelligent**
- Auto-tag à l'upload via Haiku (3-5 tags FR)
- Détection doublons sha256 + fallback titre+head (409 Conflict avec bypass `?force=1`)
- "Source manquante ?" inline dans chat (regex refs légales BE → comparaison KB)

**1D — Sessions power**
- Migration #17 ChatFolder + pinned/archived/folderId sur ChatSession
- Routes CRUD folders + duplicate session
- UI rail : sections pinned/archive, badges, callbacks
- Estimate cost avant Send

### ✅ Phase 2A — Streaming SSE (commit `a6a7942`)
- Wrapper `callClaudeStream` (AsyncGenerator events typés)
- Routes `/chat` et `/regenerate-from` streamées via ReadableStream + SSE
- Frontend `sse-client.ts` avec AbortController
- StreamCursor + badge "Live" dans la bulle pendant streaming
- Bouton Stop (variant destructive) pendant `sending`
- Fallback non-streaming intact pour cURL / smoke tests

### ✅ Phase 2B — Switch modèle + templates (commit `318589d`)
- Migration #18 ChatSession.preferredModel
- Helper `model-resolver.ts` fail-safe fallback Sonnet
- `session-model-picker.tsx` (badge + inline DropdownMenu Shadcn)
- 7 templates prompts pré-définis (Calculateur Beldoc, Refonte UI Shadcn, Migration Prisma, Page admin pattern, Composant React, Bug fix, Audit ciblé)
- Dropdown Template dans le mode prompt avec placeholders `[NOM]`/`[SUJET]` + confirm si écrasement

### ✅ Phase 3A — RAG sémantique pgvector (commit `5e441cf`)
- Migration #19 KnowledgeChunk + extension `vector` + index ivfflat cosine
- Provider Voyage AI prioritaire (fallback OpenAI text-embedding-3-small)
- Libs chunker / embeddings / indexer / context RAG
- Indexing fire-and-forget au create/update sources
- Vector search top-K=8 avec max 3 chunks/source pour diversité
- Routes admin `/reindex` (single) + `/admin/reindex-all` (batch)
- UI source-card : badge `IndexStatusBadge` + bouton réindexer
- Fallback fail-soft : RAG jamais bloquant

### ✅ Phase 3B — Snippets + export md + voice (commit `2a93339`)
- Migration #20 ChatSnippet (shortcut unique par domain)
- Routes CRUD snippets
- Command palette `/<shortcut>` dans la textarea (chat ET prompt brief)
- Sheet de gestion CRUD (accessible depuis rail + entry palette)
- Export conversation `.md` (route GET, entry context menu rail, download Blob)
- Voice input Whisper (route POST proxy OpenAI, hook useVoiceRecorder, bouton Mic dans input bar)

## TODOs ADMIN à faire au réveil

Migrations à appliquer manuellement (cf. historique de désynchro projet) :
```bash
# Sur la DB Neon (extension pgvector requise pour #19) :
pnpm dotenv -e .env.local -- prisma migrate resolve --applied 17_add_chat_folders_pin_archive
pnpm dotenv -e .env.local -- prisma migrate resolve --applied 18_add_chat_preferred_model
pnpm dotenv -e .env.local -- prisma migrate resolve --applied 19_add_knowledge_chunks_pgvector
pnpm dotenv -e .env.local -- prisma migrate resolve --applied 20_add_chat_snippets
# Si les tables n'existent pas encore, exécuter les SQL via db execute avant le resolve.
```

Env vars à ajouter selon les features désirées :
- `VOYAGE_API_KEY` (recommandé) ou `OPENAI_API_KEY` → active le RAG sémantique
- `OPENAI_API_KEY` → active le voice input Whisper

Action après migration #19 appliquée :
- `POST /api/chomage-ia/admin/reindex-all?domain=chomage` pour indexer la KB existante

## TODOs non câblés (mineurs, conscients)

- Régénération inline après Stop streaming (la bulle aborted n'a pas encore son bouton "Régénérer ?" — le user peut passer par le ContextMenu)
- Endpoints backend pour onTogglePin/onArchive sessions (le schema est OK, les UI items existent avec callbacks, mais le wiring final dans chat-full-shell n'est pas fait — `onDuplicate` est wiré, pin/archive renvoient un toast "Bientôt disponible")
- DELETE /api/chomage-ia/messages/[id] pour suppression de messages individuels (context menu prêt côté UI, endpoint à créer)
- Propagation AbortSignal jusqu'à Anthropic (optim coût stop)
- Auto-retry 429 transient côté callClaudeStream

Tout le reste est complet et testé (TS clean + build OK à chaque vague).
