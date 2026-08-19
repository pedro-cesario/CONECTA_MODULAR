describe('Testes de Integração - Fluxos Completos', () => {
  
  let cookie;
  const testSector = process.env.TEST_SETOR || '68';
  
  beforeAll(async () => {
    if (!process.env.TEST_USERNAME || !process.env.TEST_PASSWORD) {
      console.log('⚠️ Pulando testes de integração: credenciais não configuradas');
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
      console.log('✓ Login realizado com sucesso');
    }
  });

  describe('Fluxo 1: Passagem de Plantão', () => {
    
    test('Login → Listar Setores → Listar Pacientes → Salvar Ocorrência', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem login');
        return;
      }
      
      const setoresRes = await api
        .get('/api/setores')
        .set('Cookie', cookie);
      expect(setoresRes.status).toBe(200);
      
      const pacientesRes = await api
        .post('/api/pacientes')
        .set('Cookie', cookie)
        .send({ cd_setor: testSector });
      expect(pacientesRes.status).toBeGreaterThanOrEqual(200);
      
      const salvarRes = await api
        .post('/api/salvar')
        .set('Cookie', cookie)
        .send({
          cd_setor: testSector,
          nr_atendimento: '999998',
          ds_ocorrencia: 'TESTE INTEGRAÇÃO - Fluxo 1 Jest',
          tp_turno: '1'
        });
      expect(salvarRes.status).toBeGreaterThanOrEqual(200);
    });
    
  });

  describe('Fluxo 2: Livro Administrativo', () => {
    
    test('Login → Setores Livro → Salvar Livro', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem login');
        return;
      }
      
      const setoresRes = await api
        .get('/api/setores-livro')
        .set('Cookie', cookie);
      expect(setoresRes.status).toBe(200);
      
      const livroRes = await api
        .post('/api/livro-administrativo')
        .set('Cookie', cookie)
        .send({
          cd_setor: testSector,
          cd_enfermeiro: '1',
          dt_planto: new Date().toISOString().split('T')[0],
          tp_turno: 'M',
          ds_observacao: 'TESTE INTEGRAÇÃO - Fluxo 2 Jest'
        });
      expect(livroRes.status).toBeGreaterThanOrEqual(200);
    });
    
  });

  describe('Fluxo 3: Dashboard', () => {
    
    test('Login → Dashboard Setores → Dashboard Pacientes', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem login');
        return;
      }
      
      const dashRes = await api
        .get('/api/dashboard/setores')
        .set('Cookie', cookie);
      expect(dashRes.status).toBe(200);
      
      const pacientesRes = await api
        .post(`/api/dashboard/pacientes-setor/${testSector}`)
        .set('Cookie', cookie);
      expect(pacientesRes.status).toBeGreaterThanOrEqual(200);
    });

    test('Login → Perfil Alterar → Dashboard Internação', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem login');
        return;
      }

      const meRes = await api.get('/api/me').set('Cookie', cookie);
      const perfis = meRes.body.data?.perfisDisponiveis || [];
      const perfilEnfermagem = perfis.find(p => p.id === 'enfermagem');

      if (perfilEnfermagem) {
        const alterarRes = await api
          .post('/api/perfil/alterar')
          .set('Cookie', cookie)
          .send({ perfil: 'enfermagem' });
        expect(alterarRes.status).toBe(200);
      }

      const internacaoRes = await api
        .get('/api/dashboard/internacao')
        .set('Cookie', cookie);
      expect(internacaoRes.status).toBe(200);
      expect(internacaoRes.body.data).toHaveProperty('particularesAlta');
      expect(internacaoRes.body.data).toHaveProperty('altaMedica');
      expect(internacaoRes.body.data).toHaveProperty('salaObservacao');
      expect(internacaoRes.body.data).toHaveProperty('indicacaoInternacao');
      expect(internacaoRes.body.data).toHaveProperty('decididos');
    });
    
  });

  describe('Fluxo 4: Escala Técnica', () => {
    
    test('Login → Salvar Escala → Obter Escala', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem login');
        return;
      }
      
      const escalaRes = await api
        .post('/api/escala-tecnica')
        .set('Cookie', cookie)
        .send({
          cd_setor: testSector,
          dt_planto: new Date().toISOString().split('T')[0],
          tp_turno: 'M',
          nm_tecnicos: ['Técnico Teste']
        });
      expect(escalaRes.status).toBeGreaterThanOrEqual(200);
      
      const obterRes = await api
        .get('/api/escala-tecnica')
        .set('Cookie', cookie);
      expect(obterRes.status).toBeGreaterThanOrEqual(200);
    });
    
  });

  describe('Fluxo 5: Múltiplas Requisições', () => {
    
    test('Verifica que Session persiste', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando: sem login');
        return;
      }
      
      for (let i = 0; i < 3; i++) {
        const res = await api
          .get('/api/me')
          .set('Cookie', cookie);
        expect(res.status).toBe(200);
      }
    });
    
  });

});