/**
 * block.js - block object for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * https://github.com/indutny/bcoin
 */

var bcoin = require('../bcoin');
var bn = require('bn.js');
var utils = bcoin.utils;
var assert = utils.assert;
var constants = bcoin.protocol.constants;
var network = bcoin.protocol.network;

/**
 * Block
 */

function Block(data) {
  var self = this;

  if (!(this instanceof Block))
    return new Block(data);

  bcoin.abstractblock.call(this, data);

  this.type = 'block';

  this._witnessSize = data._witnessSize || 0;

  this.txs = data.txs || [];

  this._cbHeight = null;

  this.txs = this.txs.map(function(data, i) {
    if (data instanceof bcoin.tx)
      return data;

    return bcoin.tx(data, self, i);
  });
}

utils.inherits(Block, bcoin.abstractblock);

Block.prototype.render = function render() {
  return this.getRaw();
};

Block.prototype.renderNormal = function renderNormal() {
  return bcoin.protocol.framer.block(this);
};

Block.prototype.renderWitness = function renderWitness() {
  return bcoin.protocol.framer.witnessBlock(this);
};

Block.prototype.getRaw = function getRaw() {
  var raw;

  if (this.hasWitness())
    raw = bcoin.protocol.framer.witnessBlock(this);
  else
    raw = bcoin.protocol.framer.block(this);

  this._size = raw.length;
  this._witnessSize = raw._witnessSize;

  return raw;
};

Block.prototype.getVirtualSize = function getVirtualSize() {
  var size, witnessSize, base;

  size = this.getSize();
  witnessSize = this.getWitnessSize();
  base = size - witnessSize;

  return (base * 4 + witnessSize + 3) / 4 | 0;
};

Block.prototype.getSize = function getSize() {
  if (this._size == null)
    this.getRaw();
  return this._size;
};

Block.prototype.getWitnessSize = function getWitnessSize() {
  if (this._witnessSize == null)
    this.getRaw();
  return this._witnessSize;
};

Block.prototype.hasWitness = function hasWitness() {
  for (var i = 0; i < this.txs.length; i++) {
    if (this.txs[i].hasWitness())
      return true;
  }
  return false;
};

Block.prototype.getSigops = function getSigops(scriptHash, accurate) {
  var total = 0;
  var i;

  for (i = 0; i < this.txs.length; i++)
    total += this.txs[i].getSigops(scriptHash, accurate);

  return total;
};

Block.prototype.getMerkleRoot = function getMerkleRoot() {
  var leaves = [];
  var i, root;

  for (i = 0; i < this.txs.length; i++)
    leaves.push(this.txs[i].hash());

  root = utils.getMerkleRoot(leaves);

  if (!root)
    return;

  return utils.toHex(root);
};

Block.prototype.getCommitmentHash = function getCommitmentHash() {
  var leaves = [];
  var i, witnessNonce, witnessRoot, commitmentHash;

  witnessNonce = this.txs[0].inputs[0].witness[0];

  if (!witnessNonce)
    return;

  for (i = 0; i < this.txs.length; i++)
    leaves.push(this.txs[i].witnessHash());

  witnessRoot = utils.getMerkleRoot(leaves);

  if (!witnessRoot)
    return;

  commitmentHash = utils.dsha256(Buffer.concat([witnessRoot, witnessNonce]));

  return utils.toHex(commitmentHash);
};

Block.prototype.__defineGetter__('commitmentHash', function() {
  var coinbase, i, commitment, commitmentHash;

  if (this._commitmentHash)
    return this._commitmentHash;

  coinbase = this.txs[0];

  for (i = 0; i < coinbase.outputs.length; i++) {
    commitment = coinbase.outputs[i].script;
    if (bcoin.script.isCommitment(commitment)) {
      commitmentHash = bcoin.script.getCommitmentHash(commitment);
      break;
    }
  }

  if (commitmentHash)
    this._commitmentHash = utils.toHex(commitmentHash);

  return this._commitmentHash;
});

Block.prototype._verify = function _verify() {
  var uniq = {};
  var i, tx, hash;

  if (!this.verifyHeaders())
    return false;

  // Size can't be bigger than MAX_BLOCK_SIZE
  if (this.txs.length > constants.block.maxSize
      || this.getVirtualSize() > constants.block.maxSize) {
    utils.debug('Block is too large: %s', this.rhash);
    return false;
  }

  // First TX must be a coinbase
  if (!this.txs.length || !this.txs[0].isCoinbase()) {
    utils.debug('Block has no coinbase: %s', this.rhash);
    return false;
  }

  // Test all txs
  for (i = 0; i < this.txs.length; i++) {
    tx = this.txs[i];

    // The rest of the txs must not be coinbases
    if (i > 0 && tx.isCoinbase()) {
      utils.debug('Block more than one coinbase: %s', this.rhash);
      return false;
    }

    // Check for duplicate txids
    hash = tx.hash('hex');
    if (uniq[hash]) {
      utils.debug('Block has duplicate txids: %s', this.rhash);
      return false;
    }
    uniq[hash] = true;
  }

  // Check merkle root
  if (this.getMerkleRoot() !== this.merkleRoot) {
    utils.debug('Block failed merkleroot test: %s', this.rhash);
    return false;
  }

  return true;
};

Block.prototype.getCoinbaseHeight = function getCoinbaseHeight() {
  var coinbase, s, height;

  if (this.version < 2)
    return -1;

  if (this._cbHeight != null)
    return this._cbHeight;

  coinbase = this.txs[0];

  if (!coinbase || coinbase.inputs.length === 0)
    return -1;

  s = coinbase.inputs[0].script;

  if (Buffer.isBuffer(s[0]))
    height = bcoin.script.num(s[0], true);
  else
    height = -1;

  this._cbHeight = height;

  return height;
};

Block.reward = function reward(height) {
  var halvings = height / network.halvingInterval | 0;
  var reward;

  if (height < 0)
    return new bn(0);

  if (halvings >= 64)
    return new bn(0);

  reward = new bn(5000000000);
  reward.iushrn(halvings);

  return reward;
};

Block.prototype.inspect = function inspect() {
  return {
    type: this.type,
    height: this.height,
    hash: utils.revHex(this.hash('hex')),
    reward: utils.btc(this.getReward()),
    fee: utils.btc(this.getFee()),
    date: new Date(this.ts * 1000).toISOString(),
    version: this.version,
    prevBlock: utils.revHex(this.prevBlock),
    merkleRoot: utils.revHex(this.merkleRoot),
    commitmentHash: this.commitmentHash
      ? utils.revHex(this.commitmentHash)
      : null,
    ts: this.ts,
    bits: this.bits,
    nonce: this.nonce,
    totalTX: this.totalTX,
    txs: this.txs
  };
};

Block.prototype.toJSON = function toJSON() {
  return {
    type: 'block',
    height: this.height,
    hash: utils.revHex(this.hash('hex')),
    version: this.version,
    prevBlock: utils.revHex(this.prevBlock),
    merkleRoot: utils.revHex(this.merkleRoot),
    ts: this.ts,
    bits: this.bits,
    nonce: this.nonce,
    totalTX: this.totalTX,
    txs: this.txs.map(function(tx) {
      return tx.toJSON();
    })
  };
};

Block._fromJSON = function _fromJSON(json) {
  assert.equal(json.type, 'block');
  json.prevBlock = utils.revHex(json.prevBlock);
  json.merkleRoot = utils.revHex(json.merkleRoot);
  json.txs = json.txs.map(function(tx) {
    return bcoin.tx._fromJSON(tx);
  });
  return json;
};

Block.fromJSON = function fromJSON(json) {
  return new Block(Block._fromJSON(json));
};

Block.prototype.toRaw = function toRaw(enc) {
  var data = this.render();

  if (enc === 'hex')
    data = utils.toHex(data);

  return data;
};

Block._fromRaw = function _fromRaw(data, enc, type) {
  if (enc === 'hex')
    data = new Buffer(data, 'hex');

  if (type === 'merkleblock')
    return bcoin.merkleblock._fromRaw(data);

  if (type === 'headers')
    return bcoin.headers._fromRaw(data);

  return bcoin.protocol.parser.parseBlock(data);
};

Block.fromRaw = function fromRaw(data, enc, type) {
  if (type === 'merkleblock')
    return bcoin.merkleblock.fromRaw(data);

  if (type === 'headers')
    return bcoin.headers.fromRaw(data);

  return new Block(Block._fromRaw(data, enc));
};

Block.prototype.toCompact = function toCompact() {
  var block = this.abbr();
  var height = this.height;
  var off = 0;
  var buf;

  buf = new Buffer(
    block.length + 4
    + utils.sizeIntv(this.txs.length)
    + this.txs.length * 32);

  if (height === -1)
    height = 0x7fffffff;

  off += utils.copy(block, buf, off);
  off += utils.writeU32(buf, height, off);

  off += utils.writeIntv(buf, this.txs.length, off);
  this.txs.forEach(function(tx) {
    off += utils.copy(tx.hash(), buf, off);
  });

  return buf;
};

Block.fromCompact = function fromCompact(buf) {
  var tx, txCount, i;
  var off = 0;
  var hashes = [];

  var version = utils.read32(buf, 0);
  var prevBlock = buf.slice(4, 36);
  var merkleRoot = buf.slice(36, 68);
  var ts = utils.readU32(buf, 68);
  var bits = utils.readU32(buf, 72);
  var nonce = utils.readU32(buf, 76);
  var height = utils.readU32(buf, 80);
  var txCount = utils.readIntv(buf, 84);
  off = txCount.off;
  txCount = txCount.r;

  for (i = 0; i < txCount; i++) {
    if (off + 32 > buf.length)
      throw new Error('Bad TX count.');
    hashes.push(utils.toHex(buf.slice(off, off + 32)));
    off += 32;
  }

  if (height === 0x7fffffff)
    height = -1;

  return {
    version: version,
    prevBlock: utils.toHex(prevBlock),
    merkleRoot: utils.toHex(merkleRoot),
    ts: ts,
    bits: bits,
    nonce: nonce,
    height: height,
    totalTX: txCount,
    hashes: hashes
  };
};

/**
 * Expose
 */

module.exports = Block;
