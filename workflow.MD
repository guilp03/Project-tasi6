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
[Mesma estrutura, incluindo as três camadas de economicidade]

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
| Exposição | | | | |
| Composição | | | | |
| Ensaio | | | | |
| Ressonância | | | | |
| **Total** | | | | |

> Conversão USD → BRL: usar cotação da data de fechamento do projeto.

#### Custo contrafactual humano (total do projeto)
| Fase | Horas totais estimadas | Custo humano estimado (R$) |
|------|----------------------|--------------------------|
| Exposição | | |
| Composição | | |
| Ensaio | | |
| Ressonância | | |
| **Total** | | |

#### Análise comparativa
- **Custo total com IA (R$):** [custo IA convertido + horas de supervisão humana]
- **Custo total estimado sem IA (R$):** [custo contrafactual]
- **Razão de economicidade:** [custo sem IA / custo com IA]
- **Saving estimado (R$):** [diferença absoluta]
- **Saving estimado (%):** [diferença percentual]

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
