const crypto = require('crypto');
const Sdk = require('./index.js');
const readline = require('readline');

const client = new Sdk.Client({
    crypto,
    // baseUrl: 'lattice-3f60.local',
    baseUrl: 'https://signing.staging-gridpl.us',
    name: 'SdkTester',
})

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});


client.connect('40a36bc23f0a', (err) => { 
    if (err) throw new Error(err);
    console.log('Connected!');
    rl.question('Please enter the pairing secret: ', (secret) => {
        rl.close();
        client.pair(secret, (err) => { 
            if (err) throw new Error(err);
            console.log('Paired!');
        })
    })
});