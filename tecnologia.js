// Classifica se um produto é de tecnologia, pela categoria e pelo nome.
// true = tecnologia, false = claramente outra coisa, null = não dá para saber
const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// categorias das lojas
const CAT_SIM = /inform[a-z]*tica|eletronic|celular|smartphone|telefon|computador|notebook|\bpcs?\b|tablet|\bgames?\b|gamer|console|\btvs?\b|televis|audio|\bsom\b|^fones?\b|perifer|hardware|monitor|camera|foto|drone|smartwatch|wearable|impress|\brede\b|conectividade|armazenamento|tecnologia|casa inteligente|smart ?home|projetor|video\b/;
const CAT_NAO = /movei|colch|cama|mesa e banho|decorac|moda|calcad|roupa|vestu|beleza|perfum|higiene|cosmet|maquiag|farm|medicament|saude|suplement|pet|brinqued|infantil|bebe|mercearia|bebida|aliment|limpeza|congelad|hortifrut|padaria|frios|carnes|jardim|construc|ferrament|pneu|automotiv|esporte|papelaria|utilidades domest|cozinha|eletroportat|eletrodomest|refrigerac|climatizac|ar e ventilac|cuidados pessoais|gift card|servicos|joias|relogios?$|bolsas|malas/;

// nomes de produto (para lojas sem categoria ou categorias genéricas)
const NOME_SIM = new RegExp([
  'notebook', 'laptop', 'macbook', 'chromebook', 'ultrabook', 'computador', '\\bpc gamer', 'all in one', 'mini pc', 'desktop',
  'smartphone', 'celular', 'iphone', 'galaxy [asmz]\\d', 'galaxy tab', '\\bmoto [a-z]\\d', 'motorola edge', 'redmi', 'xiaomi', 'poco [xfm]\\d', 'realme',
  'tablet', '\\bipad', 'kindle', 'e-reader',
  'smart ?tv', '\\btv \\d', '\\btv led', '\\btv qled', '\\btv oled', 'televis', 'monitor (gamer|led|ips|curvo|\\d)', '\\bmonitor\\b(?!.*(bebe|cardiac|pressao|glicose))', 'projetor',
  '\\bssd\\b', 'hd externo', 'hd interno', '\\bnvme\\b', 'pen ?drive', 'cartao (de )?memoria', 'micro ?sd',
  'memoria (ram|ddr)', '\\bddr[345]\\b', 'placa de video', 'placa-mae', 'placa mae', 'processador', 'ryzen', 'intel core', '\\bcore i[3579]', 'geforce', '\\brtx ?\\d', '\\bgtx\\b', 'radeon',
  'fonte (atx|gamer|\\d+ ?w)', 'gabinete', 'water ?cooler', 'cooler (para )?(processador|cpu|fan)', '\\bfan\\b.*rgb', 'pasta termica',
  'headset', 'fone de ouvido', 'fones de ouvido', 'earbuds?', 'airpods', '\\btws\\b', 'caixa de som', 'caixa acustica', 'soundbar', 'home theater', 'subwoofer', 'microfone', '\\bjbl\\b',
  'mouse', 'teclado', 'webcam', 'mousepad', 'controle (gamer|sem fio|xbox|ps[45]|dualsense|joy)', 'joystick', 'volante gamer', 'cadeira gamer',
  'roteador', 'repetidor', 'wi-?fi mesh', '\\bswitch\\b(?! ?nintendo)', 'adaptador (wi-?fi|bluetooth|usb|hdmi|de rede)', 'modem',
  'smartwatch', 'smartband', 'apple watch', 'galaxy watch', 'relogio inteligente', 'pulseira inteligente', '\\bmi band',
  'alexa', 'echo (dot|show|pop)', 'google nest', 'chromecast', 'fire tv', 'tv box', 'apple tv', 'lampada inteligente', 'tomada inteligente', 'camera (de seguranca|wi-?fi|ip|inteligente)',
  'playstation', '\\bps[45]\\b', 'xbox', 'nintendo', 'console', 'steam deck', 'jogo (para|de) (ps|xbox|nintendo|switch)',
  'camera (digital|mirrorless|instantanea|esportiva)', 'gopro', '\\bdrone', 'estabilizador (gimbal|para celular)', 'gimbal',
  'impressora', 'multifuncional', 'cartucho', 'toner', 'scanner',
  'carregador', 'power ?bank', 'bateria externa', 'cabo (usb|hdmi|type-?c|lightning|de rede|displayport)', '\\bhub usb', 'dock(ing)? station', 'nobreak', 'estabilizador de energia', 'filtro de linha',
  'pelicula (para |de )?(celular|iphone|galaxy|moto|vidro)', 'capa (para |de )?(celular|iphone|galaxy|moto|notebook|tablet)', 'suporte (para )?(notebook|monitor|celular|tv)',
].join('|'));
// coisas com nomes parecidos que não são tecnologia
const NOME_NAO = /multiprocessador|processador de alimentos|processador compacto|mini processador|projetor (para|de) desenho|mesa projetora|porta[- ]fones?|air ?fryer|fritadeira|liquidificador|batedeira|cafeteira|geladeira|refrigerador|fogao|micro-?ondas|lava-?lou|maquina de lavar|aspirador(?! robo)|ventilador|ar condicionado|purificador de agua|secador de cabelo|chapinha|prancha|barbeador|depilador|escova (dental|secadora)|panela|sanduicheira|grill|forno|cooler termico|caixa termica|mouse de pano|teclado (musical|infantil)|monitor (de bebe|cardiaco|de pressao)|camera de re\b|brinquedo|boneca|fantasia|camiseta|roupa|tenis|sandalia|chinelo/;

// categorias em que um nome "técnico" engana (processador de alimentos, projetor de desenho infantil)
const CAT_FORTE_NAO = /alimento|moedor|multiprocessador|cozinha|eletroportat|brinqued|infantil|bebe|moda|calcad|beleza|perfum|higiene|farm|medicament|\bpet\b|mercearia|bebida/;

function ehTecnologia(p) {
  const nome = normalizar(p.nome);
  const cat = normalizar(p.categoria);
  if (NOME_NAO.test(nome)) return false;
  if (cat && CAT_FORTE_NAO.test(cat)) return false;
  if (NOME_SIM.test(nome)) return true;
  if (cat && CAT_SIM.test(cat)) return true;
  if (cat && CAT_NAO.test(cat)) return false;
  return null;
}

// termos pesquisados nas lojas mistas (que vendem de tudo) para trazer só tecnologia
const TERMOS = [
  'notebook', 'smartphone', 'iphone', 'tablet', 'smart tv', 'monitor', 'ssd', 'placa de video', 'processador', 'memoria ram',
  'headset', 'fone de ouvido bluetooth', 'caixa de som', 'soundbar', 'smartwatch', 'console', 'playstation 5', 'xbox', 'nintendo switch',
  'mouse gamer', 'teclado mecanico', 'roteador', 'camera', 'impressora', 'projetor', 'alexa echo', 'kindle', 'carregador', 'power bank',
];

module.exports = { ehTecnologia, TERMOS };
