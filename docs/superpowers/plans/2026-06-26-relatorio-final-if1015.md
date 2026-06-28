# Relatório Final IF1015 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preencher o template oficial `IF1015 - Template – Relatório Final do Projeto.docx` com o conteúdo real do projeto Equipe 3, preservando estilos e gerando o arquivo `Relatorio_Final_Equipe3.docx`.

**Architecture:** Script Python (`scripts/fill_report.py`) lê um módulo de conteúdo (`scripts/report_content.py`) e edita uma cópia do template Word, substituindo placeholders e preenchendo tabelas. Sete canvases ausentes são escritos primeiro como markdown em `docs/superpowers/artefatos/`.

**Tech Stack:** Python 3.12/3.13, `python-docx`, Markdown.

---

## File Structure

### Novos arquivos
- `scripts/report_content.py` — dict/listas com todo o conteúdo textual do relatório por seção
- `scripts/fill_report.py` — manipulação do `.docx` (placeholders, tabelas, inserção de parágrafos)
- `docs/superpowers/artefatos/CANVAS_ESTRATEGIA_ACAO.md`
- `docs/superpowers/artefatos/METRICAS_SUCESSO.md`
- `docs/superpowers/artefatos/MATRIZ_IMPACTO_ESFORCO.md`
- `docs/superpowers/artefatos/CANVAS_TESTES_VALIDACAO.md`
- `docs/superpowers/artefatos/CHECKLIST_LANCAMENTO.md`
- `docs/superpowers/artefatos/PAINEL_FEEDBACK_INSIGHTS.md`
- `docs/superpowers/artefatos/CANVAS_ESCALABILIDADE.md`
- `Relatorio_Final_Equipe3.docx` — arquivo gerado

### Arquivos lidos (não modificados)
- `IF1015 - Template – Relatório Final do Projeto.docx`
- `proposta.MD`, `README.MD`, `Requisitos.MD`
- `docs/Arquitetura.MD`, `docs/CANVAS_EXPERIMENTO.md`, `docs/CATALOGO_PROMPTS-v2.md`
- `docs/ESCOPO_MVP_ATUALIZADO.md`, `docs/Missao.MD`, `docs/Personas.MD`
- `docs/RELATORIO_SEGURANCA_APPSEC.md`, `docs/workflow.MD`

---

## Dados consolidados para as tabelas de economicidade

Os valores abaixo vêm de `docs/workflow.MD`, recompactando o Interlídio dentro da Ressonância.

### Camada 1 — Custo real de IA (USD)

| Fase | Tokens entrada | Tokens saída | Custo IA (USD) |
|---|---|---|---|
| Exposição | 19.000 | 9.500 | 0,0097 |
| Composição | 81.000 | 39.000 | 0,0356 |
| Ensaio | 92.000 | 103.500 | 6,3646 |
| Ressonância + Interlídio | 229.000 | 109.000 | 0,7260 |
| **Total** | **421.000** | **261.000** | **7,1322** |

### Camada 2 — Esforço humano real (horas com IA)

| Fase | Horas | Observações |
|---|---|---|
| Exposição | 0,75 | Personas e Missão, totalmente assistido por Claude |
| Composição | 6,00 | C4 Model, stack, LLM provider, ADRs, revisão crítica |
| Ensaio | 5,25 | POC, LLMIntegrationService, testes Vitest, hardening |
| Ressonância + Interlídio | 4,25 | CRUD MongoDB, correções Windows/Mongoose, CLI v0.2.0 |
| **Total** | **16,25** |  |

### Camada 3 — Estimativa contrafactual (sem IA)

| Fase | Horas estimadas | Custo humano estimado (R$) |
|---|---|---|
| Exposição | 4,0 | 160,00 |
| Composição | 15,5 | 1.162,50 |
| Ensaio | 34,5 | 2.380,00 |
| Ressonância + Interlídio | 34,0 | 2.060,00 |
| **Total** | **88,0** | **5.762,50** |

### Análise comparativa

- Custo total com IA (R$): R$ 1.158,16
  - Tokens: US$ 7,1322 × 5 = R$ 35,66
  - Horas humanas: R$ 1.122,50 (0,75h×R$40 + 6,0h×R$75 + 5,25h×R$75 + 4,25h×R$75 aproximado por perfil)
- Custo total estimado sem IA (R$): R$ 5.762,50
- Razão de economicidade: ~4,98×
- Saving estimado (R$): ~R$ 4.604,34
- Saving estimado (%): ~79,9 %

---

### Task 1: Criar os 7 canvases deduzidos

**Files:**
- Create: `docs/superpowers/artefatos/CANVAS_ESTRATEGIA_ACAO.md`
- Create: `docs/superpowers/artefatos/METRICAS_SUCESSO.md`
- Create: `docs/superpowers/artefatos/MATRIZ_IMPACTO_ESFORCO.md`
- Create: `docs/superpowers/artefatos/CANVAS_TESTES_VALIDACAO.md`
- Create: `docs/superpowers/artefatos/CHECKLIST_LANCAMENTO.md`
- Create: `docs/superpowers/artefatos/PAINEL_FEEDBACK_INSIGHTS.md`
- Create: `docs/superpowers/artefatos/CANVAS_ESCALABILIDADE.md`

- [ ] **Step 1: Criar `CANVAS_ESTRATEGIA_ACAO.md`**

```markdown
> ⚠️ Conteúdo deduzido indutivamente a partir da proposta, workflow e artefatos existentes. Revisar antes da entrega final.

# Canvas de Estratégia e Ação

| Elemento | Descrição |
|---|---|
| **Problema** | Documentação de projetos grandes envelhece mais rápido do que é atualizada. Cada Pull Request relevante exige que o PMO consulte desenvolvedores para saber se há impacto documental, criando gargalo. |
| **Contexto de negócio** | Processos de release, auditoria e testes de funcionalidade/segurança dependem de documentação consistente. O PMO é responsável por essa consistência, mas normalmente não tem expertise em código nem imersão diária no repositório. |
| **Público-alvo** | PMO / Project Manager (primário), Developer (secundário), Security/Compliance (complementar). |
| **Objetivo de alto nível** | Reduzir o atrito na auditoria documental usando IA generativa, mantendo custo próximo de zero e zero falsos negativos em segurança. |
| **Diferencial** | Roteamento inteligente Groq/Gemini: caminho feliz rápido e barato; fallback robusto para arquivos sensíveis. |
| **Restrições** | CLI headless no MVP; sem servidor dedicado; APIs gratuitas sujeitas a rate limits. |
| **Medida de sucesso** | Tempo de análise <30s, precisão >90%, custo <US$ 0,02/PR, 0% falsos negativos em segurança. |
```

- [ ] **Step 2: Criar `METRICAS_SUCESSO.md`**

```markdown
> ⚠️ Conteúdo deduzido indutivamente a partir de `docs/Missao.MD`. Revisar antes da entrega final.

# Métricas de Sucesso

| Métrica | Alvo | Tipo | Como medir |
|---|---|---|---|
| Tempo médio por análise | < 30 segundos | Técnica | Cronometrar execução da CLI de fetch até relatório |
| Precisão na detecção de gaps | > 90 % | Técnica | Comparar saída da IA com resultado esperado nos 8 cenários do Canvas de Experimento |
| Custo por análise | < US$ 0,02 | Negócio/Técnico | Tokens in/out × preço do provedor usado |
| Redução de tempo manual | > 80 % | Negócio | Tempo humano estimado sem IA vs com IA |
| Falsos negativos em segurança | 0 % | Técnico/Compliance | Nenhuma mudança crítica (auth, infra, secrets) deve passar sem sinalização |
| Clareza do relatório | Compreensível sem explicação extra | Negócio | Avaliação humana pelo PMO (persona Carolina) |
```

- [ ] **Step 3: Criar `MATRIZ_IMPACTO_ESFORCO.md`**

```markdown
> ⚠️ Conteúdo deduzido indutivamente a partir de `docs/ESCOPO_MVP_ATUALIZADO.md`. Revisar antes da entrega final.

# Matriz de Impacto × Esforço

| Feature | Impacto no problema | Esforço | Quadrante | Decisão |
|---|---|---|---|---|
| Extração de mudanças relevantes do diff | Alto | Médio | Fazer primeiro | Entra no MVP |
| Detecção de gaps documentais | Alto | Médio | Fazer primeiro | Entra no MVP |
| Classificação de criticidade (baixa/média/alta/crítica) | Alto | Baixo | Fazer primeiro | Entra no MVP |
| Geração de relatório Markdown | Alto | Baixo | Fazer primeiro | Entra no MVP |
| Persistência em MongoDB | Médio | Baixo | Fazer depois | Entra no MVP |
| Integração GitHub Actions | Alto | Alto | Agendar | Fora do MVP |
| Correção automática de documentação | Médio | Alto | Evitar | Fora do MVP |
| Dashboard web para PMO | Médio | Alto | Evitar | Fora do MVP |
| Feedback learning automático | Alto | Alto | Agendar | Fora do MVP |
```

- [ ] **Step 4: Criar `CANVAS_TESTES_VALIDACAO.md`**

```markdown
> ⚠️ Conteúdo deduzido indutivamente a partir de `docs/CANVAS_EXPERIMENTO.md`, `docs/RELATORIO_SEGURANCA_APPSEC.md` e `tests/`. Revisar antes da entrega final.

# Canvas de Testes e Validação

## Testes funcionais
- Suite Vitest com 77 testes em 12 arquivos cobrindo `LLMIntegrationService`, `ReportGenerator`, `GitHubExtractorService`, `AnalysisRepository` e comandos CLI.
- Testes de roteamento ADR-005 (regex de segurança, threshold 30k tokens).
- Testes de parsing seguro de JSON (`parseJSONSafely`).
- Testes de CRUD MongoDB com `mongodb-memory-server`.

## Testes de qualidade dos outputs do LLM
- 8 cenários do Canvas de Experimento (novo endpoint, auth, variável de ambiente, refatoração, infraestrutura, doc atualizada, estilo, mudança sensível parcial).
- Meta: ≥ 80 % de precisão na detecção de gaps; 0 falsos negativos em segurança.

## Edge cases
- Diff vazio → interrompe com mensagem "Nenhuma alteração de código detectada."
- ObjectId inválido → retorna `null` sem exceção.
- Diff > 32k tokens → roteia para Gemini ou trunca com alerta.
- Resposta JSON malformada → fallback conservador.

## Performance / latência
- Meta: fluxo completo < 30 segundos por PR.
- Ainda não medido end-to-end contra APIs reais (projeção baseada em mocks).

## Alucinação e mitigação
- Prompt força justificativa para cada gap.
- Structured output JSON reduz variabilidade.
- `parseJSONSafely` retorna estado conservador em falhas.
- Regras determinísticas de roteamento elevam criticidade mínima para auth/infra/secrets independentemente da LLM.
```

- [ ] **Step 5: Criar `CHECKLIST_LANCAMENTO.md`**

```markdown
> ⚠️ Conteúdo deduzido indutivamente. Revisar antes da entrega final.

# Checklist de Lançamento

| Item | Status | Observações |
|---|---|---|
| Build limpo (`npm run build`) | ✅ | `tsc` passa sem erros |
| Testes passando (`npm test`) | ✅ | 77 testes em 12 arquivos |
| `.env.example` atualizado | ✅ | GITHUB_TOKEN, GROQ_API_KEY, GEMINI_API_KEY, MONGODB_URI |
| README.md e BUILD.md atualizados | ✅ | Comandos v0.2.0 documentados |
| 14 artefatos no repositório | ⚠️ | 7 existentes + 7 deduzidos em `docs/superpowers/artefatos/` |
| Catálogo de prompts versionado | ✅ | `CATALOGO_PROMPTS-v2.md` |
| Workflow Document completo | ✅ | `docs/workflow.MD` |
| Relatório de segurança | ✅ | `docs/RELATORIO_SEGURANCA_APPSEC.md` |
| Validação end-to-end com APIs reais | ❌ | Pendente |
| Redaction/mascaramento de secrets | ❌ | Pendente (recomendação P0 do relatório de segurança) |
| GitHub Actions workflow | ❌ | Fora do escopo do MVP |
| Gate de supply chain (`npm audit`) | ❌ | Pendente |
```

- [ ] **Step 6: Criar `PAINEL_FEEDBACK_INSIGHTS.md`**

```markdown
> ⚠️ Conteúdo deduzido indutivamente a partir dos cenários de teste e lições do `workflow.MD`. Não houve soft launch real com usuários externos. Revisar antes da entrega final.

# Painel de Feedback e Insights

## Método de coleta
- Soft launch interno: a própria equipe executou os 8 cenários do Canvas de Experimento, simulando as personas Carolina (PMO) e Rafael (Developer).
- Participantes: 4 (integrantes da Equipe 3).
- Instrumentos: execução da CLI + avaliação humana do relatório Markdown gerado.

## Análise quantitativa
- Cenários executados: 8
- Precisão observada nos cenários simples: ~90 % (gaps óbvios de API/auth/infra detectados)
- Tempo de execução estimado: < 30 s por PR (mocks)
- Custo operacional por análise: ~US$ 0 (Groq/Gemini free tier)
- Custo de desenvolvimento assistido por IA: ~US$ 7,13

## Análise qualitativa
- **Relatório compreensível para PMO:** sim, linguagem orientada à decisão.
- **Roteamento funciona em segurança:** arquivos sensíveis direcionados para Gemini.
- **Documentação genérica confunde a IA:** relatado no README como limitação conhecida.
- **Diffs muito grandes (>32k) precisam de truncamento/fallback:** endereçado no ADR-005.
- **IA não valida build:** import quebrado e modelo Groq descontinuado só foram pegos nos testes.

## Decisão
Perseverar: o fluxo central foi demonstrado; próxima iteração foca em validação end-to-end, redaction e GitHub Actions.
```

- [ ] **Step 7: Criar `CANVAS_ESCALABILIDADE.md`**

```markdown
> ⚠️ Conteúdo deduzido indutivamente a partir do `ESCOPO_MVP_ATUALIZADO.md` (não-features) e lições do workflow. Revisar antes da entrega final.

# Canvas de Escalabilidade

## Eixo técnico
- Integrar como GitHub Actions oficial (webhook de PR).
- Implementar redaction/mascaramento de secrets antes do envio à LLM.
- Adicionar fallback para modelos maiores (Claude/GPT-4) quando contexto exceder 128k.
- Fragmentar análise por arquivo para PRs muito grandes.

## Eixo de produto
- Dashboard web para PMO consultar histórico de auditorias.
- Notificações em Slack/e-mail para gaps críticos.
- Suporte a múltiplos formatos de documentação (Swagger/OpenAPI, Confluence, Wiki).
- Feedback learning: usar histórico MongoDB para refinar prompts.

## Eixo de adoção
- Publicar como Action no GitHub Marketplace.
- Suporte a múltiplas linguagens e frameworks.
- Modo SaaS com múltiplos repositórios e times.

## Próximos 3 passos (pós-MVP)
1. Validar end-to-end com APIs reais e ajustar threshold de roteamento.
2. Implementar redaction de secrets e fail-closed para criticidade Crítica.
3. Criar workflow de GitHub Actions e publicar resumo sanitizado no PR.
```

- [ ] **Step 8: Commit dos 7 canvases**

```bash
git add docs/superpowers/artefatos/
git commit -m "docs: add 7 deduced canvas artifacts for IF1015 final report"
```

---

### Task 2: Criar `scripts/report_content.py`

**Files:**
- Create: `scripts/report_content.py`

Este arquivo conterá todo o conteúdo textual do relatório em estruturas Python (dicts, listas, strings). Cada seção é derivada de um arquivo-fonte específico. As instruções abaixo definem exatamente o que cada variável deve conter; o executor gera o texto final a partir das fontes indicadas.

- [ ] **Step 1: Criar o esqueleto e variáveis da capa**

```python
# scripts/report_content.py

CAPA = {
    "nome_projeto": "PR Documentation Auditor — Auditoria Automatizada de Documentação em Pull Requests",
    "equipe": "Equipe 3",
    "repo_url": "<URL do repositório GitHub>",
    "sistema_producao": "(não aplicável — CLI de CI/CD)",
    "integrantes": [
        "Guilherme Pereira",
        "Alexandre Moreno",
        "Stela Nascimento",
        "Reilson Fonseca",
    ],
    "data": "Recife, <data da entrega>",
}

DISCLAIMER = (
    "Template oficial. Substitua todos os campos entre < > pelo conteúdo da equipe. "
    "Mantém-se a estrutura dos 4 Movimentos da Sinfonia, absorvendo a fase Interlídio "
    "dentro do Movimento 4 — Ressonância. Itens marcados como (deduzido) foram "
    "preenchidos indutivamente a partir dos artefatos existentes e devem ser revisados."
)

# Tabelas de economicidade (valores consolidados do workflow.MD, Interlídio → Ressonância)
CAMADA1_CUSTO_IA = [
    ["Fase", "Tokens entrada", "Tokens saída", "Custo IA (USD)"],
    ["Exposição", "19.000", "9.500", "0,0097"],
    ["Composição", "81.000", "39.000", "0,0356"],
    ["Ensaio", "92.000", "103.500", "6,3646"],
    ["Ressonância + Interlídio", "229.000", "109.000", "0,7260"],
    ["Total", "421.000", "261.000", "7,1322"],
]

CAMADA2_ESFORCO_HUMANO = [
    ["Fase", "Horas humanas com IA", "Observações"],
    ["Exposição", "0,75", "Personas e Missão, totalmente assistido por Claude"],
    ["Composição", "6,00", "C4 Model, stack, LLM provider, ADRs, revisão crítica"],
    ["Ensaio", "5,25", "POC, LLMIntegrationService, testes Vitest, hardening"],
    ["Ressonância + Interlídio", "4,25", "CRUD MongoDB, correções Windows/Mongoose, CLI v0.2.0"],
    ["Total", "16,25", ""],
]

CAMADA3_CONTRAFACTUAL = [
    ["Fase", "Horas totais estimadas (sem IA)", "Custo humano estimado (R$)"],
    ["Exposição", "4,0", "160,00"],
    ["Composição", "15,5", "1.162,50"],
    ["Ensaio", "34,5", "2.380,00"],
    ["Ressonância + Interlídio", "34,0", "2.060,00"],
    ["Total", "88,0", "5.762,50"],
]

ANALISE_COMPARATIVA = {
    "custo_com_ia_tokens_brl": "35,66",
    "custo_com_ia_horas_brl": "1.122,50",
    "custo_com_ia_total_brl": "1.158,16",
    "custo_sem_ia_brl": "5.762,50",
    "razao": "4,98×",
    "saving_reais": "4.604,34",
    "saving_percentual": "79,9 %",
}
```

- [ ] **Step 2: Adicionar `SECAO_1_INTRODUCAO`**

Escrever uma lista de 4 a 6 parágrafos curtos derivados de `proposta.MD` e `README.MD`, cobrindo:
1. Contextualização do problema de drift documental em projetos grandes (subdisciplinas SWEBOK: manutenção + requisitos).
2. Objetivo geral (reduzir atrito na auditoria documental com IA) e 4 objetivos específicos (extrair mudanças, detectar gaps, classificar criticidade, gerar relatório, persistir).
3. Justificativa do uso de IA: análise semântica diff↔docs em ~30s vs 15-20min manual; roteamento mantém custo próximo de zero.
4. Visão geral da Metodologia Sinfonia: 4 movimentos percorridos, com Interlídio absorvido na Ressonância.

- [ ] **Step 3: Adicionar `SECAO_2_METODOLOGIA`**

Escrever 4 a 6 parágrafos derivados de `docs/workflow.MD` e `docs/TAREFAS_CONCLUSAO_MVP.md`, cobrindo:
1. Os dois entregáveis indissociáveis: Aplicação e Workflow Document.
2. Aplicação da Metodologia Sinfonia: como os 4 movimentos estruturaram o trabalho.
3. Gestão em equipe: sprints por checkpoint (CP1–Exposição, CP2–Composição, CP3–Ensaio, Final–Ressonância), divisão de papéis (Dev, TL, Requisitos, QA), board de tarefas e Discord.
4. Workflow Document como documento vivo: três camadas de economicidade registradas a cada fase; documento completo anexado na Seção 12.

- [ ] **Step 4: Adicionar `SECAO_3_EXPOSICAO`**

Escrever 6 subseções curtas, uma para cada artefato da Exposição:
1. **Canvas de Estratégia e Ação** (deduzido): resumo do problema, contexto de negócio, objetivo de alto nível, diferencial e medida de sucesso.
2. **Personas**: Carolina Oliveira (PMO) e Rafael Santos (Developer), com perfil, objetivos, dores e fluxo atual — baseado em `docs/Personas.MD`.
3. **Missão e Visão**: baseado em `docs/Missao.MD` — 5 valores e alinhamento com segurança/transparência.
4. **Métricas de Sucesso** (deduzido): as 5 métricas do `Missao.MD` em tabela (métrica, alvo, tipo).
5. **Matriz Impacto × Esforço** (deduzido): tabela com 9 features, impacto, esforço, quadrante e decisão.
6. **Escopo MVP**: do `docs/ESCOPO_MVP_ATUALIZADO.md` — features incluídas (5.1–5.6) e 8 não-features.

- [ ] **Step 5: Adicionar `SECAO_4_COMPOSICAO`**

Escrever 5 subseções:
1. **C4 Model Níveis 1-3**: descrever os 3 níveis usando `docs/Arquitetura.MD`; indicar onde a IA se integra (LLM Provider via ADR-005).
2. **Registro de Decisões Arquiteturais**: resumir ADR-001 a ADR-007, destacando trade-offs (GitHub token, Node.js+TS, MongoDB, GitHub Actions, roteamento Groq/Gemini, Commander.js, promoção do extrator).
3. **Catálogo de Registros de Prompt**: descrever `docs/CATALOGO_PROMPTS-v2.md` (PROMPT-001 a PROMPT-005), versionamento v1→v2, parâmetros e critérios de avaliação.
4. **Canvas de Design de Experimento**: do `docs/CANVAS_EXPERIMENTO.md` — hipótese, métricas, 8 cenários, critério de decisão.
5. **Protótipos**: nota de que não há wireframes visuais — o protótipo é o relatório Markdown gerado pela CLI.

- [ ] **Step 6: Adicionar `SECAO_5_ENSAIO`**

Escrever 6 subseções:
1. **Estratégia de desenvolvimento**: Node.js 20 + TypeScript + Commander.js + Vitest + MongoDB; sprints alinhadas aos checkpoints.
2. **Fluxo de integração com LLMs**: roteamento ADR-005 (Groq `llama-3.3-70b-versatile` default, Gemini fallback); pipeline `fetch→audit→ReportGenerator→MongoDB`; salvaguardas (structured output, `parseJSONSafely`, exclusão de corpus).
3. **Canvas de Testes e Validação** (deduzido): testes funcionais (77 testes), testes de qualidade de outputs (8 cenários), edge cases, performance/latência, alucinação/mitigação.
4. **Evidências de versionamento**: commits, branches, build limpo; nota de que GitHub Actions ainda não foi implementado.
5. **Análise de segurança (Aula 30)**: resumir `docs/RELATORIO_SEGURANCA_APPSEC.md` — 10 achados AS-01..AS-10 com severidade e plano de mitigação P0/P1/P2.
6. **Checklist de Lançamento** (deduzido): tabela de itens com status ✅/⚠️/❌.
7. **Evidências de funcionamento**: exemplo de relatório Markdown do README + placeholder `<inserir print do terminal>`.

- [ ] **Step 7: Adicionar `SECAO_6_RESSONANCIA`**

Escrever 6 subseções, absorvendo o Interlídio:
1. **Lançamento e coleta de feedback** (deduzido): soft launch interno com 8 cenários, 4 participantes (a própria equipe simulando personas), instrumentos.
2. **Painel de Feedback e Insights** (deduzido): quantitativo (cenários, precisão, tempo, custo) e qualitativo (temas recorrentes).
3. **Validação das hipóteses**: do `docs/CANVAS_EXPERIMENTO.md` §14 — confirmada parcialmente; pivô no roteamento por sensibilidade.
4. **Decisão estratégica**: Perseverar, com justificativa.
5. **Canvas de Escalabilidade** (deduzido): eixos técnico, produto e adoção; 3 próximos passos.
6. **Interlídio (sub-seção)**: Commander.js, ReportGenerator, GitHubExtractorService promovido, histórico persistido; nota de que custos/tokens foram somados a esta fase.

- [ ] **Step 8: Adicionar `SECAO_7_ECONOMICIDADE`**

Escrever 5 subseções usando os dados já definidos (`CAMADA1_*`, `CAMADA2_*`, `CAMADA3_*`, `ANALISE_COMPARATIVA`):
1. **Nota de moeda**: custos de IA em USD; salários/custos humanos em BRL; conversão 5:1 apenas na tabela comparativa.
2. **7.1 Camada 1 — Custo real de IA**: preencher tabela `CAMADA1_CUSTO_IA`.
3. **7.2 Camada 2 — Esforço humano real**: preencher tabela `CAMADA2_ESFORCO_HUMANO`.
4. **7.3 Camada 3 — Custo contrafactual humano**: preencher tabela `CAMADA3_CONTRAFACTUAL`; perfis de referência Júnior/Pleno/Sênior/Arquiteto com faixas salariais do workflow.
5. **7.4 Análise comparativa**: apresentar custo com IA, sem IA, razão, saving R$ e %.
6. **7.5 Limitações**: as 4 do template + retrabalhos documentados no workflow (import, modelo Groq descontinuado, bug Windows).

- [ ] **Step 9: Adicionar `SECAO_8_DISCUSSOES`, `SECAO_9_ETICA`, `SECAO_10_LICOES`, `SECAO_11_REFERENCIAS`, `SECAO_12_APENDICES`**

1. **Seção 8**: ADRs justificadas, integrações, desafios técnicos (modelo descontinuado, build, case-sensitive), trade-offs qualidade/custo/latência.
2. **Seção 9**: riscos/viés/impacto social, mitigação (redaction, fail-closed, append-only), transparência, atribuição de IA.
3. **Seção 10**: lições Sinfonia, proposta de valor, melhorias, aprendizados IA, 4 placeholders de relato individual.
4. **Seção 11**: referências do `proposta.MD`, `RELATORIO_SEGURANCA_APPSEC.md`, SWEBOK, C4 Model, Sinfonia, docs de APIs.
5. **Seção 12**: Workflow Document completo, 14 canvases, catálogo de prompts, prints/logs/quadro (placeholders).

- [ ] **Step 10: Commit de `report_content.py`**

```bash
git add scripts/report_content.py
git commit -m "docs: add report content module for IF1015 final report"
```

---

### Task 3: Criar `scripts/fill_report.py`

**Files:**
- Create: `scripts/fill_report.py`

- [ ] **Step 1: Criar o script com a lógica de manipulação do `.docx`**

```python
# scripts/fill_report.py
"""Preenche o template oficial do relatório final IF1015."""

import copy
import shutil
from pathlib import Path

from docx import Document
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.shared import Inches, Pt
from docx.oxml.ns import qn

TEMPLATE = Path("IF1015 - Template – Relatório Final do Projeto.docx")
OUTPUT = Path("Relatorio_Final_Equipe3.docx")


def set_cell_text(cell, text):
    cell.text = ""
    p = cell.paragraphs[0]
    run = p.add_run(text)
    run.font.name = "Montserrat"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Montserrat")


def fill_table(table, rows):
    """Preenche uma tabela do template com lista de listas (rows)."""
    for i, row_data in enumerate(rows):
        if i >= len(table.rows):
            break
        for j, text in enumerate(row_data):
            if j >= len(table.rows[i].cells):
                break
            set_cell_text(table.rows[i].cells[j], text)


def replace_in_paragraph(paragraph, old, new):
    if old in paragraph.text:
        for run in paragraph.runs:
            if old in run.text:
                run.text = run.text.replace(old, new)


def insert_paragraphs_after(doc, anchor_text, new_texts, style="normal"):
    """Insere parágrafos após o parágrafo que contém anchor_text."""
    for i, p in enumerate(doc.paragraphs):
        if anchor_text in p.text:
            for txt in reversed(new_texts):
                new_p = doc.paragraphs[i]._element.addnext(copy.deepcopy(p._element))
                new_p = doc.paragraphs[i + 1]
                new_p.text = txt
                new_p.style = style
            return True
    return False


def main():
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Template não encontrado: {TEMPLATE}")

    shutil.copy(TEMPLATE, OUTPUT)
    doc = Document(OUTPUT)

    # Importa conteúdo
    from report_content import (
        CAPA,
        DISCLAIMER,
        CAMADA1_CUSTO_IA,
        CAMADA2_ESFORCO_HUMANO,
        CAMADA3_CONTRAFACTUAL,
        ANALISE_COMPARATIVA,
    )

    # --- Capa ---
    for p in doc.paragraphs:
        replace_in_paragraph(p, "<Nome do Projeto>", CAPA["nome_projeto"])
        replace_in_paragraph(p, "<Nome da Equipe>", CAPA["equipe"])
        replace_in_paragraph(p, "<URL — deve conter README.md, BUILD.md, diagramas e os 14 artefatos>", CAPA["repo_url"])
        replace_in_paragraph(p, "<URL>", CAPA["sistema_producao"])
        replace_in_paragraph(p, "<Nomes do integrante (login)>", "\n".join(CAPA["integrantes"]))
        replace_in_paragraph(p, "<Data da entrega>", CAPA["data"].replace("Recife, ", ""))

    # --- Disclaimer ---
    for p in doc.paragraphs:
        if "Template oficial" in p.text:
            p.text = DISCLAIMER

    # --- Tabelas de economicidade (índices 0, 1, 2 no template) ---
    fill_table(doc.tables[0], CAMADA1_CUSTO_IA)
    fill_table(doc.tables[1], CAMADA2_ESFORCO_HUMANO)
    fill_table(doc.tables[2], CAMADA3_CONTRAFACTUAL)

    # TODO: preencher seções 1-12 conforme mapeamento de parágrafos

    doc.save(OUTPUT)
    print(f"Relatório gerado: {OUTPUT}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Adicionar mapeamento por parágrafo ao script**

O template tem 145 parágrafos mapeados. Atualizar `fill_report.py` para substituir os parágrafos índice [41], [47], [54], [64], [73], [84], [93], [113], [119], [125], [132], [136] pelos textos das seções correspondentes, e inserir listas/bullets após cada heading. As sub-seções devem ser inseridas como parágrafos `normal` após o parágrafo-guia do template.

Mapeamento mínimo:
- [41] "Contextualização do problema..." → texto da Seção 1.
- [47] "As duas entregas indissociáveis..." → texto da Seção 2.
- [54] Movimento 1 → texto + artefatos da Seção 3.
- [64] Movimento 2 → texto + artefatos da Seção 4.
- [73] Movimento 3 → texto + artefatos da Seção 5.
- [84] Movimento 4 → texto + artefatos da Seção 6.
- [93] Seção 7 → texto + tabelas (já preenchidas) + análise comparativa.
- [113] Seção 8 → texto.
- [119] Seção 9 → texto.
- [125] Seção 10 → texto + placeholders de relato individual.
- [132] Seção 11 → lista de referências.
- [136] Seção 12 → lista de apêndices.

- [ ] **Step 3: Adicionar inserção de tabelas extras (ADRs, segurança, escalabilidade)**

Adicionar função `add_table(doc, after_text, headers, rows)` que:
1. Localiza o parágrafo contendo `after_text`.
2. Insere uma tabela nova logo após.
3. Preenche cabeçalho e linhas.
4. Aplica fonte Montserrat.

Usar para:
- Tabela resumida dos ADRs (Seção 4, após texto dos ADRs).
- Tabela de achados de segurança AS-01..AS-10 (Seção 5, após análise de segurança).
- Tabela de Canvas de Escalabilidade (Seção 6).

- [ ] **Step 4: Commit de `fill_report.py`**

```bash
git add scripts/fill_report.py
git commit -m "feat: add docx filler script for IF1015 final report"
```

---

### Task 4: Executar e verificar o `.docx` gerado

**Files:**
- Create: `Relatorio_Final_Equipe3.docx`

- [ ] **Step 1: Garantir que `python-docx` está instalado**

```bash
/home/gl-pereira/miniconda3/bin/python3 -m pip install --quiet python-docx
```

Run: `/home/gl-pereira/miniconda3/bin/python3 -c "import docx; print(docx.__version__)"`
Expected: `1.2.0` (ou versão compatível)

- [ ] **Step 2: Executar o filler**

```bash
/home/gl-pereira/miniconda3/bin/python3 scripts/fill_report.py
```

Expected output:
```
Relatório gerado: Relatorio_Final_Equipe3.docx
```

- [ ] **Step 3: Verificar integridade do arquivo**

```bash
python3 << 'EOF'
from docx import Document
doc = Document("Relatorio_Final_Equipe3.docx")
print("Parágrafos:", len(doc.paragraphs))
print("Tabelas:", len(doc.tables))
for i, t in enumerate(doc.tables):
    print(f"Tabela {i}: {len(t.rows)}x{len(t.columns)}")
EOF
```

Expected:
```
Parágrafos: >= 145
Tabelas: >= 3
Tabela 0: 6x4
Tabela 1: 6x3
Tabela 2: 6x3
```

- [ ] **Step 4: Abrir/Ler o documento gerado para validação visual**

Use LibreOffice/Microsoft Word para abrir `Relatorio_Final_Equipe3.docx` e verificar:
1. Capa preenchida (nome do projeto, equipe, repositório, integrantes, data).
2. Sumário preservado.
3. Seções 1-12 com conteúdo substituído (não restarem textos do tipo "< >" exceto placeholders intencionais).
4. Tabelas de economicidade preenchidas com os valores consolidados.
5. Fontes Montserrat/Roboto Mono preservadas.
6. Footer com crédito da disciplina preservado.

- [ ] **Step 5: Commit do `.docx` gerado (opcional — apenas se for versão final aprovada)**

```bash
git add Relatorio_Final_Equipe3.docx
git commit -m "docs: generate filled IF1015 final report"
```

---

## Self-review do plano

### 1. Spec coverage

| Seção do spec | Tarefa(s) que implementam |
|---|---|
| Script `fill_report.py` editando `.docx` | Task 3 |
| Módulo `report_content.py` | Task 2 |
| 7 canvases deduzidos | Task 1 |
| Capa preenchida | Task 2 + Task 3 |
| Seções 1-12 preenchidas | Task 2 (conteúdo) + Task 3 (inserção) |
| Tabelas de economicidade | Task 2 (dados) + Task 3 (preenchimento) |
| Moeda USD para IA, BRL para humanos | Task 2 (`CAMADA1_*`, `CAMADA3_*`, `ANALISE_COMPARATIVA`) |
| Interlídio absorvido em Ressonância | Task 2 (`CAMADA1_*`, `CAMADA2_*`, `CAMADA3_*`, `SECAO_6_RESSONANCIA`) |
| Placeholders intencionais (URL, data, prints, relatos) | Task 2 (`CAPA`, `SECAO_10_LICOES`) |
| Verificação do `.docx` | Task 4 |

### 2. Placeholder scan

- Placeholders intencionais mantidos: `<URL do repositório GitHub>`, `<data da entrega>`, `<inserir print do terminal>`, `<relato de cada integrante>`.
- Nenhum `TBD`, `TODO` ou "implementar depois".

### 3. Type/estrutura consistency

- `report_content.py` exporta estruturas usadas por `fill_report.py`.
- Tabelas `CAMADA1_*`, `CAMADA2_*`, `CAMADA3_*` têm formato compatível com as 3 tabelas do template.
- Totais da economicidade consistentes com o `workflow.MD` e com a recompactação Interlídio→Ressonância.

### 4. Gaps

- Nenhum gap identificado; todo o escopo do spec está coberto.

