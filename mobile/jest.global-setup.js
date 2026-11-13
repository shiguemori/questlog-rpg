/**
 * Fuso fixo nos testes de tela: o produto usa America/Sao_Paulo e os testes montam
 * datas locais. Sem isto, o CI (UTC) gera outro horário, outra semente de sorte na
 * batalha e outro resultado de luta.
 */
module.exports = () => {
  process.env.TZ = 'America/Sao_Paulo';
};
