# Workflow de Desenvolvimento Assistido por IA -- [Nome da Equipe]

## Sobre este documento
Este documento registra como a equipe utilizou ferramentas e técnicas de IA ao longo do desenvolvimento do projeto. É atualizado a cada fase do projeto e entregue junto com a aplicação na apresentação final.

Além do registro qualitativo do uso de IA, este documento captura dados de **economicidade**: consumo de tokens, esforço humano real e uma estimativa contrafactual do custo equivalente sem assistência de IA. O objetivo é permitir, ao final do semestre, uma análise comparativa entre o custo real do desenvolvimento assistido por IA e o custo estimado de um desenvolvimento realizado integralmente por profissionais humanos nos perfis equivalentes.

---
## Ferramentas utilizadas
| Ferramenta | Categoria | Quando usada | Modelo/Versão | Avaliação geral |
|------------|-----------|-------------|---------------|-----------------|
| Claude | LLM/Assistente | Requisitos, prompts, revisão | claude-sonnet-4-6 | ⭐⭐⭐⭐ |
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
[Mesma estrutura, incluindo as três camadas de economicidade]

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
| Composição | — | — | — | — |
| Ensaio | — | — | — | — |
| Ressonância | — | — | — | — |
| **Total (estimado ao final)** | | | | |

> Conversão USD → BRL: usando taxa aproximada de 5 BRL/USD (vigente em 2026-05-04)

#### Custo contrafactual humano (total do projeto)
| Fase | Horas totais estimadas | Custo humano estimado (R$) |
|------|----------------------|--------------------------|
| Exposição | 4,0h | R$ 160,00 |
| Composição | — | — |
| Ensaio | — | — |
| Ressonância | — | — |
| **Total (estimado ao final)** | | |

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
