'use strict';

const { criarApp } = require('./app');

const PORTA = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const AMBIENTE = process.env.APP_ENV || 'desenvolvimento';

const servidor = criarApp().listen(PORTA, HOST, () => {
  console.log(`Reserva de Salas [${AMBIENTE}] rodando em http://${HOST}:${PORTA}`);
});

function encerrar(sinal) {
  console.log(`Recebido ${sinal}, encerrando o servidor.`);
  servidor.close(() => process.exit(0));
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
