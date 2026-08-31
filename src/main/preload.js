const { contextBridge, ipcRenderer } = require('electron');

const pixAPI = {
  config: {
    get: () => ipcRenderer.invoke('pix:get-config'),
    set: (key, value) => ipcRenderer.invoke('pix:set-config', key, value),
    getApiKeys: () => ipcRenderer.invoke('pix:get-api-keys'),
    setApiKeys: (keys) => ipcRenderer.invoke('pix:set-api-keys', keys)
  },

  ai: {
    complete: (params) => ipcRenderer.invoke('pix:ai:complete', params),
    stream: (params) => ipcRenderer.invoke('pix:ai:stream', params),
    vision: (params) => ipcRenderer.invoke('pix:ai:vision', params),
    onStreamData: (callback) => {
      ipcRenderer.on('pix:ai:stream:data', (_, data) => callback(data));
    },
    onStreamEnd: (callback) => {
      ipcRenderer.on('pix:ai:stream:end', (_, data) => callback(data));
    },
    onStreamError: (callback) => {
      ipcRenderer.on('pix:ai:stream:error', (_, data) => callback(data));
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('pix:ai:stream:data');
      ipcRenderer.removeAllListeners('pix:ai:stream:end');
      ipcRenderer.removeAllListeners('pix:ai:stream:error');
    }
  },

  automation: {
    screenshot: (params) => ipcRenderer.invoke('pix:automation:screenshot', params),
    click: (params) => ipcRenderer.invoke('pix:automation:click', params),
    type: (params) => ipcRenderer.invoke('pix:automation:type', params),
    key: (params) => ipcRenderer.invoke('pix:automation:key', params),
    move: (params) => ipcRenderer.invoke('pix:automation:move', params),
    scroll: (params) => ipcRenderer.invoke('pix:automation:scroll', params),
    drag: (params) => ipcRenderer.invoke('pix:automation:drag', params),
    app: {
      open: (params) => ipcRenderer.invoke('pix:automation:app:open', params),
      close: (params) => ipcRenderer.invoke('pix:automation:app:close', params),
      list: () => ipcRenderer.invoke('pix:automation:app:list'),
      focus: (params) => ipcRenderer.invoke('pix:automation:app:focus', params)
    },
    download: (params) => ipcRenderer.invoke('pix:automation:download', params),
    find: (params) => ipcRenderer.invoke('pix:automation:find', params),
    readScreen: (params) => ipcRenderer.invoke('pix:automation:readScreen', params),
    ocr: (params) => ipcRenderer.invoke('pix:automation:ocr', params),
    webhook: (params) => ipcRenderer.invoke('pix:automation:webhook', params)
  },

  sandbox: {
    create: (params) => ipcRenderer.invoke('pix:sandbox:create', params),
    execute: (params) => ipcRenderer.invoke('pix:sandbox:execute', params),
    destroy: (params) => ipcRenderer.invoke('pix:sandbox:destroy', params),
    list: () => ipcRenderer.invoke('pix:sandbox:list'),
    status: (params) => ipcRenderer.invoke('pix:sandbox:status', params),
    install: (params) => ipcRenderer.invoke('pix:sandbox:install', params),
    fs: (params) => ipcRenderer.invoke('pix:sandbox:fs', params)
  },

  storage: {
    save: (params) => ipcRenderer.invoke('pix:storage:save', params),
    load: (params) => ipcRenderer.invoke('pix:storage:load', params),
    list: (params) => ipcRenderer.invoke('pix:storage:list', params),
    delete: (params) => ipcRenderer.invoke('pix:storage:delete', params),
    search: (params) => ipcRenderer.invoke('pix:storage:search', params),
    stats: () => ipcRenderer.invoke('pix:storage:stats'),
    export: (params) => ipcRenderer.invoke('pix:storage:export', params),
    import: (params) => ipcRenderer.invoke('pix:storage:import', params)
  },

  learning: {
    observe: (params) => ipcRenderer.invoke('pix:learning:observe', params),
    analyze: (params) => ipcRenderer.invoke('pix:learning:analyze', params),
    teach: (params) => ipcRenderer.invoke('pix:learning:teach', params),
    recall: (params) => ipcRenderer.invoke('pix:learning:recall', params),
    patterns: () => ipcRenderer.invoke('pix:learning:patterns')
  },

  knowledge: {
    search: (params) => ipcRenderer.invoke('pix:knowledge:search', params),
    news: (params) => ipcRenderer.invoke('pix:knowledge:news', params),
    wiki: (params) => ipcRenderer.invoke('pix:knowledge:wiki', params),
    trends: (params) => ipcRenderer.invoke('pix:knowledge:trends', params),
    weather: (params) => ipcRenderer.invoke('pix:knowledge:weather', params),
    stocks: (params) => ipcRenderer.invoke('pix:knowledge:stocks', params)
  },

  plugins: {
    list: () => ipcRenderer.invoke('pix:plugins:list'),
    install: (params) => ipcRenderer.invoke('pix:plugins:install', params),
    uninstall: (params) => ipcRenderer.invoke('pix:plugins:uninstall', params),
    enable: (params) => ipcRenderer.invoke('pix:plugins:enable', params),
    disable: (params) => ipcRenderer.invoke('pix:plugins:disable', params)
  },

  tasks: {
    schedule: (params) => ipcRenderer.invoke('pix:tasks:schedule', params),
    cancel: (params) => ipcRenderer.invoke('pix:tasks:cancel', params),
    list: () => ipcRenderer.invoke('pix:tasks:list')
  },

  system: {
    info: () => ipcRenderer.invoke('pix:system:info'),
    openFolder: (path) => ipcRenderer.invoke('pix:system:open-folder', path),
    showSaveDialog: (options) => ipcRenderer.invoke('pix:system:show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('pix:system:show-open-dialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('pix:system:show-message-box', options)
  },

  session: {
    create: (params) => ipcRenderer.invoke('pix:session:create', params),
    get: (id) => ipcRenderer.invoke('pix:session:get', id),
    list: () => ipcRenderer.invoke('pix:session:list'),
    close: (id) => ipcRenderer.invoke('pix:session:close', id)
  },

  execute: {
    code: (params) => ipcRenderer.invoke('pix:execute:code', params),
    command: (params) => ipcRenderer.invoke('pix:execute:command', params)
  }
};

contextBridge.exposeInMainWorld('pix', pixAPI);
