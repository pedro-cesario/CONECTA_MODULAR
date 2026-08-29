const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

async function gerarXlsx(auditoria) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Conecta HEAL';
  workbook.created = new Date();
  const geral = workbook.addWorksheet('Auditoria');
  geral.columns = [{ width: 24 }, { width: 52 }];
  geral.addRow(['Auditoria', 'Higiene de Mãos']);
  geral.addRow(['Data', auditoria.DT_AUDITORIA]);
  geral.addRow(['Setor', auditoria.NM_SETOR]);
  geral.addRow(['Avaliador', auditoria.NM_AVALIADOR]);
  geral.addRow(['Turno', auditoria.turno_label]);
  geral.addRow(['Profissional', auditoria.NM_PROFISSIONAL]);
  geral.addRow(['Observações', auditoria.DS_OBSERVACAO || '']);
  geral.getColumn(1).font = { bold: true };

  const oportunidades = workbook.addWorksheet('Oportunidades');
  oportunidades.columns = [{ header: 'Oportunidade', width: 42 }, { header: 'Resultado', width: 20 }, { header: 'Conforme', width: 14 }];
  oportunidades.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  oportunidades.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0754A6' } };
  auditoria.oportunidades.forEach(item => oportunidades.addRow([item.oportunidade_label, item.resultado_label, item.conforme ? 'Sim' : 'Não']));

  const tecnico = workbook.addWorksheet('Dados técnicos');
  tecnico.columns = [{ header: 'Campo', width: 32 }, { header: 'Valor', width: 32 }];
  tecnico.addRows([
    ['ID da auditoria', auditoria.NR_SEQUENCIA], ['ID do setor', auditoria.CD_SETOR_ATENDIMENTO],
    ['ID do avaliador', auditoria.CD_AVALIADOR], ['ID do profissional', auditoria.CD_PESSOA_FISICA],
    ['Criado em', auditoria.DT_CRIACAO || ''], ['Lançado por', auditoria.NM_USUARIO || '']
  ]);
  return workbook.xlsx.writeBuffer();
}

function gerarPdf(auditoria, res) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  doc.pipe(res);
  doc.fillColor('#0754A6').fontSize(18).font('Helvetica-Bold').text('Auditoria de Higiene de Mãos');
  doc.moveDown(0.4).fillColor('#475569').fontSize(10).font('Helvetica').text('Conecta HEAL · Núcleo de Segurança do Paciente - NISA');
  doc.moveDown();
  const dados = [['Data', auditoria.DT_AUDITORIA], ['Setor', auditoria.NM_SETOR], ['Avaliador', auditoria.NM_AVALIADOR], ['Turno', auditoria.turno_label], ['Profissional', auditoria.NM_PROFISSIONAL]];
  dados.forEach(([label, value]) => {
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value || '-');
  });
  doc.moveDown().font('Helvetica-Bold').fontSize(12).fillColor('#0754A6').text('Oportunidades');
  doc.moveDown(0.5);
  const x = 48; const y = doc.y; const widths = [280, 120, 90];
  doc.rect(x, y, widths.reduce((a, b) => a + b, 0), 20).fill('#0754A6');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  doc.text('Oportunidade', x + 6, y + 6, { width: widths[0] - 12 });
  doc.text('Resultado', x + widths[0] + 6, y + 6, { width: widths[1] - 12 });
  doc.text('Conforme', x + widths[0] + widths[1] + 6, y + 6, { width: widths[2] - 12 });
  let rowY = y + 20;
  auditoria.oportunidades.forEach((item, index) => {
    const height = 25;
    doc.rect(x, rowY, widths.reduce((a, b) => a + b, 0), height).fill(index % 2 ? '#F8FAFC' : '#FFFFFF').stroke('#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica').fontSize(8.5);
    doc.text(item.oportunidade_label, x + 6, rowY + 7, { width: widths[0] - 12 });
    doc.text(item.resultado_label, x + widths[0] + 6, rowY + 7, { width: widths[1] - 12 });
    doc.text(item.conforme ? 'Sim' : 'Não', x + widths[0] + widths[1] + 6, rowY + 7, { width: widths[2] - 12 });
    rowY += height;
  });
  doc.y = rowY + 18;
  doc.fillColor('#0754A6').font('Helvetica-Bold').fontSize(12).text('Observações');
  doc.moveDown(0.4).fillColor('#0F172A').font('Helvetica').fontSize(10).text(auditoria.DS_OBSERVACAO || 'Sem observações.');
  doc.end();
}

// ─── Auditoria de Processos ───────────────────────────────────────────────

async function gerarXlsxProcessos(auditoria) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Conecta HEAL';
  workbook.created = new Date();
  const geral = workbook.addWorksheet('Auditoria');
  geral.columns = [{ width: 24 }, { width: 52 }];
  geral.addRow(['Auditoria', 'Auditoria de Processos']);
  geral.addRow(['Data', auditoria.DT_AUDITORIA]);
  geral.addRow(['Setor', auditoria.NM_SETOR]);
  geral.addRow(['Responsável', auditoria.NM_AVALIADOR]);
  geral.addRow(['Paciente', auditoria.NM_PACIENTE]);
  geral.addRow(['Idade', auditoria.NR_IDADE != null ? `${auditoria.NR_IDADE} anos` : '-']);
  geral.addRow(['Unidade/Leito', auditoria.DS_UNIDADE_LEITO || '-']);
  geral.addRow(['Atendimento', auditoria.NR_ATENDIMENTO || '-']);
  geral.addRow(['Observações', auditoria.DS_OBSERVACAO || '']);
  geral.getColumn(1).font = { bold: true };

  const respostas = workbook.addWorksheet('Respostas');
  respostas.columns = [{ header: 'Grupo', width: 12 }, { header: 'Subgrupo', width: 22 }, { header: 'Item', width: 40 }, { header: 'Resposta', width: 16 }, { header: 'Descrição', width: 40 }];
  respostas.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  respostas.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0754A6' } };
  (auditoria.respostas || []).forEach(item => respostas.addRow([item.CD_GRUPO, item.CD_SUBGRUPO || '', item.CD_ITEM, item.resposta_label || item.IE_RESPOSTA, item.DS_DESCRICAO || '']));

  return workbook.xlsx.writeBuffer();
}

function gerarPdfProcessos(auditoria, res) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  doc.pipe(res);
  doc.fillColor('#0754A6').fontSize(18).font('Helvetica-Bold').text('Auditoria de Processos');
  doc.moveDown(0.4).fillColor('#475569').fontSize(10).font('Helvetica').text('Conecta HEAL · Núcleo de Segurança do Paciente - NISA');
  doc.moveDown();
  const dados = [
    ['Data', auditoria.DT_AUDITORIA], ['Setor', auditoria.NM_SETOR], ['Responsável', auditoria.NM_AVALIADOR],
    ['Paciente', auditoria.NM_PACIENTE], ['Idade', auditoria.NR_IDADE != null ? `${auditoria.NR_IDADE} anos` : '-'],
    ['Unidade/Leito', auditoria.DS_UNIDADE_LEITO || '-'], ['Atendimento', auditoria.NR_ATENDIMENTO || '-']
  ];
  dados.forEach(([label, value]) => {
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(value || '-');
  });
  doc.moveDown().font('Helvetica-Bold').fontSize(12).fillColor('#0754A6').text('Respostas');
  doc.moveDown(0.5);
  const x = 48; let rowY = doc.y; const widths = [80, 160, 80];
  doc.rect(x, rowY, widths.reduce((a, b) => a + b, 0), 20).fill('#0754A6');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  doc.text('Grupo', x + 6, rowY + 6, { width: widths[0] - 12 });
  doc.text('Item', x + widths[0] + 6, rowY + 6, { width: widths[1] - 12 });
  doc.text('Resposta', x + widths[0] + widths[1] + 6, rowY + 6, { width: widths[2] - 12 });
  rowY += 20;
  (auditoria.respostas || []).forEach((item, index) => {
    const height = 22;
    if (rowY > 750) { doc.addPage(); rowY = 48; }
    doc.rect(x, rowY, widths.reduce((a, b) => a + b, 0), height).fill(index % 2 ? '#F8FAFC' : '#FFFFFF').stroke('#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica').fontSize(8.5);
    doc.text(item.CD_GRUPO || '', x + 6, rowY + 5, { width: widths[0] - 12 });
    doc.text(item.CD_ITEM || '', x + widths[0] + 6, rowY + 5, { width: widths[1] - 12 });
    doc.text(item.resposta_label || item.IE_RESPOSTA || '', x + widths[0] + widths[1] + 6, rowY + 5, { width: widths[2] - 12 });
    rowY += height;
  });
  doc.end();
}

module.exports = { gerarXlsx, gerarPdf, gerarXlsxProcessos, gerarPdfProcessos };
