# Tarefas para Conclusão do MVP — CP3 (Ensaio)

**Autor:** Alexandre Magalhães (Tech Lead)
**Data:** 27/05/2026
**Contexto:** após o passe de testes e hardening (suíte Vitest com 28 testes, correção do modelo Groq descontinuado, fix de build/tsconfig), o núcleo `extração → análise IA → gaps → criticidade` está funcional e coberto por testes. Faltam três frentes do escopo do MVP (`ESCOPO_MVP_ATUALIZADO.md`) e dois entregáveis do CP3. Este documento distribui o trabalho restante.

> **Como ler uma tarefa:** cada uma tem _Escopo_, _Arquivos_, _Critérios de aceitação_ (o que valida a entrega) e _Definição de pronto_ (DoD). Não fechar a tarefa sem todos os critérios verdes.

---

## ✅ Dependência transversal RESOLVIDA — TL-1 já está no `main`

O contrato compartilhado **`AnalysisRecord` já foi implementado, testado e integrado**. Reilson e Stela estão **liberados**. O que mudou no código:

- **`src/services/types.ts`** — interface `AnalysisRecord` (bloco `analysis` alinhado ao escopo §5.6) + `TokenUsage`.
- **`src/services/LLMIntegrationService.ts`** — novo método público **`analyzePR(corpusFilePath, docsPath): Promise<AnalysisRecord>`**. O `analyzeDiff` antigo continua intacto. As chamadas internas agora capturam tokens (`callGroqRaw`/`callGeminiRaw`).
- **`src/index.ts`** — a CLI já chama `analyzePR` e imprime o `AnalysisRecord` completo; há comentários marcando **onde** Reilson (persistência) e Stela (relatório) plugam.
- **Testes:** `tests/record.test.ts` (3 casos) cobre o contrato. Suíte total: **31 testes verdes**.

Contrato entregue (consumir como está — **não alterar sem alinhar com a TL**):

```ts
export interface AnalysisRecord {
  repository: string;
  pullRequest: { id: string; title: string; author: string; url: string };
  analysis: {
    status: "Atenção necessária" | "OK";   // derivado de requires_docs_update
    criticality: "Baixa" | "Média" | "Alta" | "Crítica";
    requiresDocsUpdate: boolean;
    detectedChanges: string[];             // derivado dos arquivos do PR
    documentationGaps: string[];           // = AuditResult.gaps
    justification: string;                 // = AuditResult.justificativa
    recommendations: string[];             // derivado da criticidade
  };
  llm: {
    provider: "groq" | "gemini";
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;                 // USD; 0 no free tier
  };
  routing: { reason: string };
  createdAt: string;                       // ISO timestamp
}
```

> **Decisões fechadas com o time:** (1) `analysis` alinhado ao §5.6 — status/detectedChanges/recommendations são derivados **no contrato**, não em cada consumidor; (2) `detectedChanges` derivado dos arquivos do PR (`path (status)`), sem custo de tokens.

---

## ✅ TL-1 — Definir e expor o `AnalysisRecord` (Tech Lead — Alexandre) — **CONCLUÍDA**

**Critérios de aceitação** (todos verdes)
- [x] `analyzePR` retorna um `AnalysisRecord` completo e tipado (sem `any`).
- [x] `provider` e `model` refletem a decisão real de roteamento.
- [x] Testes Vitest cobrindo o novo método (`tests/record.test.ts`, mock de `fetch` com `usage`/`usageMetadata`).
- [x] `npx tsc --noEmit` e `npm test` verdes (31 testes).
- [x] `analyzeDiff` antigo intacto (compatibilidade preservada).

---

## 🟩 TAREFA REILSON — Persistência de histórico em MongoDB (§5.6)

**Responsável:** Reilson Fonseca (Dev — Persistência)
**Depende de:** TL-1 ✅ (concluída — `analyzePR` já devolve o `AnalysisRecord`; basta dar `save(record)`).
**Referência de escopo:** `ESCOPO_MVP_ATUALIZADO.md` §5.6 e critério de sucesso §8 ("100% das análises salvas com sucesso").

**Escopo**
1. Adicionar dependência **Mongoose** (`mongoose`) ao `package.json`.
2. Criar `src/services/persistence/AnalysisRepository.ts` com:
   - conexão lazy ao MongoDB via `process.env.MONGODB_URI`;
   - schema/model `Analysis` exatamente com a forma do `AnalysisRecord` (campos `repository`, `pullRequest`, `analysis`, `llm`, `createdAt`);
   - método `save(record: AnalysisRecord): Promise<string>` (retorna o id salvo);
   - método `findRecent(limit = 10): Promise<AnalysisRecord[]>` para inspeção do histórico.
3. Plugar o `save()` no fluxo do `src/index.ts`, **após** a análise — sem derrubar a CLI se o Mongo estiver offline (logar warning e seguir, já que a análise em si não pode falhar por causa do banco).
4. Adicionar `MONGODB_URI` ao `.env.example`.
5. Documentar como subir um Mongo local (pode reaproveitar um `docker-compose` simples) num `docs/PERSISTENCE.md` curto.

**Arquivos:** `src/services/persistence/AnalysisRepository.ts` (novo), `src/index.ts`, `package.json`, `.env.example`, `docs/PERSISTENCE.md` (novo).

**Critérios de aceitação**
- [ ] Rodar uma auditoria salva **1 documento** no MongoDB com **todos** os campos do schema preenchidos (validar com `mongosh` ou `findRecent`).
- [ ] O documento salvo bate 1:1 com o exemplo de schema do §5.6 do escopo.
- [ ] Com Mongo **offline**, a CLI ainda imprime o resultado da análise e sai com código 0, logando um aviso claro (a persistência é best-effort, a análise não).
- [ ] `findRecent()` retorna os últimos N registros ordenados por `createdAt` desc.
- [ ] Teste automatizado do repositório usando **`mongodb-memory-server`** (sem depender de Mongo externo no CI), cobrindo `save` + `findRecent`.
- [ ] `npx tsc --noEmit` e `npm test` verdes.

**DoD:** demonstração de uma análise salva e recuperada via `findRecent`; testes verdes; `docs/PERSISTENCE.md` permite a qualquer um do time subir o banco e reproduzir.

---

## 🟨 TAREFA STELA — Gerador de relatório Markdown (§5.5)

**Responsável:** Stela Nascimento (Dev — Saída/Relatórios)
**Depende de:** TL-1 ✅ (concluída — `record.analysis` já traz status/detectedChanges/recommendations prontos).
**Referência de escopo:** `ESCOPO_MVP_ATUALIZADO.md` §5.5 (formato e exemplo do relatório).

**Escopo**
1. Criar `src/services/ReportGenerator.ts` com função pura `buildMarkdownReport(record: AnalysisRecord): string`.
2. O Markdown deve conter **todas** as seções do §5.5:
   - `# Relatório de Auditoria de Documentação`
   - **Status** — derivado: `requires_docs_update === true` → "Atenção necessária"; senão → "OK / Sem pendências".
   - **Criticidade** — `record.analysis.criticidade`.
   - **Mudanças identificadas** — lista a partir dos arquivos do PR / contexto.
   - **Gaps documentais encontrados** — `record.analysis.gaps`.
   - **Justificativa** — `record.analysis.justificativa`.
   - **Recomendação** — texto derivado da criticidade (ex.: Crítica/Alta → "Atualizar a documentação antes de aprovar o PR").
   - **Necessidade de atualização** — sim/não.
3. Salvar o relatório em `output/report-pr-{number}.md` e também imprimir o caminho no console; plugar no `src/index.ts`.
4. Não alterar o contrato do LLM: derive Status/Recomendação dos campos já existentes em `AuditResult` (não precisa pedir nada novo ao modelo).

**Arquivos:** `src/services/ReportGenerator.ts` (novo), `src/index.ts`, e fixtures de teste.

**Critérios de aceitação**
- [ ] Dado um `AnalysisRecord` de exemplo, o `.md` gerado contém **todas** as 7 seções listadas acima, na ordem.
- [ ] Um caso "Crítica" produz Status "Atenção necessária" e Recomendação de bloquear/atualizar antes do merge; um caso "Baixa" com `requires_docs_update=false` produz Status "OK".
- [ ] O relatório é legível por um PMO **sem explicação técnica adicional** (validar com leitura de alguém de fora do código — pode ser eu).
- [ ] Teste automatizado da função pura (snapshot ou asserts por seção), seguindo o padrão de `tests/prompt.test.ts`.
- [ ] `npx tsc --noEmit` e `npm test` verdes.

**DoD:** arquivo `.md` gerado a partir de um corpus real, revisado pela TL; testes verdes.

---

## 🟦 Tarefas finais de conclusão do MVP (Tech Lead — Alexandre)

Ficam comigo, por serem de integração/qualidade/risco (papéis Tech Lead + QA, conforme Aula 8 §2.3):

### TL-2 — Relatório de Segurança (entregável CP3)
- Produzir `docs/RELATORIO_SEGURANCA.md`: superfície de ataque (chaves de API em env, dados de PR enviados a LLMs de terceiros), tratamento de segredos, riscos do roteamento, e o que fica fora do escopo de segurança no MVP.
- **Aceitação:** documento cobre manuseio de `GITHUB_TOKEN`/`GROQ_API_KEY`/`GEMINI_API_KEY`, exposição de dados a APIs externas e mitigggações; aprovado em revisão do time.

### TL-3 — Checklist de Lançamento (entregável CP3)
- Produzir `docs/CHECKLIST_LANCAMENTO.md` com itens verificáveis (build passa, testes verdes, `.env` documentado, persistência ok, relatório gerado, validação end-to-end).
- **Aceitação:** todos os itens marcáveis e rastreáveis ao estado real do repo.

### TL-4 — Validação end-to-end com chaves reais
- Rodar o fluxo completo (extração → análise → relatório → persistência) contra Groq e Gemini reais; substituir as projeções de latência/custo do `IMPLEMENTATION_SUMMARY.md` por números medidos.
- **Aceitação:** uma execução real registrada (PR padrão via Groq + PR sensível via Gemini), com métricas observadas anexadas ao Workflow Doc.

### TL-5 — Code review e integração final
- Revisar os PRs de Reilson e Stela, integrar no `main`, garantir `npm run build` + `npm test` verdes no estado final.

---

## Ordem de execução sugerida

```
TL-1 (contrato AnalysisRecord)
   ├──> REILSON (persistência MongoDB)     ┐
   └──> STELA  (relatório Markdown)        ┘  (em paralelo)
                                              │
                          TL-4 (validação end-to-end) ──> TL-5 (integração)
TL-2 e TL-3 (docs CP3) podem correr em paralelo a tudo.
```

## Padrões do projeto (obrigatório para todos)
- **TypeScript estrito**, sem `any`.
- **Todo código novo entra com teste Vitest** (`npm test` deve continuar verde) — é requisito do CP3.
- Rodar `npx tsc --noEmit` antes de abrir PR (build não pode quebrar — já tropeçamos nisso uma vez).
- Manter custo operacional **zero**: usar apenas os tiers gratuitos (Groq llama-3.3, Gemini 1.5 Flash) e Mongo local/free.
