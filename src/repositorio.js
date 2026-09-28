'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const ARQUIVO_PADRAO = path.join(__dirname, '..', 'dados', 'reservas.json');

class RepositorioReservas {
  constructor(arquivo = process.env.ARQUIVO_DADOS || ARQUIVO_PADRAO) {
    this.arquivo = arquivo;
    this.reservas = this.carregar();
  }

  carregar() {
    try {
      return JSON.parse(fs.readFileSync(this.arquivo, 'utf8'));
    } catch {
      return [];
    }
  }

  salvar() {
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(this.reservas, null, 2));
  }

  listar({ data, salaId, matricula } = {}) {
    return this.reservas
      .filter((r) => (data ? r.data === data : true))
      .filter((r) => (salaId ? r.salaId === salaId : true))
      .filter((r) => (matricula ? r.matricula === matricula : true))
      .sort((a, b) => `${a.data}${a.inicio}`.localeCompare(`${b.data}${b.inicio}`));
  }

  buscar(id) {
    return this.reservas.find((r) => r.id === id) || null;
  }

  criar(dados) {
    const reserva = {
      id: randomUUID(),
      ...dados,
      criadaEm: new Date().toISOString(),
    };
    this.reservas.push(reserva);
    this.salvar();
    return reserva;
  }

  remover(id) {
    const antes = this.reservas.length;
    this.reservas = this.reservas.filter((r) => r.id !== id);
    if (this.reservas.length === antes) {
      return false;
    }
    this.salvar();
    return true;
  }
}

module.exports = { RepositorioReservas, ARQUIVO_PADRAO };
