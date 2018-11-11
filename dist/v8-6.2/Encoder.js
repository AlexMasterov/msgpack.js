'use strict';

const { utf8toBin } = require('utf8-bin');
const { throwsEncoderHandler } = require('./handlers');
const { selectEncoderFloat, encodeAscii } = require('./encoders');
const { CHR } = require('./binary');
const Ext = require('./Ext');

const isArray = Array.isArray;
const isBuffer = Buffer.isBuffer;
const alloc = Buffer.allocUnsafe;
const objectKeys = Object.keys;

const Bool = 'boolean';
const Num = 'number';
const Obj = 'object';
const Str = 'string';

class Encoder {
  constructor({
    float='64',
    objectKeys='ascii',
    bufferMinLen=15,
    bufferMinAlloc=2048,
    handler=throwsEncoderHandler,
    codecs=false,
  } = {}) {
    this.handler = null; // avoid function tracking on the hidden class
    this.handler = handler.bind(this);
    this.encodeFloat = selectEncoderFloat(float);
    this.encodeObjectKeys = (objectKeys === 'ascii') ? encodeAscii : this.encodeStr;
    this.encodeBigInt = this.encodeInt;
    this.codecs = codecs;
    this.buffer = null;
    this.bufferAlloc = 0;
    this.bufferMinLen = bufferMinLen >>> 0;
    this.bufferMinAlloc = bufferMinAlloc >>> 0;
  }

  encode(value) {
    switch (typeof value) {
      case Str:
        return this.encodeStr(value);
      case Num:
        return (value % 1 === 0) ? this.encodeInt(value) : this.encodeFloat(value);
      case Obj:
        if (value === null) return '\xc0';
        if (isArray(value)) return this.encodeArray(value);
        if (isBuffer(value)) return this.encodeBin(value);
        if (value.constructor == Ext) return this.encodeExt(value.type, value.bin);
        if (this.codecs !== false) {
          let bin, i = this.codecs.length;
          while (i > 0) {
            bin = this.codecs[i -= 1].encode(this, value);
            if (bin !== null) return bin;
          }
        }
        return this.encodeObject(value);
      case Bool:
        return value ? '\xc3' : '\xc2';

      default:
        return this.handler(value);
    }
  }

  encodeNil() {
    return '\xc0';
  }

  encodeBool(bool) {
    return bool ? '\xc3' : '\xc2';
  }

  encodeInt(num) {
    if (num < 0) {
      // negative fixint
      if (num > -0x21) {
        return CHR[num & 0xff];
      }
      // int 8
      if (num > -0x81) {
        return '\xd0'
          + CHR[num & 0xff];
      }
      // int 16
      if (num > -0x8001) {
        return '\xd1'
          + CHR[num >> 8 & 0xff]
          + CHR[num & 0xff];
      }
      // int 32
      if (num > -0x80000001) {
        return '\xd2'
          + CHR[num >> 24 & 0xff]
          + CHR[num >> 16 & 0xff]
          + CHR[num >> 8 & 0xff]
          + CHR[num & 0xff];
      }
      // s_int 64
      if (num > -0x20000000000001) {
        return '\xd3'
          + encodeInt64(
            (num / 0x100000000 >> 0) - 1,
            num >>> 0
          );
      }
      // -Infinity
      return '\xd3\xff\xdf\xff\xff\xff\xff\xff\xff';
    }
    // positive fixint
    if (num < 0x80) {
      return CHR[num];
    }
    // uint 8
    if (num < 0x100) {
      return '\xcc'
        + CHR[num];
    }
    // uint 16
    if (num < 0x10000) {
      return '\xcd'
        + CHR[num >> 8]
        + CHR[num & 0xff];
    }
    // uint 32
    if (num < 0x100000000) {
      return '\xce'
        + CHR[num >> 24 & 0xff]
        + CHR[num >> 16 & 0xff]
        + CHR[num >> 8 & 0xff]
        + CHR[num & 0xff];
    }
    // s_uint 64
    if (num < 0x20000000000000) {
      return '\xcf'
        + encodeInt64(
          num >>> 11 | 1,
          num
        );
    }
    // Infinity
    return '\xcf\x00\x20\x00\x00\x00\x00\x00\x00';
  }

  encodeStr(str) {
    let len = str.length, bin;
    if (len === 0) return '\xa0';

    if (len < this.bufferMinLen) {
      bin = utf8toBin(str);
      len = bin.length;
    } else {
      if (len > this.bufferAlloc) {
        this.bufferAlloc = this.bufferMinAlloc * (len >>> 10 | 2);
        this.buffer = alloc(this.bufferAlloc);
      }
      len = this.buffer.utf8Write(str, 0);
      bin = this.buffer.latin1Slice(0, len);
    }

    // fixstr
    if (len < 0x20) {
      return CHR[len | 0xa0]
        + bin;
    }
    // str 8
    if (len < 0x100) {
      return '\xd9'
        + CHR[len]
        + bin;
    }
    // str 16
    if (len < 0x10000) {
      return '\xda'
        + CHR[len >> 8]
        + CHR[len & 0xff]
        + bin;
    }
    // str 32
    return '\xdb'
      + CHR[len >> 24 & 0xff]
      + CHR[len >> 16 & 0xff]
      + CHR[len >> 8 & 0xff]
      + CHR[len & 0xff]
      + bin;
  }

  encodeBin(buf) {
    const len = buf.length;
    if (len === 0) return '\xc4\x00';

    let bin;
    if (len < 7) {
      bin = '';
      for (let i = 0; i < len; i++) {
        bin += CHR[buf[i]];
      }
    } else {
      bin = buf.latin1Slice(0, len);
    }

    // bin 8
    if (len < 0x100) {
      return '\xc4'
        + CHR[len]
        + bin;
    }
    // bin 16
    if (len < 0x10000) {
      return '\xc5'
        + CHR[len >> 8]
        + CHR[len & 0xff]
        + bin;
    }
    // bin 32
    return '\xc6'
      + CHR[len >> 24 & 0xff]
      + CHR[len >> 16 & 0xff]
      + CHR[len >> 8 & 0xff]
      + CHR[len & 0xff]
      + bin;
  }

  encodeArray(arr) {
    const len = arr.length;
    if (len === 0) return '\x90';

    let bin;
    if (len < 0x10) { // fixarray
      bin = CHR[0x90 | len];
    } else if (len < 0x10000) { // array 16
      bin = '\xdc'
        + CHR[len >> 8]
        + CHR[len & 0xff];
    } else { // array 32
      bin = '\xdd'
        + CHR[len >> 24 & 0xff]
        + CHR[len >> 16 & 0xff]
        + CHR[len >> 8 & 0xff]
        + CHR[len & 0xff];
    }

    for (let i = 0; i < len; i++) {
      bin += this.encode(arr[i]);
    }

    return bin;
  }

  encodeObject(obj) {
    const keys = objectKeys(obj);
    const len = keys.length;
    if (len === 0) return '\x80';

    let bin;
    if (len < 0x10) { // fixmap
      bin = CHR[0x80 | len];
    } else if (len < 0x10000) { // map 16
      bin = '\xde'
        + CHR[len >> 8]
        + CHR[len & 0xff];
    } else { // map 32
      bin = '\xdf'
        + CHR[len >> 24 & 0xff]
        + CHR[len >> 16 & 0xff]
        + CHR[len >> 8 & 0xff]
        + CHR[len & 0xff];
    }

    for (let key, i = 0; i < len; i++) {
      key = keys[i];
      bin += this.encodeObjectKeys(key);
      bin += this.encode(obj[key]);
    }

    return bin;
  }

  encodeMap(map) {
    const size = map.size;
    if (size === 0) return '\x80';

    let bin;
    if (size < 0x10) { // fixmap
      bin = CHR[0x80 | size];
    } else if (size < 0x10000) { // map 16
      bin = '\xde'
        + CHR[size >> 8]
        + CHR[size & 0xff];
    } else { // map 32
      bin = '\xdf'
        + CHR[size >> 24 & 0xff]
        + CHR[size >> 16 & 0xff]
        + CHR[size >> 8 & 0xff]
        + CHR[size & 0xff];
    }

    for (const [key, value] of map) {
      bin += this.encode(key);
      bin += this.encode(value);
    }

    return bin;
  }

  encodeExt(type, bin) {
    const ext = CHR[type & 0x7f] + bin;
    const len = bin.length;

    // fixext 1/2/4/8/16
    switch (len) {
      case 1: return '\xd4' + ext;
      case 2: return '\xd5' + ext;
      case 4: return '\xd6' + ext;
      case 8: return '\xd7' + ext;
      case 16: return '\xd8' + ext;
    }
    // ext 8
    if (len < 0x100) {
      return '\xc7'
        + CHR[len]
        + ext;
    }
    // ext 16
    if (len < 0x10000) {
      return '\xc8'
        + CHR[len >> 8]
        + CHR[len & 0xff]
        + ext;
    }
    // ext 32
    return '\xc9'
      + CHR[len >> 24 & 0xff]
      + CHR[len >> 16 & 0xff]
      + CHR[len >> 8 & 0xff]
      + CHR[len & 0xff]
      + ext;
  }
}

function encodeInt64(hi, lo) {
  return CHR[hi >> 24 & 0xff]
    + CHR[hi >> 16 & 0xff]
    + CHR[hi >> 8 & 0xff]
    + CHR[hi & 0xff]
    + CHR[lo >> 24 & 0xff]
    + CHR[lo >> 16 & 0xff]
    + CHR[lo >> 8 & 0xff]
    + CHR[lo & 0xff];
}

module.exports = Encoder;