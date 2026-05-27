# Workflow de Desenvolvimento Assistido por IA -- [Nome da Equipe]

## Sobre este documento
Este documento registra como a equipe utilizou ferramentas e técnicas de IA ao longo do desenvolvimento do projeto. É atualizado a cada fase do projeto e entregue junto com a aplicação na apresentação final.

Além do registro qualitativo do uso de IA, este documento captura dados de **economicidade**: consumo de tokens, esforço humano real e uma estimativa contrafactual do custo equivalente sem assistência de IA. O objetivo é permitir, ao final do semestre, uma análise comparativa entre o custo real do desenvolvimento assistido por IA e o custo estimado de um desenvolvimento realizado integralmente por profissionais humanos nos perfis equivalentes.

---
## Ferramentas utilizadas
| Ferramenta | Categoria | Quando usada | Modelo/Versão | Avaliação geral |
|------------|-----------|-------------|---------------|-----------------|
| Claude | LLM/Assistente | Requisitos, prompts, revisão | claude-sonnet-4-6 | ⭐⭐⭐⭐ |
| Claude (Opus) | Agente de código | Testes, hardening, análise de escopo (Ensaio) | claude-opus-4-7 | ⭐⭐⭐⭐⭐ |
| GitHub Copilot | Code completion | Implementação | GPT-4o | ⭐⭐⭐ |
| ... | ... | ... | ... | ... |

> Registrar o modelo específico utilizado é importante para o cálculo de custo
> por token, pois modelos diferentes têm preços diferentes.

---

## Fase: Exposição (Aulas 17-20)

### Onde a IA ajudou
- **Geração de personas:** Claude foi essencial para estruturar as personas baseado na proposta. Análise rápida da proposta.MD + geração de Carolina Oliveira (PMO) e Rafael Santos (Developer) com dores, dia-a-dia e benefícios bem definidos.
- **Iteração estruturada:** Refino da persona com foco (sem casos de uso) foi feito rapidamente com feedback
- **Definição de Missão e Valores:** Claude estruturou uma missão/valores que reflete a filosofia pragmática do projeto (velocidade > perfeição, custo mínimo, aceitação de erros). Documento sucinto mas representativo.

### Onde a IA não ajudou (ou atrapalhou)
- Nada a relatar nesta fase inicial

### Prompts notáveis desta fase
- PROMPT-001: Análise de proposta para extração de personas (persona principal)
- PROMPT-002: Geração de persona secundária (desenvolvedor)

### Decisões tomadas sem IA
- Definição de quantas personas seriam necessárias (2 personas: PMO + Developer) — decisão tomada manualmente baseada na proposta

### Registro de economicidade desta fase
> Preencher ao final de cada fase. Estimativas são aceitáveis quando dados
> exatos não estiverem disponíveis -- indique quando for estimativa.

#### Camada 1 -- Consumo de IA
| Atividade | Ferramenta/Modelo | Tokens entrada | Tokens saída | Custo estimado (USD) |
|-----------|------------------|---------------|-------------|----------------------|
| Geração e análise de personas | Claude Sonnet | ~13.000 | ~6.500 | ~$0.0065 |
| Definição de Missão e Valores | Claude Sonnet | ~6.000 | ~3.000 | ~$0.0032 |
| **Total da fase** | | **~19.000** | **~9.500** | **~$0.0097** |

> Como obter os dados: (a) via painel de uso da API (OpenAI, Anthropic);
> (b) instrumentando as chamadas no código da aplicação; (c) usando as
> estimativas do playground/interface web quando disponíveis.
> Preços de referência (março 2026): Claude Sonnet ~$3/M tokens entrada,
> ~$15/M tokens saída; GPT-4o ~$2,50/M entrada, ~$10/M saída. Consulte
> preços atuais em docs.anthropic.com e platform.openai.com.

#### Camada 2 -- Esforço humano real (auto-declarado)
| Atividade | Membro (perfil) | Tempo com IA (h) | Tempo sem IA (h) | Observações |
|-----------|----------------|-----------------|-----------------|-------------|
| Geração de personas | Guilherme (júnior) | 0,5h | -- | Totalmente assistido por Claude. Ler proposta, gerar 2 personas, documentar em arquivo |
| Definição de Missão e Valores | Guilherme (júnior) | 0,25h | -- | Totalmente assistido por Claude. Estruturação de valores alinhados com proposta |
| **Total** | | **0,75h** | | |

> **Perfis de referência para uso no cálculo:** Júnior / Pleno / Sênior /
> Arquiteto. Use o perfil mais próximo do nível de experiência real do membro
> naquela atividade específica, não o perfil geral da pessoa.

#### Camada 3 -- Estimativa contrafactual
| Atividade | Perfil | Tempo estimado sem IA (h) | Salário médio/h (R$) | Custo humano estimado (R$) |
|-----------|--------|--------------------------|---------------------|---------------------------|
| Geração de personas (pesquisa + entrevista + escrita) | Júnior | 2,5h | R$ 40 | R$ 100,00 |
| Definição de Missão e Valores (workshops + escrita) | Júnior | 1,5h | R$ 40 | R$ 60,00 |
| **Total da fase** | | **4,0h** | | **R$ 160,00** |

> **Raciocínio contrafactual (personas):** Sem IA, seria necessário: (1) Ler e entender proposta (~15min), (2) Pesquisar personas/templates (~20min), (3) Entrevistar PMO (~30min), (4) Entrevistar developer (~20min), (5) Consolidar e escrever (~45min), (6) Documentar (~15min). Total: ~2,5h
>
> **Raciocínio contrafactual (missão/valores):** Sem IA, seria necessário: (1) Pesquisar valores em startups similares (~20min), (2) Workshops internos com equipe (~30min), (3) Consolidar feedback e escrever (~25min). Total: ~1,5h

> **Referências salariais sugeridas (mercado Recife/PE, 2026):**
> Júnior ~R$ 35-45/h | Pleno ~R$ 65-85/h | Sênior ~R$ 100-130/h |
> Arquiteto ~R$ 140-180/h. Fontes: pesquisa de salários ABES, Stack Overflow
> Developer Survey, Glassdoor Brasil. A equipe pode ajustar os valores com
> base em fontes mais recentes, desde que documente a fonte utilizada.
>
> **Metodologia do contrafactual:** o tempo estimado sem IA deve refletir
> quanto tempo o mesmo membro levaria para executar a mesma atividade
> *partindo do zero*, sem assistência de nenhuma ferramenta de IA generativa.
> É uma estimativa -- registre o raciocínio que embasou o número.

### Lições aprendidas
> O que a equipe aprenderia se começasse essa fase novamente?

---

## Fase: Composição (Aulas 21-24)

### Onde a IA ajudou
- **C4 Model (Nível 1, 2, 3):** Claude estruturou diagrama de contexto, contêineres e componentes rapidamente. Iterações rápidas de refinamento.
- **Seleção de Stack:** Claude analisou trade-offs Node.js vs Python vs Go considerando performance em GitHub Actions e startup time crítico.
- **Seleção de LLM Provider:** Claude fez análise comparativa Groq vs Claude vs GPT-4 vs Deepseek, considerando os 5 valores de Missão (pragmatismo, custo mínimo, latência, segurança, transparência).
- **Decisões Arquiteturais (ADRs):** Claude estruturou 5 ADRs com contexto, decisão, alternativas e consequências, alinhados com valores do projeto.
- **Revisão Crítica:** Claude fez análise honesta de cada decisão vs Missão + PRE_PROPOSTA, identificando que MongoDB poderia ser removido do MVP (depois revertido por decisão do time).

### Onde a IA não ajudou (ou atrapalhou)
- **Over-documentation:** Inicialmente documentamos Nível 3 com muito detalhe (subcomponentes 3.1, 3.2, 3.3, etc) — foi simplificado depois para Design Emergente durante implementação.
- **MongoDB scope creep:** Houve debate se MongoDB era necessário para MVP — recomendação inicial era removê-lo, mas time decidiu manter para possibilitar feedback learning em v2.

### Prompts notáveis desta fase
- PROMPT-C1: "Faça um C4 Model completo (3 níveis) para sistema monolítico Python CLI acionado por GitHub Actions"
- PROMPT-C2: "Compare Node.js vs Python para CLI em GitHub Actions considerando startup time < 30s análise total"
- PROMPT-C3: "Análise comparativa Groq vs Claude vs GPT-4 vs Deepseek para análise de documentação, considerando estes 5 valores..."
- PROMPT-C4: "Revise cada decisão arquitetural contra Missão.MD e PRE_PROPOSTA.md — qual alinha? qual não alinha?"

### Decisões tomadas sem IA
- **MongoDB sim/não:** Debate inicial (remover para MVP vs manter) — time decidiu manter para v1 com foco em feedback learning.
- **C4 Level 3 scope:** Decisão de simplificar Nível 3 para Design Emergente (não documentar cada subcomponente antes de implementar).

### Registro de economicidade desta fase

#### Camada 1 -- Consumo de IA
| Atividade | Ferramenta/Modelo | Tokens entrada | Tokens saída | Custo estimado (USD) |
|-----------|------------------|---------------|-------------|----------------------|
| C4 Model (3 níveis) | Claude Haiku 4.5 | ~28.000 | ~12.000 | ~$0.0096 |
| Stack tecnológico (análise) | Claude Haiku 4.5 | ~8.000 | ~4.000 | ~$0.0032 |
| LLM Provider comparison | Claude Haiku 4.5 | ~15.000 | ~8.000 | ~$0.0072 |
| ADRs (5 decisões arquiteturais) | Claude Haiku 4.5 | ~12.000 | ~6.000 | ~$0.0048 |
| Revisão crítica vs Missão/Proposta | Claude Haiku 4.5 | ~18.000 | ~9.000 | ~$0.0108 |
| **Total da fase** | | **~81.000** | **~39.000** | **~$0.0356** |

#### Camada 2 -- Esforço humano real (auto-declarado)
| Atividade | Membro (perfil) | Tempo com IA (h) | Tempo sem IA (h) | Observações |
|-----------|----------------|-----------------|-----------------|-------------|
| C4 Model (3 níveis) | Guilherme (pleno) | 1,5h | — | Claude fez 80% do trabalho (estrutura, diagramas). Refinamento e validação manuais. |
| Stack tecnológico | Guilherme (pleno) | 0,75h | — | Claude análise 90%, decisão final + trade-off avaliação manual. |
| LLM Provider (Groq vs Claude vs GPT vs Deepseek) | Guilherme (pleno) | 1,0h | — | Claude comparação, depois reconsideração vs Missão.MD (manual). |
| ADRs (5 decisões) | Guilherme (pleno) | 1,5h | — | Claude gerou estrutura, time refinava contexto/alternativas/consequências. |
| Revisão crítica (Missão + Proposta) | Guilherme (pleno) | 1,25h | — | Claude análise inicial, depois discussão de MongoDB sim/não. |
| **Total** | | **6,0h** | | |

#### Camada 3 -- Estimativa contrafactual
| Atividade | Perfil | Tempo estimado sem IA (h) | Salário médio/h (R$) | Custo humano estimado (R$) |
|-----------|--------|--------------------------|---------------------|---------------------------|
| C4 Model (pesquisa + sketch + validação) | Pleno | 4,0h | R$ 75 | R$ 300,00 |
| Stack analysis (pesquisa trade-offs + testes) | Pleno | 2,5h | R$ 75 | R$ 187,50 |
| LLM Provider comparison (pesquisa + análise) | Pleno | 3,0h | R$ 75 | R$ 225,00 |
| ADRs (estrutura + contexto + escrita) | Pleno | 3,5h | R$ 75 | R$ 262,50 |
| Revisão crítica (análise vs requisitos) | Pleno | 2,5h | R$ 75 | R$ 187,50 |
| **Total da fase** | | **15,5h** | | **R$ 1.162,50** |

### Lições aprendidas
- ✅ **C4 Model é uma estrutura excelente** — Claude compreende bem e documenta de forma clara. Sempre começar por Nível 1 (contexto) antes de descer para detalhes.
- ✅ **Análise de trade-offs com valores do projeto** — Vincular cada decisão aos 5 valores (Pragmatismo, Custo, Contexto Real, Segurança, Transparência) deu clareza e alinhamento.
- ⚠️ **Design Emergente > over-documentation** — Tentar documentar Nível 3 com subcomponentes antes de implementar gerou retrabalho. Melhor deixar estrutura básica e refinar durante dev.
- ⚠️ **Análise crítica importante** — Revisão honesta da arquitetura vs Missão + Proposta identificou scope creep (MongoDB debate) e força melhores decisões.
- ✅ **Claude com Haiku é suficiente** — Para arquitetura de alto nível, Haiku tem custo ~3x menor que Sonnet com qualidade adequada.

## Fase: Ensaio (Aulas 25-29)

### Onde a IA ajudou
- **POC do extrator de PR:** Claude/Copilot geraram o `poc-diff-reader.ts` (~596 linhas) que consome a GitHub API, baixa metadados + diffs do PR e serializa tudo em `output/pr-corpus.json`. Esse corpus virou o contrato de entrada da camada de análise.
- **Implementação do `LLMIntegrationService` (ADR-005):** a classe principal (~700 linhas) foi gerada a partir de um meta-prompt detalhado que descrevia o roteamento inteligente, o structured output e os requisitos de fetch nativo. A IA acertou de primeira o esqueleto da classe, os métodos privados (`calculateRoutingDecision`, `callGroq`, `callGemini`, `parseJSONSafely`) e o uso de `responseMimeType`/`response_format` para forçar JSON.
- **Roteamento Groq vs Gemini:** Claude implementou os 17+ padrões regex de detecção de arquivos sensíveis (`.env*`, `/auth`, `security/`, `.github/workflows/`, `Dockerfile`, `Terraform`, `k8s/`, segredos) e o corte por tamanho de diff (>30k tokens → Gemini), exatamente como previsto na ADR-005.
- **Structured Output tipado:** geração da interface `AuditResult` e do parse seguro com fallback, evitando crash quando a LLM devolve JSON malformado.
- **Reorganização do repositório:** Claude propôs e executou a separação em `docs/` (documentação), `apps/` (POC) e `src/` (app principal), além de ajustar `package.json` (scripts `dev`, `audit`, `poc:diff-reader`) e `tsconfig.json`.
- **Documentação de apoio:** `IMPLEMENTATION.md` e `IMPLEMENTATION_SUMMARY.md` foram gerados junto com o código, mantendo doc e implementação sincronizadas.
- **Testes automatizados + hardening (entregável CP3):** Claude montou a suíte Vitest (28 testes em 5 arquivos) cobrindo roteamento ADR-005, parse seguro com fallback, construção de prompt, chamadas Groq/Gemini com `fetch` mockado e um fluxo end-to-end com fixtures temporárias — cobertura de ~92% no `LLMIntegrationService`. No mesmo passe, identificou e corrigiu o bug do modelo Groq descontinuado, um defeito de `tsconfig` que impedia o build e dois erros de tipagem estrita revelados quando o `tsc` passou a rodar.

### Onde a IA não ajudou (ou atrapalhou)
- **Modelo Groq descontinuado (caçado tarde):** o meta-prompt sugeria `mixtral-8x7b-32768`, modelo já descontinuado no Groq (a API responde `model_decommissioned`/HTTP 400). O bug passou despercebido no commit inicial e só foi pego no passe de testes/hardening do CP3, quando foi corrigido para `llama-3.3-70b-versatile` (sucessor ativo no free tier — custo zero preservado). Sem teste end-to-end, a IA não detecta sozinha que um ID de modelo deixou de existir.
- **Import quebrado:** o primeiro commit (`eb66d63`) saiu com um import incorreto que exigiu um commit de correção logo em seguida (`e35d59a "import fix"`) — a IA não validou o build antes de finalizar.
- **Over-estimativa de capacidades:** os números de latência/custo no `IMPLEMENTATION_SUMMARY.md` foram gerados pela IA sem medição real (os testes usam `fetch` mockado; ainda não houve chamada real às APIs), então continuam sendo projeções, não dados observados.
- **Build nunca validado:** o `tsconfig.json` original tinha `resolveJsonModule` com `moduleResolution` implícito `classic`, então `npm run build` falhava — defeito que só apareceu quando rodamos o `tsc` pela primeira vez na fase de testes. A IA havia "completado" a implementação sem nunca compilar.
- **`.env.example` e chaves:** a IA assumiu nomes de variáveis que precisaram ser conferidos contra o `config.ts` para garantir consistência.

### Prompts notáveis desta fase
- PROMPT-E1 (meta-prompt de integração): *"Escreva uma classe TypeScript `LLMIntegrationService` ... método `analyzeDiff(corpusFilePath, docsPath)` ... roteamento inteligente (ADR-005) ... Groq para o caminho feliz e Gemini para segurança/auth/.env/infra/CI-CD ... structured output obedecendo à interface `AuditResult` ... `responseMimeType: "application/json"` (Gemini) e `response_format: { type: "json_object" }` (Groq) ... fetch nativo do Node ... parse seguro do JSON."* — gerou ~80% da implementação de uma vez.
- PROMPT-E2: "Reorganize o repositório separando docs/, apps/ e src/ sem over-engineering, atualizando package.json e tsconfig."
- PROMPT-E3 (testes): "Adicione Vitest e uma suíte cobrindo os componentes principais — roteamento ADR-005, parse seguro, construção de prompt e as chamadas Groq/Gemini com fetch mockado — sem gastar API."
- Reaproveitamento do **CATALOGO_PROMPTS-v2.md** (PROMPT-001 a PROMPT-005) como base para os prompts internos de auditoria em `src/utils/prompts.ts`.

### Decisões tomadas sem IA
- **Modelo Groq de substituição:** decisão de adotar `llama-3.3-70b-versatile` (qualidade de raciocínio, contexto 128k, free tier) em vez do `llama-3.1-8b-instant` — priorizando qualidade da auditoria sobre latência pura no caminho feliz.
- **Escopo do MVP (o que NÃO fazer):** o time decidiu conscientemente deixar de fora persistência MongoDB, parsing de CLI com yargs/commander, geração de relatório Markdown, integração com GitHub Actions e cache — empurrados para v0.2.
- **Threshold de 30k tokens** como gatilho de roteamento para Gemini — calibrado manualmente contra o limite de contexto do Groq.

### Registro de economicidade desta fase

#### Camada 1 -- Consumo de IA
| Atividade | Ferramenta/Modelo | Tokens entrada | Tokens saída | Custo estimado (USD) |
|-----------|------------------|---------------|-------------|----------------------|
| POC extrator de PR (`poc-diff-reader.ts`) | GitHub Copilot (GPT-4o) | ~14.000 | ~9.000 | ~$0.0125 |
| LLMIntegrationService (meta-prompt → ~700 linhas) | Claude Sonnet 4.6 | ~22.000 | ~14.000 | ~$0.2760 |
| Roteamento ADR-005 + regex de segurança | Claude Sonnet 4.6 | ~8.000 | ~5.000 | ~$0.0990 |
| Reorganização repo + package.json/tsconfig | Claude Sonnet 4.6 | ~6.000 | ~3.500 | ~$0.0705 |
| Docs (IMPLEMENTATION + SUMMARY) | Claude Sonnet 4.6 | ~10.000 | ~8.000 | ~$0.1500 |
| Correção de import (commit inicial) | Claude Sonnet 4.6 | ~5.000 | ~2.000 | ~$0.0450 |
| Sessão TL+IA: testes Vitest, hardening, README e docs do CP3 (**medido via `/usage`**) | Claude Opus 4.7 | 25.500 | 62.000 | $5.7100 |
| Roteamento auxiliar | Claude Haiku 4.5 | 1.500 | 15 | $0.0016 |
| **Total da fase** | | **~92.000** | **~103.500** | **~$6.3646** |

> Observação: a fase Ensaio é a de maior custo de IA do projeto. O valor de US$ 5,71 (≈ R$ 28,55)
> da sessão TL+IA foi **medido** via `/usage`, não estimado — e é dominado por **cache** (5,8M
> tokens de leitura de cache + 184k de escrita numa sessão de 2h36m), não por geração crua. O custo
> bruto de entrada/saída (25,5k in + 62k out) é só uma fração disso. **Importante:** este é o custo
> de _desenvolvimento assistido_ (o agente de código), não o custo operacional do produto — a
> aplicação em si continua **custo zero** (Groq llama-3.3 + Gemini Flash no free tier).

#### Camada 2 -- Esforço humano real (auto-declarado)
| Atividade | Membro (perfil) | Tempo com IA (h) | Tempo sem IA (h) | Observações |
|-----------|----------------|-----------------|-----------------|-------------|
| POC extrator de PR | Guilherme (Dev pleno) | 1,5h | — | Copilot gerou base; integração com GitHub API e testes manuais. |
| LLMIntegrationService (meta-prompt) | Alexandre Magalhães (Tech Lead) | 1,0h | — | Meta-prompt gerou ~80%; TL revisou roteamento e tipos. |
| Reorganização do repositório | Alexandre Magalhães (Tech Lead) | 0,5h | — | Totalmente assistido; mover docs/apps/src + ajustar scripts. |
| Debug (import fix commit inicial) | Alexandre Magalhães (Tech Lead) | 0,5h | — | Build quebrado por import incorreto — correção manual. |
| Documentação (IMPLEMENTATION/SUMMARY) | Alexandre Magalhães (Tech Lead) | 0,25h | — | Gerada junto ao código, revisão leve. |
| Testes Vitest + hardening (fix Groq/tsconfig/tipagem) | Alexandre Magalhães (Tech Lead / QA) | 1,0h | — | Suíte de 28 testes assistida; bug do modelo Groq e build pegos aqui. |
| Análise de escopo vs CP3 + delegação de tarefas finais | Alexandre Magalhães (Tech Lead) | 0,5h | — | Mapa "feito vs falta", criação do `TAREFAS_CONCLUSAO_MVP.md`. |
| **Total** | | **5,25h** | | |

#### Camada 3 -- Estimativa contrafactual
| Atividade | Perfil | Tempo estimado sem IA (h) | Salário médio/h (R$) | Custo humano estimado (R$) |
|-----------|--------|--------------------------|---------------------|---------------------------|
| POC extrator de PR (estudar GitHub API + implementar + testar) | Pleno | 8,0h | R$ 75 | R$ 600,00 |
| LLMIntegrationService (arquitetura + 2 integrações HTTP + roteamento) | Pleno | 12,0h | R$ 75 | R$ 900,00 |
| Reorganização do repositório | Júnior | 1,5h | R$ 40 | R$ 60,00 |
| Debug e ajustes (import) | Pleno | 1,5h | R$ 75 | R$ 112,50 |
| Documentação técnica (2 guias) | Júnior | 3,0h | R$ 40 | R$ 120,00 |
| Suíte de testes (28 casos + mocks + fixtures) | Pleno | 6,0h | R$ 75 | R$ 450,00 |
| Hardening (caçar bug de modelo + build + tipagem) | Pleno | 2,5h | R$ 75 | R$ 187,50 |
| **Total da fase** | | **34,5h** | | **R$ 2.380,00** |

> **Raciocínio contrafactual (LLMIntegrationService):** sem IA seria necessário: (1) ler docs das APIs Groq e Gemini (~2h), (2) modelar a classe e os tipos (~2h), (3) implementar as duas integrações HTTP com fetch + tratamento de erro (~4h), (4) implementar e calibrar o roteamento por regex (~2h), (5) parse seguro + fallback e testes (~2h). Total: ~12h. O meta-prompt comprimiu isso para ~1h de trabalho efetivo.

### Sessão de testes & hardening (Tech Lead + Claude Opus 4.7)

Sessão dedicada de pareamento TL ↔ IA que fechou o gap obrigatório de **testes automatizados** do CP3 e endureceu o MVP. O que foi resolvido:

- **Suíte Vitest criada** — 28 testes em 5 arquivos (`tests/routing|parse|prompt|api|integration.test.ts`), todos passando, com `fetch` mockado (zero gasto de API). Cobertura de **~92%** no `LLMIntegrationService` e ~89% em `prompts`.
- **Bug crítico do Groq corrigido** — `mixtral-8x7b-32768` (descontinuado, `model_decommissioned`/HTTP 400) → **`llama-3.3-70b-versatile`** (sucessor ativo no free tier). O caminho feliz, que estava quebrado, voltou a funcionar — custo zero mantido.
- **Build consertado** — `tsconfig.json` ganhou `moduleResolution: node` (sem isso `npm run build` nem compilava) e dois erros de tipagem estrita no `response.json()` foram tipados corretamente. `npx tsc --noEmit` e `npm run build` agora passam limpos.
- **Análise de escopo vs CP3** — mapeamento "feito vs falta" contra `ESCOPO_MVP_ATUALIZADO.md` e os entregáveis do CP3, gerando o plano de delegação (ver abaixo).

**Consumo da sessão (medido via `/usage`):**
- **Custo total:** US$ 5,71 (≈ R$ 28,55)
- **Duração:** 14m02s de API · 2h36m20s de relógio (parede)
- **Mudanças de código:** 819 linhas adicionadas, 296 removidas
- **Por modelo:** Claude Opus 4.7 → 25,5k entrada / 62,0k saída / 5,8M leitura de cache / 184,3k escrita de cache (US$ 5,71); Claude Haiku 4.5 → 1,5k / 15 (US$ 0,0016)
- **Leitura:** o custo é dominado pela **leitura de cache** (5,8M tokens) de uma sessão longa, não pela geração de saída. Em uma sessão mais curta/focada o número cairia bastante.

Contrafactual: escrever a mesma suíte de testes + caçar os 3 bugs de build/modelo manualmente custaria ~8,5h de um Dev pleno (~R$ 637,50) — ainda assim a sessão assistida saiu ~22× mais barata.

### Pendências delegadas pela TL para conclusão do MVP

Ainda fora do MVP (escopo §5.5/§5.6 e entregáveis CP3), agora distribuídas em **`docs/TAREFAS_CONCLUSAO_MVP.md`**:

| Frente | Responsável | Papel |
|--------|-------------|-------|
| ✅ Contrato `AnalysisRecord` (desbloqueio) — **concluído** | Alexandre Magalhães | Tech Lead |
| Persistência MongoDB (§5.6) | Reilson Fonseca | Dev — Persistência |
| Relatório Markdown (§5.5) | Stela Nascimento | Dev — Saída/Relatórios |
| Relatório de Segurança + Checklist de Lançamento (CP3) | Alexandre Magalhães | Tech Lead / QA |
| Validação end-to-end com chaves reais | Alexandre Magalhães | Tech Lead |

### Lições aprendidas
- ✅ **Meta-prompt detalhado = alavanca máxima** — descrever a classe inteira (método público, requisitos de roteamento, structured output, fetch nativo) em um único prompt gerou ~80% do código de uma vez. O retorno por token investido foi o maior do projeto.
- ⚠️ **IA não valida build** — o import quebrado mostra que a IA gera código plausível mas não compila por você; sempre rodar `tsc`/`npm run build` antes de commitar.
- ⚠️ **Cuidado com conhecimento defasado de modelos** — a sugestão do `mixtral-8x7b-32768` (descontinuado) reforça que decisões sobre versões/modelos de terceiros precisam de verificação humana contra a doc oficial.
- ⚠️ **Números gerados ≠ números medidos** — latência e custo no SUMMARY são projeções da IA; precisam ser validados com teste end-to-end real na próxima fase.
- ✅ **Pragmatismo no escopo** — listar explicitamente o que NÃO fazer (MongoDB, CLI lib, relatórios) evitou scope creep e manteve o MVP enxuto, alinhado à Missão.
- ✅ **Testes pegam o que o review não pega** — escrever a suíte forçou rodar o `tsc` pela primeira vez, e foi isso (não a leitura do código) que revelou o modelo Groq morto e o build quebrado. Teste cedo, não só no fim.
- ✅ **Definir o contrato antes de paralelizar** — ao delegar persistência e relatório, criar primeiro o tipo `AnalysisRecord` (tarefa da TL) evita que Reilson e Stela alterem o mesmo contrato em dois lugares.

## Fase: Ressonância (Aulas 30-32)
[Mesma estrutura, incluindo as três camadas de economicidade]

---

## Reflexão final

### Métricas de uso de IA (estimadas)
| Atividade | % assistida por IA | Ferramentas |
|----------|-------------------|-------------|
| Escrita de código | ...% | ... |
| Geração de testes | ...% | ... |
| Documentação | ...% | ... |
| Design de prompts | ...% | ... |
| Análise de requisitos | ...% | ... |

### Consolidado de economicidade do projeto

#### Custo real de IA (total do projeto)
| Fase | Tokens entrada | Tokens saída | Custo IA (USD) | Custo IA (R$) |
|------|---------------|-------------|---------------|--------------|
| Exposição | ~19.000 | ~9.500 | ~$0.0097 | ~R$ 0,05 |
| Composição | ~81.000 | ~39.000 | ~$0.0356 | ~R$ 0,18 |
| Ensaio | ~92.000 | ~103.500 | ~$6.3646 | ~R$ 31,82 |
| Ressonância | — | — | — | — |
| **Total (até Ensaio)** | **~192.000** | **~152.000** | **~$6.4099** | **~R$ 32,05** |

> Nota: o custo da fase Ensaio (US$ 5,71 medido) é majoritariamente leitura de cache de uma
> sessão longa de pareamento com agente de código — ver detalhamento na seção da fase.

> Conversão USD → BRL: usando taxa aproximada de 5 BRL/USD (vigente em 2026-05-04)

#### Custo contrafactual humano (total do projeto)
| Fase | Horas totais estimadas | Custo humano estimado (R$) |
|------|----------------------|--------------------------|
| Exposição | 4,0h | R$ 160,00 |
| Composição | 15,5h | R$ 1.162,50 |
| Ensaio | 34,5h | R$ 2.380,00 |
| Ressonância | — | — |
| **Total (estimado até Ensaio)** | 54,0h | R$ 3.702,50 |

#### Análise comparativa (Fase Exposição)
- **Custo total com IA (R$):** R$ 30,05 (tokens: R$ 0,05 + tempo humano: 0,75h × R$ 40/h = R$ 30,00)
- **Custo total estimado sem IA (R$):** R$ 160,00
- **Razão de economicidade:** 5,33x (sem IA é 5,33× mais caro)
- **Saving estimado (R$):** R$ 129,95
- **Saving estimado (%):** 81,25%

> **Atenção às limitações desta análise:**
> (1) O contrafactual é uma estimativa subjetiva -- há viés de retrospecto.
> (2) O custo com IA não inclui o tempo de aprendizado das ferramentas
> (curva de adoção), que seria menor em um time já experiente.
> (3) A qualidade do output pode diferir entre as abordagens -- custo menor
> não implica necessariamente resultado equivalente.
> (4) Há atividades onde a IA aumentou o tempo total (retrabalho, revisão
> de outputs incorretos) -- esses casos devem ser documentados explicitamente.
> Registre suas próprias limitações e reflita sobre o que os números
> realmente indicam.

### O que mudaria se fizesse novamente?

### Recomendações para outras equipes
