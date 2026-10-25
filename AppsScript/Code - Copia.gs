const FM = {
  APP_NAME: 'Felipe Mariano | Administração',
  SHEETS: {
    CONFIG: 'CONFIG',
    CATEGORIAS: 'CATEGORIAS',
    MAQUINAS: 'MAQUINAS',
    FOTOS: 'FOTOS',
    LOGS: 'LOGS'
  },
  SESSION_TTL: 21600,
  MAX_IMAGE_BYTES: 6 * 1024 * 1024,
  DEFAULT_CATEGORIES: [
    'Offset',
    'Guilhotinas',
    'Dobradeiras',
    'Corte e Vinco',
    'Acabamento',
    'Impressão Digital',
    'Laminadoras',
    'CTP'
  ]
};

function doGet(e) {
  const p = (e && e.parameter) || {};

  if (String(p.api || '') === '1') {
    return apiPublica_(p);
  }

  return renderAdminPage_(false, '', '');
}

/**
 * Login administrativo processado diretamente no servidor.
 * Assim o botão de login não depende de google.script.run.
 */
function doPost(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.adminAction || '').trim();

  // --------------------------------------------------------
  // AÇÕES DO PAINEL JÁ AUTENTICADO
  // --------------------------------------------------------
  if (action) {
    return processarAcaoAdminPost_(p);
  }

  // --------------------------------------------------------
  // LOGIN
  // --------------------------------------------------------
  const password = String(p.adminPassword || '');
  const result = autenticarAdmin_(password);

  if (!result.success) {
    return renderAdminPage_(
      false,
      '',
      result.message || 'Não foi possível entrar.'
    );
  }

  return renderAdminPage_(
    true,
    result.token,
    ''
  );
}

/**
 * Processa os botões administrativos sem depender de JavaScript.
 */
function processarAcaoAdminPost_(p) {
  const token = String(p.adminToken || '').trim();
  const action = String(p.adminAction || '').trim();
  const machineId = String(p.machineId || '').trim();

  try {
    validarSessao_(token);

    if (action === 'refresh' || action === 'cancel') {
      return renderAdminPage_(true, token, '');
    }

    if (action === 'logout') {
      logoutAdmin(token);
      return renderAdminPage_(false, '', '');
    }

    if (action === 'new') {
      return renderAdminPage_(
        true,
        token,
        '',
        {
          editorOpen: true,
          editMachine: null
        }
      );
    }

    if (action === 'edit') {
      const machine = obterMaquinaAdmin(token, machineId);

      return renderAdminPage_(
        true,
        token,
        '',
        {
          editorOpen: true,
          editMachine: machine
        }
      );
    }

    if (action === 'publish') {
      alterarStatusMaquina(token, machineId, 'PUBLICADO');

      return renderAdminPage_(
        true,
        token,
        '',
        {
          actionMessage: 'Equipamento publicado com sucesso.'
        }
      );
    }

    if (action === 'hide') {
      alterarStatusMaquina(token, machineId, 'OCULTO');

      return renderAdminPage_(
        true,
        token,
        '',
        {
          actionMessage: 'Equipamento ocultado com sucesso.'
        }
      );
    }

    if (action === 'sold') {
      alterarStatusMaquina(token, machineId, 'VENDIDO');

      return renderAdminPage_(
        true,
        token,
        '',
        {
          actionMessage: 'Equipamento marcado como vendido.'
        }
      );
    }

    if (action === 'confirmDelete') {
      const machine = obterMaquinaAdmin(token, machineId);

      return renderAdminPage_(
        true,
        token,
        '',
        {
          deleteConfirmMachine: machine
        }
      );
    }

    if (action === 'delete') {
      excluirMaquina(token, machineId);

      return renderAdminPage_(
        true,
        token,
        '',
        {
          actionMessage: 'Equipamento excluído com sucesso.'
        }
      );
    }

    if (action === 'setCover') {
      const photoId = String(p.photoId || '').trim();
      definirFotoCapa(token, photoId);

      const machine = obterMaquinaAdmin(token, machineId);

      return renderAdminPage_(
        true,
        token,
        '',
        {
          editorOpen: true,
          editMachine: machine,
          actionMessage: 'Foto de capa atualizada.'
        }
      );
    }

    if (action === 'deletePhoto') {
      const photoId = String(p.photoId || '').trim();
      excluirFoto(token, photoId);

      const machine = obterMaquinaAdmin(token, machineId);

      return renderAdminPage_(
        true,
        token,
        '',
        {
          editorOpen: true,
          editMachine: machine,
          actionMessage: 'Foto excluída.'
        }
      );
    }

    if (action === 'save') {
      const payload = {
        id: machineId,
        titulo: String(p.titulo || ''),
        categoriaId: String(p.categoriaId || ''),
        marca: String(p.marca || ''),
        modelo: String(p.modelo || ''),
        ano: String(p.ano || ''),
        condicao: String(p.condicao || ''),
        status: String(p.status || 'OCULTO'),
        ordem: Number(p.ordem || 999),
        localizacao: String(p.localizacao || ''),
        disponibilidade: String(p.disponibilidade || ''),
        descricaoCurta: String(p.descricaoCurta || ''),
        descricaoCompleta: String(p.descricaoCompleta || ''),
        preco: String(p.preco || ''),
        mostrarPreco:
          String(p.mostrarPreco || '').toLowerCase() === 'true' ||
          String(p.mostrarPreco || '').toLowerCase() === 'on',
        destaque:
          String(p.destaque || '').toLowerCase() === 'true' ||
          String(p.destaque || '').toLowerCase() === 'on',
        especificacoes: String(p.especificacoes || '')
      };

      salvarMaquina(token, payload);

      return renderAdminPage_(
        true,
        token,
        '',
        {
          actionMessage: machineId
            ? 'Equipamento atualizado com sucesso.'
            : 'Equipamento cadastrado com sucesso.'
        }
      );
    }

    throw new Error('Ação administrativa inválida: ' + action);

  } catch (err) {
    let editMachine = null;
    let editorOpen = false;

    // Se falhar durante edição/salvamento, tenta manter o formulário aberto.
    if (
      machineId &&
      (action === 'edit' ||
       action === 'save' ||
       action === 'setCover' ||
       action === 'deletePhoto')
    ) {
      try {
        editMachine = obterMaquinaAdmin(token, machineId);
        editorOpen = true;
      } catch (_) {}
    }

    return renderAdminPage_(
      true,
      token,
      '',
      {
        editorOpen: editorOpen,
        editMachine: editMachine,
        actionError:
          err && err.message
            ? err.message
            : String(err || 'Erro administrativo.')
      }
    );
  }
}

function renderAdminPage_(authenticated, token, loginError, options) {
  options = options || {};

  const tpl = HtmlService.createTemplateFromFile('Admin');

  let initialData = {
    machines: [],
    categories: [],
    error: ''
  };

  if (authenticated) {
    try {
      initialData = carregarDadosPainel_();
    } catch (err) {
      initialData = {
        machines: [],
        categories: [],
        error:
          err && err.message
            ? err.message
            : String(err || 'Erro ao carregar o painel.')
      };
    }
  }

  const machines = Array.isArray(initialData.machines)
    ? initialData.machines
    : [];

  const categories = Array.isArray(initialData.categories)
    ? initialData.categories
    : [];

  tpl.appName = FM.APP_NAME;
  tpl.webAppUrl = ScriptApp.getService().getUrl() || '';
  tpl.authenticated = Boolean(authenticated);
  tpl.adminToken = String(token || '');
  tpl.loginError = String(loginError || '');

  tpl.initialMachines = machines;
  tpl.initialCategories = categories;
  tpl.initialMachineCount = machines.length;
  tpl.initialPublishedCount = machines.filter(function(machine) {
    return String(machine.status || '').toUpperCase() === 'PUBLICADO';
  }).length;
  tpl.initialLoadError = String(initialData.error || '');

  // Estado da interface administrativa renderizado no servidor.
  tpl.editorOpen = Boolean(options.editorOpen);
  tpl.editMachine = options.editMachine || null;
  tpl.deleteConfirmMachine = options.deleteConfirmMachine || null;
  tpl.actionMessage = String(options.actionMessage || '');
  tpl.actionError = String(options.actionError || '');

  return tpl.evaluate().setTitle(FM.APP_NAME);
}

function INSTALAR_SISTEMA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra a planilha e acesse Extensões > Apps Script para usar este projeto vinculado.');

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());

  ss.setSpreadsheetLocale('pt_BR');
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');

  ensureSheet_(ss, FM.SHEETS.CONFIG, ['CHAVE','VALOR','DESCRICAO']);
  ensureSheet_(ss, FM.SHEETS.CATEGORIAS, ['ID','NOME','SLUG','ATIVA','ORDEM','CRIADO_EM','ATUALIZADO_EM']);
  ensureSheet_(ss, FM.SHEETS.MAQUINAS, [
    'ID','SLUG','TITULO','CATEGORIA_ID','CATEGORIA','MARCA','MODELO','ANO','CONDICAO',
    'DESCRICAO_CURTA','DESCRICAO_COMPLETA','LOCALIZACAO','DISPONIBILIDADE','PRECO',
    'MOSTRAR_PRECO','DESTAQUE','STATUS','ORDEM','ESPECIFICACOES_JSON','FOTO_CAPA_URL',
    'FOTO_CAPA_ID','CRIADO_EM','ATUALIZADO_EM'
  ]);
  ensureSheet_(ss, FM.SHEETS.FOTOS, ['ID','MAQUINA_ID','ARQUIVO_ID','URL','ORDEM','CAPA','CRIADO_EM']);
  ensureSheet_(ss, FM.SHEETS.LOGS, ['DATA_HORA','ACAO','ENTIDADE','ENTIDADE_ID','DETALHES']);

  styleAllSheets_(ss);
  criarPastaFotos_();
  popularCategoriasIniciais_();
  aplicarValidacoes_();
  atualizarConfig_();
  SpreadsheetApp.flush();

  Logger.log('INSTALAÇÃO CONCLUÍDA');
  Logger.log('ID DA PLANILHA: ' + ss.getId());
  Logger.log('URL DA PLANILHA: ' + ss.getUrl());

  return { success: true, spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('FM Máquinas')
    .addItem('Instalar / reparar estrutura', 'INSTALAR_SISTEMA')
    .addSeparator()
    .addItem('Definir / alterar senha admin', 'DEFINIR_SENHA_ADMIN')
    .addItem('Registrar URL do Web App', 'REGISTRAR_URL_WEBAPP')
    .addSeparator()
    .addItem('Reparar URLs das fotos', 'REPARAR_URLS_FOTOS')
    .addToUi();
}

function DEFINIR_SENHA_ADMIN() {
  const ui = SpreadsheetApp.getUi();
  const first = ui.prompt('Senha administrativa','Digite uma nova senha com pelo menos 8 caracteres:',ui.ButtonSet.OK_CANCEL);
  if (first.getSelectedButton() !== ui.Button.OK) return;
  const password = String(first.getResponseText() || '');
  if (password.length < 8) return ui.alert('A senha deve ter pelo menos 8 caracteres.');

  const second = ui.prompt('Confirmar senha','Digite a mesma senha novamente:',ui.ButtonSet.OK_CANCEL);
  if (second.getSelectedButton() !== ui.Button.OK) return;
  if (password !== String(second.getResponseText() || '')) return ui.alert('As senhas não coincidem.');

  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('ADMIN_SALT', salt);
  props.setProperty('ADMIN_HASH', hashPassword_(password, salt));
  ui.alert('Senha administrativa definida com sucesso.');
}

function REGISTRAR_URL_WEBAPP() {
  const url = ScriptApp.getService().getUrl();
  if (!url) throw new Error('Ainda não existe uma implantação ativa como Aplicativo da Web.');
  atualizarConfig_();
  SpreadsheetApp.getUi().alert('URL registrada com sucesso:\n\n' + url);
  return url;
}

function autenticarAdmin_(password) {
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('ADMIN_SALT');
  const expected = props.getProperty('ADMIN_HASH');

  if (!salt || !expected) {
    return {
      success: false,
      message: 'A senha administrativa ainda não foi configurada.'
    };
  }

  if (hashPassword_(String(password || ''), salt) !== expected) {
    log_('LOGIN_FALHOU', 'AUTH', '', 'Tentativa inválida');
    return { success: false, message: 'Senha inválida.' };
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    'session:' + token,
    'admin',
    FM.SESSION_TTL
  );

  log_('LOGIN_OK', 'AUTH', '', 'Login administrativo');

  return {
    success: true,
    token: token,
    expiresIn: FM.SESSION_TTL
  };
}

// Mantida para compatibilidade com versões anteriores do painel.
function loginAdmin(password) {
  return autenticarAdmin_(password);
}

function logoutAdmin(token) {
  if (token) CacheService.getScriptCache().remove('session:' + token);
  return { success:true };
}

function verificarSessao(token) {
  try { validarSessao_(token); return { success:true }; }
  catch (err) { return { success:false, message:err.message }; }
}

function validarSessao_(token) {
  if (!token) throw new Error('Sessão administrativa ausente.');
  const value = CacheService.getScriptCache().get('session:' + token);
  if (value !== 'admin') throw new Error('Sessão expirada. Faça login novamente.');
  CacheService.getScriptCache().put('session:' + token, 'admin', FM.SESSION_TTL);
}

function carregarDadosPainel_() {
  const fotos = getFotosMap_();

  const machines = rowsToObjects_(getSheet_(FM.SHEETS.MAQUINAS))
    .sort(sortMaquinas_)
    .map(r => normalizarMaquina_(r, fotos[String(r.ID)] || []));

  const categories = listarCategoriasPublicas_();

  return {
    machines: machines,
    categories: categories
  };
}

/**
 * Uma única chamada para atualizar todo o painel.
 */
function carregarPainelAdmin(token) {
  validarSessao_(token);
  return carregarDadosPainel_();
}

/* Mantidas por compatibilidade com versões anteriores. */
function listarCategoriasAdmin(token) {
  validarSessao_(token);
  return listarCategoriasPublicas_();
}

function listarMaquinasAdmin(token) {
  validarSessao_(token);
  return carregarDadosPainel_().machines;
}

/**
 * Retorna uma única máquina para preencher o formulário de edição.
 */
function obterMaquinaAdmin(token, id) {
  validarSessao_(token);

  id = String(id || '').trim();
  if (!id) throw new Error('ID da máquina não informado.');

  const row = findById_(getSheet_(FM.SHEETS.MAQUINAS), id);
  if (!row) throw new Error('Máquina não encontrada.');

  const fotos = getFotosMap_();

  return normalizarMaquina_(
    row,
    fotos[String(row.ID)] || []
  );
}

function salvarMaquina(token, data) {
  validarSessao_(token);
  data = data || {};

  const sheet = getSheet_(FM.SHEETS.MAQUINAS);
  const headers = getHeaders_(sheet);
  const existing = data.id ? findById_(sheet, data.id) : null;
  const categoria = buscarCategoria_(data.categoriaId, data.categoria);
  const titulo = String(data.titulo || '').trim();

  if (!titulo) throw new Error('Informe o título do equipamento.');
  if (!categoria) throw new Error('Selecione uma categoria.');

  const obj = {
    ID: existing ? existing.ID : uuid_('maq'),
    SLUG: slugify_(titulo + '-' + (data.modelo || '')),
    TITULO: titulo,
    CATEGORIA_ID: categoria.id,
    CATEGORIA: categoria.nome,
    MARCA: String(data.marca || '').trim(),
    MODELO: String(data.modelo || '').trim(),
    ANO: String(data.ano || '').trim(),
    CONDICAO: String(data.condicao || 'Usada').trim(),
    DESCRICAO_CURTA: String(data.descricaoCurta || '').trim(),
    DESCRICAO_COMPLETA: String(data.descricaoCompleta || '').trim(),
    LOCALIZACAO: String(data.localizacao || '').trim(),
    DISPONIBILIDADE: String(data.disponibilidade || 'Sob consulta').trim(),
    PRECO: String(data.preco || '').trim(),
    MOSTRAR_PRECO: Boolean(data.mostrarPreco),
    DESTAQUE: Boolean(data.destaque),
    STATUS: ['PUBLICADO','OCULTO','VENDIDO'].includes(String(data.status || '').toUpperCase()) ? String(data.status).toUpperCase() : 'OCULTO',
    ORDEM: Number(data.ordem || 999),
    ESPECIFICACOES_JSON: JSON.stringify(normalizarEspecificacoes_(data.especificacoes)),
    FOTO_CAPA_URL: existing ? existing.FOTO_CAPA_URL : '',
    FOTO_CAPA_ID: existing ? existing.FOTO_CAPA_ID : '',
    CRIADO_EM: existing ? existing.CRIADO_EM : new Date(),
    ATUALIZADO_EM: new Date()
  };

  if (existing) {
    sheet.getRange(existing.__row,1,1,headers.length).setValues([objectToRow_(headers,obj)]);
    log_('ATUALIZOU','MAQUINA',obj.ID,obj.TITULO);
  } else {
    sheet.appendRow(objectToRow_(headers,obj));
    log_('CRIOU','MAQUINA',obj.ID,obj.TITULO);
  }

  return { success:true, maquina:normalizarMaquina_(obj, getFotosMap_()[String(obj.ID)] || []) };
}

function alterarStatusMaquina(token, id, status) {
  validarSessao_(token);
  status = String(status || '').toUpperCase();
  if (!['PUBLICADO','OCULTO','VENDIDO'].includes(status)) throw new Error('Status inválido.');

  const sheet = getSheet_(FM.SHEETS.MAQUINAS);
  const row = findById_(sheet,id);
  if (!row) throw new Error('Máquina não encontrada.');
  const headers = getHeaders_(sheet);
  sheet.getRange(row.__row, headers.indexOf('STATUS') + 1).setValue(status);
  sheet.getRange(row.__row, headers.indexOf('ATUALIZADO_EM') + 1).setValue(new Date());
  log_('STATUS','MAQUINA',id,status);
  return { success:true };
}

function excluirMaquina(token, id) {
  validarSessao_(token);
  const sheet = getSheet_(FM.SHEETS.MAQUINAS);
  const row = findById_(sheet,id);
  if (!row) throw new Error('Máquina não encontrada.');
  excluirFotosDaMaquina_(id);
  sheet.deleteRow(row.__row);
  log_('EXCLUIU','MAQUINA',id,row.TITULO);
  return { success:true };
}

function uploadFoto(token, maquinaId, fileData) {
  validarSessao_(token);
  const machine = findById_(getSheet_(FM.SHEETS.MAQUINAS), maquinaId);
  if (!machine) throw new Error('Máquina não encontrada.');

  fileData = fileData || {};
  const base64 = String(fileData.base64 || '').replace(/^data:[^;]+;base64,/, '');
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length) throw new Error('Arquivo de imagem vazio.');
  if (bytes.length > FM.MAX_IMAGE_BYTES) throw new Error('A imagem excede o limite de 6 MB.');

  const mimeType = String(fileData.mimeType || 'image/jpeg');
  if (!/^image\//i.test(mimeType)) throw new Error('Envie somente arquivos de imagem.');

  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID'));
  const folderName = `${maquinaId} - ${sanitizeFileName_(machine.TITULO).slice(0,80)}`;
  const folders = root.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : root.createFolder(folderName);

  const file = folder.createFile(Utilities.newBlob(bytes, mimeType, sanitizeFileName_(fileData.name || 'imagem.jpg')));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const directUrl = driveImageUrl_(file.getId(), 1600);

  const photosSheet = getSheet_(FM.SHEETS.FOTOS);
  const existing = rowsToObjects_(photosSheet).filter(r => String(r.MAQUINA_ID) === String(maquinaId));
  const isCover = existing.length === 0 || Boolean(fileData.capa);
  if (isCover) desmarcarCapas_(maquinaId);

  const photoId = uuid_('foto');
  photosSheet.appendRow([photoId, maquinaId, file.getId(), directUrl, existing.length + 1, isCover, new Date()]);
  if (isCover) atualizarCapaMaquina_(maquinaId, file.getId(), directUrl);
  log_('UPLOAD_FOTO','MAQUINA',maquinaId,file.getName());

  return { success:true, foto:{ id:photoId, arquivoId:file.getId(), url:directUrl, ordem:existing.length + 1, capa:isCover } };
}

function definirFotoCapa(token, fotoId) {
  validarSessao_(token);
  const sheet = getSheet_(FM.SHEETS.FOTOS);
  const photo = findById_(sheet,fotoId);
  if (!photo) throw new Error('Foto não encontrada.');

  desmarcarCapas_(photo.MAQUINA_ID);
  const headers = getHeaders_(sheet);
  sheet.getRange(photo.__row, headers.indexOf('CAPA') + 1).setValue(true);
  atualizarCapaMaquina_(photo.MAQUINA_ID, photo.ARQUIVO_ID, photo.URL);
  return { success:true };
}

function excluirFoto(token, fotoId) {
  validarSessao_(token);
  const sheet = getSheet_(FM.SHEETS.FOTOS);
  const photo = findById_(sheet,fotoId);
  if (!photo) throw new Error('Foto não encontrada.');

  try { DriveApp.getFileById(photo.ARQUIVO_ID).setTrashed(true); } catch (err) {}
  const machineId = String(photo.MAQUINA_ID);
  const wasCover = String(photo.CAPA).toUpperCase() === 'TRUE';
  sheet.deleteRow(photo.__row);

  if (wasCover) {
    const remaining = rowsToObjects_(sheet).filter(r => String(r.MAQUINA_ID) === machineId).sort((a,b) => Number(a.ORDEM || 999) - Number(b.ORDEM || 999));
    if (remaining.length) {
      desmarcarCapas_(machineId);
      const headers = getHeaders_(sheet);
      sheet.getRange(remaining[0].__row, headers.indexOf('CAPA') + 1).setValue(true);
      atualizarCapaMaquina_(machineId, remaining[0].ARQUIVO_ID, remaining[0].URL);
    } else {
      atualizarCapaMaquina_(machineId,'','');
    }
  }

  return { success:true };
}

function apiPublica_(p) {
  const callback = sanitizeCallback_(p.callback || p.prefix || '');
  const payload = {
    success:true,
    maquinas:listarMaquinasPublicas_(),
    categorias:listarCategoriasPublicas_(),
    atualizadoEm:new Date().toISOString()
  };

  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function listarMaquinasPublicas_() {
  const fotos = getFotosMap_();
  return rowsToObjects_(getSheet_(FM.SHEETS.MAQUINAS))
    .filter(r => String(r.STATUS || '').toUpperCase() === 'PUBLICADO')
    .sort(sortMaquinas_)
    .map(r => normalizarMaquina_(r, fotos[String(r.ID)] || []));
}

function listarCategoriasPublicas_() {
  return rowsToObjects_(getSheet_(FM.SHEETS.CATEGORIAS))
    .filter(r => String(r.ATIVA).toUpperCase() !== 'FALSE')
    .sort((a,b) => Number(a.ORDEM || 999) - Number(b.ORDEM || 999))
    .map(r => ({ id:String(r.ID || ''), nome:String(r.NOME || ''), slug:String(r.SLUG || ''), ativa:true, ordem:Number(r.ORDEM || 0) }));
}

function normalizarMaquina_(r, fotos) {
  let specs = [];
  try { specs = r.ESPECIFICACOES_JSON ? JSON.parse(r.ESPECIFICACOES_JSON) : []; } catch (err) {}
  return {
    id:String(r.ID || ''), slug:String(r.SLUG || ''), titulo:String(r.TITULO || ''),
    categoriaId:String(r.CATEGORIA_ID || ''), categoria:String(r.CATEGORIA || ''),
    marca:String(r.MARCA || ''), modelo:String(r.MODELO || ''), ano:r.ANO === '' ? '' : String(r.ANO),
    condicao:String(r.CONDICAO || ''), descricaoCurta:String(r.DESCRICAO_CURTA || ''),
    descricaoCompleta:String(r.DESCRICAO_COMPLETA || ''), localizacao:String(r.LOCALIZACAO || ''),
    disponibilidade:String(r.DISPONIBILIDADE || ''), preco:r.PRECO === '' ? '' : String(r.PRECO),
    mostrarPreco:String(r.MOSTRAR_PRECO).toUpperCase() === 'TRUE',
    destaque:String(r.DESTAQUE).toUpperCase() === 'TRUE', status:String(r.STATUS || 'OCULTO'),
    ordem:Number(r.ORDEM || 0), especificacoes:specs,
    fotoCapaUrl:driveImageUrl_(r.FOTO_CAPA_ID, 1600) || String(r.FOTO_CAPA_URL || ''), fotoCapaId:String(r.FOTO_CAPA_ID || ''), fotos:fotos
  };
}

function normalizarEspecificacoes_(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  return value.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const i = line.indexOf(':');
    return i < 0 ? { nome:line, valor:'' } : { nome:line.slice(0,i).trim(), valor:line.slice(i+1).trim() };
  });
}

function buscarCategoria_(id, nome) {
  const cats = listarCategoriasPublicas_();
  if (id) {
    const c = cats.find(x => x.id === String(id));
    if (c) return c;
  }
  if (nome) return cats.find(x => x.slug === slugify_(nome)) || null;
  return null;
}


/**
 * Gera uma URL de imagem do Google Drive apropriada para <img>.
 * Funciona melhor que /uc?export=view para fotos exibidas no site.
 */
function driveImageUrl_(fileId, width) {
  fileId = String(fileId || '').trim();
  if (!fileId) return '';

  const size = Math.max(200, Number(width || 1600));
  return 'https://drive.google.com/thumbnail?id=' +
    encodeURIComponent(fileId) +
    '&sz=w' + size;
}

function getFotosMap_() {
  const map = {};
  rowsToObjects_(getSheet_(FM.SHEETS.FOTOS)).forEach(r => {
    const key = String(r.MAQUINA_ID || '');
    if (!map[key]) map[key] = [];
    map[key].push({ id:String(r.ID || ''), arquivoId:String(r.ARQUIVO_ID || ''), url:driveImageUrl_(r.ARQUIVO_ID, 1600) || String(r.URL || ''), ordem:Number(r.ORDEM || 0), capa:String(r.CAPA).toUpperCase() === 'TRUE' });
  });
  Object.keys(map).forEach(k => map[k].sort((a,b) => a.ordem - b.ordem));
  return map;
}

function atualizarCapaMaquina_(maquinaId, fileId, url) {
  const sheet = getSheet_(FM.SHEETS.MAQUINAS);
  const row = findById_(sheet,maquinaId);
  if (!row) return;
  const headers = getHeaders_(sheet);
  sheet.getRange(row.__row, headers.indexOf('FOTO_CAPA_URL') + 1).setValue(url || '');
  sheet.getRange(row.__row, headers.indexOf('FOTO_CAPA_ID') + 1).setValue(fileId || '');
  sheet.getRange(row.__row, headers.indexOf('ATUALIZADO_EM') + 1).setValue(new Date());
}

function desmarcarCapas_(maquinaId) {
  const sheet = getSheet_(FM.SHEETS.FOTOS);
  const headers = getHeaders_(sheet);
  const col = headers.indexOf('CAPA') + 1;
  rowsToObjects_(sheet).filter(r => String(r.MAQUINA_ID) === String(maquinaId)).forEach(r => sheet.getRange(r.__row,col).setValue(false));
}

function excluirFotosDaMaquina_(maquinaId) {
  const sheet = getSheet_(FM.SHEETS.FOTOS);
  const rows = rowsToObjects_(sheet).filter(r => String(r.MAQUINA_ID) === String(maquinaId)).sort((a,b) => b.__row - a.__row);
  rows.forEach(r => {
    try { DriveApp.getFileById(r.ARQUIVO_ID).setTrashed(true); } catch (err) {}
    sheet.deleteRow(r.__row);
  });
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function styleAllSheets_(ss) {
  Object.values(FM.SHEETS).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const cols = sheet.getLastColumn();
    sheet.getRange(1,1,1,cols).setBackground('#001656').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setRowHeight(1,34);
    if (!sheet.getFilter() && sheet.getMaxRows() >= 2) sheet.getRange(1,1,sheet.getMaxRows(),cols).createFilter();
  });
}

function criarPastaFotos_() {
  const props = PropertiesService.getScriptProperties();
  const current = props.getProperty('DRIVE_FOLDER_ID');
  if (current) {
    try { DriveApp.getFolderById(current); return current; } catch (err) {}
  }
  const folder = DriveApp.createFolder('FM - Fotos das Máquinas');
  props.setProperty('DRIVE_FOLDER_ID', folder.getId());
  return folder.getId();
}

function popularCategoriasIniciais_() {
  const sheet = getSheet_(FM.SHEETS.CATEGORIAS);
  const existing = new Set(rowsToObjects_(sheet).map(r => String(r.SLUG || '')));
  FM.DEFAULT_CATEGORIES.forEach((name,index) => {
    const slug = slugify_(name);
    if (!existing.has(slug)) sheet.appendRow([uuid_('cat'),name,slug,true,index+1,new Date(),new Date()]);
  });
}

function aplicarValidacoes_() {
  const maquinas = getSheet_(FM.SHEETS.MAQUINAS);
  maquinas.getRange('I2:I').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Nova','Seminova','Usada'],true).build());
  maquinas.getRange('Q2:Q').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['PUBLICADO','OCULTO','VENDIDO'],true).build());
}

function atualizarConfig_() {
  const ss = getSpreadsheet_();
  const props = PropertiesService.getScriptProperties();
  const values = [
    ['APP_NAME',FM.APP_NAME,'Nome do sistema'],
    ['SPREADSHEET_ID',ss.getId(),'ID da Planilha Google'],
    ['SPREADSHEET_URL',ss.getUrl(),'URL da Planilha Google'],
    ['DRIVE_FOLDER_ID',props.getProperty('DRIVE_FOLDER_ID') || '','Pasta das fotos no Google Drive'],
    ['WEB_APP_URL',ScriptApp.getService().getUrl() || '','URL da implantação do Apps Script'],
    ['TIMEZONE',ss.getSpreadsheetTimeZone(),'Fuso horário']
  ];
  const sheet = getSheet_(FM.SHEETS.CONFIG);
  if (sheet.getLastRow() > 1) sheet.getRange(2,1,sheet.getLastRow()-1,3).clearContent();
  sheet.getRange(2,1,values.length,3).setValues(values);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Planilha ainda não configurada. Execute INSTALAR_SISTEMA().');
  return SpreadsheetApp.openById(id);
}
function getSheet_(name) { const s = getSpreadsheet_().getSheetByName(name); if (!s) throw new Error('Aba não encontrada: ' + name); return s; }
function rowsToObjects_(sheet) {
  const values = sheet.getDataRange().getValues(); if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(r => r.some(v => String(v || '').trim() !== '')).map((row,index) => {
    const obj = { __row:index+2 }; headers.forEach((h,i) => obj[h] = row[i]); return obj;
  });
}
function getHeaders_(sheet) { return sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String); }
function objectToRow_(headers,obj) { return headers.map(h => obj[h] !== undefined ? obj[h] : ''); }
function findById_(sheet,id) { return rowsToObjects_(sheet).find(r => String(r.ID) === String(id)) || null; }
function uuid_(prefix) { return prefix + '_' + Utilities.getUuid(); }
function slugify_(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function sanitizeFileName_(name) { return String(name || 'arquivo').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim(); }
function sortMaquinas_(a,b) {
  const da = String(a.DESTAQUE).toUpperCase() === 'TRUE' ? 0 : 1;
  const db = String(b.DESTAQUE).toUpperCase() === 'TRUE' ? 0 : 1;
  if (da !== db) return da - db;
  return Number(a.ORDEM || 9999) - Number(b.ORDEM || 9999);
}
function hashPassword_(password,salt) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(salt)+'|'+String(password),Utilities.Charset.UTF_8));
}
function base64ForClient_(value) {
  const text = JSON.stringify(value || {});
  return Utilities.base64EncodeWebSafe(
    text,
    Utilities.Charset.UTF_8
  );
}

function jsonForHtml_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function sanitizeCallback_(name) {
  name = String(name || '').trim(); if (!name) return '';
  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(name)) throw new Error('Callback JSONP inválido.');
  return name;
}
function log_(action,entity,entityId,details) {
  try { getSheet_(FM.SHEETS.LOGS).appendRow([new Date(),action,entity,entityId || '',typeof details === 'string' ? details : JSON.stringify(details)]); } catch (err) {}
}


/**
 * Execute uma vez se já existirem fotos cadastradas.
 * Atualiza as URLs antigas nas abas FOTOS e MAQUINAS.
 */
function REPARAR_URLS_FOTOS() {
  const fotosSheet = getSheet_(FM.SHEETS.FOTOS);
  const fotos = rowsToObjects_(fotosSheet);
  const fotosHeaders = getHeaders_(fotosSheet);
  const colFotoUrl = fotosHeaders.indexOf('URL') + 1;

  fotos.forEach(row => {
    const fileId = String(row.ARQUIVO_ID || '').trim();
    if (!fileId) return;
    fotosSheet.getRange(row.__row, colFotoUrl)
      .setValue(driveImageUrl_(fileId, 1600));
  });

  const maquinasSheet = getSheet_(FM.SHEETS.MAQUINAS);
  const maquinas = rowsToObjects_(maquinasSheet);
  const maquinasHeaders = getHeaders_(maquinasSheet);
  const colCapaUrl = maquinasHeaders.indexOf('FOTO_CAPA_URL') + 1;

  maquinas.forEach(row => {
    const fileId = String(row.FOTO_CAPA_ID || '').trim();
    if (!fileId) return;
    maquinasSheet.getRange(row.__row, colCapaUrl)
      .setValue(driveImageUrl_(fileId, 1600));
  });

  SpreadsheetApp.flush();
  return {
    success: true,
    fotosAtualizadas: fotos.length,
    maquinasVerificadas: maquinas.length
  };
}


/**
 * Execute manualmente no editor do Apps Script se precisar diagnosticar
 * o acesso à planilha. Não altera nenhum dado.
 */
function DIAGNOSTICO_ADMIN() {
  const result = {
    success: false,
    spreadsheetId: '',
    sheets: [],
    maquinas: 0,
    categorias: 0,
    fotos: 0,
    message: ''
  };

  try {
    const ss = getSpreadsheet_();

    result.spreadsheetId = ss.getId();
    result.sheets = ss.getSheets().map(function(sheet) {
      return sheet.getName();
    });

    result.maquinas = rowsToObjects_(
      getSheet_(FM.SHEETS.MAQUINAS)
    ).length;

    result.categorias = rowsToObjects_(
      getSheet_(FM.SHEETS.CATEGORIAS)
    ).length;

    result.fotos = rowsToObjects_(
      getSheet_(FM.SHEETS.FOTOS)
    ).length;

    result.success = true;
    result.message = 'Backend administrativo OK.';
  } catch (err) {
    result.message = err && err.message
      ? err.message
      : String(err);
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

