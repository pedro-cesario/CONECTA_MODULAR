COMMENT ON TABLE CONECTA_AUD_NISA IS 'Cabeçalho das auditorias do Conecta/NISA. Fonte oficial para histórico, exportação e indicadores.';
COMMENT ON COLUMN CONECTA_AUD_NISA.IE_TIPO_AUDITORIA IS 'Tipo da auditoria. Inicialmente HIGIENE_MAOS.';
COMMENT ON COLUMN CONECTA_AUD_NISA.IE_TURNO IS 'D = Dia; N = Noite.';
COMMENT ON TABLE CONECTA_AUD_NISA_PROF IS 'Profissional avaliado em uma auditoria; mantém nome histórico.';
COMMENT ON TABLE CONECTA_AUD_NISA_OPORT IS 'Oportunidades observadas. A e S são conformes; P é oportunidade perdida.';
COMMENT ON COLUMN CONECTA_AUD_NISA_OPORT.IE_RESULTADO IS 'A = Álcool; S = Sabonete; P = Perdida.';
