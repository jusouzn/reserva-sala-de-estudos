'use strict';

const SALAS = [
  { id: 'A-101', bloco: 'A', andar: 1, capacidade: 4, recursos: ['Quadro branco', 'Tomadas'] },
  { id: 'A-102', bloco: 'A', andar: 1, capacidade: 6, recursos: ['Quadro branco', 'TV'] },
  { id: 'B-203', bloco: 'B', andar: 2, capacidade: 2, recursos: ['Tomadas'] },
  { id: 'B-204', bloco: 'B', andar: 2, capacidade: 8, recursos: ['Projetor', 'TV', 'Tomadas'] },
  { id: 'C-310', bloco: 'C', andar: 3, capacidade: 4, recursos: ['Cabine de silêncio'] },
];

function listarSalas() {
  return SALAS;
}

function buscarSala(id) {
  return SALAS.find((sala) => sala.id === id) || null;
}

module.exports = { SALAS, listarSalas, buscarSala };
