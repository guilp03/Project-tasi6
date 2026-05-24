# Levantamento de Requisitos — Sistema de Auditoria Inteligente de Pull Requests

## 1. Requisitos Funcionais (RF)
Os requisitos funcionais descrevem as funcionalidades obrigatórias que o sistema deverá executar para atender aos objetivos do projeto.

### [RF-001] Captura e Leitura de Alterações de Código (PR Diff)
* **Descrição:** O sistema deverá ser capaz de receber, interpretar e processar arquivos de diff bruto provenientes de Pull Requests.
* **Ator/Componente:** CLI / Evento do GitHub.
* **Critérios de Aceitação:**
    * O sistema deverá aceitar o arquivo de diff como parâmetro via linha de comando.
    * O sistema deverá processar diffs textuais padrão gerados pelo Git.
    * Caso o arquivo de diff esteja vazio, a execução deverá ser interrompida com a mensagem: `"Nenhuma alteração de código detectada."`

### [RF-002] Extração Semântica com Inteligência Artificial
* **Descrição:** O sistema deverá enviar o conteúdo do diff para uma LLM, identificando exclusivamente alterações estruturais e funcionais relevantes, desconsiderando modificações meramente estéticas.
* **Ator/Componente:** Sistema Auditor → Provedor de LLM (Groq/Claude).
* **Critérios de Aceitação:**
    * As alterações deverão ser classificadas nas seguintes categorias:
        1. Novos recursos e endpoints;
        2. Alterações em regras de negócio;
        3. Mudanças de infraestrutura e configuração.
    * Alterações relacionadas apenas à formatação, comentários ou estilo de código não deverão ser consideradas na análise.

### [RF-003] Comparação Documental e Identificação de Gaps Documentais
* **Descrição:** O sistema deverá confrontar as alterações funcionais extraídas do código com os arquivos de documentação locais fornecidos para mapear lacunas (gaps).
* **Ator/Componente:** Sistema Auditor.
* **Critérios de Aceitação:**
    * A IA deverá cruzar as informações e identificar o que foi modificado no código, mas está ausente, incompleto ou contraditório nos documentos analisados.
    * O resultado deverá listar as seções específicas da documentação que necessitam de criação ou atualização.

### [RF-004] Classificação Automatizada de Criticidade e Risco
* **Descrição:** O sistema deverá avaliar o impacto gerado pela ausência de documentação e atribuir um nível de risco para o gap encontrado, focando em segurança e compliance.
* **Ator/Componente:** Sistema Auditor → Provedor de LLM.
* **Critérios de Aceitação:**
    * Os níveis de risco deverão ser categorizados em: Baixo, Médio, Alto ou Crítico.
    * **Regra de Negócio Mandatória:** Qualquer modificação em regras de autenticação, autorização, criptografia ou infraestrutura (IaC) sem a correspondente documentação deverá ser obrigatoriamente classificada como **Crítica**.

### [RF-005] Geração de Relatório Estruturado em Markdown
* **Descrição:** O sistema deverá consolidar as análises realizadas em um relatório final legível, formatado em Markdown, ideal para o consumo de gerentes de projeto (PMOs).
* **Ator/Componente:** Sistema Auditor.
* **Critérios de Aceitação:**
    * O relatório gerado deverá seguir obrigatoriamente a estrutura contendo as seções: `# Status`, `## Criticidade`, `## Mudanças Identificadas`, `## Gaps Documentais Encontrados` e `## Recomendação`.
    * O texto deverá utilizar linguagem clara e acessível, permitindo a compreensão por profissionais sem perfil estritamente técnico.

### [RF-006] Persistência do Histórico de Auditoria
* **Descrição:** O sistema deverá gravar o resultado completo de cada auditoria realizada em um banco de dados para fins de rastreabilidade e geração de métricas.
* **Ator/Componente:** Sistema Auditor → MongoDB.
* **Critérios de Aceitação:**
    * Cada registro salvo deverá conter: ID do Pull Request, data/hora da execução, relatório Markdown na íntegra, nível de criticidade final e métricas de consumo (tokens e tempo de processamento).
    * O sistema deve garantir que 100% das análises finalizadas com sucesso sejam persistidas.

### [RF-007] Configuração de Parâmetros de Entrada via CLI
* **Descrição:** O usuário deverá conseguir especificar explicitamente os caminhos dos arquivos que serão processados pela ferramenta.
* **Ator/Componente:** Usuário / CLI.
* **Critérios de Aceitação:**
    * A CLI deve aceitar os argumentos `--diff` (caminho do arquivo de diff) e `--docs` (caminho do arquivo ou diretório de documentação).
    * Caso os caminhos informados sejam inválidos ou inexistentes, o sistema deverá encerrar a execução exibindo uma mensagem de erro apropriada.

### [RF-008] Consulta e Inspeção do Histórico
* **Descrição:** O sistema deverá permitir a recuperação e visualização básica das auditorias que foram salvas no banco de dados.
* **Ator/Componente:** Usuário / CLI → MongoDB.
* **Critérios de Aceitação:**
    * A CLI deverá disponibilizar um comando ou parâmetro específico (ex: `--history`) para listar as análises anteriores.
    * A listagem básica deverá exibir na tela, no mínimo: o identificador do PR, a data da execução e a criticidade atribuída.

---

## 2. Requisitos Não Funcionais (RNF)
Os requisitos não funcionais definem os critérios de qualidade, restrições e atributos de comportamento que o sistema deve garantir.

### [RNF-001] Desempenho e Tempo de Resposta
* **Descrição:** O tempo total de processamento da auditoria não deve atrasar o fluxo de desenvolvimento e revisão.
* **Critério de Aceitação:** O fluxo completo de execução da CLI (leitura, análise da IA, geração de relatório e salvamento no banco) não deverá ultrapassar **30 segundos** por Pull Request.

### [RNF-002] Confiabilidade e Tolerância a Falhas (Fallback de LLM)
* **Descrição:** O sistema deverá implementar um mecanismo de redundância entre provedores de IA para balancear custo, velocidade e precisão.
* **Critérios de Aceitação:**
    * O sistema deverá adotar a estratégia *"Groq-first"*, utilizando prioritariamente a API do Groq (Mixtral) para garantir baixa latência e custo reduzido.
    * Caso ocorra uma falha de limite de requisições (Rate Limit) ou indisponibilidade na API do Groq, o sistema deverá realizar um *fallback* automático e transparente para o modelo Claude 3.5 Sonnet.

### [RNF-003] Segurança e Compliance (Falsos Negativos)
* **Descrição:** O sistema deve mitigar o risco de deixar passar alterações de segurança sem a devida sinalização.
* **Critérios de Aceitação:**
    * O sistema deve buscar a meta de **0% de falsos negativos** em tópicos críticos de: Segurança, Infraestrutura, Compliance e Autenticação/Autorização.
    * Em caso de dúvida ou ambiguidade na análise da IA, o sistema deverá priorizar falsos positivos (alertar preventivamente) em vez da omissão de riscos relevantes.

### [RNF-004] Interface e Usabilidade
* **Descrição:** A interface de interação com o usuário na fase de MVP será simplificada e focada em automação.
* **Critérios de Aceitação:**
    * A interação com o sistema deverá ocorrer exclusivamente via linha de comando (CLI).
    * O sistema deverá aceitar os argumentos padronizados: `--diff`, `--docs`, `--output` e `--history`.
    * O resultado final deverá ser exibido diretamente no terminal e/ou exportado em um arquivo físico `.md`.

### [RNF-005] Persistência de Dados
* **Descrição:** Restrição tecnológica sobre o ecossistema de armazenamento histórico.
* **Critério de Aceitação:** Toda a persistência de dados históricos e registros de auditoria do sistema deverá ser realizada obrigatoriamente no banco de dados **MongoDB**.

### [RNF-006] Tratamento de Limite de Contexto das LLMs
* **Descrição:** O sistema deverá ser capaz de tratar adequadamente Pull Requests que contenham um volume elevado de alterações de código.
* **Critérios de Aceitação:**
    * Caso o arquivo de diff ultrapasse o limite de contexto suportado pelo Groq Mixtral (32k), o sistema deverá adotas uma das seguintes ações tratadas em código:
        1. Truncar o conteúdo de forma segura e alertar o usuário sobre a limitação; ou
        2. Redirecionar automaticamente o processamento completo para o Claude 3.5 Sonnet, aproveitando a sua maior janela de contexto (200k).

### [RNF-007] Eficiência Financeira
* **Descrição:** O sistema deverá operar com um custo financeiro sustentável por análise realizada.
* **Critério de Aceitação:** O custo médio de consumo de tokens por auditoria deverá permanecer **abaixo de R$ 0,10** nos cenários padrão do MVP utilizando a estratégia combinada de IA.
