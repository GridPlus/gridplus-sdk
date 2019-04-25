const crypto = require('crypto');
const Sdk = require('./index.js');

const client = new Sdk.Client({
    crypto,
    // baseUrl: 'lattice-3f60.local',
    baseUrl: 'https://signing.staging-gridpl.us',
    name: 'SdkTester',
})


const util = require('./src/util.js');
// const parsed = util.parseLattice1Response('0100bc4956e4000180241d20f8');

console.log('Connecting')
client.connect('40a36bc23f0a', (res) => {
    console.log('Did I connect?', res);
})