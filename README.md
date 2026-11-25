# CRUD Alunos — Firebase Cloud Firestore (NoSQL)

Atividade prática de **Banco de Dados NoSQL** — CRUD completo com **Firebase Cloud Firestore**, consumido via **API REST (Node.js + Express + firebase-admin)**.

## Estrutura do projeto

```
crud-firestore-alunos/
├── server.js                          # API REST (CRUD + consultas)
├── package.json
├── .env.example                       # variáveis opcionais de credencial
├── .gitignore                         # ignora serviceAccountKey.json e .env
└── serviceAccountKey.example.json    # modelo do service account (copie e preencha)
```

A coleção no Firestore chama-se **`alunos`**, com documentos no formato:

```json
{
  "nome": "Ana",
  "turma": "3DSB",
  "dataNascimento": "2009-05-15",
  "ativo": true
}
```

## Pré-requisitos

1. **Node.js 22+** (recomendado 24) — `node -v`
2. **Projeto no Firebase** com o **Cloud Firestore** habilitado (modo de teste para a aula).

## Passo a passo no Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um projeto (ou use um já existente).
2. Adicione o **Web App** ao projeto (não precisa de web app para usar o Admin SDK, mas o passo facilita o console).
3. Em **Firestore Database**, clique em **Criar banco de dados** → modo **Produção** ou **Teste** (modo teste recomendado para aula).
4. Em **Project Settings → Service accounts**, clique em **Generate new private key** e baixe o arquivo JSON.
5. Renomeie o arquivo baixado para `serviceAccountKey.json` e coloque **na raiz deste projeto**.
6. Nunca comite esse arquivo no GitHub (o `.gitignore` já o exclui).

## Como rodar

```bash
npm install
npm start
```

A API sobe em `http://localhost:3000`.

Se preferir usar variáveis de ambiente em vez do arquivo:

```bash
export FIREBASE_PROJECT_ID="seu-projeto-id"
export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-...@seu-projeto.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
npm start
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/alunos` | CREATE — cria aluno |
| `GET` | `/api/alunos` | READ — lista alunos (com filtros) |
| `GET` | `/api/alunos/:id` | READ — aluno por id |
| `PUT` | `/api/alunos/:id` | UPDATE — atualiza aluno |
| `DELETE` | `/api/alunos/:id` | DELETE — exclui aluno |

### CREATE — cadastrar aluno

```bash
curl -X POST http://localhost:3000/api/alunos \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Ana",
    "turma": "3DSB",
    "dataNascimento": "2009-05-15",
    "ativo": true
  }'
```

Resposta:

```json
{
  "id": "abc123xyz456",
  "nome": "Ana",
  "turma": "3DSB",
  "dataNascimento": "2009-05-15",
  "ativo": true
}
```

### READ — listar alunos

```bash
# Lista todos
curl http://localhost:3000/api/alunos

# Consulta por turma
curl "http://localhost:3000/api/alunos?turma=3DSB"

# Consulta por data de nascimento (AAAA-MM-DD)
curl "http://localhost:3000/api/alunos?dataNascimento=2009-05-15"
```

Resposta:

```json
{
  "total": 1,
  "alunos": [
    {
      "id": "abc123xyz456",
      "nome": "Ana",
      "turma": "3DSB",
      "dataNascimento": "2009-05-15",
      "ativo": true
    }
  ]
}
```

### READ — aluno por id

```bash
curl http://localhost:3000/api/alunos/abc123xyz456
```

### UPDATE — atualizar aluno

```bash
curl -X PUT http://localhost:3000/api/alunos/abc123xyz456 \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Ana Souza",
    "turma": "3DSB",
    "dataNascimento": "2009-05-15",
    "ativo": true
  }'
```

### DELETE — excluir aluno

```bash
curl -X DELETE http://localhost:3000/api/alunos/abc123xyz456
```

## Exemplo completo com dados fictícios

```bash
# CREATE
curl -X POST http://localhost:3000/api/alunos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana","turma":"3DSB","dataNascimento":"2009-05-15","ativo":true}'

# READ (lista)
curl http://localhost:3000/api/alunos

# READ (por turma)
curl "http://localhost:3000/api/alunos?turma=3DSB"

# READ (por data de nascimento)
curl "http://localhost:3000/api/alunos?dataNascimento=2009-05-15"

# UPDATE
curl -X PUT http://localhost:3000/api/alunos/<ID> \
  -H "Content-Type: application/json" \
  -d '{"nome":"Ana Souza","turma":"3DSB","dataNascimento":"2009-05-15","ativo":true}'

# DELETE
curl -X DELETE http://localhost:3000/api/alunos/<ID>
```

## Entrega

- [ ] Código no GitHub (sem o `serviceAccountKey.json`).
- [ ] Capturas de tela do CRUD e das consultas (turma e data de nascimento).
- [ ] Dados fictícios.
