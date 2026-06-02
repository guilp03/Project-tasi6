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

Se `MONGODB_URI` não estiver definida, a análise **continua normalmente** —
apenas uma mensagem informativa é impressa no console:

```
[MongoDB] MONGODB_URI not set — skipping persistence.
```

Se a variável estiver definida mas a conexão falhar, um aviso é emitido:

```
[MongoDB] Persistence unavailable: connect ECONNREFUSED 127.0.0.1:27017
```

O resultado da análise é sempre exibido, independentemente do estado do banco.

---

## 5. Operações disponíveis (CRUD completo)

A classe `AnalysisRepository` expõe as seguintes operações:

### `save(record): Promise<string>`
Persiste um `AnalysisRecord` e retorna o id (`ObjectId` como string hex).

```typescript
const id = await repository.save(record);
// id => "665f1a2b3c4d5e6f7a8b9c0d"
```

### `findRecent(limit?): Promise<AnalysisRecord[]>`
Retorna os registros mais recentes, ordenados por `createdAt` decrescente.
O parâmetro `limit` tem valor padrão 10.

```typescript
const recent = await repository.findRecent();     // últimos 10
const last5  = await repository.findRecent(5);    // últimos 5
```

### `findById(id): Promise<AnalysisRecord | null>`
Busca um registro pelo seu ObjectId. Retorna `null` se não encontrado ou
se o `id` for inválido.

```typescript
const record = await repository.findById("665f1a2b3c4d5e6f7a8b9c0d");
if (record) {
  console.log(record.analysis.status);
}
```

### `update(id, patch): Promise<AnalysisRecord | null>`
Atualiza campos do sub-documento `analysis` de um registro existente.
Apenas campos de `analysis` podem ser modificados — os campos imutáveis
(`repository`, `pullRequest`, `llm`, `routing`, `createdAt`) não são alterados.
Retorna o registro atualizado, ou `null` se o id não existir.

```typescript
const updated = await repository.update(id, {
  status: "OK",
  requiresDocsUpdate: false,
  recommendations: ["No action needed"],
});
```

### `deleteById(id): Promise<boolean>`
Remove um registro pelo id. Retorna `true` se deletado, `false` se não
encontrado ou id inválido.

```typescript
const deleted = await repository.deleteById(id);
if (deleted) {
  console.log("Record removed.");
}
```

---

## 6. Índices criados automaticamente

O schema Mongoose cria dois índices para melhorar a performance de consultas:

| Índice | Propósito |
|---|---|
| `{ createdAt: -1 }` | Ordena registros do mais recente ao mais antigo |
| `{ repository: 1, createdAt: -1 }` | Filtra por repositório com ordenação temporal |

---

## 7. Validar que os dados estão sendo salvos

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

## 8. Executar os testes de persistência

Os testes utilizam `mongodb-memory-server` e **não dependem de nenhum MongoDB
externo** — um servidor em memória é iniciado automaticamente.

```bash
npm test
```

Para rodar apenas os testes de persistência:

```bash
npx vitest run tests/persistence.test.ts
```

Os testes cobrem todas as operações CRUD:
- `save()` — persistir e retornar id
- `findRecent()` — listar com limite e ordenação
- `findById()` — busca por id (incluindo ids inválidos)
- `update()` — atualização parcial do sub-documento `analysis`
- `deleteById()` — remoção com verificação de não-existência
