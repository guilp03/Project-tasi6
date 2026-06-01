# Persistência MongoDB — PR Documentation Auditor

Este documento descreve como configurar, validar e consultar a persistência
de histórico de análises no MongoDB.

---

## 1. Pré-requisitos

- Docker instalado (recomendado para ambiente local), **ou** uma instância
  MongoDB acessível via URI.
- Node.js ≥ 18.

---

## 2. Subir o MongoDB local com Docker

```bash
docker run -d \
  --name pr-auditor-mongo \
  -p 27017:27017 \
  mongo:7
```

Para parar o container:

```bash
docker stop pr-auditor-mongo
```

Para remover:

```bash
docker rm pr-auditor-mongo
```

---

## 3. Variável de ambiente

Copie `.env.example` para `.env` e preencha os valores:

```bash
cp .env.example .env
```

A variável relevante para persistência:

```env
MONGODB_URI=mongodb://localhost:27017/pr-auditor
```

O campo `MONGODB_URI` aceita qualquer URI de conexão válida do MongoDB,
incluindo instâncias remotas com autenticação:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/pr-auditor
```

---

## 4. Comportamento quando o MongoDB está indisponível

Se `MONGODB_URI` não estiver definida, ou se a conexão falhar, a análise
**continua normalmente** — apenas um aviso é impresso no console:

```
[MongoDB] Persistence unavailable: connect ECONNREFUSED 127.0.0.1:27017
```

O resultado da análise é sempre exibido, independentemente do estado do banco.

---

## 5. Validar que os dados estão sendo salvos

### Via mongo shell (Docker)

```bash
docker exec -it pr-auditor-mongo mongosh pr-auditor
```

Dentro do shell:

```js
// Listar todos os registros (mais recente primeiro)
db.analyses.find().sort({ createdAt: -1 }).pretty()

// Contar registros
db.analyses.countDocuments()

// Ver apenas campos de resumo
db.analyses.find({}, {
  repository: 1,
  "pullRequest.title": 1,
  "analysis.status": 1,
  "analysis.criticality": 1,
  createdAt: 1
}).sort({ createdAt: -1 })
```

### Via Compass (GUI)

1. Abra [MongoDB Compass](https://www.mongodb.com/products/compass).
2. Conecte com `mongodb://localhost:27017`.
3. Navegue até o banco **pr-auditor** → coleção **analyses**.

---

## 6. Consultar registros via código

```typescript
import { AnalysisRepository } from "./src/services/persistence/AnalysisRepository.js";

const repo = new AnalysisRepository();

// Últimos 10 registros (padrão)
const recent = await repo.findRecent();

// Últimos 5 registros
const last5 = await repo.findRecent(5);
```

Os registros são retornados ordenados por `createdAt` decrescente
(mais recentes primeiro), respeitando o tipo `AnalysisRecord`.

---

## 7. Executar os testes de persistência

Os testes utilizam `mongodb-memory-server` e **não dependem de nenhum MongoDB
externo** — um servidor em memória é iniciado automaticamente.

```bash
npm test
```

Para rodar apenas os testes de persistência:

```bash
npx vitest run tests/persistence.test.ts
```
