const crypto = require('crypto');
const Sdk = require('./index.js');

const client = new Sdk.Client({
    crypto,
    // baseUrl: 'lattice-3f60.local',
    baseUrl: 'https://signing.staging-gridpl.us',
    name: 'SdkTester',
})


client.connect('40a36bc23f0a', (res) => {
    console.log('Did I connect?', res);
})