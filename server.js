'use strict';

/**
 * CRUD de Alunos com Firebase Cloud Firestore
 * Node.js + Express + firebase-admin
 *
 * Modelo da coleção "alunos" (mesmo formato do material da aula):
 *   {
 *     nome:        string,
 *     turma:       string,   // ex.: "3DSB"
 *     dataNascimento: string, // ex.: "2009-05-15" (AAAA-MM-DD)
 *     ativo:       boolean
 *   }
 *
 * Variáveis de ambiente (opcionais):
 *   PORT                            -> porta HTTP (padrão: 3000)
 *   FIREBASE_SERVICE_ACCOUNT_KEY  -> caminho do serviceAccountKey.json
 *   FIREBASE_PROJECT_ID            -> (alternativa ao arquivo) ID do projeto
 *   FIREBASE_CLIENT_EMAIL          -> (alternativa ao arquivo) client_email
 *   FIREBASE_PRIVATE_KEY           -> (alternativa ao arquivo) private_key
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const admin = require('firebase-admin');

/* ------------------------------------------------------------------ */
/* Conexão com o Firebase                                              */
/* ------------------------------------------------------------------ */

const SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || path.join(__dirname, 'serviceAccountKey.json');

function loadServiceAccount() {
  const parsed = fs.existsSync(SERVICE_ACCOUNT_PATH)
    ? JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
    : null;

  const serviceAccount = parsed
    ? {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }
    : {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : undefined,
      };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('\n[erro] Credenciais do Firebase não encontradas.');
    console.error('        Crie o arquivo "serviceAccountKey.json" na raiz do projeto');
    console.error('        (copie o "serviceAccountKey.example.json") e reinicie.');
    console.error('        Ou configure as variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.\n');
    process.exit(1);
  }

  return serviceAccount;
}

const serviceAccount = loadServiceAccount();
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const alunosCollection = db.collection('alunos');

/* ------------------------------------------------------------------ */
/* Express                                                             */
/* ------------------------------------------------------------------ */

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------------------------------------------ */
/* Validação                                                          */
/* ------------------------------------------------------------------ */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeText(value, field, { required = false, maxLength = 60 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `O campo "${field}" é obrigatório.`);
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, `O campo "${field}" deve ser texto.`);
  const clean = value.trim();
  if (required && clean.length === 0) throw new HttpError(400, `O campo "${field}" é obrigatório.`);
  if (clean.length > maxLength) throw new HttpError(400, `O campo "${field}" deve ter no máximo ${maxLength} caracteres.`);
  return clean;
}

function sanitizeBoolean(value, field, { required = false, fallback = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `O campo "${field}" é obrigatório.`);
    return fallback;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'sim', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'nao', 'não', 'no'].includes(normalized)) return false;
  throw new HttpError(400, `O campo "${field}" deve ser booleano (true/false).`);
}

function sanitizeDate(value, field = 'dataNascimento') {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !DATE_REGEX.test(value.trim())) {
    throw new HttpError(400, `O campo "${field}" deve estar no formato AAAA-MM-DD (ex.: 2009-05-15).`);
  }
  const [ano, mes, dia] = value.trim().split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
    throw new HttpError(400, `O campo "${field}" é uma data inválida.`);
  }
  return value.trim();
}

/** Valida e normaliza o payload de aluno. Com `partial: true`, só os campos enviados são validados/retornados. */
function parseAlunoPayload(body, { partial = false } = {}) {
  const payload = body && typeof body === 'object' ? body : {};
  const aluno = {};

  const has = (field) => !partial || field in payload;

  if (has('nome')) {
    aluno.nome = sanitizeText(payload.nome, 'nome', { required: true, maxLength: 60 });
    if (aluno.nome.length < 2) throw new HttpError(400, 'Informe um nome com pelo menos 2 caracteres.');
  }

  if (has('turma')) {
    aluno.turma = sanitizeText(payload.turma, 'turma', { required: true, maxLength: 10 });
  }

  if (has('dataNascimento')) {
    aluno.dataNascimento = sanitizeDate(payload.dataNascimento);
  }

  if (has('ativo')) {
    aluno.ativo = sanitizeBoolean(payload.ativo, 'ativo', { required: false, fallback: true });
  }

  return aluno;
}

/** Monta a resposta de um aluno document, convertendo Timestamp -> ISO string. */
function toAluno(id, data) {
  const aluno = { id, ...(data || {}) };
  if (aluno.criadoEm && typeof aluno.criadoEm.toDate === 'function') {
    aluno.criadoEm = aluno.criadoEm.toDate().toISOString();
  }
  return aluno;
}

/* ------------------------------------------------------------------ */
/* Rotas da API                                                        */
/* ------------------------------------------------------------------ */

const api = express.Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'crud-firestore-alunos', timestamp: new Date().toISOString() });
});

/** CREATE — cadastra um aluno na coleção "alunos". */
api.post('/alunos', asyncHandler(async (req, res) => {
  const aluno = parseAlunoPayload(req.body, { partial: false });

  const ref = alunosCollection.doc();
  await ref.set({ ...aluno, criadoEm: admin.firestore.FieldValue.serverTimestamp() });

  const created = await ref.get();
  res.status(201).json(toAluno(created.id, created.data()));
}));

/** READ — lista alunos, com filtros opcionais (?turma=3DSB e/ou ?dataNascimento=2009-05-15). */
api.get('/alunos', asyncHandler(async (req, res) => {
  const { turma, dataNascimento } = req.query;

  let query = alunosCollection;
  const constraints = [];

  if (turma) {
    constraints.push({ field: 'turma', value: String(turma).trim() });
  }
  if (dataNascimento) {
    constraints.push({ field: 'dataNascimento', value: String(dataNascimento).trim() });
  }

  for (const c of constraints) {
    query = query.where(c.field, '==', c.value);
  }

  const snapshot = await query.orderBy('nome', 'asc').get();
  const alunos = snapshot.docs.map((doc) => toAluno(doc.id, doc.data()));

  res.json({ total: alunos.length, alunos });
}));

/** READ — um aluno pelo id. */
api.get('/alunos/:id', asyncHandler(async (req, res) => {
  const aluno = await alunosCollection.doc(req.params.id).get();
  if (!aluno.exists) throw new HttpError(404, 'Aluno não encontrado.');
  res.json(toAluno(aluno.id, aluno.data()));
}));

/** UPDATE — atualiza (parcial) um aluno. */
api.put('/alunos/:id', asyncHandler(async (req, res) => {
  const alunoRef = alunosCollection.doc(req.params.id);
  const atual = await alunoRef.get();
  if (!atual.exists) throw new HttpError(404, 'Aluno não encontrado.');

  const dados = parseAlunoPayload(req.body, { partial: true });
  if (Object.keys(dados).length === 0) {
    throw new HttpError(400, 'Envie ao menos um campo para atualizar (nome, turma, dataNascimento ou ativo).');
  }

  await alunoRef.update(dados);
  const updated = await alunoRef.get();
  res.json(toAluno(updated.id, updated.data()));
}));

/** DELETE — exclui um aluno. */
api.delete('/alunos/:id', asyncHandler(async (req, res) => {
  const alunoRef = alunosCollection.doc(req.params.id);
  const atual = await alunoRef.get();
  if (!atual.exists) throw new HttpError(404, 'Aluno não encontrado.');

  await alunoRef.delete();
  res.status(204).end();
}));

app.use('/api', api);

/* ------------------------------------------------------------------ */
/* Tratamento de erros                                                 */
/* ------------------------------------------------------------------ */

app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Rota não encontrada.' } });
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: { message: err.message || 'Erro interno do servidor.' } });
});

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

const server = app.listen(PORT, () => {
  console.log(`\n  CRUD Alunos (Firestore) rodando em http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api/alunos\n`);
});

function shutdown(signal) {
  console.log(`\n[server] ${signal} recebido, encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
