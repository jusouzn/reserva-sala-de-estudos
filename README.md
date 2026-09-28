# Reserva de Salas de Estudo

Sistema web para reservar as salas de estudo em grupo da biblioteca. O aluno escolhe a
sala, o dia e o horário; o sistema verifica se a sala está livre e confirma a reserva.

Projeto usado na atividade **Construindo um pipeline de CI/CD**, com o workflow em
[`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml).

## O que o sistema faz

- Mostra as 5 salas da biblioteca com capacidade, bloco e recursos
- Exibe a agenda do dia escolhido, com os horários já ocupados de cada sala
- Permite reservar uma sala preenchendo nome, matrícula, data e horário
- Lista as reservas do aluno (identificado pela matrícula) e permite cancelá-las

### Regras de negócio

- A biblioteca funciona das 08:00 às 22:00, em blocos de meia hora
- A reserva dura no mínimo 1 hora e no máximo 3 horas
- Não é possível reservar uma data que já passou
- Duas reservas não podem se sobrepor na mesma sala e no mesmo dia
- Cada matrícula pode fazer no máximo 2 reservas por dia
- A matrícula precisa ter 8 dígitos

## Tecnologias

Node.js + Express no backend, HTML/CSS/JavaScript puro no frontend (sem framework),
Jest e Supertest nos testes. As reservas são gravadas num arquivo JSON.

## Rodando localmente

Precisa do Node.js 20 ou superior.

```bash
npm install
npm start
```

Acesse http://localhost:3000.

Outros comandos:

```bash
npm run dev           # sobe com reload automático
npm run lint          # ESLint
npm run format        # aplica o Prettier
npm test              # testes
npm run test:coverage # testes com relatório de cobertura
npm run smoke         # smoke tests contra uma instância já no ar
```

## API

| Método   | Rota                | O que faz                                          |
| -------- | ------------------- | -------------------------------------------------- |
| `GET`    | `/health`           | Status, versão e ambiente — usado no deploy        |
| `GET`    | `/api/salas`        | Lista as salas                                     |
| `GET`    | `/api/agenda?data=` | Salas com as reservas daquele dia                  |
| `GET`    | `/api/reservas`     | Reservas, com filtros `data`, `sala` e `matricula` |
| `POST`   | `/api/reservas`     | Cria uma reserva                                   |
| `DELETE` | `/api/reservas/:id` | Cancela uma reserva                                |

Exemplo:

```bash
curl -X POST http://localhost:3000/api/reservas \
  -H 'content-type: application/json' \
  -d '{"salaId":"A-101","aluno":"Ana Ribeiro","matricula":"20231045",
       "data":"2025-10-15","inicio":"14:00","fim":"16:00"}'
```

Respostas de erro: `400` para dados inválidos, `404` para sala ou reserva inexistente,
`409` para conflito de horário ou limite diário atingido.

## O pipeline de CI/CD

```
push / pull request
        │
        ├── qualidade      ESLint + Prettier            (estática)
        ├── seguranca      CodeQL + npm audit           (estática)
        ├── dependencias   dependency-review, só em PR  (estática)
        │
        └── testes         Jest em Node 20 e 22         (dinâmica)
                 │
              build        empacota src, public e scripts
                 │
           homologacao     health check + smoke tests + OWASP ZAP   (dinâmica)
                 │
            producao       health check + smoke tests + release     (dinâmica)
```

### Jobs

| Job            | Verificação | Principais comandos                                              |
| -------------- | ----------- | ---------------------------------------------------------------- |
| `qualidade`    | estática    | `npm ci`, `npm run lint`, `npm run format:check`                 |
| `seguranca`    | estática    | `npm audit --audit-level=high`, `github/codeql-action`           |
| `dependencias` | estática    | `actions/dependency-review-action`                               |
| `testes`       | dinâmica    | `npm run test:coverage` em Node 20 e 22                          |
| `build`        | —           | copia os arquivos, gera `build-info.json` e publica o artefato   |
| `homologacao`  | dinâmica    | `npm ci --omit=dev`, sobe o servidor, `curl /health`, smoke, ZAP |
| `producao`     | dinâmica    | mesma coisa + `gh release create`                                |

### Verificação estática e dinâmica

A **estática** analisa o código sem executá-lo: o ESLint procura erros e más práticas,
o Prettier confere a formatação, o CodeQL procura vulnerabilidades no código-fonte e o
`npm audit` e o Dependency Review procuram CVEs conhecidas nas dependências.

A **dinâmica** executa o código de verdade: o Jest exercita a API com o Supertest em
duas versões do Node, e depois de cada deploy o pipeline sobe o servidor, espera o
`/health` responder e roda os smoke tests (`scripts/smoke-test.js`) fazendo requisições
HTTP reais — criar reserva, conferir a agenda, tentar reservar o mesmo horário e esperar
`409`, cancelar. Em homologação ainda roda o OWASP ZAP, que faz uma varredura de
segurança na aplicação no ar.

### Os dois ambientes

|                   | `homologacao`               | `producao`        |
| ----------------- | --------------------------- | ----------------- |
| Quando roda       | push em `main` ou `develop` | só push em `main` |
| Porta e `APP_ENV` | 3000 / `homologacao`        | 8080 / `producao` |
| Aprovação manual  | não                         | sim               |
| Extras            | varredura OWASP ZAP         | publica a release |

Os dois são **GitHub Environments** de verdade (Settings → Environments), então cada
deploy fica registrado no histórico do repositório. O artefato gerado no `build` é o
mesmo que vai para os dois — nada é reconstruído no meio do caminho.

Produção tem um revisor obrigatório, então o job fica em _Waiting_ até alguém aprovar
em **Actions → Review deployments**.

## Estrutura

```
public/            frontend (HTML, CSS e JS)
src/
  app.js           rotas do Express
  server.js        sobe o servidor
  salas.js         catálogo de salas
  regras.js        validações e conflito de horário
  repositorio.js   leitura e escrita do JSON
scripts/
  smoke-test.js    testes HTTP usados no deploy
tests/             testes do Jest
.github/workflows/ci-cd.yml
```
