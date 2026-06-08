# Relatorio de Seguranca da Aplicacao

## 1. Introducao

Este relatorio apresenta uma avaliacao de seguranca da aplicacao **PR Documentation Auditor**, com foco em **Application Security** e no uso da ferramenta em um ambiente de CI/CD. A aplicacao e uma CLI em Node.js e TypeScript que extrai informacoes de Pull Requests, envia diffs e documentacao para provedores externos de LLM, gera um relatorio Markdown e persiste o resultado em MongoDB para consulta historica.

A analise considera nao apenas o codigo-fonte da aplicacao, mas tambem o ambiente operacional no qual ela sera executada. Essa decisao e relevante porque os principais riscos da solucao nao estao restritos a falhas classicas de codigo. A ferramenta manipula codigo privado, segredos de ambiente, conteudo de Pull Requests, relatorios de auditoria e integracoes externas. Portanto, a superficie de ataque inclui GitHub Actions, permissoes do `GITHUB_TOKEN`, provedores de LLM, MongoDB, artefatos de pipeline e publicacao automatica de comentarios em PRs.

## 2. Contexto e Premissas

As seguintes premissas foram consideradas para esta avaliacao:

- A ferramenta sera executada em pipeline CI/CD.
- O runner recomendado e adotado sera **GitHub-hosted runner**.
- Os repositorios auditados sao **privados**, **proprios** e **confiaveis**.
- Diffs, documentacoes, relatorios e historico podem conter dados sensiveis.
- O envio de codigo privado para Groq/Gemini e permitido, desde que sejam adotados controles de seguranca.
- A ferramenta deve comentar automaticamente no Pull Request.
- Comentarios publicados em PR, Jira ou Confluence devem conter apenas resumo sanitizado.
- Detalhes sensiveis devem permanecer apenas em MongoDB ou artefato restrito.
- Achados de criticidade **Critica** devem falhar o job e bloquear o merge.
- A liberacao apos bloqueio critico deve exigir double check humano por Tech Lead, Security Champion ou AppSec.
- Caso um secret apareca no diff, a criticidade deve ser considerada **Critica**.
- Vulnerabilidades `high` ou `critical` em dependencias npm devem falhar o pipeline.
- O MongoDB e obrigatorio para trilha historica de auditoria.
- PMO e auditoria podem consultar o historico em modo somente leitura.
- Ninguem deve modificar ou apagar historico manualmente, para preservar a veracidade dos fatos.
- O prazo recomendado de retencao e 12 meses para historico e relatorios sanitizados.
- Diffs brutos e `pr-corpus.json` devem ser descartados ou retidos por no maximo 7 a 30 dias.

## 3. Arquitetura de Seguranca Observada

A aplicacao possui quatro fluxos principais:

1. **Extracao do Pull Request:** o servico `GitHubExtractorService` consulta a API do GitHub usando `GITHUB_TOKEN` e gera um corpus contendo metadados do PR e patches dos arquivos alterados.
2. **Analise por LLM:** o servico `LLMIntegrationService` le o corpus e a documentacao, monta um prompt e envia o conteudo para Groq ou Gemini.
3. **Geracao de relatorio:** `ReportGenerator` transforma o resultado da analise em Markdown.
4. **Persistencia:** `AnalysisRepository` salva o registro da auditoria em MongoDB e permite consulta posterior pelo comando `history`.

O projeto ja apresenta algumas decisoes positivas de seguranca, como validacao da presenca de variaveis de ambiente obrigatorias, roteamento de PRs sensiveis para Gemini, uso de JSON estruturado na resposta da LLM e exclusao temporaria do corpus no fluxo `fetch-and-audit` quando `--keep-corpus` nao e usado. Entretanto, ainda existem lacunas importantes quando a aplicacao e analisada sob uma perspectiva de AppSec e governanca.

## 4. Dados Sensiveis e Classificacao

Como a ferramenta audita repositorios privados, todo conteudo processado deve ser tratado como potencialmente sensivel. Isso inclui:

- codigo proprietario;
- regras de negocio;
- nomes de servicos internos;
- URLs privadas;
- tokens, senhas, API keys e connection strings;
- configuracoes de CI/CD;
- detalhes de autenticacao, autorizacao e infraestrutura;
- dados pessoais eventualmente presentes em exemplos, fixtures, logs ou documentacao.

Sob a LGPD, a retencao de dados deve respeitar finalidade, necessidade e descarte ao final do tratamento. A LGPD tambem permite conservacao em hipoteses como cumprimento de obrigacao legal ou regulatoria, mas isso nao autoriza retencao indefinida sem justificativa. Sob ISO 27001, registros devem ser protegidos contra perda, alteracao, destruicao indevida, acesso nao autorizado e divulgacao nao autorizada. Assim, a trilha de auditoria deve existir, mas deve ser minimizada, protegida e mantida por prazo definido.

## 5. Achados de Seguranca

### AS-01: Ausencia de mascaramento antes do envio para LLM

**Severidade:** Alta

O projeto identifica arquivos potencialmente sensiveis por padroes como `.env`, `secret`, `password`, `api_key`, `token`, `credential`, `auth`, infraestrutura e CI/CD. Essa deteccao e usada para roteamento do provedor de LLM. Entretanto, nao ha evidencia de uma etapa de redaction ou mascaramento antes da montagem do prompt.

No fluxo atual, `GitHubExtractorService` inclui `file.patch` diretamente no campo `diff` do corpus. Em seguida, `buildAuditPrompt` inclui os diffs no prompt enviado a Groq ou Gemini. Portanto, se um PR introduzir acidentalmente um token, senha, URI de banco ou chave privada, esse valor pode ser enviado para um provedor externo de LLM.

**Risco:** exposicao de segredos, codigo privado ou informacoes internas para terceiros; persistencia posterior de informacoes sensiveis em relatorios ou historico.

**Recomendacao:** implementar uma etapa obrigatoria de sanitizacao antes da chamada a LLM, cobrindo tokens, senhas, connection strings, JWTs, chaves privadas, certificados, credenciais em URL e variaveis sensiveis. Caso um secret seja detectado no diff, a ferramenta deve classificar como **Critica**, falhar o pipeline e exigir revisao humana.

### AS-02: Criticidade Critica nao falha automaticamente o job

**Severidade:** Alta

O requisito operacional definido para o projeto e que achados de criticidade **Critica** devem bloquear o merge e falhar o job. No codigo atual, o comando `audit` e o comando `fetch-and-audit` imprimem status e criticidade no terminal, mas nao ha evidencia de `process.exit(1)` quando `record.analysis.criticality === "Critica"`.

**Risco:** um PR critico pode receber relatorio de alerta, mas o pipeline continuar verde, permitindo merge sem double check humano.

**Recomendacao:** apos gerar e persistir a auditoria, a CLI deve falhar quando a criticidade for `Critica`. A liberacao deve ocorrer apenas por processo controlado, com aprovacao de Tech Lead, Security Champion ou AppSec.

### AS-03: Persistencia MongoDB opcional conflita com requisito de auditoria

**Severidade:** Alta

O historico em MongoDB foi definido como requisito de auditoria. Entretanto, no comando `audit`, a persistencia ocorre apenas se `MONGODB_URI` estiver definida. Alem disso, se a persistencia falhar, a aplicacao registra um `console.warn` e continua.

**Risco:** o pipeline pode concluir sem registro historico, criando lacuna de auditoria e prejudicando rastreabilidade.

**Recomendacao:** em CI/CD, `MONGODB_URI` deve ser obrigatoria. Falhas de conexao, validacao ou escrita no MongoDB devem falhar o job. Para execucao local, pode existir modo opcional, mas ele deve ser explicitamente separado do modo CI.

### AS-04: Historico nao e estritamente imutavel

**Severidade:** Alta

O requisito definido e que ninguem consiga modificar o historico para preservar a veracidade dos fatos. Entretanto, `AnalysisRepository` possui metodos `update` e `deleteById`. Mesmo que nao estejam expostos diretamente pela CLI atual, a presenca desses metodos indica que a camada de persistencia permite alteracao e remocao de registros.

**Risco:** alteracao indevida, acidental ou maliciosa de evidencias de auditoria.

**Recomendacao:** transformar o historico em modelo append-only. A identidade usada pelo CI/CD deve ter permissao de insercao e leitura limitada, sem `update` e sem `delete`. PMO/auditoria devem usar usuario somente leitura. O projeto tambem pode adicionar hash do registro, encadeamento de hashes ou assinatura para detectar adulteracao.

### AS-05: Publicacao automatica de relatorio pode expor detalhes sensiveis

**Severidade:** Alta

O projeto deve comentar automaticamente no PR e tambem pode publicar resultados em Jira ou Confluence. O `ReportGenerator` inclui mudancas identificadas, gaps, justificativa, repositorio, PR, provedor, modelo e tokens. Embora o relatorio atual nao inclua o diff completo, gaps e justificativas gerados pela LLM podem reproduzir trechos sensiveis ou mencionar nomes internos.

**Risco:** exposicao de informacoes sensiveis em comentarios de PR, Jira, Confluence ou notificacoes.

**Recomendacao:** gerar dois niveis de saida: um resumo sanitizado para publicacao e um relatorio completo restrito. O comentario no PR deve conter status, criticidade, numero de gaps e recomendacoes de alto nivel, sem segredos, diffs, URLs internas ou trechos de codigo sensivel.

### AS-06: Risco de prompt injection por conteudo de PR e documentacao

**Severidade:** Media/Alta

Mesmo que os repositorios sejam confiaveis, o conteudo do PR e da documentacao ainda deve ser tratado como entrada nao confiavel. Um colaborador pode inserir instrucoes no diff ou na documentacao tentando manipular a LLM, por exemplo: "ignore as instrucoes anteriores" ou "retorne sempre OK".

O prompt atual orienta a LLM a retornar JSON valido, mas nao ha isolamento semantico forte entre instrucao do sistema e dados analisados. Tambem nao ha segunda validacao deterministica que force criticidade critica quando arquivos ou padroes sensiveis forem detectados.

**Risco:** falso negativo em analises de seguranca ou documentacao; reducao indevida da criticidade.

**Recomendacao:** reforcar o prompt com delimitacao explicita de dados nao confiaveis e implementar regras deterministicas fora da LLM. Por exemplo: se houver secret detectado no diff, arquivos de auth, `.env`, CI/CD ou infra, a criticidade minima deve ser elevada independentemente da resposta da LLM.

### AS-07: Validacao da resposta da LLM usa fallback seguro apenas parcialmente

**Severidade:** Media

O metodo `parseJSONSafely` valida campos basicos da resposta da LLM. Caso a resposta seja invalida, retorna um resultado padrao com `requires_docs_update: false`, criticidade `Media` e uma recomendacao de revisao manual.

**Risco:** em caso de erro de parsing, a ferramenta pode nao bloquear o pipeline mesmo quando a analise deveria ser inconclusiva. Para um contexto de CI/CD com seguranca, falha de analise deve ser tratada de forma conservadora.

**Recomendacao:** em modo CI, falhas de parsing, resposta vazia ou formato invalido devem gerar estado inconclusivo bloqueante ou criticidade alta/critica, exigindo revisao humana. O principio deve ser "falhar fechado" quando a ferramenta nao conseguir produzir uma analise confiavel.

### AS-08: Permissoes do GitHub Actions precisam ser explicitamente minimas

**Severidade:** Media

A ferramenta precisa ler conteudo do repositorio, consultar Pull Requests e comentar automaticamente no PR. Para isso, recomenda-se usar o `GITHUB_TOKEN` automatico do GitHub Actions com permissoes minimas. Como havera comentario automatico, o workflow provavelmente precisara de permissao de escrita em PRs ou issues, dependendo da estrategia usada pela API.

**Risco:** permissoes excessivas no token do workflow podem permitir alteracao indevida de codigo, PRs, issues ou configuracoes em caso de comprometimento do job.

**Recomendacao:** declarar permissoes no workflow:

```yaml
permissions:
  contents: read
  pull-requests: read
  pull-requests: write
```

Se o comentario for publicado via endpoint de issues, pode ser necessario `issues: write`. Essa permissao deve ser adicionada somente se tecnicamente necessaria. Evitar Personal Access Token manual, pois tende a ser mais duradouro e frequentemente configurado com escopo amplo.

### AS-09: Dependencias npm e supply chain precisam entrar no gate de seguranca

**Severidade:** Media/Alta

O projeto usa dependencias como `commander`, `dotenv`, `mongoose`, `tsx`, `typescript`, `vitest` e `mongodb-memory-server`. Como a ferramenta roda em CI/CD e manipula secrets, uma dependencia comprometida pode impactar o pipeline, roubar variaveis de ambiente ou alterar resultados.

**Risco:** comprometimento de supply chain, execucao de codigo malicioso em pipeline, vazamento de secrets.

**Recomendacao:** incluir `npm audit` ou ferramenta equivalente no pipeline e falhar para vulnerabilidades `high` ou `critical`. Habilitar Dependabot, revisar lockfile, evitar actions sem pinning e monitorar dependencias de desenvolvimento usadas no CI.

### AS-10: Retencao de artefatos brutos deve ser minimizada

**Severidade:** Media

O comando `fetch-and-audit` grava o corpus temporariamente e remove o arquivo ao final quando `--keep-corpus` nao e usado. Esse comportamento e positivo. Entretanto, a opcao `--keep-corpus` pode manter `pr-corpus.json` em `./output`, e o comando `audit` recebe corpus existente como entrada.

**Risco:** retencao prolongada de diffs brutos com codigo privado ou secrets.

**Recomendacao:** em CI/CD, evitar `--keep-corpus` por padrao. Artefatos brutos devem ser descartados imediatamente ou retidos por no maximo 7 a 30 dias em repositorio de artefatos com acesso restrito. O historico de 12 meses deve armazenar apenas dados sanitizados.

## 6. Recomendacoes de Arquitetura Segura

### 6.1 GitHub Actions

O runner recomendado e **GitHub-hosted runner**, pois reduz a carga operacional de seguranca e evita manter uma maquina persistente dentro da rede interna. Como os repositorios sao privados e confiaveis, esse modelo e adequado para o MVP e para o uso padrao.

Recomendacoes:

- usar `GITHUB_TOKEN` automatico;
- declarar permissoes minimas no workflow;
- armazenar `GROQ_API_KEY`, `GEMINI_API_KEY` e `MONGODB_URI` em GitHub Actions Secrets;
- evitar `pull_request_target`, salvo necessidade muito bem justificada;
- nao executar em PRs de forks externos com secrets disponiveis;
- falhar o job para criticidade `Critica`;
- falhar o job para vulnerabilidades npm `high` ou `critical`;
- publicar apenas resumo sanitizado no comentario do PR.

### 6.2 MongoDB

Recomenda-se MongoDB Atlas ou servico equivalente com controles fortes de acesso. Como o runner sera GitHub-hosted, a conexao por rede privada pode elevar a complexidade. Para o MVP, e aceitavel usar MongoDB Atlas com TLS, criptografia em repouso, credenciais fortes, usuario com privilegio minimo e monitoramento. Nao se recomenda liberar o banco indiscriminadamente para `0.0.0.0/0` sem controles compensatorios.

Recomendacoes:

- TLS obrigatorio em transito;
- criptografia em repouso;
- usuario de escrita do CI/CD sem permissao de update/delete;
- usuario de leitura separado para PMO/auditoria;
- backups habilitados;
- logs de auditoria;
- retencao de 12 meses;
- registros sanitizados antes da persistencia;
- modelo append-only;
- hash ou assinatura dos registros para verificacao de integridade.

### 6.3 LLM e Dados

O envio de conteudo para Groq/Gemini e permitido, mas deve ocorrer com reducao de risco. Como o conteudo vem de repositorios privados, recomenda-se minimizar o prompt, mascarar segredos e evitar envio de arquivos claramente sensiveis quando nao forem necessarios para a decisao.

Recomendacoes:

- redaction antes de `buildAuditPrompt`;
- deteccao de secrets no corpus;
- classificacao critica automatica quando secrets forem encontrados;
- evitar persistir respostas que contenham segredos;
- nao publicar detalhes sensiveis em PR/Jira/Confluence;
- registrar apenas metadados necessarios para auditoria.

## 7. Politica de Retencao Recomendada

A politica de retencao deve equilibrar auditoria, minimizacao e protecao de dados.

| Tipo de dado | Retencao recomendada | Justificativa |
| --- | --- | --- |
| `pr-corpus.json` bruto | Nao reter ou reter por 7 a 30 dias | Contem diff e pode conter codigo privado ou secrets |
| Relatorio Markdown sanitizado | 12 meses | Evidencia de auditoria e governanca |
| Registro MongoDB sanitizado | 12 meses | Trilha historica de auditoria |
| Metricas anonimizadas/agregadas | Ate 24 meses | Analise de tendencia sem dados identificaveis |
| Secrets detectados | Nao reter em texto claro | Reduz impacto de vazamento |

Apos o prazo, os registros devem ser eliminados ou anonimizados. Essa abordagem esta alinhada aos principios da LGPD de finalidade, necessidade e eliminacao apos termino do tratamento, bem como ao controle de protecao de registros da ISO 27001.

## 8. Fluxo Recomendado de Bloqueio e Liberacao

Quando a ferramenta identificar criticidade `Critica`, o pipeline deve:

1. gerar relatorio sanitizado;
2. persistir evidencia no MongoDB;
3. comentar resumo sanitizado no PR;
4. falhar o job;
5. bloquear o merge;
6. exigir revisao de Tech Lead, Security Champion ou AppSec;
7. registrar a decisao de liberacao ou correcao no historico.

Se a criticidade critica decorrer de secret no diff, a recomendacao e bloquear imediatamente e tratar como incidente de seguranca potencial, incluindo rotacao do segredo exposto.

## 9. Priorizacao das Acoes

| Prioridade | Acao | Motivo |
| --- | --- | --- |
| P0 | Implementar mascaramento antes da LLM | Evita vazamento de secrets e codigo sensivel |
| P0 | Falhar o job para criticidade Critica | Garante bloqueio efetivo de risco alto |
| P0 | Tornar MongoDB obrigatorio em CI | Preserva trilha de auditoria |
| P0 | Remover ou restringir update/delete do historico | Garante imutabilidade |
| P1 | Criar resumo sanitizado para comentario no PR | Evita exposicao em canais amplos |
| P1 | Falhar fechado em erro de LLM/parsing | Evita falso OK |
| P1 | Adicionar gate de supply chain | Reduz risco de dependencia comprometida |
| P2 | Implementar hash/assinatura de registros | Aumenta garantia de integridade |
| P2 | Definir politica formal de retencao | Sustenta ISO 27001 e LGPD |

## 10. Conclusao

A aplicacao possui uma proposta relevante para governanca de documentacao e seguranca em Pull Requests, mas seu uso em CI/CD com repositorios privados exige controles adicionais. Os principais riscos identificados estao relacionados ao tratamento de dados sensiveis, envio de conteudo para LLM externa, ausencia de mascaramento, persistencia nao obrigatoria, historico ainda mutavel e ausencia de bloqueio automatico para criticidade critica.

Do ponto de vista de Application Security, a prioridade deve ser transformar a ferramenta em um componente confiavel de controle de mudancas: ela deve minimizar dados, proteger segredos, falhar de forma conservadora, preservar evidencias e publicar apenas informacoes sanitizadas. Com as recomendacoes propostas, a aplicacao se aproxima de um modelo adequado para ambientes regulados e para auditorias baseadas em ISO 27001 e LGPD.

## 11. Referencias

- Lei Geral de Protecao de Dados Pessoais, Lei 13.709/2018: https://www.gov.br/mj/pt-br/assuntos/sua-protecao/sedigi/Lei13709.pdf
- GitHub Docs - GITHUB_TOKEN: https://docs.github.com/en/enterprise-server%403.21/actions/concepts/security/github_token
- GitHub Docs - uso seguro do GITHUB_TOKEN: https://docs.github.com/en/actions/configuring-and-managing-workflows/authenticating-with-the-github_token
- GitHub Docs - security hardening for GitHub Actions: https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/security-hardening-for-github-actions
- GitHub Docs - self-hosted runners: https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners
