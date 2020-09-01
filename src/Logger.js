const fs = require('fs')

//[LOG ] Loggin' things
//[INFO] Some info things...
//[WARN] Nothing is horribly wrong (yet)
//[ERR!] Oh fuck
//[DIR?] [object Object] ;^)
//[TRCE] {Stack trace}
//[DBUG] i did the thing

/**
 * Yay logging!
 */
module.exports = class Logger {
  /**
   * Constructor for Logger
   * @param {String}   [logFile='log.txt'] The file to log to
   * @param {Function} [reportError=Noop]  The error reporting function, if any
   * @param {boolean}  [debug=false]       If Logger.debug should show
   */
  constructor(logFile = 'log.txt', reportError = ()=>{}, debug = false) {
    this.logStream = fs.createWriteStream(logFile, {'flags': 'a'})
    // use {'flags': 'a'} to append and {'flags': 'w'} to erase and write a new file
    let date = new Date()
    let time = `${this._padLeft(date.getMonth()+1,2,0)}/${this._padLeft(date.getDate(),2,0)} ${this._padLeft(date.getHours(),2,0)}:${this._padLeft(date.getMinutes(),2,0)}`
    this.logStream.write(`[${time}][BGIN] Log Start!\n\r`)

    this._types = {
      'log'  : {disp: 'LOG ', color: '0', func: console.log},
      'info' : {disp: 'INFO', color: '36', func: console.info},
      'warn' : {disp: 'WARN', color: '33', func: console.warn},
      'error': {disp: 'ERR!', color: '31', func: console.error},
      'dir'  : {disp: 'DIR?', color: '34', func: console.log},
      'trace': {disp: 'TRCE', color: '32', func: console.log},
      'debug': {disp: 'DBUG', color: '35', func: console.log},
      '????' : {disp: '????', color: '0', func: console.log}
    }
    this._reportError = reportError
    this._debug = debug
  }

  /**
   * Same as console.log
   * Prepends Date + [LOG ] to output
   *
   * @param {String[]} message Same as console.log(), first can be a string used for Util.format
   */
  log(...message) {
    this._log(new Date(), 'log', ...message)
  }

  /**
   * Same as console.info
   * Prepends Date + [INFO] to output and colors
   *
   * @param {String[]} message Same as console.log(), first can be a string used for Util.format
   */
  info(...message) {
    this._log(new Date(), 'info', ...message)
  }

  /**
   * Same as console.warn
   * Prepends Date + [WARM] to output and colors
   *
   * @param {String[]} message Same as console.log(), first can be a string used for Util.format
   */
  warn(...message) {
    this._log(new Date(), 'warn', ...message)
  }

  /**
   * Same as console.error
   * Also calls the reportError function
   * Prepends Date + [ERR!] to output and colors
   *
   * @param {String[]} message Same as console.log(), first can be a string used for Util.format
   */
  error(...message) {
    this._reportError(require('util').format(...message), 'Logger Caught')
    this.logStream.write(`${this._log(new Date(), 'error', require('util').inspect(message[0], { depth: null }), ...message.slice(1))}\n\r`)
  }

  /**
   * Same as console.dir
   * Prepends Date + [DIR?] to output and colors
   *
   * @param {Object}   obj     The object to inspect
   * @param {String[]} message Same as console.log(), first can be a string used for Util.format
   */
  dir(obj, options) {
    console.dir(obj, { ...options, colors: true })
  }

  /**
   * Same as console.trace
   * Prepends Date + [TRCE] to output and colors
   *
   * @param {String[]} message Same as console.log(), first can be a string used for Util.format
   */
  trace(...message) {
    this._log(new Date(), 'trace', ...message)
    console.trace(...message)
  }

  /**
   * Same as console.debug
   * Only outputs if debug is true
   * Prepends Date + [DBUG] to output and colors
   *
   * @param {String[]} message Same as console.log(), first can be a string used for Util.format
   */
  debug(...message) {
    if (this._debug)
      this._log(new Date(), 'debug', ...message)
  }

  /**
   * The actual logging thing
   * You probably should never need to use it
   *
   * @param {Date}     date    The date to log
   * @param {String}   type    The type of thing to log
   * @param {String[]} message The message(s) to log. Util.format is called on this
   */
  _log(date, type, ...message) {
    const time = `${this._padLeft(date.getMonth()+1,2,0)}/${this._padLeft(date.getDate(),2,0)} ${this._padLeft(date.getHours(),2,0)}:${this._padLeft(date.getMinutes(),2,0)}`
    if (this._types[type] === undefined)
      type = '????'

    const formatted = `\u001b[${this._types[type].color}m[${time}][${this._types[type].disp}] ${require('util').format(...message)}\u001b[0m`

    this._types[type].func(formatted)
    return formatted
  }

  /**
   * You should never need to use this
   * Pads a string to the right
   *
   * @param {String} msg           The message to pad
   * @param {Number} pad           Width to pad to
   * @param {String} [padChar=' '] Char to pad with
   *
   * @return {String} The padded string
   */
  _padRight(msg, pad, padChar = ' ') {
    padChar = '' + padChar
    return new Array(pad).fill(0).map((v,i)=>msg.split('')[i]||padChar).join('')
  }

  /**
   * You should never need to use this
   * Pads a string to the left
   *
   * @param {String} msg           The message to pad
   * @param {Number} pad           Width to pad to
   * @param {String} [padChar='0'] Char to pad with
   *
   * @return {String} The padded string
   */
  _padLeft(msg, pad, padChar = '0') {
    padChar = '' + padChar //because string coersion wee
    msg = '' + msg
    let padded = padChar.repeat(pad)
    return padded.substring(0, padded.length - msg.length) + msg
  }
}
