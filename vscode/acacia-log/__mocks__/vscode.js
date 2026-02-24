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
};

const Uri = {
  parse: (s) => ({ toString: () => s, fsPath: s }),
};

module.exports = { workspace, Uri };
