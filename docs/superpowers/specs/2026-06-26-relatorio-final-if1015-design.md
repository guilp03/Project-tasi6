# Design — Relatório Final IF1015 (Equipe 3)

**Data:** 2026-06-26
**Projeto:** PR Documentation Auditor — Auditoria Automatizada de Documentação em Pull Requests
**Equipe:** 3 (Guilherme Pereira, Alexandre Moreno, Stela Nascimento, Reilson Fonseca)
**Template:** `IF1015 - Template – Relatório Final do Projeto.docx`

---

## 1. Objetivo

Editar o template oficial `.docx` da disciplina IF1015 diretamente, via script `python-docx`, preenchendo todas as seções do relatório final com o conteúdo real do projeto, preservando os estilos do template (Montserrat/Roboto Mono, headers/footers, crédito da disciplina).

## 2. Decisões aprovadas

| # | Decisão |
|---|---------|
| D1 | Editar o `.docx` diretamente (não Markdown→pandoc, não copia-e-cola manual) |
| D2 | Interlídio (v0.2.0) absorvido no Movimento 4 — Ressonância |
| D3 | Canvases faltantes preenchidos de forma indutiva a partir do material existente; marcados com aviso de revisão |
| D4 | Tabelas de economicidade recompactadas em 4 linhas (Interlídio somado em Ressonância); detalhe por 5 fases preservado no Apêndice (Seção 12) |
| D5 | Custo de IA (tokens) em **USD**; salários/custos humanos (contrafactual) em **BRL** (realidade brasileira) |
| D6 | Tabela comparativa da Seção 7.4 converte USD→BRL à taxa 5:1 *só nessa tabela*, com nota explicativa |
| D7 | Relato individual por integrante (Seção 10) fica como `<placeholder>` para preenchimento manual |
| D8 | Script `scripts/fill_report.py` + conteúdo isolado em `scripts/report_content.py` |

## 3. Arquitetura do script

```
scripts/
├── fill_report.py          # Abre o template, clona, preenche parágrafos/tabelas
└── report_content.py       # Dict estruturado por seção (conteúdo editável)
docs/superpowers/artefatos/ # Canvases deduzidos (markdown, referenciados + anexados)
├── CANVAS_ESTRATEGIA_ACAO.md
├── METRICAS_SUCESSO.md
├── MATRIZ_IMPACTO_ESFORCO.md
├── CANVAS_TESTES_VALIDACAO.md
├── CHECKLIST_LANCAMENTO.md
├── PAINEL_FEEDBACK_INSIGHTS.md
└── CANVAS_ESCALABILIDADE.md
```

### 3.1 Mapeamento do template

O template tem 145 parágrafos mapeados por índice (ver `report_content.py`). Paragrafos por movimento/seção serão substituídos no índice exato do template; parágrafos novos (sub-itens, listas) serão inseridos preservando o estilo `normal`/`Heading 2`/`Heading 3` conforme o contexto.

### 3.2 Tabelas no .docx

O template possui 3 tabelas (Camada 1, 2, 3 — 6 linhas × 5/3/3 cols). Elas serão preenchidas **in-place** com os valores consolidados. Tabelas extras (ex.: ADRs, achados de segurança, Canvas de Escalabilidade) serão inseridas como tabelas novas em `body` via `doc.add_table()` no ponto de inserção apropriado.

### 3.3 Marcação de conteúdo indutivo

Cada canvas deduzido (em `docs/superpowers/artefatos/`) começa com:

```
> ⚠️ Conteúdo deduzido indutivamente a partir da proposta, workflow e artefatos existentes.
> Revisar antes da entrega final.
```

No `.docx`, quando uma seção referencia um canvas deduzido, uma nota em itálico avisa: *"Artefato deduzido indutivamente — ver Apêndice."*

## 4. Conteúdo por seção

### 4.1 Capa

- **Nome do Projeto:** "PR Documentation Auditor — Auditoria Automatizada de Documentação em Pull Requests"
- **Equipe:** "Equipe 3"
- **Repositório Git:** `<URL — preencher>` (placeholder até URL final)
- **Sistema em produção:** "(não aplicável — CLI de CI/CD)"
- **Integrantes:** Guilherme Pereira, Alexandre Moreno, Stela Nascimento, Reilson Fonseca — logins GitHub a confirmar
- **Local/data:** Recife, `<data da entrega>`

### 4.2 Seção 1 — Introdução

- **Problema:** drift documental em PRs em projetos grandes; subdisciplina SWEBOK — manutenção + requisitos; PMO sem expertise em código como vítima principal.
- **Objetivos:** geral (reduzir atrito na auditoria documental usando IA) + específicos (extrair mudanças relevantes, detectar gaps, classificar criticidade, gerar relatório Markdown, persistir em MongoDB).
- **Justificativa IA:** análise semântica diff↔docs custaria 15-20 min humano vs ~30 s com IA; roteamento mantém custo ~zero no caminho feliz.
- **Visão Sinfonia:** panorama dos 4 movimentos percorridos.

### 4.3 Seção 2 — Metodologia

- Aplicação + Workflow Document indissociáveis.
- 4 movimentos Sinfonia com nota sobre o Interlídio absorvido na Ressonância.
- Gestão: sprints por checkpoint (CP1–CP3 + Apresentação Final), board `TAREFAS_CONCLUSAO_MVP.md`, Discord.
- Workflow Document vivo → anexo (Seção 12) + consolidado (Seção 7).

### 4.4 Seção 3 — Movimento 1 — Exposição

- **Canvas de Estratégia e Ação** *(deduzido)*: problema, contexto de negócio, objetivos de alto nível.
- **Personas**: Carolina Oliveira (PMO) + Rafael Santos (Developer) — do `Personas.MD`; mapa de empatia deduzido.
- **Missão e Visão**: do `Missao.MD` — 5 valores + alinhamento ético.
- **Métricas de Sucesso** *(deduzido)*: as 5 do `Missao.MD` (<30 s, >90 % precisão, <$0,10/PR, >80 % redução de tempo manual, 0 % FN segurança).
- **Matriz Impacto × Esforço** *(deduzido)*: features do MVP priorizadas vs fora do MVP.
- **Escopo MVP**: do `ESCOPO_MVP_ATUALIZADO.md` — features e 8 não-features.

### 4.5 Seção 4 — Movimento 2 — Composição

- **C4 Model Níveis 1-3**: do `Arquitetura.MD` — diagramas ASCII preservados; nível 3 (recomendado) incluído.
- **ADRs**: ADR-001 a ADR-007 resumidos com trade-offs; integração IA = ADR-005.
- **Catálogo de Registros de Prompt**: do `CATALOGO_PROMPTS-v2.md` — PROMPT-001 a PROMPT-005 com objetivo, template, parâmetros, input/output, critérios; versionamento v1→v2.
- **Canvas de Design de Experimento**: do `CANVAS_EXPERIMENTO.md` — hipótese, métricas, 8 cenários, critério pivotar/perseverar/parar.
- **Protótipos**: "(não aplicável — CLI headless; o relatório Markdown em si é o protótipo visível)".

### 4.6 Seção 5 — Movimento 3 — Ensaio

- **Tecnologias**: Node.js 20 + TypeScript, Commander.js, Vitest, Mongoose, execução via `tsx`.
- **Fluxo LLM**: roteamento ADR-005 (Groq `llama-3.3-70b-versatile` caminho feliz + Gemini fallback); pipelines `fetch→audit→ReportGenerator→MongoDB`; salvaguardas: structured output + `parseJSONSafely` + exclusão temporária do corpus.
- **Canvas de Testes e Validação** *(deduzido)*: Vitest (77 testes/12 arquivos), 8 cenários do Canvas de Experimento, edge cases (diff vazio, ObjectId inválido, diff >32 k), latência (meta <30 s, ainda projeção); alucinação — prompt força justificativa, `parseJSONSafely` retorna estado conservador.
- **Versionamento**: commits por feature, branches por frente, `npm run build` limpo, sem GitHub Actions ainda (declarado honestamente).
- **Análise de segurança (Aula 30)**: do `RELATORIO_SEGURANCA_APPSEC.md` — AS-01 a AS-10 com severidade e plano P0/P1/P2.
- **Checklist de Lançamento** *(deduzido)*: build limpo, 77 testes, `.env.example`, README + BUILD.md, 14 artefatos; itens pendentes marcados (validação end-to-end, GitHub Actions, redaction).
- **Evidências**: exemplo de relatório Markdown do README + placeholder `<inserir print do terminal>` para anexar depois.

### 4.7 Seção 6 — Movimento 4 — Ressonância

Absorve o **Interlídio** (v0.2.0) como etapa de evolução pré-Ressonância.

- **Lançamento e feedback** *(deduzido)*: soft launch via 8 cenários do Canvas de Experimento; 4 participantes (a própria equipe seguindo personas); instrumentos = CLI + avaliação humana dos relatórios.
- **Painel de Feedback** *(deduzido)*: quantitativo (precisão gaps, tempo, custo/PR); qualitativo (relatório compreensível, roteamento funciona, doc genérica confunde, diff >32 k trunca).
- **Validação de hipóteses**: do `CANVAS_EXPERIMENTO.md` §14 — confirmada parcialmente (fluxo com mocks); pivô = roteamento por sensibilidade.
- **Decisão estratégica**: Perseverar — fluxo demonstrado, custo ~zero; próxima iteração = validação end-to-end + redaction + GitHub Actions.
- **Canvas de Escalabilidade** *(deduzido)*: GitHub Actions, redaction, fallback Claude/GPT-4 para contexto maior, feedback learning via MongoDB, dashboard PMO, multi-linguagem, Swagger/OpenAPI.
- **Interlídio (sub-seção 6.x)**: Commander.js (4 subcomandos), ReportGenerator, GitHubExtractorService, histórico; tokens/custos somados → Seção 7.

### 4.8 Seção 7 — Economicidade

- **Unidade**: USD para custos de IA; BRL para salários/custos humanos; conversão 5:1 só na tabela 7.4.
- **Nota inicial**: "Custos de IA em USD (decisão do time, dispensando coluna BRL do template). Salários humanos em BRL (realidade brasileira). Tabela comparativa 7.4 faz a conversão à taxa 5 BRL/USD."

| Subseção | Conteúdo | Moeda |
|----------|----------|-------|
| 7.1 Camada 1 — Custo IA | Tabela 4 linhas (Exp., Comp., Ens., Ress.+Interlídio). Total ~$7.14. | USD |
| 7.2 Camada 2 — Esforço humano | Tabela 4 linhas, horas somadas. Total ~16.25 h. | horas |
| 7.3 Camada 3 — Contrafactual | Tabela 4 linhas, perfis Júnior/Pleno. Total ~88 h → ~R$ 5.762,50. | BRL |
| 7.4 Análise comparativa | IA (USD→BRL 5:1) + humano (BRL) → razão, saving R$/%. | BRL |
| 7.5 Limitações | Viés retrospecto, curva de aprendizado, qualidade não-equivalente, retrabalhos (import, Groq, Windows). | — |

### 4.9 Seção 8 — Discussões Técnicas e Estratégicas

- ADRs justificadas; integrações (GitHub API, Groq, Gemini, MongoDB).
- Desafios: modelo Groq descontinuado capturado nos testes, `tsconfig` build quebrado, bug case-sensitive Windows.
- Trade-offs qualidade/custo/latência (roteamento Groq/Gemini).

### 4.10 Seção 9 — Considerações Éticas

- Riscos: vazamento de código privado para LLM, viés de classificação de criticidade.
- Mitigação: redaction (recomendado), fail-closed, histórico append-only.
- Transparência: limitações documentadas; usuário mantém decisão final.
- Atribuição IA: este relatório + `workflow.MD` documentam todo uso, conforme Código de Conduta.

### 4.11 Seção 10 — Lições Aprendidas

- Sinfonia: Composição mais valiosa (arquitetura clara); Ensaio mais desafiador (caça a bugs).
- Proposta de valor: CLI funcional, custo ~zero.
- Melhorias: validação end-to-end real, redaction, GitHub Actions.
- Aprendizados IA: meta-prompt = alavanca máxima; IA não valida build; números gerados ≠ medidos.
- **Relato individual**: `<relato de cada integrante — preencher à mão>` (4 linhas placeholder).

### 4.12 Seção 11 — Referências

SWEBOK, C4 Model, Sinfonia (Garcia & Medeiros, 2025), papers da `proposta.MD` (dev.to AST+LLM, arXiv 2406.14836, 2402.16667, scitepress 132868, djw.fyi), docs Anthropic/OpenAI/Groq/Gemini, LGPD 13.709/2018, ISO 27001, GitHub Docs.

### 4.13 Seção 12 — Apêndices

- Workflow Document completo (`docs/workflow.MD` anexado) — detalhe por 5 fases preservado aqui.
- 14 canvases na íntegra (existentes + deduzidos em `docs/superpowers/artefatos/`).
- Catálogo de Prompts v2 (`docs/CATALOGO_PROMPTS-v2.md`).
- Prints/logs/quadro de tarefas (placeholders para anexar).

## 5. Fontes de dado por seção

| Seção | Fonte |
|-------|-------|
| Capa | Equipe + README.MD |
| 1 Introdução | proposta.MD, README.MD |
| 2 Metodologia | workflow.MD, TAREFAS_CONCLUSAO_MVP.md |
| 3 Exposição | Missao.MD, Personas.MD, ESCOPO_MVP_ATUALIZADO.md + artefatos deduzidos |
| 4 Composição | Arquitetura.MD, CANVAS_EXPERIMENTO.md, CATALOGO_PROMPTS-v2.md |
| 5 Ensaio | Arquitetura.MD (ADRs), RELATORIO_SEGURANCA_APPSEC.md + artefatos deduzidos |
| 6 Ressonância | workflow.MD (Interlídio), CANVAS_EXPERIMENTO.md + artefatos deduzidos |
| 7 Economicidade | workflow.MD (consolidado, recompactado em 4) |
| 8 Discussões | Arquitetura.MD, workflow.MD |
| 9 Ética | RELATORIO_SEGURANCA_APPSEC.md, Missao.MD |
| 10 Lições | workflow.MD (lições por fase) |
| 11 Referências | proposta.MD, RELATORIO_SEGURANCA_APPSEC.md |
| 12 Apêndices | workflow.MD + docs/ + artefatos deduzidos |

## 6. Critérios de aceitação do script

1. `Relatorio_Final_Equipe3.docx` gerado a partir do template, preservando estilos/fontes/headers/footers.
2. Todos os campos `< >` substituídos (exceto placeholders explicitamente deixados: URL do repo, data final, prints, relato individual).
3. 3 tabelas do template preenchidas (Camada 1/2/3) com 4 linhas cada.
4. Tabelas extras inseridas nos pontos apropriados (ADRs, achados de segurança).
5. 7 canvases deduzidos escritos em `docs/superpowers/artefatos/` com aviso de revisão.
6. Script re-executável sem efeitos colaterais (sempre clona do template original).
7. Output `.docx` abre sem corrupção no Word/LibreOffice.

## 7. Fora de escopo

- Não validar end-to-end contra as APIs Groq/Gemini (declarar honesty no relatório).
- Não incluir GitHub Actions workflow (não existe ainda).
- Não preencher relato individual por membro (placeholder).
- Não recotar USD→BRL (taxa 5:1 fixa do projeto).