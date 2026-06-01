# Levantamento de Requisitos — Sistema de Auditoria Inteligente de Pull Requests

**Projeto:** TASI6 — Auditoria Automatizada de Documentação com IA  
**Domínio:** D3 — Documentação Automatizada  
**Versão:** 1.1  
**Data:** 24/05/2026  

---

## 1. Visão Geral

Este documento apresenta os requisitos funcionais, requisitos não funcionais e regras de negócio do sistema de auditoria inteligente de Pull Requests.

A aplicação tem como objetivo apoiar PMOs, reviewers, desenvolvedores e responsáveis por segurança/compliance na identificação de gaps entre alterações realizadas em Pull Requests e a documentação existente do projeto.

O sistema será executado inicialmente via CLI, com possibilidade de integração ao fluxo de GitHub Actions. A aplicação utilizará modelos de linguagem para analisar diffs, identificar mudanças relevantes, comparar essas mudanças com arquivos de documentação, classificar criticidade e gerar um relatório estruturado em Markdown.

Além disso, o sistema armazenará o histórico das auditorias em MongoDB, permitindo rastreabilidade, consulta posterior e análise de métricas.

---

## 2. Atores e Componentes Envolvidos

| Ator/Componente | Papel no sistema |
|---|---|
| PMO / Reviewer | Consulta o relatório de auditoria para decidir se o PR precisa de revisão documental |
| Developer | Recebe feedback sobre documentação ausente, incompleta ou inconsistente |
| Security / Compliance | Monitora mudanças sensíveis envolvendo segurança, infraestrutura e compliance |
| CLI | Interface inicial de execução da aplicação |
| GitHub / GitHub Actions | Fonte dos Pull Requests, diffs e possível ambiente de automação |
| Provedor de LLM | Serviço externo responsável pela análise inteligente das mudanças |
| MongoDB | Banco de dados utilizado para persistir o histórico das análises |

---

# 3. Requisitos Funcionais (RF)

Os requisitos funcionais descrevem as funcionalidades que o sistema deve executar para atender aos objetivos do projeto.

---

## [RF-001] Captura e leitura de alterações de código

**Descrição:**  
O sistema deve ser capaz de receber, interpretar e processar arquivos de diff bruto provenientes de Pull Requests.

**Ator/Componente:** CLI / GitHub / GitHub Actions

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve aceitar um arquivo de diff como parâmetro via linha de comando.
- O sistema deve processar diffs textuais padrão gerados pelo Git.
- Caso o arquivo de diff esteja vazio, a execução deve ser interrompida com a mensagem: `Nenhuma alteração de código detectada.`
- Caso o arquivo de diff seja inválido ou inexistente, o sistema deve exibir uma mensagem de erro clara.

---

## [RF-002] Configuração de parâmetros de entrada via CLI

**Descrição:**  
O usuário deve conseguir especificar explicitamente os caminhos dos arquivos que serão processados pela ferramenta.

**Ator/Componente:** Usuário / CLI

**Prioridade:** Alta

**Critérios de Aceitação:**
- A CLI deve aceitar o argumento `--diff` para indicar o caminho do arquivo de diff.
- A CLI deve aceitar o argumento `--docs` para indicar o caminho do arquivo ou diretório de documentação.
- A CLI deve aceitar o argumento `--output` para indicar, opcionalmente, o caminho de saída do relatório Markdown.
- Caso os caminhos informados sejam inválidos ou inexistentes, o sistema deve encerrar a execução exibindo uma mensagem de erro apropriada.

---

## [RF-003] Extração semântica de mudanças com IA

**Descrição:**  
O sistema deve enviar o conteúdo do diff para uma LLM, identificando alterações estruturais e funcionais relevantes, desconsiderando modificações meramente estéticas.

**Ator/Componente:** Sistema Auditor → Provedor de LLM

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve classificar as alterações em categorias como:
  1. novos recursos e endpoints;
  2. alterações em regras de negócio;
  3. mudanças em infraestrutura e configuração;
  4. mudanças relacionadas a autenticação, autorização ou segurança;
  5. alterações em schemas, contratos de API ou interfaces públicas.
- Alterações relacionadas apenas à formatação, comentários, renomeações internas simples ou estilo de código não devem ser consideradas como mudanças documentais relevantes.
- A saída desta etapa deve ser estruturada para ser reutilizada pelas próximas etapas da análise.

---

## [RF-004] Leitura e seleção de documentação relevante

**Descrição:**  
O sistema deve localizar e ler arquivos de documentação fornecidos pelo usuário para comparação com as mudanças do Pull Request.

**Ator/Componente:** Sistema Auditor / CLI

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve aceitar arquivos ou diretórios contendo documentação.
- O sistema deve processar arquivos Markdown, README e documentos textuais compatíveis com o MVP.
- Caso nenhuma documentação seja encontrada, o sistema deve informar que a análise documental ficou limitada.
- O sistema deve registrar no relatório quais documentos foram considerados na análise.

---

## [RF-005] Comparação documental e identificação de gaps

**Descrição:**  
O sistema deve confrontar as alterações funcionais extraídas do código com os arquivos de documentação fornecidos, identificando lacunas, inconsistências ou ausências documentais.

**Ator/Componente:** Sistema Auditor → Provedor de LLM

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve identificar o que foi modificado no código, mas está ausente, incompleto ou contraditório na documentação analisada.
- O resultado deve listar os gaps documentais encontrados.
- Sempre que possível, o relatório deve indicar quais seções ou arquivos de documentação precisam ser criados ou atualizados.
- Caso não sejam encontrados gaps relevantes, o sistema deve indicar explicitamente que não foram detectadas lacunas documentais relevantes.

---

## [RF-006] Classificação automatizada de criticidade

**Descrição:**  
O sistema deve avaliar o impacto gerado pela ausência de documentação e atribuir um nível de criticidade para cada gap encontrado.

**Ator/Componente:** Sistema Auditor → Provedor de LLM

**Prioridade:** Alta

**Critérios de Aceitação:**
- Os níveis de criticidade devem ser categorizados em: `Baixa`, `Média`, `Alta` ou `Crítica`.
- Mudanças relacionadas a autenticação, autorização, criptografia, infraestrutura, dados sensíveis ou compliance devem receber prioridade elevada na análise.
- A classificação deve vir acompanhada de justificativa textual.
- Em caso de ambiguidade em mudança sensível, o sistema deve preferir alertar preventivamente em vez de omitir o risco.

---

## [RF-007] Sinalização de mudanças sensíveis

**Descrição:**  
O sistema deve emitir alerta quando o Pull Request alterar arquivos ou trechos relacionados a segurança, infraestrutura, autenticação, autorização, variáveis de ambiente, secrets, criptografia ou compliance.

**Ator/Componente:** Sistema Auditor → Provedor de LLM

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve identificar alterações em arquivos ou caminhos associados a infraestrutura, CI/CD, autenticação, autorização, secrets ou variáveis de ambiente.
- O sistema deve sinalizar essas alterações mesmo quando a documentação parecer estar parcialmente atualizada.
- O alerta deve ser destacado no relatório final.

---

## [RF-008] Geração de relatório estruturado em Markdown

**Descrição:**  
O sistema deve consolidar as análises realizadas em um relatório final legível, formatado em Markdown e adequado ao consumo de PMOs, reviewers e desenvolvedores.

**Ator/Componente:** Sistema Auditor

**Prioridade:** Alta

**Critérios de Aceitação:**
- O relatório gerado deve conter, no mínimo, as seguintes seções:
  - `# Status`
  - `## Criticidade`
  - `## Mudanças Identificadas`
  - `## Gaps Documentais Encontrados`
  - `## Recomendações`
  - `## Justificativa`
  - `## Limitações da Análise`, quando aplicável.
- O texto deve utilizar linguagem clara e acessível.
- O relatório deve permitir que um profissional sem perfil estritamente técnico compreenda a decisão recomendada.
- O relatório deve indicar quando a análise foi inconclusiva ou limitada.

---

## [RF-009] Exportação do relatório

**Descrição:**  
O sistema deve permitir que o relatório final seja exibido no terminal e/ou exportado como arquivo Markdown.

**Ator/Componente:** Usuário / CLI

**Prioridade:** Alta

**Critérios de Aceitação:**
- Por padrão, o relatório deve ser exibido no terminal.
- Quando o argumento `--output` for informado, o sistema deve salvar o relatório no caminho especificado.
- Caso o caminho de saída seja inválido, o sistema deve informar o erro ao usuário.

---

## [RF-010] Persistência do histórico de auditoria no MongoDB

**Descrição:**  
O sistema deve gravar o resultado completo de cada auditoria finalizada com sucesso em um banco MongoDB para fins de rastreabilidade e geração de métricas.

**Ator/Componente:** Sistema Auditor → MongoDB

**Prioridade:** Alta para persistência básica; Média para consultas avançadas

**Critérios de Aceitação:**
- Cada registro salvo deve conter, no mínimo:
  - identificador da análise;
  - identificador do Pull Request, quando disponível;
  - data e hora da execução;
  - arquivos de documentação analisados;
  - resumo das mudanças identificadas;
  - gaps encontrados;
  - criticidade final;
  - relatório Markdown completo;
  - modelo de IA utilizado;
  - tempo de processamento;
  - estimativa de consumo de tokens, quando disponível.
- O sistema deve persistir 100% das análises finalizadas com sucesso.
- Caso o MongoDB esteja indisponível, o sistema deve informar a falha de persistência sem ocultar o resultado da análise do usuário.

---

## [RF-011] Consulta básica do histórico de auditorias

**Descrição:**  
O sistema deve permitir a recuperação e visualização básica das auditorias salvas no MongoDB.

**Ator/Componente:** Usuário / CLI → MongoDB

**Prioridade:** Média  
**Escopo:** MVP estendido

**Critérios de Aceitação:**
- A CLI deve disponibilizar um comando ou parâmetro específico, como `--history`, para listar análises anteriores.
- A listagem básica deve exibir, no mínimo:
  - identificador da análise;
  - identificador do Pull Request, quando disponível;
  - data da execução;
  - criticidade atribuída;
  - status da análise.
- Caso não existam registros, o sistema deve informar que nenhum histórico foi encontrado.

---

## [RF-012] Tratamento de falhas na chamada ao LLM

**Descrição:**  
O sistema deve lidar com falhas de comunicação com o provedor de LLM, incluindo timeout, erro de autenticação, limite de requisições, indisponibilidade do serviço ou resposta inválida.

**Ator/Componente:** Sistema Auditor → Provedor de LLM

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve exibir mensagens claras em caso de falha.
- O sistema deve registrar o erro nos metadados da execução.
- Quando configurado, o sistema deve tentar utilizar um modelo alternativo em caso de falha do modelo principal.
- Respostas inválidas da LLM devem ser tratadas sem quebrar a aplicação de forma inesperada.

---

## [RF-013] Publicação de comentário no Pull Request

**Descrição:**  
O sistema deve permitir, em uma etapa posterior de integração, a publicação do relatório gerado como comentário no Pull Request analisado.

**Ator/Componente:** Sistema Auditor → GitHub API

**Prioridade:** Média  
**Escopo:** Integração com GitHub Actions / pós-MVP inicial

**Critérios de Aceitação:**
- Quando configurado com token do GitHub, o sistema deve publicar o relatório na PR correspondente.
- Caso a publicação falhe, o sistema deve informar a falha sem descartar o relatório gerado.
- O comentário deve preservar a formatação Markdown.

---

# 4. Requisitos Não Funcionais (RNF)

Os requisitos não funcionais descrevem atributos de qualidade, restrições técnicas e comportamentos esperados do sistema.

---

## [RNF-001] Desempenho e tempo de resposta

**Descrição:**  
O tempo total de processamento da auditoria não deve atrasar o fluxo de desenvolvimento e revisão.

**Prioridade:** Alta

**Critérios de Aceitação:**
- O fluxo completo de execução da CLI, incluindo leitura, análise da IA, geração de relatório e tentativa de salvamento no banco, deve buscar não ultrapassar 30 segundos por Pull Request em cenários padrão do MVP.
- Caso o tempo seja excedido, o sistema deve informar no relatório ou nos metadados o tempo total da execução.

---

## [RNF-002] Baixo custo operacional

**Descrição:**  
O sistema deve operar com custo financeiro sustentável por análise realizada.

**Prioridade:** Alta

**Critérios de Aceitação:**
- O custo médio estimado por análise deve buscar permanecer abaixo de R$ 0,10 nos cenários padrão do MVP.
- O sistema deve priorizar modelos de menor custo e baixa latência para análises comuns.
- Modelos mais robustos devem ser reservados para falhas, ambiguidades ou mudanças críticas.

---

## [RNF-003] Confiabilidade e fallback de LLM

**Descrição:**  
O sistema deve implementar uma estratégia de tolerância a falhas entre provedores ou modelos de IA, equilibrando custo, velocidade e precisão.

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve usar um modelo principal para análises padrão.
- Caso ocorra falha, indisponibilidade, limite de requisições ou análise crítica configurada, o sistema deve permitir fallback para um modelo alternativo mais robusto.
- A escolha concreta dos provedores, como Groq ou Claude, deve ser registrada como decisão arquitetural, não como dependência fixa do requisito.

---

## [RNF-004] Segurança e proteção de credenciais

**Descrição:**  
O sistema não deve expor tokens, chaves de API, credenciais do GitHub, credenciais do MongoDB ou outros dados sensíveis em logs, relatórios ou comentários públicos.

**Prioridade:** Alta

**Critérios de Aceitação:**
- Valores como `GITHUB_TOKEN`, `LLM_API_KEY` e `MONGODB_URI` não devem aparecer em logs ou relatórios.
- Caso um possível secret seja identificado em um diff, o valor deve ser mascarado no relatório.
- Mensagens de erro não devem revelar credenciais ou informações sensíveis de conexão.
- O sistema deve utilizar variáveis de ambiente para dados sensíveis.

---

## [RNF-005] Mitigação de falsos negativos em mudanças críticas

**Descrição:**  
O sistema deve reduzir o risco de deixar passar alterações críticas sem sinalização adequada.

**Prioridade:** Alta

**Critérios de Aceitação:**
- Nos cenários controlados do MVP, a meta é não deixar passar mudanças críticas relacionadas a segurança, infraestrutura, compliance, autenticação ou autorização.
- Em caso de dúvida ou ambiguidade em mudanças críticas, o sistema deve priorizar o alerta preventivo.
- O sistema deve deixar claro que a análise da IA não substitui revisão humana.

---

## [RNF-006] Interface e usabilidade via CLI

**Descrição:**  
A interface de interação com o usuário na fase de MVP será simplificada e focada em automação.

**Prioridade:** Alta

**Critérios de Aceitação:**
- A interação com o sistema deve ocorrer inicialmente via linha de comando.
- A CLI deve aceitar argumentos padronizados como `--diff`, `--docs`, `--output` e, no MVP estendido, `--history`.
- As mensagens exibidas devem ser claras e orientadas à ação.
- O resultado final deve ser exibido no terminal e/ou exportado em arquivo `.md`.

---

## [RNF-007] Persistência de dados

**Descrição:**  
O histórico de auditorias deve ser armazenado em banco MongoDB.

**Prioridade:** Alta

**Critérios de Aceitação:**
- A persistência histórica deve ser realizada em MongoDB.
- O sistema deve usar uma estrutura documental compatível com armazenamento de relatórios, metadados e resultados de análise.
- O sistema deve tratar falhas de conexão ou escrita no banco de forma clara.

---

## [RNF-008] Tratamento de limite de contexto das LLMs

**Descrição:**  
O sistema deve tratar adequadamente Pull Requests que contenham volume elevado de alterações de código ou documentação.

**Prioridade:** Média

**Critérios de Aceitação:**
- Caso o diff ou a documentação ultrapasse o limite de contexto do modelo utilizado, o sistema deve adotar uma ação tratada em código, como:
  1. truncar o conteúdo de forma segura e alertar o usuário sobre a limitação;
  2. dividir a análise por arquivo ou bloco;
  3. redirecionar automaticamente para um modelo com maior janela de contexto, quando configurado.
- O relatório deve informar quando a análise foi limitada por tamanho de contexto.

---

## [RNF-009] Transparência e explicabilidade

**Descrição:**  
O sistema deve apresentar justificativas claras para cada gap documental identificado e para cada nível de criticidade atribuído.

**Prioridade:** Alta

**Critérios de Aceitação:**
- Cada gap listado no relatório deve conter uma justificativa textual.
- Cada classificação de criticidade deve indicar o motivo da classificação.
- O relatório deve indicar incertezas, limitações ou ausência de contexto quando aplicável.
- A saída da IA deve ser apresentada como apoio à decisão, não como decisão definitiva.

---

## [RNF-010] Manutenibilidade e modularidade

**Descrição:**  
O código deve ser modular e organizado, separando responsabilidades principais do sistema.

**Prioridade:** Alta

**Critérios de Aceitação:**
- O sistema deve separar módulos como:
  - leitura de entrada;
  - parsing de diff;
  - leitura de documentação;
  - integração com LLM;
  - geração de relatório;
  - persistência no MongoDB;
  - consulta de histórico.
- Alterações em um módulo não devem exigir mudanças significativas em componentes não relacionados.
- O código deve seguir padrões de organização compatíveis com TypeScript/Node.js.

---

## [RNF-011] Testabilidade

**Descrição:**  
O sistema deve permitir testes automatizados para os componentes principais.

**Prioridade:** Alta

**Critérios de Aceitação:**
- Devem ser previstos testes para leitura de diff, validação de parâmetros, geração de relatório e persistência.
- A integração com LLM deve permitir uso de mocks ou respostas simuladas durante testes.
- Casos críticos, como diff vazio, documentação ausente e erro de LLM, devem possuir testes associados.

---

## [RNF-012] Compatibilidade com GitHub Actions

**Descrição:**  
O sistema deve ser compatível com execução em ambiente de automação do GitHub.

**Prioridade:** Média

**Critérios de Aceitação:**
- O sistema deve ser executável em ambiente Node.js 20+.
- O sistema deve aceitar configuração por variáveis de ambiente.
- O sistema deve conseguir operar sem interface gráfica.
- A execução deve ser adequada a pipelines de CI/CD.

---

# 5. Regras de Negócio (RN)

As regras de negócio definem comportamentos obrigatórios relacionados ao domínio da aplicação.

---

## [RN-001] Mudanças críticas devem ser sempre destacadas

Alterações relacionadas a autenticação, autorização, criptografia, infraestrutura, secrets, variáveis de ambiente, dados sensíveis ou compliance devem ser tratadas como mudanças relevantes para auditoria documental.

---

## [RN-002] Mudanças críticas sem documentação devem gerar alerta elevado

Se uma mudança crítica não possuir documentação correspondente, o sistema deve classificá-la como `Alta` ou `Crítica`, dependendo do impacto identificado.

---

## [RN-003] Refatorações internas podem ser ignoradas

Mudanças internas sem impacto funcional, sem alteração de comportamento externo e sem impacto em usuários ou operação não devem obrigatoriamente gerar gap documental.

---

## [RN-004] O sistema não aprova nem reprova Pull Requests automaticamente

A ferramenta apenas recomenda, alerta e informa. A decisão final continua sendo humana.

---

## [RN-005] Toda recomendação deve conter justificativa

Toda recomendação gerada pela IA deve vir acompanhada de explicação mínima sobre o motivo da classificação ou do gap identificado.

---

## [RN-006] Alertas preventivos são preferíveis à omissão de riscos críticos

Em casos de ambiguidade envolvendo segurança, infraestrutura ou compliance, o sistema deve preferir gerar um alerta preventivo a deixar de sinalizar uma possível mudança crítica.

---

# 6. Priorização para o MVP

## 6.1 Entra no MVP inicial

| Código | Requisito |
|---|---|
| RF-001 | Captura e leitura de alterações de código |
| RF-002 | Configuração de parâmetros via CLI |
| RF-003 | Extração semântica de mudanças com IA |
| RF-004 | Leitura e seleção de documentação relevante |
| RF-005 | Comparação documental e identificação de gaps |
| RF-006 | Classificação automatizada de criticidade |
| RF-007 | Sinalização de mudanças sensíveis |
| RF-008 | Geração de relatório em Markdown |
| RF-009 | Exportação do relatório |
| RF-010 | Persistência do histórico no MongoDB |
| RF-012 | Tratamento de falhas na chamada ao LLM |

---

## 6.2 MVP estendido ou pós-MVP

| Código | Requisito |
|---|---|
| RF-011 | Consulta básica do histórico de auditorias |
| RF-013 | Publicação de comentário no Pull Request |

---

# 7. Resumo dos Requisitos Funcionais

| Código | Requisito | Prioridade | Escopo |
|---|---|---|---|
| RF-001 | Captura e leitura de alterações de código | Alta | MVP |
| RF-002 | Configuração de parâmetros de entrada via CLI | Alta | MVP |
| RF-003 | Extração semântica de mudanças com IA | Alta | MVP |
| RF-004 | Leitura e seleção de documentação relevante | Alta | MVP |
| RF-005 | Comparação documental e identificação de gaps | Alta | MVP |
| RF-006 | Classificação automatizada de criticidade | Alta | MVP |
| RF-007 | Sinalização de mudanças sensíveis | Alta | MVP |
| RF-008 | Geração de relatório estruturado em Markdown | Alta | MVP |
| RF-009 | Exportação do relatório | Alta | MVP |
| RF-010 | Persistência do histórico de auditoria no MongoDB | Alta/Média | MVP |
| RF-011 | Consulta básica do histórico de auditorias | Média | MVP estendido |
| RF-012 | Tratamento de falhas na chamada ao LLM | Alta | MVP |
| RF-013 | Publicação de comentário no Pull Request | Média | Pós-MVP/MVP estendido |

---

# 8. Resumo dos Requisitos Não Funcionais

| Código | Requisito | Prioridade |
|---|---|---|
| RNF-001 | Desempenho e tempo de resposta | Alta |
| RNF-002 | Baixo custo operacional | Alta |
| RNF-003 | Confiabilidade e fallback de LLM | Alta |
| RNF-004 | Segurança e proteção de credenciais | Alta |
| RNF-005 | Mitigação de falsos negativos em mudanças críticas | Alta |
| RNF-006 | Interface e usabilidade via CLI | Alta |
| RNF-007 | Persistência de dados | Alta |
| RNF-008 | Tratamento de limite de contexto das LLMs | Média |
| RNF-009 | Transparência e explicabilidade | Alta |
| RNF-010 | Manutenibilidade e modularidade | Alta |
| RNF-011 | Testabilidade | Alta |
| RNF-012 | Compatibilidade com GitHub Actions | Média |

---

# 9. Observações Finais

Este documento consolida os requisitos do sistema com foco em uma primeira versão viável da aplicação. O MVP prioriza a execução via CLI, a análise de diffs e documentações fornecidas, a geração de relatório em Markdown e a persistência do histórico no MongoDB.

Funcionalidades de integração mais avançada, como publicação automática de comentários em Pull Requests reais e consulta detalhada de histórico, podem ser implementadas em uma etapa posterior ou como extensão do MVP, dependendo da capacidade da equipe e do andamento do projeto.
