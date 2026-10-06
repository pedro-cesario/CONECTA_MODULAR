import { api } from '../../core/api.js';
import * as ui from '../../core/ui.js';
import * as router from '../../core/router.js';

export function setupEvolucao() {
  const btnAbrir = document.getElementById('btn-abrir-evolucao');
  const screenEvolucao = document.getElementById('screen-evolucao');
  const btnLiberar = document.getElementById('btn-evo-liberar');
  const btnValidar = document.getElementById('btn-evo-validar');

  if (btnAbrir) {
    btnAbrir.addEventListener('click', () => {
      router.activateWorkspace('evolucao', document.getElementById('sec-evolucao'));
    });
  }

  if (btnLiberar) {
    btnLiberar.addEventListener('click', async () => {
      const nrAtendimento = document.getElementById('inp-evo-atendimento').value;
      const texto = document.getElementById('inp-evo-texto').value;

      if (!nrAtendimento) {
        ui.showToast('Informe o número do atendimento.', 'warning');
        return;
      }

      try {
        ui.showToast('Criando evolução no banco...', 'info');
        const data = await api.post('/api/evolucao/criar', { nrAtendimento, texto });

        if (!data.success) {
          ui.showToast(data.message || 'Erro ao criar evolução', 'danger');
          return;
        }

        ui.showToast('Evolução criada! Iniciando assinatura digital...', 'info');

        // Automação da assinatura digital pelo Heimdall
        let heimdallObj = window.heimdall || (window.parent && window.parent.heimdall) || (window.top && window.top.heimdall);
        
        console.log('Heimdall Check:', { heimdall: !!heimdallObj, hasXml: !!data.xmlCanonico, cpfMedico: data.cpfMedico });

        if (heimdallObj && data.xmlCanonico && data.cpfMedico) {
            try {
                const sigModule = heimdallObj.module({ name: '@philips-emr/tasy-native-signature-module', version: '*' });
                const result = await sigModule.run('SIGN', {
                    signaturePreparedPayload: {
                        id: data.cpfMedico,
                        data: data.xmlCanonico,
                        userPolicy: 0
                    }
                });
                
                await registrarAssinatura(data, result);
            } catch (sigErr) {
                console.error("Erro na assinatura Heimdall direta:", sigErr);
                ui.showToast('Evolução criada, mas o processo de assinatura digital falhou.', 'warning');
            }
        } else if (window.opener && data.xmlCanonico && data.cpfMedico) {
            ui.showToast('Solicitando assinatura digital ao Tasy...', 'info');
            
            const cdEvolucaoNum = Number(data.cd_evolucao);

            // Construir o envelope XML esperado pelo Vault ID
            const base64Xml = btoa(unescape(encodeURIComponent(data.xmlCanonico)));
            const dataEnvelope = `<XML>\r\n<SIG_FORMAT>ATTACHED</SIG_FORMAT>\r\n<USER_CPF>${data.cpfMedico}</USER_CPF>\r\n<SIG_POLICY>CMS</SIG_POLICY>\r\n<DOC>${base64Xml}</DOC>\r\n</XML>`;

            const payload = {
                "@class": "br.com.philips.tasy.dto.shared.signature.WSignaturePreparedPayload",
                "batch": false,
                "configured": true,
                "data": dataEnvelope,
                "id": data.cpfMedico,
                "message": 0,
                "ready": true,
                "projects": [
                    {
                        "@class": "br.com.philips.tasy.dto.shared.wSignature.WSignatureProject",
                        "actionClass": "WSignatureDefaultAction",
                        "batch": false,
                        "batchParameters": [],
                        "consultToSign": false,
                        "functionCode": "281",
                        "ieImprimir": "0",
                        "inactivation": false,
                        "parameters": {
                            "CD_EVOLUCAO": cdEvolucaoNum,
                            "NR_SEQUENCIA": cdEvolucaoNum
                        },
                        "processDescription": "EP",
                        "projectCode": "183",
                        "reportCode": "783",
                        "reportParameters": {
                            "CD_EVOLUCAO": cdEvolucaoNum,
                            "NR_SEQUENCIA": cdEvolucaoNum
                        },
                        "reportType": "WATE",
                        "tableName": "EVOLUCAO_PACIENTE"
                    }
                ]
            };

            const onMessage = async (e) => {
                if (e.data && e.data.type === 'HEIMDALL_SIGN_RESULT') {
                    // O Heimdall pode retornar status 500 dentro de result em vez de cair no catch
                    const resultObj = e.data.result || {};
                    const isHttpError = resultObj.status >= 400 || (resultObj.entity && typeof resultObj.entity === 'string' && resultObj.entity.includes('Exception'));
                    
                    window.removeEventListener('message', onMessage);
                    if (e.data.success && !isHttpError) {
                        console.log("Sucesso na assinatura pelo proxy!");
                        await registrarAssinatura(data, e.data.result);
                    } else {
                        const errorMsg = e.data.error || (resultObj.entity ? resultObj.entity : JSON.stringify(resultObj));
                        console.error("Erro retornado pelo proxy:", errorMsg);
                        ui.showToast('Falha na assinatura proxy: ' + errorMsg, 'danger');
                    }
                }
            };
            
            window.addEventListener('message', onMessage);
            
            window.opener.postMessage({
                type: 'HEIMDALL_SIGN',
                payload: payload
            }, '*');

            // Timeout de segurança
            setTimeout(() => {
                window.removeEventListener('message', onMessage);
            }, 60000);
        } else {
            ui.showToast('Evolução criada! (Ambiente fora do Tasy Native, sem assinatura automática)', 'success');
        }

        async function registrarAssinatura(dataObj, result) {
            console.log("Resultado bruto retornado pelo Heimdall Proxy:", JSON.stringify(result));
            
            // O Vault ID retorna os dados em result.entity.data
            const pacoteAssinado = result && (
                (result.entity && result.entity.data) || 
                result.signedData || 
                result.data || 
                result.signature || 
                result.signatureData || 
                result.cades
            );

            if (pacoteAssinado) {
                const base64XmlStr = btoa(unescape(encodeURIComponent(dataObj.xmlCanonico)));
                const envelopeStr = `<XML>\r\n<SIG_FORMAT>ATTACHED</SIG_FORMAT>\r\n<USER_CPF>${dataObj.cpfMedico}</USER_CPF>\r\n<SIG_POLICY>CMS</SIG_POLICY>\r\n<DOC>${base64XmlStr}</DOC>\r\n</XML>`;

                const assinarRes = await api.post('/api/evolucao/assinar', {
                    cd_evolucao: dataObj.cd_evolucao,
                    signedData: pacoteAssinado,
                    md5Hash: dataObj.md5Hash,
                    cd_medico: dataObj.cdMedico,
                    nm_usuario: dataObj.nmUsuarioLogado,
                    xmlCanonico: dataObj.xmlCanonico,
                    xmlEnvelope: envelopeStr
                });
                
                if (assinarRes.success) {
                    ui.showToast('Evolução criada e assinada digitalmente com sucesso!', 'success');
                } else {
                    ui.showToast('Evolução criada, mas falhou ao registrar no Oracle: ' + assinarRes.message, 'warning');
                }
            } else {
                console.error("Faltou o campo signedData no retorno do Heimdall:", result);
                ui.showToast('Falha ao obter assinatura: veja o console (F12) para os detalhes do erro do Vault ID.', 'danger');
            }
        }

      } catch (err) {
        console.error(err);
        ui.showToast('Falha na comunicação com servidor.', 'danger');
      }
    });
  }

  if (btnValidar) {
    btnValidar.addEventListener('click', async () => {
      const nrAtendimento = document.getElementById('inp-evo-atendimento').value;
      if (!nrAtendimento) {
        ui.showToast('Informe o número do atendimento.', 'warning');
        return;
      }

      try {
        const res = await api.get('/api/evolucao/validar/' + nrAtendimento);
        if (res.success && res.assinado) {
          ui.showModal('success', 'Assinatura Digital - ICP-Brasil', `
            <div class="alert alert-success d-flex align-items-center" role="alert" style="text-align: left;">
              <i class="bi bi-shield-check fs-2 me-3"></i>
              <div>
                <strong>Documento Assinado Digitalmente</strong><br/>
                ${res.detalhes_assinatura || `Assinado digitalmente por ${res.medico}.`}
              </div>
            </div>
            <div class="mt-3 text-start" style="text-align: left;">
              <p><strong>Médico:</strong> ${res.medico}</p>
              <p><strong>Data de Liberação:</strong> ${res.data_liberacao}</p>
              <p><strong>Hash de Validação Tasy:</strong> ${res.nr_seq_assinatura}</p>
              ${res.eventos_auditoria && res.eventos_auditoria.length ? `<p><strong>Eventos de Auditoria:</strong> ${res.eventos_auditoria.join(', ')}</p>` : ''}
            </div>
          `);
        } else {
          ui.showModal('warning', 'Assinatura Digital - Status', `
            <div class="alert alert-warning d-flex align-items-center" role="alert" style="text-align: left;">
              <i class="bi bi-exclamation-triangle fs-2 me-3"></i>
              <div>
                <strong>Evolução pendente de assinatura digital no Tasy</strong><br/>
                ${res.message || 'O documento ainda não foi assinado ou validado.'}
              </div>
            </div>
          `);
        }
      } catch (err) {
        console.error(err);
        ui.showToast('Erro ao validar assinatura', 'danger');
      }
    });
  }
}
