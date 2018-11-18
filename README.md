# msgpuck

[![npm](https://img.shields.io/npm/v/msgpuck.svg)](https://www.npmjs.com/package/msgpuck)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build Status](https://travis-ci.org/AlexMasterov/msgpuck.js.svg)](https://travis-ci.org/AlexMasterov/msgpuck.js)
[![Coverage Status](https://coveralls.io/repos/github/AlexMasterov/msgpuck.js/badge.svg?branch=master)](https://coveralls.io/github/AlexMasterov/msgpuck.js?branch=master)

A fast and memory-efficient [MessagePack](https://msgpack.org) serialization library.

## Features

- Fully compliant with the latest [MessagePack specification](https://github.com/msgpack/msgpack/blob/master/spec.md#messagepack-specification)
- Supports safe/big/custom 64-bit integers handling
- Supports custom Extension Types (Serialization Codecs)
- [Fully tested](https://travis-ci.org/AlexMasterov/msgpuck.js), including V8 JIT optimizations

## Installation

```sh
# npm
npm install msgpuck

# yarn
yarn add msgpuck
```

## Usage

## Encoding

To encode values you can either use an instance of `Encoder`:

```javascript
const { Encoder } = require('msgpuck');

const encoder = new Encoder();

...

encoder.encode(value); // string(binary)
```

A list of all low-level encoder methods:

```javascript
encoder.encodeNil();                    // MP nil
encoder.encodeBool(true);               // MP bool
encoder.encodeInt(42);                  // MP int
encoder.encodeBigInt(42n);              // MP int64
encoder.encodeFloat(Math.PI);           // MP float
encoder.encodeStr('foo');               // MP str
encoder.encodeBin(Buffer.from([0x2a])); // MP bin
encoder.encodeArray([1, 2]);            // MP array
encoder.encodeObject({ key: 'value' }); // MP map
encoder.encodeExt(1, '\x2a');           // MP ext
```

## Decoding

To decode data (buffer) you can either use an instance of `Decoder`:

```javascript
const { Decoder } = require('msgpuck');

const decoder = new Decoder();

...

decoder.decode(buffer);
```

## Extensions

To define application-specific types use the `Ext` class:

```javascript
const { Encoder, Decoder, Ext } = require('msgpuck');

const encoded = new Encoder().encode(Ext.make(42, '\x2a'));

const buffer = Buffer.from(encoded, 'binary');
const ext = new Decoder().decode(buffer);

console.log(ext.type === 42);     // bool(true)
console.log(ext.data === '\x2a'); // bool(true)
```

## Tests

Run tests as follows:

```
npm run test
```

## License

Copyright &#169; 2018 Alex Masterov &lt;alex.masterow@gmail.com&gt;

MsgPuck is licensed under MIT and can be used for any personal or commercial project.
