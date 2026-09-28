'use strict';

// Testa a aplicação já em execução, via HTTP. Roda no pipeline depois de cada
// deploy, em homologação e em produção.

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

let passou = 0;
let falhou = 0;

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    ...opcoes,
    signal: AbortSignal.timeout(5000),
  });
  const texto = await resposta.text();
  const ehJson = (resposta.headers.get('content-type') || '').includes('application/json');

  return {
    status: resposta.status,
    headers: resposta.headers,
    corpo: texto && ehJson ? JSON.parse(texto) : null,
    texto,
  };
}

async function teste(nome, fn) {
  try {
    await fn();
    passou += 1;
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    falhou += 1;
    console.log(`  FALHOU  ${nome}`);
    console.log(`         ${erro.message}`);
  }
}

function conferir(condicao, mensagem) {
  if (!condicao) {
    throw new Error(mensagem);
  }
}

async function esperarSubir() {
  for (let tentativa = 1; tentativa <= 30; tentativa += 1) {
    try {
      const { status } = await chamar('/health');
      if (status === 200) {
        return;
      }
    } catch {
      // servidor ainda não respondeu
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`A aplicação não respondeu em ${BASE_URL}.`);
}

function amanha() {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  return data.toISOString().slice(0, 10);
}

async function main() {
  console.log(`\nSmoke tests em ${BASE_URL}\n`);
  await esperarSubir();

  await teste('GET /health responde ok', async () => {
    const { status, corpo } = await chamar('/health');
    conferir(status === 200, `status ${status}`);
    conferir(corpo.status === 'ok', `status "${corpo.status}"`);
    console.log(`       versão ${corpo.versao} · ambiente ${corpo.ambiente}`);
  });

  await teste('a página do sistema é servida na raiz', async () => {
    const { status, texto } = await chamar('/');
    conferir(status === 200, `status ${status}`);
    conferir(texto.includes('Reserva de Salas de Estudo'), 'HTML inesperado na raiz');
  });

  await teste('cabeçalhos de segurança do Helmet estão presentes', async () => {
    const { headers } = await chamar('/health');
    conferir(headers.get('x-content-type-options') === 'nosniff', 'falta X-Content-Type-Options');
    conferir(headers.get('x-powered-by') === null, 'X-Powered-By não deveria aparecer');
  });

  await teste('GET /api/salas lista as salas', async () => {
    const { status, corpo } = await chamar('/api/salas');
    conferir(status === 200, `status ${status}`);
    conferir(corpo.length > 0, 'nenhuma sala retornada');
  });

  const matricula = String(Math.floor(10000000 + Math.random() * 89999999));
  let reservaId = null;

  await teste('POST /api/reservas cria uma reserva', async () => {
    const { status, corpo } = await chamar('/api/reservas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        salaId: 'C-310',
        aluno: 'Teste do Pipeline',
        matricula,
        data: amanha(),
        inicio: '08:00',
        fim: '09:00',
      }),
    });
    conferir(status === 201, `status ${status} — ${JSON.stringify(corpo)}`);
    reservaId = corpo.id;
  });

  await teste('GET /api/agenda mostra a reserva criada', async () => {
    const { corpo } = await chamar(`/api/agenda?data=${amanha()}`);
    const sala = corpo.salas.find((s) => s.id === 'C-310');
    conferir(
      sala.reservas.some((r) => r.id === reservaId),
      'a reserva não apareceu na agenda'
    );
  });

  await teste('reservar o mesmo horário devolve 409', async () => {
    const { status } = await chamar('/api/reservas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        salaId: 'C-310',
        aluno: 'Outro Aluno',
        matricula: '99999999',
        data: amanha(),
        inicio: '08:00',
        fim: '09:00',
      }),
    });
    conferir(status === 409, `status ${status}`);
  });

  await teste('dados inválidos devolvem 400', async () => {
    const { status } = await chamar('/api/reservas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ salaId: 'C-310', aluno: 'X', matricula: '1' }),
    });
    conferir(status === 400, `status ${status}`);
  });

  await teste('DELETE /api/reservas/:id cancela a reserva', async () => {
    const { status } = await chamar(`/api/reservas/${reservaId}`, { method: 'DELETE' });
    conferir(status === 204, `status ${status}`);
  });

  console.log(`\n${passou} passaram, ${falhou} falharam.\n`);

  if (falhou > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error(`\nErro ao rodar os smoke tests: ${erro.message}\n`);
  process.exitCode = 1;
});
