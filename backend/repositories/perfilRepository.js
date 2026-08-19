const { getConnection } = require('../database');

async function findByDsPerfil(dsPerfil) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT CD_PERFIL FROM PERFIL WHERE DS_PERFIL = :ds_perfil`,
      { ds_perfil: dsPerfil }
    );
    return result.rows.length > 0 ? result.rows[0].CD_PERFIL : null;
  } finally {
    await conn.close();
  }
}

async function findAllTasyProfiles() {
  const conn = await getConnection();
  try {
    const result = await conn.execute(
      `SELECT CD_PERFIL, DS_PERFIL FROM PERFIL ORDER BY DS_PERFIL`
    );
    return result.rows.map(row => ({
      cd_perfil: row.CD_PERFIL,
      ds_perfil: row.DS_PERFIL
    }));
  } finally {
    await conn.close();
  }
}

module.exports = { findByDsPerfil, findAllTasyProfiles };
