const ABERTURA = 8 * 60;
const FECHAMENTO = 22 * 60;

const form = document.getElementById('form-reserva');
const campoData = document.getElementById('campo-data');
const campoSala = document.getElementById('campo-sala');
const campoInicio = document.getElementById('campo-inicio');
const campoFim = document.getElementById('campo-fim');
const divAgenda = document.getElementById('agenda');
const divMinhas = document.getElementById('minhas-reservas');
const divMensagem = document.getElementById('mensagem');
const rotuloData = document.getElementById('rotulo-data');
const rotuloMatricula = document.getElementById('rotulo-matricula');
const rodape = document.getElementById('rodape');

function hojeISO() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Monta a data com os componentes locais: new Date('2025-10-15') seria
// meia-noite em UTC e cairia no dia anterior no horário de Brasília.
function porExtenso(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function emMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

function mostrarMensagem(html, tipo) {
  divMensagem.className = `mensagem ${tipo}`;
  divMensagem.innerHTML = html;
  divMensagem.hidden = false;
}

function horariosPossiveis() {
  const horarios = [];
  for (let minuto = ABERTURA; minuto <= FECHAMENTO; minuto += 30) {
    const hora = String(Math.floor(minuto / 60)).padStart(2, '0');
    const min = String(minuto % 60).padStart(2, '0');
    horarios.push(`${hora}:${min}`);
  }
  return horarios;
}

function opcoes(lista, selecionado) {
  return lista
    .map((h) => `<option value="${h}"${h === selecionado ? ' selected' : ''}>${h}</option>`)
    .join('');
}

function preencherInicios() {
  campoInicio.innerHTML = opcoes(horariosPossiveis().slice(0, -2), '14:00');
}

// Mantém o término sempre entre 1 e 3 horas depois do início.
function ajustarTermino() {
  const inicio = emMinutos(campoInicio.value);
  const validos = horariosPossiveis().filter((h) => {
    const duracao = emMinutos(h) - inicio;
    return duracao >= 60 && duracao <= 180;
  });

  const atual = campoFim.value;
  campoFim.innerHTML = opcoes(validos, validos.includes(atual) ? atual : validos[0]);
}

async function carregarSalas() {
  const salas = await fetch('/api/salas').then((r) => r.json());

  campoSala.innerHTML = salas
    .map(
      (sala) =>
        `<option value="${escapar(sala.id)}">${escapar(sala.id)} · ${sala.capacidade} lugares</option>`
    )
    .join('');
}

function desenharLinhaTempo(reservas) {
  const total = FECHAMENTO - ABERTURA;
  const faixas = reservas
    .map((r) => {
      const inicio = ((emMinutos(r.inicio) - ABERTURA) / total) * 100;
      const largura = ((emMinutos(r.fim) - emMinutos(r.inicio)) / total) * 100;
      return `<div class="faixa" style="left:${inicio}%;width:${largura}%"></div>`;
    })
    .join('');

  return `
    <div class="linha-tempo">${faixas}</div>
    <div class="escala"><span>08h</span><span>13h</span><span>18h</span><span>22h</span></div>`;
}

async function carregarAgenda() {
  const data = campoData.value || hojeISO();
  const agenda = await fetch(`/api/agenda?data=${encodeURIComponent(data)}`).then((r) => r.json());

  rotuloData.textContent = porExtenso(agenda.data);

  divAgenda.innerHTML = agenda.salas
    .map((sala) => {
      const ocupada = sala.reservas.length > 0;

      const lista = ocupada
        ? `<ul class="horarios">${sala.reservas
            .map(
              (r) =>
                `<li><time>${escapar(r.inicio)} – ${escapar(r.fim)}</time><span>${escapar(r.aluno)}</span></li>`
            )
            .join('')}</ul>`
        : '<p class="vazio">Livre o dia todo.</p>';

      return `
        <article class="sala">
          <div class="sala-topo">
            <h3>Sala ${escapar(sala.id)}</h3>
            <span class="etiqueta ${ocupada ? 'ocupada' : 'livre'}">
              ${ocupada ? `${sala.reservas.length} reserva${sala.reservas.length > 1 ? 's' : ''}` : 'Livre'}
            </span>
          </div>
          <p class="sala-meta">
            Bloco ${escapar(sala.bloco)} · ${sala.andar}º andar · até ${sala.capacidade} pessoas
            <span class="recursos">${sala.recursos.map((r) => `<span>${escapar(r)}</span>`).join('')}</span>
          </p>
          ${desenharLinhaTempo(sala.reservas)}
          ${lista}
        </article>`;
    })
    .join('');
}

async function carregarMinhasReservas() {
  const matricula = localStorage.getItem('matricula');

  if (!matricula) {
    rotuloMatricula.textContent = '';
    divMinhas.innerHTML = '<p class="vazio">Faça uma reserva para acompanhá-la por aqui.</p>';
    return;
  }

  rotuloMatricula.textContent = `Matrícula ${matricula}`;

  const reservas = await fetch(`/api/reservas?matricula=${encodeURIComponent(matricula)}`).then(
    (r) => r.json()
  );

  if (reservas.length === 0) {
    divMinhas.innerHTML = '<p class="vazio">Nenhuma reserva no momento.</p>';
    return;
  }

  divMinhas.innerHTML = `
    <table>
      <thead>
        <tr><th>Sala</th><th>Dia</th><th>Horário</th><th></th></tr>
      </thead>
      <tbody>
        ${reservas
          .map(
            (r) => `
              <tr>
                <td>${escapar(r.salaId)}</td>
                <td>${formatarData(r.data)}</td>
                <td>${escapar(r.inicio)} – ${escapar(r.fim)}</td>
                <td><button class="cancelar" data-id="${escapar(r.id)}">Cancelar</button></td>
              </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

async function atualizar() {
  await Promise.all([carregarAgenda(), carregarMinhasReservas()]);
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const resposta = await fetch('/api/reservas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(form))),
  });

  if (!resposta.ok) {
    const { erros } = await resposta.json();
    mostrarMensagem(`<ul>${erros.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`, 'erro');
    return;
  }

  const reserva = await resposta.json();
  localStorage.setItem('matricula', reserva.matricula);

  mostrarMensagem(
    `Sala <strong>${escapar(reserva.salaId)}</strong> reservada para ${porExtenso(reserva.data)}, ` +
      `das ${escapar(reserva.inicio)} às ${escapar(reserva.fim)}.`,
    'sucesso'
  );

  await atualizar();
});

divMinhas.addEventListener('click', async (evento) => {
  const botao = evento.target.closest('.cancelar');
  if (!botao) {
    return;
  }

  await fetch(`/api/reservas/${encodeURIComponent(botao.dataset.id)}`, { method: 'DELETE' });
  divMensagem.hidden = true;
  await atualizar();
});

campoData.addEventListener('change', carregarAgenda);
campoInicio.addEventListener('change', ajustarTermino);

async function iniciar() {
  campoData.value = hojeISO();
  campoData.min = hojeISO();
  preencherInicios();
  ajustarTermino();

  await carregarSalas();
  await atualizar();

  const saude = await fetch('/health').then((r) => r.json());
  rodape.textContent = `Versão ${saude.versao} · ambiente ${saude.ambiente} · ${saude.reservas} reserva(s) registradas`;
}

iniciar();
