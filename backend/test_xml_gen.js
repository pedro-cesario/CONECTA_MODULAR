const crypto = require('crypto');
const db = require('./src/core/database');
const oracledb = require('oracledb');

async function testGen() {
    let conn;
    try {
        conn = await db.getConnection();
        const cdEvolucao = 2429938; // Previously inserted sequence we found in tasy_assinat_dig_log
        
        const sqlQuery = `
        SELECT
              a.*,
              SUBSTR(obter_nome_pessoa_fisica(cd_pessoa_fisica, NULL),1,200) NM_PESSOA_FISICA,
              SUBSTR(obter_nome_pessoa_fisica(cd_medico, NULL),1,200) NM_MEDICO,
              SUBSTR(obter_valor_dominio(72, ie_tipo_evolucao),1,200) DS_TIPO_EVOLUCAO,
              SUBSTR(obter_desc_espec_medica(CD_ESPECIALIDADE),1,50) DS_ESPECIALIDADE,
              SUBSTR(obter_desc_espec_medica(CD_ESPECIALIDADE_MEDICO),1,50) DS_ESPECIALIDADE_PROF,
              SUBSTR(obter_nome_pessoa_fisica(cd_medico_parecer, NULL),1,200) NM_MEDICO_PARECER,
              SUBSTR(obter_nome_setor(cd_setor_atendimento),1,40) DS_SETOR_ATENDIMENTO,
              SUBSTR(obter_desc_cido_topografia(CD_TOPOGRAFIA),1,100) DS_TOPOGRAFIA,
              SUBSTR(obter_cor_tipo_evolucao(IE_EVOLUCAO_CLINICA),1,15) DS_COR_TIPO_EVOLUCAO,
              SUBSTR(Obter_Descricao_Padrao('CAN_ESTADO_DOENCA','DS_ESTADO',a.CD_ESTADO_DOENCA),1,255) DS_ESTADO_DOENCA,
              SUBSTR(Obter_Descricao_Padrao('CAN_ESTADO_PACIENTE','DS_ESTADO',a.IE_ESTADO_PAC_FIM_TRAT),1,255) DS_ESTADO_PAC_FIM_TRAT,
              TO_CHAR(DT_EVOLUCAO, 'DD/MM/YYYY') AS DT_EVOLUCAO_STR,
              TO_CHAR(DT_LIBERACAO, 'DD/MM/YYYY HH24:MI:SS') AS DT_LIBERACAO_STR
        FROM evolucao_paciente a
        WHERE a.cd_evolucao = :cdEvolucao
        `;
        const result = await conn.execute(sqlQuery, { cdEvolucao }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (result.rows.length === 0) {
             console.log("No row found"); return;
        }
        
        const row = result.rows[0];
        
        const safeXml = (val) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes('<')) return `<![CDATA[${val}]]>`;
            return val;
        };
        
        const xmlCanonico = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Evolucoes>
<Evolucao>
<CD_ESPECIALIDADE>${safeXml(row.CD_ESPECIALIDADE)}</CD_ESPECIALIDADE>
<CD_MEDICO_PARECER>${safeXml(row.CD_MEDICO_PARECER)}</CD_MEDICO_PARECER>
<NR_ATENDIMENTO>${safeXml(row.NR_ATENDIMENTO)}</NR_ATENDIMENTO>
<DS_EVOLUCAO><![CDATA[${row.DS_EVOLUCAO}]]></DS_EVOLUCAO>
<DT_EVOLUCAO>${safeXml(row.DT_EVOLUCAO_STR)}</DT_EVOLUCAO>
<CD_EVOLUCAO>${safeXml(row.CD_EVOLUCAO)}</CD_EVOLUCAO>
<CD_MEDICO>${safeXml(row.CD_MEDICO)}</CD_MEDICO>
<DT_LIBERACAO>${safeXml(row.DT_LIBERACAO_STR)}</DT_LIBERACAO>
<IE_EVOLUCAO_CLINICA>${safeXml(row.IE_EVOLUCAO_CLINICA)}</IE_EVOLUCAO_CLINICA>
<IE_RECEM_NATO>${safeXml(row.IE_RECEM_NATO)}</IE_RECEM_NATO>
<CD_ESPECIALIDADE_MEDICO>${safeXml(row.CD_ESPECIALIDADE_MEDICO)}</CD_ESPECIALIDADE_MEDICO>
<IE_TIPO_EVOLUCAO>${safeXml(row.IE_TIPO_EVOLUCAO)}</IE_TIPO_EVOLUCAO>
<CD_PESSOA_FISICA>${safeXml(row.CD_PESSOA_FISICA)}</CD_PESSOA_FISICA>
<CD_SETOR_ATENDIMENTO>${safeXml(row.CD_SETOR_ATENDIMENTO)}</CD_SETOR_ATENDIMENTO>
<QT_PESO>${safeXml(row.QT_PESO)}</QT_PESO>
<QT_ALTURA>${safeXml(row.QT_ALTURA)}</QT_ALTURA>
<QT_SUPERF_CORPORIA>${safeXml(row.QT_SUPERF_CORPORIA)}</QT_SUPERF_CORPORIA>
<CD_TOPOGRAFIA>${safeXml(row.CD_TOPOGRAFIA)}</CD_TOPOGRAFIA>
<CD_TUMOR_PRIM_PAT>${safeXml(row.CD_TUMOR_PRIM_PAT)}</CD_TUMOR_PRIM_PAT>
<CD_LINFONODO_REG_PAT>${safeXml(row.CD_LINFONODO_REG_PAT)}</CD_LINFONODO_REG_PAT>
<CD_METASTASE_DIST_PAT>${safeXml(row.CD_METASTASE_DIST_PAT)}</CD_METASTASE_DIST_PAT>
<CD_ESTADIO_OUTRO>${safeXml(row.CD_ESTADIO_OUTRO)}</CD_ESTADIO_OUTRO>
<DT_INICIO_TRAT_PROPOSTO>${safeXml(row.DT_INICIO_TRAT_PROPOSTO)}</DT_INICIO_TRAT_PROPOSTO>
<DT_FINAL_TRAT_PROPOSTO>${safeXml(row.DT_FINAL_TRAT_PROPOSTO)}</DT_FINAL_TRAT_PROPOSTO>
<CD_ESTADO_DOENCA>${safeXml(row.CD_ESTADO_DOENCA)}</CD_ESTADO_DOENCA>
<IE_ESTADO_PAC_FIM_TRAT>${safeXml(row.IE_ESTADO_PAC_FIM_TRAT)}</IE_ESTADO_PAC_FIM_TRAT>
<NM_MEDICO>${safeXml(row.NM_MEDICO)}</NM_MEDICO>
<DS_TIPO_EVOLUCAO>${safeXml(row.DS_TIPO_EVOLUCAO)}</DS_TIPO_EVOLUCAO>
<NM_PESSOA_FISICA>${safeXml(row.NM_PESSOA_FISICA)}</NM_PESSOA_FISICA>
<DS_ESTADO_DOENCA>${safeXml(row.DS_ESTADO_DOENCA)}</DS_ESTADO_DOENCA>
<DS_ESTADO_PAC_FIM_TRAT>${safeXml(row.DS_ESTADO_PAC_FIM_TRAT)}</DS_ESTADO_PAC_FIM_TRAT>
<DS_ESPECIALIDADE>${safeXml(row.DS_ESPECIALIDADE)}</DS_ESPECIALIDADE>
<DS_ESPECIALIDADE_PROF>${safeXml(row.DS_ESPECIALIDADE_PROF)}</DS_ESPECIALIDADE_PROF>
<NM_MEDICO_PARECER>${safeXml(row.NM_MEDICO_PARECER)}</NM_MEDICO_PARECER>
<DS_SETOR_ATENDIMENTO>${safeXml(row.DS_SETOR_ATENDIMENTO)}</DS_SETOR_ATENDIMENTO>
<DS_TOPOGRAFIA>${safeXml(row.DS_TOPOGRAFIA)}</DS_TOPOGRAFIA>
<DS_COR_TIPO_EVOLUCAO>${safeXml(row.DS_COR_TIPO_EVOLUCAO)}</DS_COR_TIPO_EVOLUCAO>
</Evolucao>
</Evolucoes>
`;
        console.log(xmlCanonico);
        
        const md5Hash = crypto.createHash('md5').update(Buffer.from(xmlCanonico, 'latin1')).digest('hex');
        console.log("MD5 Hash:", md5Hash);
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch(err) {}
        }
        process.exit(0);
    }
}
testGen();
