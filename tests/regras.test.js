'use strict';

const regras = require('../src/regras');

const HOJE = '2025-05-10';

function dadosValidos(alteracoes = {}) {
  return {
    salaId: 'A-101',
    aluno: 'Ana Ribeiro',
    matricula: '20231045',
    data: '2025-05-12',
    inicio: '14:00',
    fim: '16:00',
    ...alteracoes,
  };
}

describe('validação da reserva', () => {
  it('aceita uma reserva bem preenchida', () => {
    expect(regras.validar(dadosValidos(), HOJE)).toEqual([]);
  });

  it('exige uma sala', () => {
    expect(regras.validar(dadosValidos({ salaId: '' }), HOJE)).toContain('Escolha uma sala.');
  });

  it('exige nome com pelo menos 3 caracteres', () => {
    const erros = regras.validar(dadosValidos({ aluno: 'Jo' }), HOJE);
    expect(erros).toContain('Informe o nome do aluno (mínimo 3 caracteres).');
  });

  it.each(['1234567', '123456789', 'abcdefgh', ''])('recusa a matrícula %p', (matricula) => {
    const erros = regras.validar(dadosValidos({ matricula }), HOJE);
    expect(erros).toContain('A matrícula deve ter exatamente 8 dígitos.');
  });

  it('recusa data em formato inválido', () => {
    const erros = regras.validar(dadosValidos({ data: '12/05/2025' }), HOJE);
    expect(erros).toContain('Data inválida, use o formato AAAA-MM-DD.');
  });

  it('recusa data no passado', () => {
    const erros = regras.validar(dadosValidos({ data: '2025-05-09' }), HOJE);
    expect(erros).toContain('Não dá para reservar uma data que já passou.');
  });

  it('aceita reserva para o próprio dia', () => {
    expect(regras.validar(dadosValidos({ data: HOJE }), HOJE)).toEqual([]);
  });

  it.each(['14:15', '9:00', '14h', ''])('recusa o horário %p', (inicio) => {
    const erros = regras.validar(dadosValidos({ inicio }), HOJE);
    expect(erros).toContain('Os horários devem ser cheios ou de meia hora, no formato HH:MM.');
  });

  it('recusa horário antes da abertura', () => {
    const erros = regras.validar(dadosValidos({ inicio: '07:00', fim: '08:30' }), HOJE);
    expect(erros).toContain('A biblioteca funciona das 08:00 às 22:00.');
  });

  it('recusa término depois do fechamento', () => {
    const erros = regras.validar(dadosValidos({ inicio: '21:00', fim: '23:00' }), HOJE);
    expect(erros).toContain('A biblioteca funciona das 08:00 às 22:00.');
  });

  it('recusa término antes do início', () => {
    const erros = regras.validar(dadosValidos({ inicio: '16:00', fim: '14:00' }), HOJE);
    expect(erros).toContain('O horário de término precisa ser depois do início.');
  });

  it('recusa reserva com menos de 1 hora', () => {
    const erros = regras.validar(dadosValidos({ inicio: '14:00', fim: '14:30' }), HOJE);
    expect(erros).toContain('A reserva mínima é de 1 hora.');
  });

  it('recusa reserva com mais de 3 horas', () => {
    const erros = regras.validar(dadosValidos({ inicio: '14:00', fim: '18:00' }), HOJE);
    expect(erros).toContain('A reserva máxima é de 3 horas.');
  });

  it('aceita exatamente 3 horas', () => {
    expect(regras.validar(dadosValidos({ inicio: '14:00', fim: '17:00' }), HOJE)).toEqual([]);
  });
});

describe('conflito de horário', () => {
  const existente = { salaId: 'A-101', data: '2025-05-12', inicio: '14:00', fim: '16:00' };

  it.each([
    ['começa no meio da outra', '15:00', '17:00'],
    ['termina no meio da outra', '13:00', '15:00'],
    ['engloba a outra', '13:00', '17:00'],
    ['é idêntica', '14:00', '16:00'],
    ['está contida na outra', '14:30', '15:30'],
  ])('detecta conflito quando a nova reserva %s', (_caso, inicio, fim) => {
    expect(regras.conflita({ ...existente, inicio, fim }, existente)).toBe(true);
  });

  it('não acusa conflito quando uma começa exatamente onde a outra termina', () => {
    expect(regras.conflita({ ...existente, inicio: '16:00', fim: '17:00' }, existente)).toBe(false);
  });

  it('não acusa conflito em salas diferentes', () => {
    expect(regras.conflita({ ...existente, salaId: 'B-203' }, existente)).toBe(false);
  });

  it('não acusa conflito em dias diferentes', () => {
    expect(regras.conflita({ ...existente, data: '2025-05-13' }, existente)).toBe(false);
  });
});

describe('limite diário por aluno', () => {
  const reservas = [
    { matricula: '20231045', data: '2025-05-12' },
    { matricula: '20231045', data: '2025-05-12' },
    { matricula: '20239999', data: '2025-05-12' },
  ];

  it('bloqueia o aluno que já tem 2 reservas no dia', () => {
    expect(regras.atingiuLimiteDiario('20231045', '2025-05-12', reservas)).toBe(true);
  });

  it('libera o aluno com menos de 2 reservas no dia', () => {
    expect(regras.atingiuLimiteDiario('20239999', '2025-05-12', reservas)).toBe(false);
  });

  it('conta apenas o dia consultado', () => {
    expect(regras.atingiuLimiteDiario('20231045', '2025-05-13', reservas)).toBe(false);
  });
});

describe('utilitários', () => {
  it('converte horário em minutos', () => {
    expect(regras.emMinutos('08:30')).toBe(510);
  });

  it('devolve a data de hoje no formato ISO', () => {
    expect(regras.hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
