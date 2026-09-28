'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');

const { criarApp } = require('../src/app');
const { RepositorioReservas } = require('../src/repositorio');

function daquiADias(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

const AMANHA = daquiADias(1);

function novaReserva(alteracoes = {}) {
  return {
    salaId: 'A-101',
    aluno: 'Ana Ribeiro',
    matricula: '20231045',
    data: AMANHA,
    inicio: '14:00',
    fim: '16:00',
    ...alteracoes,
  };
}

describe('API de reservas', () => {
  let pasta;
  let arquivo;
  let repositorio;
  let app;

  beforeEach(() => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'reservas-'));
    arquivo = path.join(pasta, 'reservas.json');
    repositorio = new RepositorioReservas(arquivo);
    app = criarApp({ repositorio });
  });

  afterEach(() => {
    fs.rmSync(pasta, { recursive: true, force: true });
  });

  describe('GET /health', () => {
    it('informa status, versão e ambiente', async () => {
      const resposta = await request(app).get('/health');

      expect(resposta.status).toBe(200);
      expect(resposta.body.status).toBe('ok');
      expect(typeof resposta.body.versao).toBe('string');
      expect(resposta.body.reservas).toBe(0);
    });

    it('usa a variável APP_ENV para identificar o ambiente', async () => {
      const anterior = process.env.APP_ENV;
      process.env.APP_ENV = 'homologacao';

      const resposta = await request(app).get('/health');
      expect(resposta.body.ambiente).toBe('homologacao');

      process.env.APP_ENV = anterior;
    });
  });

  describe('GET /api/salas', () => {
    it('lista as salas da biblioteca', async () => {
      const resposta = await request(app).get('/api/salas');

      expect(resposta.status).toBe(200);
      expect(resposta.body.length).toBeGreaterThan(0);
      expect(resposta.body[0]).toHaveProperty('capacidade');
    });
  });

  describe('POST /api/reservas', () => {
    it('cria a reserva e devolve 201', async () => {
      const resposta = await request(app).post('/api/reservas').send(novaReserva());

      expect(resposta.status).toBe(201);
      expect(resposta.body).toMatchObject({ salaId: 'A-101', inicio: '14:00', fim: '16:00' });
      expect(resposta.body.id).toEqual(expect.any(String));
    });

    it('grava a reserva em disco', async () => {
      await request(app).post('/api/reservas').send(novaReserva());

      const gravado = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      expect(gravado).toHaveLength(1);
      expect(gravado[0].aluno).toBe('Ana Ribeiro');
    });

    it('remove espaços em branco do nome', async () => {
      const resposta = await request(app)
        .post('/api/reservas')
        .send(novaReserva({ aluno: '  Ana Ribeiro  ' }));

      expect(resposta.body.aluno).toBe('Ana Ribeiro');
    });

    it('devolve 400 com a lista de erros quando os dados são inválidos', async () => {
      const resposta = await request(app)
        .post('/api/reservas')
        .send(novaReserva({ matricula: '123', inicio: '14:00', fim: '14:30' }));

      expect(resposta.status).toBe(400);
      expect(resposta.body.erros).toContain('A matrícula deve ter exatamente 8 dígitos.');
      expect(resposta.body.erros).toContain('A reserva mínima é de 1 hora.');
    });

    it('devolve 404 quando a sala não existe', async () => {
      const resposta = await request(app)
        .post('/api/reservas')
        .send(novaReserva({ salaId: 'Z-999' }));

      expect(resposta.status).toBe(404);
      expect(resposta.body.erros[0]).toMatch(/não existe/);
    });

    it('devolve 409 quando o horário já está ocupado', async () => {
      await request(app).post('/api/reservas').send(novaReserva());

      const resposta = await request(app)
        .post('/api/reservas')
        .send(novaReserva({ matricula: '20239999', aluno: 'Bruno Lima', inicio: '15:00' }));

      expect(resposta.status).toBe(409);
      expect(resposta.body.erros[0]).toMatch(/já existe uma reserva/i);
    });

    it('permite reservar a mesma sala em horários que não se sobrepõem', async () => {
      await request(app).post('/api/reservas').send(novaReserva());

      const resposta = await request(app)
        .post('/api/reservas')
        .send(
          novaReserva({ matricula: '20239999', aluno: 'Bruno Lima', inicio: '16:00', fim: '17:00' })
        );

      expect(resposta.status).toBe(201);
    });

    it('permite reservar salas diferentes no mesmo horário', async () => {
      await request(app).post('/api/reservas').send(novaReserva());

      const resposta = await request(app)
        .post('/api/reservas')
        .send(novaReserva({ salaId: 'B-203', matricula: '20239999', aluno: 'Bruno Lima' }));

      expect(resposta.status).toBe(201);
    });

    it('devolve 409 quando o aluno excede o limite diário', async () => {
      await request(app).post('/api/reservas').send(novaReserva());
      await request(app)
        .post('/api/reservas')
        .send(novaReserva({ salaId: 'B-203', inicio: '09:00', fim: '10:00' }));

      const resposta = await request(app)
        .post('/api/reservas')
        .send(novaReserva({ salaId: 'C-310', inicio: '17:00', fim: '18:00' }));

      expect(resposta.status).toBe(409);
      expect(resposta.body.erros[0]).toMatch(/no máximo 2 reservas/);
    });

    it('devolve 400 quando o JSON está malformado', async () => {
      const resposta = await request(app)
        .post('/api/reservas')
        .set('content-type', 'application/json')
        .send('{"salaId": ');

      expect(resposta.status).toBe(400);
      expect(resposta.body.erros).toEqual(['JSON inválido.']);
    });
  });

  describe('GET /api/reservas', () => {
    beforeEach(async () => {
      await request(app).post('/api/reservas').send(novaReserva());
      await request(app)
        .post('/api/reservas')
        .send(
          novaReserva({ salaId: 'B-203', matricula: '20239999', inicio: '09:00', fim: '10:00' })
        );
    });

    it('lista todas as reservas', async () => {
      const resposta = await request(app).get('/api/reservas');

      expect(resposta.status).toBe(200);
      expect(resposta.body).toHaveLength(2);
    });

    it('devolve as reservas ordenadas por horário', async () => {
      const resposta = await request(app).get('/api/reservas');

      expect(resposta.body[0].inicio).toBe('09:00');
      expect(resposta.body[1].inicio).toBe('14:00');
    });

    it('filtra por sala', async () => {
      const resposta = await request(app).get('/api/reservas?sala=B-203');

      expect(resposta.body).toHaveLength(1);
      expect(resposta.body[0].salaId).toBe('B-203');
    });

    it('filtra por matrícula', async () => {
      const resposta = await request(app).get('/api/reservas?matricula=20231045');

      expect(resposta.body).toHaveLength(1);
      expect(resposta.body[0].matricula).toBe('20231045');
    });

    it('filtra por data', async () => {
      const resposta = await request(app).get(`/api/reservas?data=${daquiADias(5)}`);

      expect(resposta.body).toHaveLength(0);
    });
  });

  describe('GET /api/agenda', () => {
    it('devolve todas as salas com as reservas do dia', async () => {
      await request(app).post('/api/reservas').send(novaReserva());

      const resposta = await request(app).get(`/api/agenda?data=${AMANHA}`);

      expect(resposta.status).toBe(200);
      expect(resposta.body.data).toBe(AMANHA);

      const salaReservada = resposta.body.salas.find((sala) => sala.id === 'A-101');
      expect(salaReservada.reservas).toHaveLength(1);

      const salaLivre = resposta.body.salas.find((sala) => sala.id === 'B-203');
      expect(salaLivre.reservas).toHaveLength(0);
    });

    it('usa o dia de hoje quando nenhuma data é informada', async () => {
      const resposta = await request(app).get('/api/agenda');

      expect(resposta.body.data).toBe(daquiADias(0));
    });
  });

  describe('DELETE /api/reservas/:id', () => {
    it('cancela a reserva e devolve 204', async () => {
      const criada = await request(app).post('/api/reservas').send(novaReserva());

      const resposta = await request(app).delete(`/api/reservas/${criada.body.id}`);

      expect(resposta.status).toBe(204);
      expect(repositorio.buscar(criada.body.id)).toBeNull();
    });

    it('libera o horário para uma nova reserva', async () => {
      const criada = await request(app).post('/api/reservas').send(novaReserva());
      await request(app).delete(`/api/reservas/${criada.body.id}`);

      const resposta = await request(app).post('/api/reservas').send(novaReserva());
      expect(resposta.status).toBe(201);
    });

    it('devolve 404 quando a reserva não existe', async () => {
      const resposta = await request(app).delete('/api/reservas/nao-existe');

      expect(resposta.status).toBe(404);
    });
  });

  describe('outras rotas', () => {
    it('serve a página do sistema na raiz', async () => {
      const resposta = await request(app).get('/');

      expect(resposta.status).toBe(200);
      expect(resposta.text).toContain('Reserva de Salas de Estudo');
    });

    it('devolve 404 em JSON para rotas desconhecidas', async () => {
      const resposta = await request(app).get('/api/inexistente');

      expect(resposta.status).toBe(404);
      expect(resposta.body.erros).toEqual(['Rota não encontrada.']);
    });
  });
});

describe('RepositorioReservas', () => {
  it('recarrega as reservas gravadas por outra instância', () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'reservas-'));
    const arquivo = path.join(pasta, 'reservas.json');

    const primeiro = new RepositorioReservas(arquivo);
    primeiro.criar(novaReserva());

    const segundo = new RepositorioReservas(arquivo);
    expect(segundo.listar()).toHaveLength(1);

    fs.rmSync(pasta, { recursive: true, force: true });
  });

  it('começa vazio quando o arquivo ainda não existe', () => {
    const repositorio = new RepositorioReservas(path.join(os.tmpdir(), 'nao-existe', 'x.json'));

    expect(repositorio.listar()).toEqual([]);
  });

  it('devolve false ao remover um id inexistente', () => {
    const repositorio = new RepositorioReservas(path.join(os.tmpdir(), 'nao-existe', 'x.json'));

    expect(repositorio.remover('qualquer')).toBe(false);
  });
});
