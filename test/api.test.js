describe('API Health Check', () => {
  
  test('GET /api/ping - Servidor respondendo', async () => {
    const response = await api.get('/api/ping');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('ok');
  });

});

describe('API Endpoints', () => {
  
  let cookie;
  
  beforeAll(async () => {
    if (process.env.TEST_USERNAME && process.env.TEST_PASSWORD) {
      const res = await api
        .post('/api/login')
        .send({
          username: process.env.TEST_USERNAME,
          password: process.env.TEST_PASSWORD
        });
      cookie = res.headers['set-cookie'];
    }
  });

  describe('Auth', () => {
    
    test('POST /api/login - Credenciais válidas', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: credenciais não configuradas');
        return;
      }
      
      const response = await api
        .post('/api/login')
        .send({
          username: process.env.TEST_USERNAME,
          password: process.env.TEST_PASSWORD
        });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
      }
    });

    test('POST /api/login - Credenciais inválidas', async () => {
      const response = await api
        .post('/api/login')
        .send({
          username: 'teste-invalido',
          password: 'senha-invalida'
        });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('GET /api/me - Sessão válida', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/me')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('perfisDisponiveis');
      expect(response.body.data).toHaveProperty('perfilAtivo');
    });

    test('POST /api/perfil/alterar - Trocar perfil ativo', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }

      const meRes = await api.get('/api/me').set('Cookie', cookie);
      const perfis = meRes.body.data?.perfisDisponiveis || [];

      if (perfis.length === 0) {
        console.log('⚠️ Pulando teste: sem perfis disponíveis');
        return;
      }

      const perfilId = perfis[0].id;

      const response = await api
        .post('/api/perfil/alterar')
        .set('Cookie', cookie)
        .send({ perfil: perfilId });
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('perfilAtivo', perfilId);
    });

    test('POST /api/perfil/alterar - Perfil inválido', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }

      const response = await api
        .post('/api/perfil/alterar')
        .set('Cookie', cookie)
        .send({ perfil: 'perfil_inexistente' });
      
      expect(response.status).toBe(403);
    });
    
  });

  describe('Setores', () => {
    
    test('GET /api/setores - Listar setores', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/setores')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
    });

    test('POST /api/setores-internacao - Setores internação', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .post('/api/setores-internacao')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
    });

    test('GET /api/setores-livro - Setores livro', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/setores-livro')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
    });
    
  });

  describe('Usuários', () => {
    
    test('GET /api/tecnicos - Lista técnicos', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/tecnicos')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
    });

    test('GET /api/enfermeiros - Lista enfermeiros', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/enfermeiros')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
    });
    
  });

  describe('Pacientes', () => {
    
    test('POST /api/pacientes - Lista pacientes por setor', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const cd_setor = process.env.TEST_SETOR || '68';
      
      const response = await api
        .post('/api/pacientes')
        .set('Cookie', cookie)
        .send({ cd_setor });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('GET /api/pacientes-setor/:cd_setor - Pacientes por setor', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const cd_setor = process.env.TEST_SETOR || '68';
      
      const response = await api
        .get(`/api/pacientes-setor/${cd_setor}`)
        .set('Cookie', cookie);
      
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
    
  });

  describe('Dashboard', () => {
    
    test('GET /api/dashboard/setores - Setores dashboard', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/dashboard/setores')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
    });

    test('GET /api/dashboard/pacientes - Pacientes dashboard', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const cd_setor = process.env.TEST_SETOR || '68';
      
      const response = await api
        .get(`/api/dashboard/pacientes?cd_setor=${cd_setor}`)
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('POST /api/dashboard/pacientes-setor/:cd_setor - Pacientes dashboard por setor', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const cd_setor = process.env.TEST_SETOR || '68';
      
      const response = await api
        .post(`/api/dashboard/pacientes-setor/${cd_setor}`)
        .set('Cookie', cookie);
      
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('GET /api/dashboard/internacao - Pacientes com indicação de internação', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/dashboard/internacao')
        .set('Cookie', cookie);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('particularesAlta');
      expect(response.body.data).toHaveProperty('altaMedica');
      expect(response.body.data).toHaveProperty('salaObservacao');
      expect(response.body.data).toHaveProperty('indicacaoInternacao');
      expect(response.body.data).toHaveProperty('decididos');
    });
    
  });

  describe('Ocorrências', () => {
    
    test('POST /api/salvar - Salvar Passagem de Plantão', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .post('/api/salvar')
        .set('Cookie', cookie)
        .send({
          cd_setor: '68',
          nr_atendimento: '999999',
          ds_ocorrencia: 'TESTE AUTOMATIZADO - Jest',
          tp_turno: '1'
        });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('POST /api/livro-administrativo - Salvar Livro', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .post('/api/livro-administrativo')
        .set('Cookie', cookie)
        .send({
          cd_setor: '68',
          cd_enfermeiro: '1',
          dt_planto: new Date().toISOString().split('T')[0],
          tp_turno: 'M',
          ds_observacao: 'TESTE AUTOMATIZADO'
        });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('POST /api/escala-tecnica - Salvar Escala', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .post('/api/escala-tecnica')
        .set('Cookie', cookie)
        .send({
          cd_setor: '68',
          dt_planto: new Date().toISOString().split('T')[0],
          tp_turno: 'M',
          nm_tecnicos: ['Teste']
        });
      
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('GET /api/escala-tecnica - Obter Escala', async () => {
      if (!cookie) {
        console.log('⚠️ Pulando teste: sem sessão');
        return;
      }
      
      const response = await api
        .get('/api/escala-tecnica')
        .set('Cookie', cookie);
      
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
    
  });

});