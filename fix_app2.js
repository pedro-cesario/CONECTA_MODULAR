const fs = require('fs');
let content = fs.readFileSync('frontend/js/app.js', 'utf8');
const searchString = `      const testBar = document.getElementById('test-environment-bar');\n      if (testBar) {`;
const searchIndex = content.lastIndexOf(searchString);
if (searchIndex !== -1) {
  content = content.substring(0, searchIndex + searchString.length + 1);
  content += `        testBar.classList.toggle('d-none', !result.showTestBar);
        document.documentElement.style.setProperty('--app-environment-height', result.showTestBar ? '25px' : '0px');
      }

      status?.classList.remove('offline');
      if (statusText) statusText.textContent = 'Todos os serviços estão operando normalmente';

    } catch (e) {
      document.getElementById('system-status')?.classList.add('offline');
      const statusText = document.getElementById('system-status-text');
      if (statusText) statusText.textContent = 'Não foi possível confirmar o status dos serviços';
    }

  }

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      window.location.reload();
    }
  });

  loadVersion();

  window.addEventListener('beforeunload', () => {
    flushPendingDrafts();
  });

  checkSession();

  setTimeout(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.getBoundingClientRect().bottom > window.innerHeight) {
        console.log('OVERFLOW:', el.tagName, el.className, el.id, el.getBoundingClientRect().bottom);
      }
    });
  }, 2000);

  async function populatePassagensFilterSetores() {
    const select = document.getElementById('passagens-filter-setor');
    if (!select || select.options.length > 1) return; // already populated
    
    try {
      const result = await api.get('/api/passagens/setores-historico');
      if (result.success && result.data) {
        const setoresHistorico = result.data || [];
        setoresHistorico.sort((a, b) => a.ds_setor_atendimento.localeCompare(b.ds_setor_atendimento));
        
        setoresHistorico.forEach(s => {
          const option = document.createElement('option');
          option.value = s.cd_setor_atendimento;
          option.textContent = s.ds_setor_atendimento;
          select.appendChild(option);
        });
      }
    } catch (err) {
      console.error('Erro ao carregar setores do histórico', err);
    }
  }

})();
`;
  fs.writeFileSync('frontend/js/app.js', content);
  console.log('Fixed app.js again');
} else {
  console.log('Search index not found');
}
