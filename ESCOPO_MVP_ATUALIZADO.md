# Escopo MVP — Auditoria Automatizada de Documentação com IA

**Projeto:** Documentação Automatizada com IA  
**Domínio:** D3 — Documentação Automatizada  
**Checkpoint:** CP1/CP2 — Exposição e Composição  
**Versão:** 1.1  

---

## 1. Objetivo do MVP

O MVP será uma ferramenta inicial de **auditoria automatizada de documentação em Pull Requests**, executada via **CLI** e pensada para integração futura com **GitHub Actions**.

A aplicação deverá analisar informações de um Pull Request, identificar mudanças relevantes no código, comparar essas mudanças com a documentação existente e gerar um relatório estruturado indicando possíveis gaps documentais.

Além disso, o MVP passa a incluir o armazenamento do **histórico de análises em um MongoDB simples**, permitindo registrar os resultados gerados pela ferramenta para consulta futura, comparação de execuções e evolução posterior do sistema.

O objetivo principal é validar se uma solução assistida por IA consegue reduzir o esforço manual de auditoria documental feito por PMOs, reviewers e desenvolvedores.

---

## 2. Problema que o MVP resolve

Em projetos de software, Pull Requests frequentemente alteram funcionalidades, APIs, configurações, infraestrutura ou regras de segurança. Porém, essas mudanças nem sempre são refletidas corretamente na documentação do projeto.

Esse problema gera:

- documentação desatualizada;
- atrasos na aprovação de Pull Requests;
- dependência de desenvolvedores para validação técnica;
- maior risco em releases;
- dificuldade para PMOs e reviewers identificarem impactos documentais.

O MVP busca atuar como um primeiro filtro automatizado, indicando quando uma mudança provavelmente exige atualização documental.

---

## 3. Usuários-alvo

### 3.1 Usuário primário — PMO / Project Manager / Reviewer

Profissional responsável por revisar se a documentação está adequada antes da aprovação de uma release. Precisa de uma visão rápida e clara sobre possíveis pendências documentais, sem depender totalmente de desenvolvedores.

### 3.2 Usuário secundário — Developer

Profissional que abre Pull Requests e precisa receber feedback sobre quais partes da documentação devem ser atualizadas para evitar retrabalho e atrasos na aprovação.

### 3.3 Usuário complementar — Security / Compliance

Profissional interessado em mudanças sensíveis, principalmente envolvendo autenticação, autorização, infraestrutura, variáveis de ambiente e dados sensíveis.

---

## 4. Fluxo principal do MVP

```text
Usuário fornece dados de um Pull Request
        ↓
Sistema identifica arquivos alterados e mudanças relevantes
        ↓
IA analisa o impacto das mudanças
        ↓
IA compara mudanças com a documentação existente
        ↓
Sistema detecta possíveis gaps documentais
        ↓
Sistema classifica criticidade
        ↓
Sistema gera relatório estruturado em Markdown
        ↓
Sistema armazena a análise no MongoDB
        ↓
Usuário consulta o relatório gerado
```

---

## 5. Funcionalidades que entram no MVP

### 5.1 Entrada estruturada de Pull Request

A ferramenta deverá receber dados básicos de um Pull Request, inicialmente via CLI ou arquivo estruturado.

A entrada mínima deve conter:

- título do Pull Request;
- descrição do Pull Request;
- lista de arquivos alterados;
- diff ou resumo das mudanças;
- documentação existente relacionada, como README, documentação de API ou arquivo Markdown.

A integração automática com GitHub Actions pode ser preparada na arquitetura, mas não precisa estar completa no primeiro MVP funcional.

---

### 5.2 Extração de mudanças relevantes

A aplicação deverá usar IA para analisar o diff ou resumo do Pull Request e extrair apenas mudanças com impacto semântico ou estrutural.

Exemplos de mudanças relevantes:

- novos endpoints;
- alteração em regra de negócio;
- mudança em schema ou contrato de API;
- alteração em autenticação ou autorização;
- mudança em configuração ou infraestrutura;
- adição de variável de ambiente;
- alteração em fluxo de instalação ou execução.

Mudanças puramente estéticas, renomeações internas sem impacto externo ou refatorações simples devem ser classificadas como baixa prioridade ou sem necessidade documental.

---

### 5.3 Detecção de gaps documentais

A aplicação deverá comparar as mudanças relevantes com a documentação fornecida e indicar possíveis lacunas.

Exemplo:

> O Pull Request adiciona a variável de ambiente `JWT_SECRET`, mas o README não contém instruções sobre essa configuração.

O foco do MVP é **detectar e explicar gaps documentais**, não corrigir automaticamente a documentação.

---

### 5.4 Classificação de criticidade

Cada gap ou alerta deverá receber uma classificação simples de criticidade.

| Criticidade | Significado |
|---|---|
| Baixa | Mudança pequena ou com baixo impacto documental |
| Média | Mudança que pode exigir atualização de documentação |
| Alta | Mudança relevante sem documentação correspondente |
| Crítica | Mudança envolvendo segurança, autenticação, infraestrutura ou compliance |

Mudanças relacionadas a autenticação, autorização, infraestrutura, secrets, variáveis de ambiente ou dados sensíveis devem receber atenção especial.

---

### 5.5 Geração de relatório estruturado

A saída do MVP deverá ser um relatório em Markdown contendo:

- status da análise;
- resumo das mudanças identificadas;
- gaps documentais encontrados;
- criticidade;
- justificativa da IA;
- recomendação para PMO ou desenvolvedor;
- indicação de necessidade ou não de atualização documental.

Exemplo de saída:

```md
# Relatório de Auditoria de Documentação

## Status
Atenção necessária

## Criticidade
Alta

## Mudanças identificadas
- Novo endpoint `POST /api/v1/auth/login`.
- Nova regra de autenticação baseada em token JWT.

## Gaps documentais encontrados
- A documentação da API não descreve o novo endpoint.
- O README não explica a nova configuração de autenticação.

## Recomendação
Atualizar a documentação de API e a seção de autenticação antes da aprovação do Pull Request.
```

---

### 5.6 Armazenamento do histórico de análises no MongoDB

O MVP deverá armazenar cada análise realizada em um banco **MongoDB simples**, usando uma estrutura flexível em JSON.

O objetivo do armazenamento é permitir:

- manter histórico das análises executadas;
- consultar resultados anteriores;
- comparar padrões de gaps recorrentes;
- registrar metadata de execução;
- preparar base para aprendizado futuro por feedback.

Cada documento salvo no MongoDB deve conter, no mínimo:

```json
{
  "repository": "nome-do-repositorio",
  "pullRequest": {
    "id": "123",
    "title": "Adicionar login com JWT",
    "author": "developer"
  },
  "analysis": {
    "status": "Atenção necessária",
    "criticality": "Alta",
    "detectedChanges": [],
    "documentationGaps": [],
    "recommendations": []
  },
  "llm": {
    "provider": "Groq ou Claude",
    "model": "modelo-utilizado",
    "inputTokens": 0,
    "outputTokens": 0,
    "estimatedCost": 0
  },
  "createdAt": "timestamp-da-analise"
}
```

Neste MVP, o MongoDB será usado apenas para persistência básica. Não faz parte do MVP criar dashboard, analytics avançado ou sistema de feedback automático.

---

## 6. O que fica fora do MVP

Para manter o escopo viável, ficam fora da primeira versão:

- dashboard web;
- autenticação de usuários;
- sistema completo de permissões;
- correção automática da documentação;
- geração automática de Pull Request com documentação corrigida;
- análise completa de qualidade de código;
- suporte robusto a múltiplas linguagens;
- análise de repositórios muito grandes;
- feedback learning automático com base no histórico;
- visualização avançada dos dados armazenados no MongoDB;
- integração obrigatória com Slack ou e-mail;
- substituição da revisão humana.

A ferramenta não pretende ser um code reviewer completo. Ela atua como apoio à auditoria documental.

---

## 7. Arquitetura mínima do MVP

A arquitetura mínima será composta por:

| Componente | Responsabilidade |
|---|---|
| CLI / Entry Point | Receber entrada do PR e orquestrar o fluxo |
| Documentation Analyzer | Interpretar mudanças e preparar contexto para IA |
| LLM Integration | Enviar prompts para o modelo e tratar respostas |
| Report Generator | Gerar relatório estruturado em Markdown |
| MongoDB Persistence | Salvar histórico da análise em JSON |

A integração com GitHub API e GitHub Actions pode ser implementada progressivamente. No MVP, é aceitável simular a entrada de PR para validar o fluxo central da solução.

---

## 8. Critérios de sucesso do MVP

O MVP será considerado bem-sucedido se conseguir:

- processar pelo menos um Pull Request simulado ou real simplificado;
- identificar mudanças relevantes no código ou infraestrutura;
- detectar pelo menos um gap documental quando ele existir;
- classificar a criticidade da mudança;
- gerar relatório claro em Markdown;
- armazenar a análise no MongoDB;
- permitir recuperação ou inspeção básica do histórico salvo;
- executar o fluxo em tempo compatível com uso em Pull Requests.

---

## 9. Métricas iniciais

| Métrica | Meta inicial |
|---|---|
| Tempo médio de análise por PR | Até 30 segundos |
| Precisão na identificação de gaps | Igual ou superior a 80% nos casos de teste |
| Falsos negativos em segurança | 0 casos críticos não detectados no experimento |
| Custo por análise | Baixo o suficiente para uso recorrente |
| Persistência da análise | 100% das análises salvas com sucesso no MongoDB |
| Clareza do relatório | Compreensível por PMO sem explicação técnica adicional |

---

## 10. Entrega esperada do MVP

Ao final do MVP, a equipe deverá demonstrar:

1. execução da ferramenta com entrada de Pull Request;
2. análise assistida por IA;
3. relatório de gaps documentais;
4. classificação de criticidade;
5. salvamento do resultado no MongoDB;
6. consulta ou visualização básica do registro salvo.

---

## 11. Resumo do escopo

O MVP será uma aplicação CLI de auditoria documental assistida por IA, capaz de analisar mudanças em Pull Requests, detectar possíveis gaps entre código e documentação, classificar criticidade, gerar relatório estruturado e armazenar o histórico das análises em MongoDB.

A primeira versão prioriza validação do fluxo central e utilidade do relatório, deixando integrações avançadas, dashboards e automações completas para versões futuras.
