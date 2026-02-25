// Manual mock for vscode module used by Jest tests
const workspace = {
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn((key) => {
      const defaults = {
        'logDateRegex': '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}',
        'logDateFormat': 'yyyy-MM-dd HH:mm:ss',
      };
      return defaults[key];
    }),
  }),
  openTextDocument: jest.fn(),
};

class EventEmitter {
  constructor() {
    this._listeners = [];
  }

  get event() {
    return (listener) => {
      this._listeners.push(listener);
      return { dispose: () => { this._listeners = this._listeners.filter(l => l !== listener); } };
    };
  }

  fire(data) {
    for (const listener of this._listeners) {
      listener(data);
    }
  }

  dispose() {
    this._listeners = [];
  }
}

const Uri = {
  parse: (s) => ({ toString: () => s, fsPath: s }),
  file: (s) => ({ toString: () => `file://${s}`, fsPath: s, scheme: 'file' }),
};

const window = {
  activeTextEditor: undefined,
  showTextDocument: jest.fn(),
};

const ViewColumn = { One: 1, Two: 2, Three: 3 };

module.exports = { workspace, Uri, EventEmitter, window, ViewColumn };
