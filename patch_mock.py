with open('backend/src/test_e2e_triagem_mock.js', 'r') as f:
    c = f.read()
    
new_settings = """
  SettingsService.getSetting = async (key) => {
    const s = {
      'triagem_estab': 1, 'triagem_setor': 2, 'triagem_procedencia': 3, 'triagem_tipo_atend': 4, 'triagem_clinica': 5,
      'triagem_cor_vermelho': 1, 'triagem_cor_amarelo': 3, 'triagem_cor_verde': 4, 'triagem_cor_azul': 5, 'triagem_fila_destino': 99
    };
    return s[key] || null;
  };
"""

c = c.replace("""  SettingsService.getSetting = async (key) => {
    if (key === 'triagem_cor_vermelho') return 1;
    if (key === 'triagem_cor_amarelo') return 3;
    if (key === 'triagem_cor_verde') return 4;
    if (key === 'triagem_cor_azul') return 5;
    if (key === 'triagem_fila_destino') return 99;
    return null;
  };""", new_settings)

with open('backend/src/test_e2e_triagem_mock.js', 'w') as f:
    f.write(c)
