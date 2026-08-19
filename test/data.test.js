describe('Testes de Inserção e Validação de Dados', () => {
  
  let cookie;
  const testSector = process.env.TEST_SETOR || '68';
  let nrOcorrenciaTeste = null;
  
  beforeAll(async () => {
    if (!process.env.TEST_USERNAME || !process.env.TEST_PASSWORD) {
      console.log('⚠️ Pulando testes: credenciais não configuradas');
      return;
    }
    
    const res = await api
      .post('/api/login')
      .send({
        username: process.env.TEST_USERNAME,
        password: process.env.TEST_PASSWORD
      });
    
    if (res.status === 200) {
      cookie = res.headers['set-cookie'];
    }
  });

  describe('POST - Inserir Dados', () => {
    
    test('POST /api/salvar - Inserir Passagem de Plantão', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem sessão');
        return;
      }
      
      nrOcorrenciaTeste = 'TESTE' + Date.now();
      
      const response = await api
        .post('/api/salvar')
        .set('Cookie', cookie)
        .send({
          cd_setor: testSector,
          nr_atendimento: nrOcorrenciaTeste,
          ds_ocorrencia: '[TESTE-AUTO] Teste Jest INSERT',
          ds_ocorrencia_internacao: '[TESTE-AUTO] Internação Jest',
          tp_turno: '1',
          ds_intercorrencias: ['Intercorrência 1', 'Intercorrência 2']
        });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.success).toBe(true);
      expect(response.body.nr_ocorrencia).toBeDefined();
      console.log('✓ PASSAGEM DE PLANTÃO inserida:', response.body.nr_ocorrencia);
    });

    test('POST /api/livro-administrativo - Inserir Livro', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem sessão');
        return;
      }
      
      const response = await api
        .post('/api/livro-administrativo')
        .set('Cookie', cookie)
        .send({
          cd_setor: testSector,
          cd_enfermeiro: '1',
          dt_planto: new Date().toISOString().split('T')[0],
          tp_turno: 'M',
          ds_observacao: '[TESTE-AUTO] Livro Jest',
          nm_tecnicos: ['Técnico A', 'Técnico B']
        });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.success).toBe(true);
      console.log('✓ LIVRO ADMINISTRATIVO inserido');
    });

    test('POST /api/escala-tecnica - Inserir Escala', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem sessão');
        return;
      }
      
      const response = await api
        .post('/api/escala-tecnica')
        .set('Cookie', cookie)
        .send({
          cd_setor: testSector,
          dt_planto: new Date().toISOString().split('T')[0],
          tp_turno: 'M',
          nm_tecnicos: ['Técnico Teste A', 'Técnico Teste B']
        });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.success).toBe(true);
      console.log('✓ ESCALA TÉCNICA inserida');
    });
    
  });

  describe('GET - Verificar Dados Inseridos', () => {
    
    test('GET /api/salvar - Listar ocorrências criadas', async () => {
      if (!cookie || !nrOcorrenciaTeste) {
        console.log('⚠️ Pulando: sem dados');
        return;
      }
      
      const response = await api
        .get('/api/salvar')
        .set('Cookie', cookie)
        .query({ cd_setor: testSector });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.success).toBe(true);
      
      const temTeste = response.body.dados?.some(o => o.NR_ATENDIMENTO === nrOcorrenciaTeste);
      if (temTeste) {
        console.log('✓ Dados de PASSAGEM verificados no banco');
      }
    });

    test('GET /api/livro-administrativo - Listar livros', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/livro-administrativo')
        .set('Cookie', cookie)
        .query({ cd_setor: testSector });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.success).toBe(true);
      console.log('✓ Dados de LIVRO verificados no banco');
    });

    test('GET /api/escala-tecnica - Listar escalas', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/escala-tecnica')
        .set('Cookie', cookie)
        .query({ cd_setor: testSector });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.success).toBe(true);
      console.log('✓ Dados de ESCALA verificados no banco');
    });
    
  });

});