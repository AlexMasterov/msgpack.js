'use strict';

const Codec = require('../Codec');

class UndefinedCodec extends Codec {
  static get type() {
    return 0x0a;
  }

  supports(value) {
    return value._isUndefined === true;
  }

  encode(value) {
    return null;
  }

  decode(data) {
    return undefined;
  }
}

module.exports = UndefinedCodec;