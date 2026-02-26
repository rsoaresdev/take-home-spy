/**
 * Descrição humanizada da qualidade do ar
 * @param {number|null} aqi
 * @returns {string}
 */
export const getAqiDescription = (aqi) => {
  if (aqi === null || aqi === undefined) return "A calcular...";
  if (aqi <= 20) return "Ar Puro. Excelente!";
  if (aqi <= 40) return "Qualidade Boa";
  if (aqi <= 60) return "Qualidade Moderada";
  if (aqi <= 80) return "Qualidade Má";
  if (aqi <= 100) return "Perigo Potencial";
  return "Qualidade Perigosa";
};

/**
 * Determina as cores do gradiente com base no valor do AQI
 * @param {number|null} aqi - Valor do AQI
 * @returns {string[]} Array de cores para o gradiente
 */
export const getGradientColors = (aqi) => {
  if (aqi === null) {
    return ["#0f172a", "#1e3a5f", "#0f172a"]; // azul escuro neutro
  }

  if (aqi < 50) {
    return ["#052e16", "#14532d", "#065f46"]; // verde escuro vibrante
  } else if (aqi < 100) {
    return ["#451a03", "#92400e", "#78350f"]; // âmbar/laranja escuro
  } else {
    return ["#450a0a", "#991b1b", "#7f1d1d"]; // vermelho escuro
  }
};

/**
 * Formata o valor do AQI
 * @param {number|null} aqi - Valor do AQI
 * @returns {string} Valor formatado
 */
export const formatAqiValue = (aqi) => {
  return aqi !== null ? Math.round(aqi).toString() : "--";
};
