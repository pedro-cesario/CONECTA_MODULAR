const fs = require('fs');
let code = fs.readFileSync('backend/src/modules/evolucao/evolucaoController.js', 'utf8');

const regex = /conn = await getConnection\(\);\s*const sqlInsert = `[\s\S]*?`\s*;\s*await conn\.execute\(sqlInsert, {[\s\S]*?}, { autoCommit: true }\);/m;

const replacement = `conn = await getConnection();

    // 1. Pegar o CD_PESSOA_FISICA do paciente (obrigatório na evolucao_paciente)
    const sqlPaciente = \`SELECT cd_pessoa_fisica FROM atendimento_paciente WHERE nr_atendimento = :nrAtendimento\`;
    const resPaciente = await conn.execute(sqlPaciente, { nrAtendimento });
    if (!resPaciente.rows || resPaciente.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Atendimento não encontrado no Tasy' });
    }
    const cdPessoaFisicaPaciente = resPaciente.rows[0].CD_PESSOA_FISICA || resPaciente.rows[0].cd_pessoa_fisica;

    const sqlInsert = \`
      INSERT INTO evolucao_paciente (
        cd_evolucao, nr_atendimento, cd_medico, dt_evolucao, dt_liberacao, ds_evolucao, 
        ie_evolucao_clinica, ie_situacao, nm_usuario, ie_tipo_evolucao, cd_pessoa_fisica, dt_atualizacao
      ) VALUES (
        EVOLUCAO_PACIENTE_SEQ.NEXTVAL, :nrAtendimento, :cdMedico, SYSDATE, SYSDATE, :texto, 
        'EC', 'A', :nmUsuario, '1', :cdPessoaFisicaPaciente, SYSDATE
      )
    \`;

    await conn.execute(sqlInsert, { 
      nrAtendimento, 
      cdMedico,
      texto: texto || 'Evolução Clínica de Teste - Conecta',
      nmUsuario: usuario?.nm_usuario || 'CONECTA',
      cdPessoaFisicaPaciente
    }, { autoCommit: true });`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('backend/src/modules/evolucao/evolucaoController.js', code, 'utf8');
    console.log('Successfully updated criarEvolucaoTeste');
} else {
    console.log('Could not find target block to replace.');
}
