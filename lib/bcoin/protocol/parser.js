/**
 * parser.js - packet parser for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * https://github.com/indutny/bcoin
 */

var EventEmitter = require('events').EventEmitter;
var bn = require('bn.js');

var bcoin = require('../../bcoin');
var utils = bcoin.utils;
var assert = utils.assert;
var constants = require('./constants');
var network = require('./network');

/**
 * Parser
 */

function Parser() {
  if (!(this instanceof Parser))
    return new Parser();

  EventEmitter.call(this);

  this.pending = [];
  this.pendingTotal = 0;
  this.waiting = 24;
  this.packet = null;
}

utils.inherits(Parser, EventEmitter);

Parser.prototype._error = function _error(str) {
  this.emit('error', new Error(str));
};

Parser.prototype.feed = function feed(data) {
  var chunk, i, off, len;

  this.pendingTotal += data.length;
  this.pending.push(data);

  while (this.pendingTotal >= this.waiting) {
    // Concat chunks
    chunk = new Buffer(this.waiting);

    i = 0;
    off = 0;
    len = 0;

    for (; off < chunk.length; i++) {
      len = utils.copy(this.pending[0], chunk, off);
      if (len === this.pending[0].length)
        this.pending.shift();
      else
        this.pending[0] = this.pending[0].slice(len);
      off += len;
    }

    assert.equal(off, chunk.length);

    // Slice buffers
    this.pendingTotal -= chunk.length;
    this.parse(chunk);
  }
};

Parser.prototype.parse = function parse(chunk) {
  if (chunk.length > constants.maxMessage)
    return this._error('Packet too large: %dmb.', utils.mb(chunk.length));

  if (this.packet === null) {
    this.packet = this.parseHeader(chunk) || {};
    return;
  }

  this.packet.payload = chunk;

  if (utils.readU32(utils.checksum(this.packet.payload)) !== this.packet.checksum)
    return this._error('Invalid checksum');

  try {
    this.packet.payload = this.parsePayload(this.packet.cmd, this.packet.payload);
  } catch (e) {
    this.emit('error', e);
  }

  if (this.packet.payload)
    this.emit('packet', this.packet);

  this.waiting = 24;
  this.packet = null;
};

Parser.prototype.parseHeader = function parseHeader(h) {
  var i, magic, cmd;

  magic = utils.readU32(h, 0);

  if (magic !== network.magic)
    return this._error('Invalid magic value: ' + magic.toString(16));

  // Count length of the cmd
  for (i = 0; h[i + 4] !== 0 && i < 12; i++);

  if (i === 12)
    return this._error('Not NULL-terminated cmd');

  cmd = h.slice(4, 4 + i).toString('ascii');
  this.waiting = utils.readU32(h, 16);

  if (this.waiting > constants.maxMessage)
    return this._error('Packet length too large: %dmb', utils.mb(this.waiting));

  return {
    cmd: cmd,
    length: this.waiting,
    checksum: utils.readU32(h, 20)
  };
};

Parser.prototype.parsePayload = function parsePayload(cmd, p) {
  if (cmd === 'version')
    return Parser.parseVersion(p);

  if (cmd === 'getdata' || cmd === 'inv' || cmd === 'notfound')
    return Parser.parseInvList(p);

  if (cmd === 'merkleblock')
    return Parser.parseMerkleBlock(p);

  if (cmd === 'headers')
    return Parser.parseHeaders(p);

  if (cmd === 'block')
    return Parser.parseBlockCompact(p);

  if (cmd === 'tx')
    return Parser.parseTX(p);

  if (cmd === 'reject')
    return Parser.parseReject(p);

  if (cmd === 'addr')
    return Parser.parseAddr(p);

  if (cmd === 'ping')
    return Parser.parsePing(p);

  if (cmd === 'pong')
    return Parser.parsePong(p);

  return p;
};

Parser.parsePing = function parsePing(p) {
  if (p.length < 8)
    throw new Error('pong packet is too small');

  return {
    nonce: utils.readU64(p, 0)
  };
};

Parser.parsePong = function parsePong(p) {
  if (p.length < 8)
    throw new Error('ping packet is too small');

  return {
    nonce: utils.readU64(p, 0)
  };
};

Parser.parseVersion = function parseVersion(p) {
  var v, services, ts, recv, from, nonce, result, off, agent, height, relay;

  if (p.length < 85)
    throw new Error('version packet is too small');

  v = utils.readU32(p, 0);
  services = utils.readU64(p, 4);

  // Timestamp
  ts = utils.read64(p, 12);

  // Our address (recv)
  recv = Parser.parseAddress(p, 20);

  // Their Address (from)
  from = Parser.parseAddress(p, 46);

  // Nonce, very dramatic
  nonce = utils.readU64(p, 72);

  // User agent length
  result = utils.readIntv(p, 80);
  off = result.off;
  agent = p.slice(off, off + result.r);
  off += result.r;

  // Start height
  height = utils.readU32(p, off);
  off += 4;

  // Relay
  relay = p.length > off ? p[off] === 1 : true;

  try {
    ts = ts.toNumber();
  } catch (e) {
    ts = 0;
  }

  try {
    services = services.toNumber();
  } catch (e) {
    services = 1;
  }

  return {
    v: v,
    services: services,
    network: (services & constants.services.network) !== 0,
    getutxo: (services & constants.services.getutxo) !== 0,
    bloom: (services & constants.services.bloom) !== 0,
    witness: (services & constants.services.witness) !== 0,
    ts: ts,
    local: recv,
    remote: from,
    nonce: nonce,
    agent: agent.toString('ascii'),
    height: height,
    relay: relay
  };
};

Parser.parseInvList = function parseInvList(p) {
  var items = [];
  var i, off, count;

  count = utils.readIntv(p, 0);
  p = p.slice(count.off);
  count = count.r;

  if (p.length < count * 36)
    throw new Error('Invalid getdata size');

  for (i = 0, off = 0; i < count; i++, off += 36) {
    items.push({
      type: constants.invByVal[utils.readU32(p, off)],
      hash: p.slice(off + 4, off + 36)
    });
  }

  return items;
};

Parser.parseMerkleBlock = function parseMerkleBlock(p) {
  var i, hashCount, off, hashes, flagCount, flags;

  if (p.length < 86)
    throw new Error('Invalid merkleblock size');

  hashCount = utils.readIntv(p, 84);
  off = hashCount.off;
  hashCount = hashCount.r;

  if (off + 32 * hashCount + 1 > p.length)
    throw new Error('Invalid hash count');

  hashes = new Array(hashCount);

  for (i = 0; i < hashCount; i++)
    hashes[i] = p.slice(off + i * 32, off + (i + 1) * 32);

  off = off + 32 * hashCount;
  flagCount = utils.readIntv(p, off);
  off = flagCount.off;
  flagCount = flagCount.r;

  if (off + flagCount > p.length)
    throw new Error('Invalid flag count');

  flags = p.slice(off, off + flagCount);

  return {
    version: utils.read32(p, 0),
    prevBlock: p.slice(4, 36),
    merkleRoot: p.slice(36, 68),
    ts: utils.readU32(p, 68),
    bits: utils.readU32(p, 72),
    nonce: utils.readU32(p, 76),
    totalTX: utils.readU32(p, 80),
    hashes: hashes,
    flags: flags,
    _size: p.length
  };
};

Parser.parseHeaders = function parseHeaders(p) {
  var headers = [];
  var i, result, off, count, header, start, r;

  if (p.length < 81)
    throw new Error('Invalid headers size');

  result = utils.readIntv(p, 0);
  off = result.off;
  count = result.r;

  if (p.length < count * 80)
    throw new Error('Invalid headers size');

  for (i = 0; i < count; i++) {
    header = {};
    start = off;
    header.version = utils.read32(p, off);
    off += 4;
    header.prevBlock = p.slice(off, off + 32);
    off += 32;
    header.merkleRoot = p.slice(off, off + 32);
    off += 32;
    header.ts = utils.readU32(p, off);
    off += 4;
    header.bits = utils.readU32(p, off);
    off += 4;
    header.nonce = utils.readU32(p, off);
    off += 4;
    r = utils.readIntv(p, off);
    header.totalTX = r.r;
    off = r.off;
    headers.push(header);
  }

  return headers;
};

Parser.parseBlock = function parseBlock(p) {
  var txs = [];
  var witnessSize = 0;
  var i, result, off, totalTX, tx;

  if (p.length < 81)
    throw new Error('Invalid block size');

  result = utils.readIntv(p, 80);
  off = result.off;
  totalTX = result.r;

  for (i = 0; i < totalTX; i++) {
    tx = Parser.parseTX(p.slice(off), true);
    if (!tx)
      throw new Error('Invalid tx count for block');
    tx._offset = off;
    off += tx._size;
    witnessSize += tx._witnessSize;
    txs.push(tx);
  }

  return {
    version: utils.read32(p, 0),
    prevBlock: p.slice(4, 36),
    merkleRoot: p.slice(36, 68),
    ts: utils.readU32(p, 68),
    bits: utils.readU32(p, 72),
    nonce: utils.readU32(p, 76),
    totalTX: totalTX,
    txs: txs,
    _size: p.length,
    _witnessSize: witnessSize
  };
};

Parser.parseBlockCompact = function parseBlockCompact(p) {
  var height = -1;
  var i, result, off, totalTX, tx;
  var inCount, input, s, version;

  if (p.length < 81)
    throw new Error('Invalid block size');

  version = utils.read32(p, 0);

  result = utils.readIntv(p, 80);
  off = result.off;
  totalTX = result.r;

  if (version > 1 && totalTX > 0) {
    if (p.length < off + 10)
      throw new Error('Invalid tx size');

    inCount = utils.readIntv(p, off + 4);
    off = inCount.off;
    inCount = inCount.r;

    if (inCount > 0) {
      input = Parser.parseInput(p.slice(off));
      if (!input)
        throw new Error('Invalid tx count for block');
    }
  }

  if (input) {
    s = bcoin.script.decode(input.script);
    if (Buffer.isBuffer(s[0]))
      height = bcoin.script.num(s[0], true);
  }

  return {
    version: version,
    prevBlock: p.slice(4, 36),
    merkleRoot: p.slice(36, 68),
    ts: utils.readU32(p, 68),
    bits: utils.readU32(p, 72),
    nonce: utils.readU32(p, 76),
    totalTX: totalTX,
    coinbaseHeight: height,
    txs: [],
    _raw: p,
    _size: p.length
  };
};

Parser.parseInput = function parseInput(p) {
  var scriptLen, off;

  if (p.length < 41)
    throw new Error('Invalid tx_in size');

  scriptLen = utils.readIntv(p, 36);
  off = scriptLen.off;
  scriptLen = scriptLen.r;

  if (off + scriptLen + 4 > p.length)
    throw new Error('Invalid tx_in script length');

  return {
    _size: off + scriptLen + 4,
    prevout: {
      hash: p.slice(0, 32),
      index: utils.readU32(p, 32)
    },
    script: bcoin.script.decode(p.slice(off, off + scriptLen)),
    sequence: utils.readU32(p, off + scriptLen)
  };
};

Parser.parseOutput = function parseOutput(p) {
  var scriptLen, off;

  if (p.length < 9)
    throw new Error('Invalid tx_out size');

  scriptLen = utils.readIntv(p, 8);
  off = scriptLen.off;
  scriptLen = scriptLen.r;

  if (off + scriptLen > p.length)
    throw new Error('Invalid tx_out script length');

  return {
    _size: off + scriptLen,
    value: utils.read64(p, 0),
    script: bcoin.script.decode(p.slice(off, off + scriptLen))
  };
};

Parser.parseCoin = function parseCoin(p, extended) {
  var off = 0;
  var version, height, value, script, hash, index, spent, scriptLen;

  if (p.length < 17 + (extended ? 37 : 0))
    throw new Error('Invalid utxo size');

  version = utils.readU32(p, off);
  off += 4;

  height = utils.readU32(p, off);
  if (height === 0x7fffffff)
    height = -1;
  off += 4;

  value = utils.read64(p, off);
  off += 8;

  scriptLen = utils.readIntv(p, off);
  off = scriptLen.off;
  scriptLen = scriptLen.r;

  if (off + scriptLen > p.length - (extended ? 37 : 0))
    throw new Error('Invalid utxo script length');

  script = bcoin.script.decode(p.slice(off, off + scriptLen));
  off += scriptLen;

  if (extended) {
    hash = p.slice(off, off + 32);
    off += 32;

    index = utils.readU32(p, off);
    off += 4;

    spent = utils.readU8(p, off) === 1;
    off += 1;
  } else {
    hash = new Buffer(constants.zeroHash);
    index = 0xffffffff;
    spent = false;
  }

  return {
    version: version,
    height: height,
    value: value,
    script: script,
    hash: hash,
    index: index,
    spent: spent
  };
};

Parser.parseTX = function parseTX(p, block) {
  var off = 0;
  var inCount, txIn, tx;
  var outCount, txOut;
  var version, locktime, i;
  var raw;

  if (p.length < 10)
    throw new Error('Invalid tx size');

  if (Parser.isWitnessTX(p))
    return Parser.parseWitnessTX(p, block);

  version = utils.readU32(p, off);
  off += 4;

  inCount = utils.readIntv(p, off);
  off = inCount.off;
  inCount = inCount.r;

  if (inCount < 0)
    throw new Error('Invalid tx_in count (negative)');

  if (off + 41 * inCount + 5 > p.length)
    throw new Error('Invalid tx_in count (too big)');

  txIn = new Array(inCount);
  for (i = 0; i < inCount; i++) {
    tx = Parser.parseInput(p.slice(off));

    if (!tx)
      return;

    txIn[i] = tx;
    txIn[i].witness = [];
    tx._offset = off;
    off += tx._size;

    if (off + 5 > p.length)
      throw new Error('Invalid tx_in offset');
  }

  outCount = utils.readIntv(p, off);
  off = outCount.off;
  outCount = outCount.r;
  if (outCount < 0)
    throw new Error('Invalid tx_out count (negative)');
  if (off + 9 * outCount + 4 > p.length)
    throw new Error('Invalid tx_out count (too big)');

  txOut = new Array(outCount);
  for (i = 0; i < outCount; i++) {
    tx = Parser.parseOutput(p.slice(off));

    if (!tx)
      return;

    txOut[i] = tx;
    tx._offset = off;
    off += tx._size;

    if (off + 4 > p.length)
      throw new Error('Invalid tx_out offset');
  }

  locktime = utils.readU32(p, off);
  off += 4;

  raw = p.length !== off ? p.slice(0, off) : p;

  if (block)
    raw = new Buffer(raw);

  return {
    version: version,
    inputs: txIn,
    outputs: txOut,
    locktime: locktime,
    _witnessSize: 0,
    _raw: raw,
    _size: off
  };
};

Parser.isWitnessTX = function isWitnessTX(p) {
  if (p.length < 12)
    return false;

  return p[4] === 0 && p[5] !== 0;
};

Parser.parseWitnessTX = function parseWitnessTX(p, block) {
  var off = 0;
  var inCount, txIn, tx;
  var outCount, txOut;
  var marker, flag;
  var version, locktime, i;
  var witnessSize = 0;
  var raw;

  if (p.length < 12)
    throw new Error('Invalid witness tx size');

  version = utils.readU32(p, off);
  off += 4;
  marker = utils.readU8(p, off);
  off += 1;
  flag = utils.readU8(p, off);
  off += 1;

  if (marker !== 0)
    throw new Error('Invalid witness tx (marker != 0)');

  if (flag === 0)
    throw new Error('Invalid witness tx (flag == 0)');

  inCount = utils.readIntv(p, off);
  off = inCount.off;
  inCount = inCount.r;

  if (inCount < 0)
    throw new Error('Invalid witness tx_in count (negative)');

  if (off + 41 * inCount + 5 > p.length)
    throw new Error('Invalid witness tx_in count (too big)');

  txIn = new Array(inCount);
  for (i = 0; i < inCount; i++) {
    tx = Parser.parseInput(p.slice(off));

    if (!tx)
      return;

    txIn[i] = tx;
    tx._offset = off;
    off += tx._size;

    if (off + 5 > p.length)
      throw new Error('Invalid witness tx_in offset');
  }

  outCount = utils.readIntv(p, off);
  off = outCount.off;
  outCount = outCount.r;
  if (outCount < 0)
    throw new Error('Invalid witness tx_out count (negative)');
  if (off + 9 * outCount + 4 > p.length)
    throw new Error('Invalid witness tx_out count (too big)');

  txOut = new Array(outCount);
  for (i = 0; i < outCount; i++) {
    tx = Parser.parseOutput(p.slice(off));

    if (!tx)
      return;

    txOut[i] = tx;
    tx._offset = off;
    off += tx._size;

    if (off + 4 > p.length)
      throw new Error('Invalid tx_out offset');
  }

  for (i = 0; i < inCount; i++) {
    tx = Parser.parseWitness(p.slice(off));

    if (!tx)
      return;

    txIn[i].witness = tx.witness;
    txIn[i]._witnessSize = tx._size;
    txIn[i]._witnessOffset = off;
    off += tx._size;
    witnessSize += tx._size;

    if (off + 4 > p.length)
      throw new Error('Invalid witness offset');
  }

  locktime = utils.readU32(p, off);
  off += 4;

  raw = p.length !== off ? p.slice(0, off) : p;

  if (block)
    raw = new Buffer(raw);

  return {
    version: version,
    marker: marker,
    flag: flag,
    inputs: txIn,
    outputs: txOut,
    locktime: locktime,
    _raw: raw,
    _size: off,
    _witnessSize: witnessSize + 2
  };
};

Parser.parseWitness = function parseWitness(p) {
  var witness = [];
  var off = 0;
  var chunkCount, chunkSize, item, i;

  chunkCount = utils.readIntv(p, off);
  off = chunkCount.off;
  chunkCount = chunkCount.r;

  for (i = 0; i < chunkCount; i++) {
    chunkSize = utils.readIntv(p, off);
    off = chunkSize.off;
    chunkSize = chunkSize.r;
    item = p.slice(off, off + chunkSize);
    off += chunkSize;
    witness.push(item);
    if (off > p.length)
      throw new Error('Invalid witness offset');
  }

  return {
    _size: off,
    witness: witness
  };
};

Parser.parseReject = function parseReject(p) {
  var messageLen, off, message, ccode, reasonLen, reason, data;

  if (p.length < 3)
    throw new Error('Invalid reject size');

  messageLen = utils.readIntv(p, 0);
  off = messageLen.off;
  messageLen = messageLen.r;

  if (off + messageLen + 2 > p.length)
    throw new Error('Invalid reject message');

  message = p.slice(off, off + messageLen).toString('ascii');
  off += messageLen;

  ccode = utils.readU8(p, off);
  off++;

  reasonLen = utils.readIntv(p, off);
  off = reasonLen.off;
  reasonLen = reasonLen.r;

  if (off + reasonLen > p.length)
    throw new Error('Invalid reject reason');

  reason = p.slice(off, off + reasonLen).toString('ascii');

  off += reasonLen;

  data = p.slice(off, off + 32);

  return {
    message: message,
    ccode: constants.rejectByVal[ccode] || ccode,
    reason: reason,
    data: data
  };
};

Parser.parseAddress = function parseAddress(p, off, full) {
  var ts, services, ip, port;

  if (!off)
    off = 0;

  if (full) {
    ts = utils.readU32(p, off);
    off += 4;
  } else {
    ts = 0;
  }

  services = utils.readU64(p, off);
  off += 8;

  ip = p.slice(off, off + 16);
  off += 16;

  port = utils.readU16BE(p, off);
  off += 2;

  try {
    services = services.toNumber();
  } catch (e) {
    services = 1;
  }

  return {
    ts: ts,
    services: services,
    network: (services & constants.services.network) !== 0,
    getutxo: (services & constants.services.getutxo) !== 0,
    bloom: (services & constants.services.bloom) !== 0,
    witness: (services & constants.services.witness) !== 0,
    ipv6: utils.array2ip(ip, 6),
    ipv4: utils.array2ip(ip, 4),
    port: port
  };
};

Parser.parseAddr = function parseAddr(p) {
  if (p.length < 31)
    throw new Error('Invalid addr size');

  var addrs = [];
  var i, off, count;

  count = utils.readIntv(p, 0);
  off = count.off;
  count = count.r;

  for (i = 0; i < count && off < p.length; i++) {
    addrs.push(Parser.parseAddress(p, off, true));
    off += 30;
  }

  return addrs;
};

Parser.parseMempool = function parseMempool(p) {
  if (p.length > 0)
    throw new Error('Invalid mempool size');

  return {};
};

/**
 * Expose
 */

module.exports = Parser;
