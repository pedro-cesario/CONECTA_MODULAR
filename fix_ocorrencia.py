import re

with open('backend/services/ocorrenciaService.js', 'r') as f:
    content = f.read()

# Fix the duplicate buildPacienteEntries / salvarPassagem mess
# We want to find the end of buildPacienteEntries and manually write the clean state.

# The duplicate block seems to be around `const atendBind = `atend_${atendimento}`;`

# I will just write the original block of code for buildPacienteEntries and salvarPassagem

correct_block = """
    const atendBind = `atend_${atendimento}`;
    binds[atendBind] = atendimento;

    const setorPlaceholders = setoresNumericos.map((s, i) => {
      const key = `setor_in_${atendimento}_${i}`;
      binds[key] = s;
      return `:${key}`;
    }).join(', ');

    selects.push(`
    SELECT
      TO_CHAR(apv.cd_setor_atendimento) AS cd_setor_linha,
      :${atendBind} AS ordem_item,
      'Setor: ' || obter_desc_setor_atend(apv.cd_setor_atendimento) || CHR(10) ||
      'Paciente: ' || obter_nome_paciente(apv.nr_atendimento) ||
      ' (Atendimento: ' || apv.nr_atendimento || ')' || CHR(10) ||
      CASE WHEN :${bindCheckbox} IS NOT NULL THEN :${bindCheckbox} || CHR(10) ELSE '' END ||
      CASE WHEN :${bindTexto} IS NOT NULL THEN 'Intercorrência: ' || :${bindTexto} || CHR(10) ELSE '' END ||
      CHR(10) AS texto_linha
    FROM atendimento_paciente_v apv
    WHERE apv.nr_atendimento = :${atendBind}
      AND apv.cd_setor_atendimento IN (${setorPlaceholders})`);
  }

  return selects;
}

async function salvarPassagem(dados, usuario) {
  const {
    nr_seq_turno,
    setoresSelecionados,
    cd_modulo,
    intercorrencias = {},
    setorIntercorrencias = {}
  } = dados;

  if (!nr_seq_turno || ![1, 2, 3, 4, 5].includes(nr_seq_turno)) {
    throw Object.assign(new Error('Turno inválido'), { status: 400 });
  }
  if (!Array.isArray(setoresSelecionados) || setoresSelecionados.length === 0) {
    throw Object.assign(new Error('Nenhum setor selecionado'), { status: 400 });
  }
  if (!cd_modulo || ![1, 4].includes(Number(cd_modulo))) {
    throw Object.assign(new Error('Módulo inválido'), { status: 400 });
  }

  const setoresNumericos = setoresSelecionados.map(Number);
  if (setoresNumericos.some(cd => !Number.isInteger(cd))) {
    throw Object.assign(new Error('Setor inválido informado na requisição'), { status: 400 });
  }

  let connection;
  try {
    connection = await getConnection();

    const cdPerfil = getCdPerfilForInsert(usuario, cd_modulo);
    if (!cdPerfil) {
      throw Object.assign(new Error('Perfil não encontrado para este módulo'), { status: 400 });
    }

    const binds = {
      nm_usuario_logado: usuario.nm_usuario,
      nr_seq_turno,
      setor_referencia: getSetorReferenciaFixo(setoresNumericos),
      cd_perfil: cdPerfil
    };

    const setorSelects = buildSetorEntries(setorIntercorrencias, binds);
    const pacienteSelects = buildPacienteEntries(intercorrencias, setoresNumericos, binds);
    const selects = [...setorSelects, ...pacienteSelects];

    if (selects.length === 0) {
"""

# Regex to find the broken section:
# Starts at `const bindTexto = \`occ_txt_\${atendimento}\`;\n    binds[bindCheckbox] = textoCheckbox || null;\n    binds[bindTexto] = textoIntercorrencia || null;\n`
# Ends at `    if (selects.length === 0) {\n`

prefix = r"(binds\[bindTexto\] = textoIntercorrencia \|\| null;\n)"
suffix = r"(    if \(selects.length === 0\) \{\n)"

new_content = re.sub(prefix + r".*?" + suffix, r"\1" + correct_block, content, flags=re.DOTALL)

with open('backend/services/ocorrenciaService.js', 'w') as f:
    f.write(new_content)

print("Fix applied successfully")
