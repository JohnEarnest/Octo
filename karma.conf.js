module.exports = function(config) {
  config.set({
    browsers: ['ChromeHeadless'],
    frameworks: ['jasmine'],
    basePath: '',
    files: [
      'lib/codemirror/codemirror.min.js',
      'lib/codemirror/octomode.js',
      'lib/filesaver.js',
      'js/emulator.js',
      'js/compiler.js',
      'js/decompiler.js',
      'js/shared.js',
      'js/util.js',
      'js/input.js',
      'spec/*.js'
    ],
  })
}
