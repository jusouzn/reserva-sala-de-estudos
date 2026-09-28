'use strict';

const HORA_ABERTURA = '08:00';
const HORA_FECHAMENTO = '22:00';
const DURACAO_MINIMA = 60;
const DURACAO_MAXIMA = 180;
const RESERVAS_POR_DIA = 2;

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):(00|30)$/;
const FORMATO_MATRICULA = /^\d{8}$/;

function emMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function validar(dados, hoje = hojeISO()) {
  const erros = [];
  const { salaId, aluno, matricula, data, inicio, fim } = dados;

  if (typeof salaId !== 'string' || salaId.trim() === '') {
    erros.push('Escolha uma sala.');
  }

  if (typeof aluno !== 'string' || aluno.trim().length < 3) {
    erros.push('Informe o nome do aluno (mínimo 3 caracteres).');
  }

  if (!FORMATO_MATRICULA.test(String(matricula))) {
    erros.push('A matrícula deve ter exatamente 8 dígitos.');
  }

  if (!FORMATO_DATA.test(String(data))) {
    erros.push('Data inválida, use o formato AAAA-MM-DD.');
  } else if (data < hoje) {
    erros.push('Não dá para reservar uma data que já passou.');
  }

  if (!FORMATO_HORA.test(String(inicio)) || !FORMATO_HORA.test(String(fim))) {
    erros.push('Os horários devem ser cheios ou de meia hora, no formato HH:MM.');
    return erros;
  }

  const minutoInicio = emMinutos(inicio);
  const minutoFim = emMinutos(fim);

  if (minutoInicio < emMinutos(HORA_ABERTURA) || minutoFim > emMinutos(HORA_FECHAMENTO)) {
    erros.push(`A biblioteca funciona das ${HORA_ABERTURA} às ${HORA_FECHAMENTO}.`);
  }

  if (minutoFim <= minutoInicio) {
    erros.push('O horário de término precisa ser depois do início.');
  } else if (minutoFim - minutoInicio < DURACAO_MINIMA) {
    erros.push('A reserva mínima é de 1 hora.');
  } else if (minutoFim - minutoInicio > DURACAO_MAXIMA) {
    erros.push('A reserva máxima é de 3 horas.');
  }

  return erros;
}

function conflita(nova, existente) {
  if (nova.salaId !== existente.salaId || nova.data !== existente.data) {
    return false;
  }
  return (
    emMinutos(nova.inicio) < emMinutos(existente.fim) &&
    emMinutos(existente.inicio) < emMinutos(nova.fim)
  );
}

function atingiuLimiteDiario(matricula, data, reservas) {
  const doAluno = reservas.filter((r) => r.matricula === matricula && r.data === data);
  return doAluno.length >= RESERVAS_POR_DIA;
}

module.exports = {
  HORA_ABERTURA,
  HORA_FECHAMENTO,
  RESERVAS_POR_DIA,
  emMinutos,
  hojeISO,
  validar,
  conflita,
  atingiuLimiteDiario,
};
