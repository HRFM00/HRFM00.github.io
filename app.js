let selectedFiles = [];
let excelData = null;
let currentSheet = null;
let supabaseClient = null;

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  // Supabase 初期化（親フォルダの supabase-config.js の createSupabaseClient/getSupabaseClient を利用）
  try {
    if (typeof getSupabaseClient === 'function') {
      supabaseClient = getSupabaseClient();
    }
  } catch (_) {}

  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, prevent));

  dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  });

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  });
});

function addFiles(files) {
  const list = document.getElementById('fileList');
  const selectedWrap = document.getElementById('selectedFiles');
  if (!files.length) return;

  files.forEach(f => {
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      // 重複回避
      if (!selectedFiles.some(s => s.name === f.name && s.size === f.size)) {
        selectedFiles.push(f);
      }
    }
  });

  list.innerHTML = '';
  selectedFiles.forEach(f => {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<span class="badge">Excel</span><span class="name" title="${f.name}">${f.name}</span><span>${formatSize(f.size)}</span>`;
    list.appendChild(row);
  });
  selectedWrap.classList.remove('hidden');
}

function formatSize(size) {
  if (size < 1024) return size + ' B';
  if (size < 1024*1024) return (size/1024).toFixed(1) + ' KB';
  return (size/1024/1024).toFixed(1) + ' MB';
}

async function processExcelFiles() {
  if (!selectedFiles.length) {
    alert('解析するエクセルファイルがありません。');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('XLSXライブラリが読み込まれていません。');
    return;
  }

  const file = selectedFiles[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      excelData = workbook;
      renderSheetSelector(workbook);
    } catch (err) {
      console.error(err);
      alert('エクセル解析でエラーが発生しました。');
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderSheetSelector(workbook) {
  const preview = document.getElementById('excelPreview');
  const select = document.getElementById('sheetSelect');
  const table = document.getElementById('tableContainer');
  preview.classList.remove('hidden');
  table.innerHTML = '';

  select.innerHTML = '<option value="">シートを選択してください</option>';
  workbook.SheetNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    select.appendChild(opt);
  });
}

function changeSheet() {
  const select = document.getElementById('sheetSelect');
  const value = select.value;
  if (!value) return;
  currentSheet = value;
  analyzeSheet(value);
}

function analyzeSheet(sheetName) {
  const ws = excelData.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  renderPreviewTable(json);
}

function renderPreviewTable(rows) {
  const table = document.getElementById('tableContainer');
  if (!rows || !rows.length) { table.innerHTML = '<p style="padding:12px">データがありません。</p>'; return; }
  const maxRows = Math.min(rows.length, 200);
  const maxCols = Math.min(Math.max(...rows.map(r => r.length)), 50);

  let html = '<table><thead><tr>';
  for (let c = 0; c < maxCols; c++) html += `<th>C${c+1}</th>`;
  html += '</tr></thead><tbody>';

  for (let r = 0; r < maxRows; r++) {
    html += '<tr>';
    for (let c = 0; c < maxCols; c++) {
      const v = (rows[r] && rows[r][c] != null) ? rows[r][c] : '';
      html += `<td>${escapeHtml(String(v))}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  table.innerHTML = html;
}

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function deleteAllShifts() {
  if (!supabaseClient) {
    alert('Supabase が未設定のため実行できません。SUPABASE_URL / SUPABASE_ANON_KEY を設定してください。');
    return;
  }
  const yes = confirm('本当に shift テーブルの全データを削除しますか？この操作は取り消せません。');
  if (!yes) return;
  try {
    const { error } = await supabaseClient.from('shift').delete().neq('id', null);
    if (error) throw error;
    alert('シフトデータを全て削除しました。');
  } catch (err) {
    console.error(err);
    alert('削除中にエラーが発生しました。');
  }
}


