'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');

const { listarSalas, buscarSala } = require('./salas');
const { RepositorioReservas } = require('./repositorio');
const regras = require('./regras');
const { version } = require('../package.json');

function criarApp({ repositorio = new RepositorioReservas() } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
        },
      },
    })
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      versao: version,
      ambiente: process.env.APP_ENV || 'desenvolvimento',
      reservas: repositorio.listar().length,
    });
  });

  app.get('/api/salas', (_req, res) => {
    res.json(listarSalas());
  });

  app.get('/api/reservas', (req, res) => {
    const { data, sala, matricula } = req.query;
    res.json(repositorio.listar({ data, salaId: sala, matricula }));
  });

  app.get('/api/agenda', (req, res) => {
    const data = req.query.data || regras.hojeISO();
    const agenda = listarSalas().map((sala) => ({
      ...sala,
      reservas: repositorio.listar({ data, salaId: sala.id }),
    }));
    res.json({ data, salas: agenda });
  });

  app.post('/api/reservas', (req, res) => {
    const dados = {
      salaId: req.body.salaId,
      aluno: typeof req.body.aluno === 'string' ? req.body.aluno.trim() : req.body.aluno,
      matricula: req.body.matricula,
      data: req.body.data,
      inicio: req.body.inicio,
      fim: req.body.fim,
    };

    const erros = regras.validar(dados);
    if (erros.length > 0) {
      return res.status(400).json({ erros });
    }

    if (!buscarSala(dados.salaId)) {
      return res.status(404).json({ erros: [`A sala ${dados.salaId} não existe.`] });
    }

    const doDia = repositorio.listar({ data: dados.data });

    if (doDia.some((existente) => regras.conflita(dados, existente))) {
      return res
        .status(409)
        .json({ erros: ['Já existe uma reserva nesse horário para essa sala.'] });
    }

    if (regras.atingiuLimiteDiario(dados.matricula, dados.data, doDia)) {
      return res.status(409).json({
        erros: [`Cada aluno pode fazer no máximo ${regras.RESERVAS_POR_DIA} reservas por dia.`],
      });
    }

    const reserva = repositorio.criar(dados);
    return res.status(201).json(reserva);
  });

  app.delete('/api/reservas/:id', (req, res) => {
    if (!repositorio.remover(req.params.id)) {
      return res.status(404).json({ erros: ['Reserva não encontrada.'] });
    }
    return res.status(204).send();
  });

  app.use((_req, res) => {
    res.status(404).json({ erros: ['Rota não encontrada.'] });
  });

  app.use((erro, _req, res, _next) => {
    const status = erro.status || 500;
    if (status >= 500) {
      console.error(erro);
    }
    res.status(status).json({
      erros: [status === 400 ? 'JSON inválido.' : 'Erro interno do servidor.'],
    });
  });

  return app;
}

module.exports = { criarApp };
