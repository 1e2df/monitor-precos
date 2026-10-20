// Decide se um preço é um bom desconto ou um provável bug de preço.
// nível 3 = bug quase certo (confirmado pelo histórico ou erro de casa decimal), 2 = suspeito/alvo, 1 = boa oferta
const DIA = 86400000;

function mediana(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function estatisticas(pontos, agora = Date.now()) {
  const recentes = pontos.filter(p => agora - p.t <= 30 * DIA).map(p => p.p);
  const todos = pontos.map(p => p.p);
  return {
    n: todos.length,
    mediana: mediana(recentes.length >= 3 ? recentes : todos),
    minimo: todos.length ? Math.min(...todos) : null,
    maximo: todos.length ? Math.max(...todos) : null,
    ultimo: pontos.length ? pontos[pontos.length - 1].p : null,
  };
}

const pct = x => Math.round(x * 100) + '%';
const reais = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const casaDecimal = (maior, menor, tol = 0.03) => [10, 100, 1000].find(f => Math.abs(maior / menor - f) / f < tol);

// item: { preco, precoDe, disponivel, divergencia }   pontos: histórico anterior [{t, p}]
// deInflado: a loja costuma exibir preços "de" irreais, então "de/por" sozinho não indica bug
// outras: menor preço do mesmo produto (mesmo EAN) em cada uma das outras lojas
// lojaBarata: a loja vende muita coisa bem abaixo das outras (ex.: genéricos de farmácia), então isso não é bug
function analisar(item, pontos, lim, precoAlvo, deInflado = false, outras = [], lojaBarata = false) {
  const out = [];
  const { preco, precoDe } = item;
  const st = estatisticas(pontos);
  const temHist = st.n >= lim.pontosMinimosHistorico;
  const add = (tipo, nivel, motivo) => out.push({ tipo, nivel, motivo });
  const offDe = precoDe ? 1 - preco / precoDe : 0;
  const offHist = temHist && st.mediana ? 1 - preco / st.mediana : 0;

  // ---- bugs ----
  if (offHist >= lim.bugQueda) {
    const f = casaDecimal(st.mediana, preco);
    add('bug', 3, f ? `parece erro de casa decimal: ${f}x menor que o normal (${reais(st.mediana)})` : `${pct(offHist)} abaixo do preço normal de ${reais(st.mediana)}`);
  }
  // só o "de/por" é indício fraco (lojas inflam o "de"); vira bug confirmado quando o histórico também cai
  if (offDe >= lim.bugDesconto && offHist < lim.bugQueda) {
    const f = casaDecimal(precoDe, preco, 0.005);
    const parado = temHist && offHist < lim.quedaMinima;
    if (deInflado || parado) add('desconto', 1, `${pct(offDe)} abaixo do preço "de" de ${reais(precoDe)} (${deInflado ? 'esta loja costuma inflar o "de"' : 'o preço não mudou; o "de" pode ser inflado'})`);
    else add('bug', 2, f ? `possível erro de casa decimal: exatamente ${f}x menor que o preço "de" de ${reais(precoDe)}` : `${pct(offDe)} abaixo do preço "de" de ${reais(precoDe)}`);
  }
  // comparação entre lojas: não depende de histórico nem do "de" da loja
  const medOutras = outras.length ? mediana(outras) : null;
  const offLojas = medOutras ? 1 - preco / medOutras : 0;
  if (offLojas >= lim.bugEntreLojas && lojaBarata) add('desconto', 1, `${pct(offLojas)} mais barato que nas outras lojas (${reais(medOutras)}); esta loja costuma ser bem mais barata nestes produtos`);
  else if (offLojas >= lim.bugEntreLojas) {
    const f = casaDecimal(medOutras, preco);
    const qtd = outras.length === 1 ? 'na outra loja' : `nas outras ${outras.length} lojas`;
    add('bug', outras.length >= 2 ? 3 : 2, f ? `parece erro de casa decimal: ${f}x mais barato que ${qtd} (${reais(medOutras)})` : `${pct(offLojas)} mais barato que ${qtd} (${reais(medOutras)})`);
  }
  const ref = precoDe || st.mediana;
  if (preco < 2 && ref && ref > 30) add('bug', 3, `preço quase zero (${reais(preco)})`);
  if (item.divergencia) add('bug', 2, `a página mostra preços muito diferentes (${reais(item.divergencia.min)} e ${reais(item.divergencia.max)})`);

  // ---- bons preços ----
  if (precoAlvo && preco <= precoAlvo) add('alvo', 2, `chegou no seu preço alvo de ${reais(precoAlvo)}`);
  if (offHist >= lim.quedaMinima && offHist < lim.bugQueda) add('queda', 1, `caiu ${pct(offHist)} em relação ao preço normal de ${reais(st.mediana)}`);
  if (offDe >= lim.descontoMinimo && offDe < lim.bugDesconto) {
    const inflado = temHist && st.maximo && precoDe > st.maximo * 1.3;
    add('desconto', 1, `${pct(offDe)} de desconto${inflado ? ' (o preço "de" nunca foi praticado aqui)' : ''}`);
  }
  if (offLojas >= lim.descontoEntreLojas && offLojas < lim.bugEntreLojas)
    add('desconto', 1, `${pct(offLojas)} mais barato que nas outras lojas (${reais(medOutras)})`);
  if (st.n >= 5 && preco < st.minimo * 0.98) add('minimo', 1, `menor preço já visto (antes ${reais(st.minimo)})`);

  // um alerta por tipo, juntando os motivos
  const porTipo = [];
  for (const a of out) {
    const j = porTipo.find(x => x.tipo === a.tipo);
    if (j) { j.motivo += '; ' + a.motivo; j.nivel = Math.max(j.nivel, a.nivel); } else porTipo.push({ ...a });
  }
  if (item.disponivel === false) porTipo.forEach(a => (a.motivo += ' (aparece indisponível)'));
  porTipo.sort((a, b) => b.nivel - a.nivel);
  return { alertas: porTipo, estatisticas: st };
}

module.exports = { analisar, estatisticas, mediana };
