function buildNameQuery(termo) {
  const tokens = termo.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return null;
  
  const accentChars = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
  const plainChars = 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';

  let query = "";
  let params = {};

  tokens.forEach((tok, i) => {
    const pName = `t_${i}`;
    const cleanTok = tok.toUpperCase(); // we will translate in js or sql? JS is fine, but SQL is safer.
    // wait, we can translate the tok in JS
    const jsTranslate = (s) => {
        let res = "";
        for (let c of s) {
            let idx = accentChars.indexOf(c);
            res += idx !== -1 ? plainChars[idx] : c;
        }
        return res;
    };
    params[pName] = jsTranslate(cleanTok);
    
    // exact word match using LIKE
    const sqlField = `TRANSLATE(UPPER(nm_pessoa_fisica), '${accentChars}', '${plainChars}')`;
    
    query += ` AND (
      ${sqlField} = :${pName} OR
      ${sqlField} LIKE :${pName} || ' %' OR
      ${sqlField} LIKE '% ' || :${pName} || ' %' OR
      ${sqlField} LIKE '% ' || :${pName}
    )`;
  });

  return { query, params, tokens };
}
console.log(buildNameQuery("Pedro Teles"));
