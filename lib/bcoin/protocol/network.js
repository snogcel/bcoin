/**
 * network.js - bitcoin networks for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * https://github.com/indutny/bcoin
 */

var bcoin = require('../../bcoin');
var bn = require('bn.js');
var utils = bcoin.utils;
var assert = utils.assert;

/**
 * Network
 */

var network = exports;
var main, testnet, dashmain, regtest, segnet;

network.set = function set(type) {
  var net = network[type];
  utils.merge(network, net);
};

network.types = ['main', 'testnet', 'dashmain', 'regtest', 'segnet'];

/**
 * Main
 */

main = network.main = {};

main.prefixes = {
  privkey: 128,
  xpubkey: 0x0488b21e,
  xprivkey: 0x0488ade4
};

main.address = {
  prefixes: {
    pubkeyhash: 0,
    scripthash: 5,
    witnesspubkeyhash: 6,
    witnessscripthash: 10
  },
  versions: {
    witnesspubkeyhash: 0,
    witnessscripthash: 0
  }
};

main.address.prefixesByVal = Object.keys(main.address.prefixes).reduce(function(out, name) {
  out[main.address.prefixes[name]] = name;
  return out;
}, {});

main.address.versionsByVal = Object.keys(main.address.versions).reduce(function(out, name) {
  out[main.address.versions[name]] = name;
  return out;
}, {});

main.type = 'main';

main.seeds = [
  'seed.bitcoin.sipa.be', // Pieter Wuille
  'dnsseed.bluematt.me', // Matt Corallo
  'dnsseed.bitcoin.dashjr.org', // Luke Dashjr
  'seed.bitcoinstats.com', // Christian Decker
  'bitseed.xf2.org', // Jeff Garzik
  'seed.bitcoin.jonasschnelli.ch' // Jonas Schnelli
];

main.port = 8333;

main.alertKey = new Buffer(''
    + '04fc9702847840aaf195de8442ebecedf5b095c'
    + 'dbb9bc716bda9110971b28a49e0ead8564ff0db'
    + '22209e0374782c093bb899692d524e9d6a6956e'
    + '7c5ecbcd68284',
    'hex');

main.checkpoints = [
  { height: 11111,  hash: '0000000069e244f73d78e8fd29ba2fd2ed618bd6fa2ee92559f542fdb26e7c1d' },
  { height: 33333,  hash: '000000002dd5588a74784eaa7ab0507a18ad16a236e7b1ce69f00d7ddfb5d0a6' },
  { height: 74000,  hash: '0000000000573993a3c9e41ce34471c079dcf5f52a0e824a81e7f953b8661a20' },
  { height: 105000, hash: '00000000000291ce28027faea320c8d2b054b2e0fe44a773f3eefb151d6bdc97' },
  { height: 134444, hash: '00000000000005b12ffd4cd315cd34ffd4a594f430ac814c91184a0d42d2b0fe' },
  { height: 168000, hash: '000000000000099e61ea72015e79632f216fe6cb33d7899acb35b75c8303b763' },
  { height: 193000, hash: '000000000000059f452a5f7340de6682a977387c17010ff6e6c3bd83ca8b1317' },
  { height: 210000, hash: '000000000000048b95347e83192f69cf0366076336c639f9b7228e9ba171342e' },
  { height: 216116, hash: '00000000000001b4f4b433e81ee46494af945cf96014816a4e2370f11b23df4e' },
  { height: 225430, hash: '00000000000001c108384350f74090433e7fcf79a606b8e797f065b130575932' },
  { height: 250000, hash: '000000000000003887df1f29024b06fc2200b55f8af8f35453d7be294df2d214' },
  { height: 279000, hash: '0000000000000001ae8c72a0b0c301f67e3afca10e819efa9041e458e9bd7e40' },
  { height: 295000, hash: '00000000000000004d9b4ef50f0f9d686fd69db2e03af35a100370c64632a983' }
];

main.checkpoints = main.checkpoints.reduce(function(out, block) {
  out[block.height] = utils.revHex(block.hash);
  return block;
}, {});

main.checkpoints.tsLastCheckpoint = 1397080064;
main.checkpoints.txsLastCheckpoint = 36544669;
main.checkpoints.txsPerDay = 60000.0;
main.checkpoints.lastHeight = 295000;

main.halvingInterval = 210000;

// http://blockexplorer.com/b/0
// http://blockexplorer.com/rawblock/000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
main.genesis = {
  version: 1,
  hash: utils.revHex(
      '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'
  ),
  prevBlock: utils.toHex(
      [ 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0 ]),
  merkleRoot: utils.revHex(
      '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
  ),
  ts: 1231006505,
  bits: 0x1d00ffff,
  nonce: 2083236893
};

main.magic = 0xd9b4bef9;

main.powLimit = new bn(
    '00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'hex'
);
main.powTargetTimespan = 14 * 24 * 60 * 60; // two weeks
main.powTargetSpacing = 10 * 60;
main.powDiffInterval = main.powTargetTimespan / main.powTargetSpacing | 0;
main.powAllowMinDifficultyBlocks = false;
main.powNoRetargeting = false;

main.block = {
  majorityEnforceUpgrade: 750,
  majorityRejectOutdated: 950,
  majorityWindow: 1000,
  bip34height: 227931
};

main.segwitHeight = 2000000000;

main.genesisBlock = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';

/**
 * Testnet (v3)
 * https://en.bitcoin.it/wiki/Testnet
 */

testnet = network.testnet = {};

testnet.type = 'testnet';

testnet.prefixes = {
  privkey: 239,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394
};

testnet.address = {
  prefixes: {
    pubkeyhash: 111,
    scripthash: 196,
    witnesspubkeyhash: 3,
    witnessscripthash: 40
  },
  versions: {
    witnesspubkeyhash: 0,
    witnessscripthash: 0
  }
};

testnet.address.prefixesByVal = Object.keys(testnet.address.prefixes).reduce(function(out, name) {
  out[testnet.address.prefixes[name]] = name;
  return out;
}, {});

testnet.address.versionsByVal = Object.keys(testnet.address.versions).reduce(function(out, name) {
  out[testnet.address.versions[name]] = name;
  return out;
}, {});

testnet.seeds = [
  'testnet-seed.alexykot.me',
  'testnet-seed.bitcoin.petertodd.org',
  'testnet-seed.bluematt.me',
  'testnet-seed.bitcoin.schildbach.de'
];

testnet.port = 18333;

testnet.alertKey = new Buffer(''
    + '04302390343f91cc401d56d68b123028bf52e5f'
    + 'ca1939df127f63c6467cdf9c8e2c14b61104cf8'
    + '17d0b780da337893ecc4aaff1309e536162dabb'
    + 'db45200ca2b0a',
    'hex');

testnet.checkpoints = [
  { height: 546, hash: '000000002a936ca763904c3c35fce2f3556c559c0214345d31b1bcebf76acb70' }
];

testnet.checkpoints = testnet.checkpoints.reduce(function(out, block) {
  out[block.height] = utils.revHex(block.hash);
  return block;
}, {});

testnet.checkpoints.tsLastCheckpoint = 1338180505;
testnet.checkpoints.txsLastCheckpoint = 16341;
testnet.checkpoints.txsPerDay = 300;
testnet.checkpoints.lastHeight = 546;

testnet.halvingInterval = 210000;

// http://blockexplorer.com/testnet/b/0
// http://blockexplorer.com/testnet/rawblock/000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943
testnet.genesis =  {
  version: 1,
  hash: utils.revHex(
      '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943'
  ),
  prevBlock: utils.toHex(
      [ 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0 ]),
  merkleRoot: utils.revHex(
      '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
  ),
  ts: 1296688602,
  bits: 0x1d00ffff,
  nonce: 414098458
};

testnet.magic = 0x0709110b;

testnet.powLimit = new bn(
    '00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'hex'
);
testnet.powTargetTimespan = 14 * 24 * 60 * 60; // two weeks
testnet.powTargetSpacing = 10 * 60;
testnet.powDiffInterval = testnet.powTargetTimespan / testnet.powTargetSpacing | 0;
testnet.powAllowMinDifficultyBlocks = true;
testnet.powNoRetargeting = false;

testnet.block = {
  majorityEnforceUpgrade: 51,
  majorityRejectOutdated: 75,
  majorityWindow: 100,
  bip34height: 21111
};

testnet.segwitHeight = 2000000000;

testnet.genesisBlock = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4adae5494dffff001d1aa4ae180101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';

/**
 * Dash Mainnet
 */

dashmain = network.dashmain = {};

dashmain.prefixes = {
  privkey: 204,
  xpubkey: 0x02fe52f8,
  xprivkey: 0x02fe52cc
};

dashmain.address = {
  prefixes: {
    pubkeyhash: 76,
    scripthash: 16,
    witnesspubkeyhash: 6, //not changed
    witnessscripthash: 10 //not changed
  },
  versions: {
    witnesspubkeyhash: 0, //notchanged
    witnessscripthash: 0 //notchanged
  }
};

dashmain.address.prefixesByVal = Object.keys(dashmain.address.prefixes).reduce(function(out, name) {
  out[dashmain.address.prefixes[name]] = name;
  return out;
}, {});

dashmain.address.versionsByVal = Object.keys(dashmain.address.versions).reduce(function(out, name) {
  out[dashmain.address.versions[name]] = name;
  return out;
}, {});

dashmain.type = 'dashmain';

dashmain.seeds = [
  'localhost'
  //'dnsseed.darkcoin.io',
  //'dnsseed.darkcoin.qa',
  //'dnsseed.masternode.io',
  //'dnsseed.dashpay.io'
];

dashmain.port = 9999;

dashmain.alertKey = new Buffer(''
    + '048240a8748a80a286b270ba126705ced4f2ce5'
    + 'a7847b3610ea3c06513150dade2a8512ed5ea86'
    + '320824683fc0818f0ac019214973e677acd1244'
    + 'f6d0571fc5103',
    'hex');

dashmain.checkpoints = [
  { height: 1500,  hash: '000000aaf0300f59f49bc3e970bad15c11f961fe2347accffff19d96ec9778e3' },
  { height: 4991,  hash: '000000003b01809551952460744d5dbb8fcbd6cbae3c220267bf7fa43f837367' },
  { height: 9918,  hash: '00000000213e229f332c0ffbe34defdaa9e74de87f2d8d1f01af8d121c3c170b' },
  { height: 16912, hash: '00000000075c0d10371d55a60634da70f197548dbbfa4123e12abfcbc5738af9' },
  { height: 23912, hash: '0000000000335eac6703f3b1732ec8b2f89c3ba3a7889e5767b090556bb9a276' },
  { height: 35457, hash: '0000000000b0ae211be59b048df14820475ad0dd53b9ff83b010f71a77342d9f' },
  { height: 45479, hash: '000000000063d411655d590590e16960f15ceea4257122ac430c6fbe39fbf02d' },
  { height: 55895, hash: '0000000000ae4c53a43639a4ca027282f69da9c67ba951768a20415b6439a2d7' },
  { height: 68899, hash: '0000000000194ab4d3d9eeb1f2f792f21bb39ff767cb547fe977640f969d77b7' },
  { height: 74619, hash: '000000000011d28f38f05d01650a502cc3f4d0e793fbc26e2a2ca71f07dc3842' },
  { height: 75095, hash: '0000000000193d12f6ad352a9996ee58ef8bdc4946818a5fec5ce99c11b87f0d' },
  { height: 88805, hash: '00000000001392f1652e9bf45cd8bc79dc60fe935277cd11538565b4a94fa85f' },
  { height: 107996, hash: '00000000000a23840ac16115407488267aa3da2b9bc843e301185b7d17e4dc40' },
  { height: 137993, hash: '00000000000cf69ce152b1bffdeddc59188d7a80879210d6e5c9503011929c3c' },
  { height: 167996, hash: '000000000009486020a80f7f2cc065342b0c2fb59af5e090cd813dba68ab0fed' },
  { height: 207992, hash: '00000000000d85c22be098f74576ef00b7aa00c05777e966aff68a270f1e01a5' },
  { height: 312645, hash: '0000000000059dcb71ad35a9e40526c44e7aae6c99169a9e7017b7d84b1c2daf' },
  { height: 407452, hash: '000000000003c6a87e73623b9d70af7cd908ae22fee466063e4ffc20be1d2dbc' }
];

dashmain.checkpoints = dashmain.checkpoints.reduce(function(out, block) {
  out[block.height] = utils.revHex(block.hash);
  return block;
}, {});

dashmain.checkpoints.tsLastCheckpoint = 1423563332;
dashmain.checkpoints.txsLastCheckpoint = 853742;
dashmain.checkpoints.txsPerDay = 2800.0;
dashmain.checkpoints.lastHeight = 407452;

dashmain.halvingInterval = 210240;

// http://blockexplorer.com/b/0
// http://blockexplorer.com/rawblock/000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
dashmain.genesis = {
  version: 1,
  hash: utils.revHex(
      '0x00000ffd590b1485b3caadc19b22e6379c733355108f107a430458cdf3407ab6'
  ),
  prevBlock: utils.toHex(
      [ 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0 ]),
  merkleRoot: utils.revHex(
      'e0028eb9648db56b1ac77cf090b99048a8007e2bb64b68f092c03c7f56a662c7'
  ),
  ts: 1390095618,
  bits: 0x1e0ffff0,
  nonce: 28917698
};

dashmain.magic = 0xbd6b0cbf;

dashmain.powLimit = new bn(
    '00000fffff000000000000000000000000000000000000000000000000000000',
    'hex'
);
dashmain.powTargetTimespan = 24 * 60 * 60; // 1 day
dashmain.powTargetSpacing = 2.5 * 60;
dashmain.powDiffInterval = main.powTargetTimespan / main.powTargetSpacing | 0;
dashmain.powAllowMinDifficultyBlocks = false;
dashmain.powNoRetargeting = false;

dashmain.block = {
  majorityEnforceUpgrade: 750,
  majorityRejectOutdated: 950,
  majorityWindow: 1000,
  bip34height: 227931
};

dashmain.segwitHeight = 2000000000;

dashmain.genesisBlock = '010000000000000000000000000000000000000000000000000000000000000000000000c762a6567f3cc092f0684bb62b7e00a84890b990f07cc71a6bb58d64b98e02e0022ddb52f0ff0f1ec23fb9010101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff6204ffff001d01044c5957697265642030392f4a616e2f3230313420546865204772616e64204578706572696d656e7420476f6573204c6976653a204f76657273746f636b2e636f6d204973204e6f7720416363657074696e6720426974636f696e73ffffffff0100f2052a010000004341040184710fa689ad5023690c80f3a49c8f13f8d45b8c857fbcbc8bc4a8e4d3eb4b10f4d4604fa08dce601aaf0f470216fe1b51850b4acf21b179c45070ac7b03a9ac00000000';


/**
 * Regtest
 */

regtest = network.regtest = {};

regtest.type = 'testnet';

regtest.prefixes = {
  privkey: 239,
  xpubkey: 0x043587cf,
  xprivkey: 0x04358394
};

regtest.address = {
  prefixes: {
    pubkeyhash: 111,
    scripthash: 196,
    witnesspubkeyhash: 3,
    witnessscripthash: 40
  },
  versions: {
    witnesspubkeyhash: 0,
    witnessscripthash: 0
  }
};

regtest.address.prefixesByVal = Object.keys(regtest.address.prefixes).reduce(function(out, name) {
  out[regtest.address.prefixes[name]] = name;
  return out;
}, {});

regtest.address.versionsByVal = Object.keys(regtest.address.versions).reduce(function(out, name) {
  out[regtest.address.versions[name]] = name;
  return out;
}, {});

regtest.seeds = [
  '127.0.0.1'
];

regtest.port = 18444;

// regtest._alertKey = bcoin.ec.generate();
// regtest.alertKey = regtest._alertKey.getPublic(true, 'array');

regtest.checkpoints = {};
regtest.checkpoints.tsLastCheckpoint = 0;
regtest.checkpoints.txsLastCheckpoint = 0;
regtest.checkpoints.txsPerDay = 300;
regtest.checkpoints.lastHeight = 0;

regtest.halvingInterval = 150;

regtest.genesis =  {
  version: 1,
  hash: utils.revHex(
      '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206'
  ),
  prevBlock: utils.toHex(
      [ 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0 ]),
  merkleRoot: utils.revHex(
      '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
  ),
  ts: 1296688602,
  bits: 0x207fffff,
  nonce: 2
};

regtest.magic = 0xdab5bffa;

regtest.powLimit = new bn(
    '7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'hex'
);
regtest.powTargetTimespan = 14 * 24 * 60 * 60; // two weeks
regtest.powTargetSpacing = 10 * 60;
regtest.powDiffInterval = regtest.powTargetTimespan / regtest.powTargetSpacing | 0;
regtest.powAllowMinDifficultyBlocks = true;
regtest.powNoRetargeting = true;

regtest.block = {
  majorityEnforceUpgrade: 750,
  majorityRejectOutdated: 950,
  majorityWindow: 1000,
  bip34height: -1
};

regtest.segwitHeight = 0;

regtest.genesisBlock = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4adae5494dffff7f20020000000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';

/**
 * Segnet
 */

segnet = network.segnet = {};

segnet.type = 'segnet';

segnet.prefixes = {
  privkey: 158,
  xpubkey: 0x053587cf,
  xprivkey: 0x05358394
};

segnet.address = {
  prefixes: {
    pubkeyhash: 30,
    scripthash: 50,
    witnesspubkeyhash: 3,
    witnessscripthash: 40
  },
  versions: {
    witnesspubkeyhash: 0,
    witnessscripthash: 0
  }
};

segnet.address.prefixesByVal = Object.keys(segnet.address.prefixes).reduce(function(out, name) {
  out[segnet.address.prefixes[name]] = name;
  return out;
}, {});

segnet.address.versionsByVal = Object.keys(segnet.address.versions).reduce(function(out, name) {
  out[segnet.address.versions[name]] = name;
  return out;
}, {});

segnet.seeds = [
  '104.243.38.34',
  '104.155.1.158',
  '119.246.245.241',
  '46.101.235.82'
];

segnet.port = 28333;

segnet.alertKey = new Buffer(''
    + '04302390343f91cc401d56d68b123028bf52e5f'
    + 'ca1939df127f63c6467cdf9c8e2c14b61104cf8'
    + '17d0b780da337893ecc4aaff1309e536162dabb'
    + 'db45200ca2b0a',
    'hex');

segnet.checkpoints = [];

segnet.checkpoints = segnet.checkpoints.reduce(function(out, block) {
  out[block.height] = utils.revHex(block.hash);
  return block;
}, {});

segnet.checkpoints.tsLastCheckpoint = 0;
segnet.checkpoints.txsLastCheckpoint = 0;
segnet.checkpoints.txsPerDay = 300;
segnet.checkpoints.lastHeight = 0;

segnet.halvingInterval = 210000;

segnet.genesis = {
  version: 1,
  hash: utils.revHex(
      '0d5b9c518ddf053fcac71730830df4526a9949c08f34acf6a1d30464d22f02aa'
  ),
  prevBlock: utils.toHex(
      [ 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0 ]),
  merkleRoot: utils.revHex(
      '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'
  ),
  ts: 1452831101,
  bits: 0x1d00ffff,
  nonce: 0
};

segnet.magic = 0xcaea962e;

segnet.powLimit = new bn(
    '00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'hex'
);
segnet.powTargetTimespan = 14 * 24 * 60 * 60; // two weeks
segnet.powTargetSpacing = 10 * 60;
segnet.powDiffInterval = segnet.powTargetTimespan / segnet.powTargetSpacing | 0;
segnet.powAllowMinDifficultyBlocks = true;
segnet.powNoRetargeting = false;

segnet.block = {
  majorityEnforceUpgrade: 7,
  majorityRejectOutdated: 9,
  majorityWindow: 10,
  bip34height: -1
};

segnet.segwitHeight = 0;

segnet.genesisBlock = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a7d719856ffff001d000000000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';

network.xprivkeys = {
  '76066276': 'main',
  '70615956': 'testnet',
  '50221772': 'dashmain',
  '87393172': 'segnet',
  xprv: 'main',
  tprv: 'testnet',
  dprv: 'dashmain',
  '2791': 'segnet'
};

network.xpubkeys = {
  '76067358': 'main',
  '70617039': 'testnet',
  '50221816': 'dashmain',
  '87394255': 'segnet',
  xpub: 'main',
  tpub: 'testnet',
  dpub: 'dashmain',
  '2793': 'segnet'
};
