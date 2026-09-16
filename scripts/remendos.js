/* Ajustes no _markup.html que o extrai_shell.js apaga a cada build, porque ele
   regenera o arquivo a partir do app de arquivo único. Mantê-los aqui é o que
   permite rodar `npm run build` quantas vezes for preciso sem perder nada.
   Uso: automático dentro do build. */
const fs = require('fs');
const path = require('path');

const ARQ = path.resolve(__dirname, '..', 'public', '_markup.html');
let m = fs.readFileSync(ARQ, 'utf8');
const feitos = [];

function aplica(nome, de, para) {
  if (m.includes(para)) { feitos.push(nome + ' (já estava)'); return; }
  const n = m.split(de).length - 1;
  if (n !== 1) throw new Error('âncora ' + (n ? 'ambígua' : 'não encontrada') + ': ' + nome);
  m = m.replace(de, para); feitos.push(nome);
}

/* "Esqueci minha senha" — só existe quando há banco configurado; o app.js
   mostra ou esconde conforme o modo. */
aplica('recuperar senha',
  '<button type="submit" class="btn btn-block" id="auth-btn">Entrar</button>',
  '<button type="submit" class="btn btn-block" id="auth-btn">Entrar</button>\n'
  + '        <button type="button" class="auth-rec" id="auth-rec" hidden onclick="esqueciSenha()">Esqueci minha senha</button>');

fs.writeFileSync(ARQ, m);
console.log('  remendos: ' + feitos.join(' · '));
