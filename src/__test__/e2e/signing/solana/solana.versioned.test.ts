import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { question } from 'readline-sync';
import {
  Constants,
  fetchSolanaAddresses,
  pair,
  sign,
  signSolanaTx,
} from '../../../..';
import { setupClient } from '../../../utils/setup';

const SOLANA_RPC = new Connection('https://api.devnet.solana.com', 'confirmed');

const fetchSigningWallet = async () => {
  const addresses = await fetchSolanaAddresses({ n: 1 });
  const solanaAddr = addresses[0];
  const pubkey = new PublicKey(solanaAddr);
  expect(PublicKey.isOnCurve(pubkey)).toBeTruthy();
  return pubkey;
};

const requestAirdrop = async (wallet: PublicKey, lamports: number) => {
  try {
    await SOLANA_RPC.requestAirdrop(wallet, lamports * LAMPORTS_PER_SOL);
    await new Promise((resolve) => setTimeout(resolve, 20000));
  } catch (error) {
    /**
     *  The faucet is flakey, so you might need to request funds manually from the faucet at https://faucet.solana.com/
     *  Also, for Solana to work, your address must have interacted with the network previously.
     */
    console.log(error);
  }
};

describe('solana.versioned', () => {
  let SIGNER_WALLET: PublicKey;
  let DESTINATION_WALLET_1: Keypair;
  let DESTINATION_WALLET_2: Keypair;
  let latestBlockhash: { blockhash: string; lastValidBlockHeight: number };

  test('setup', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
    SIGNER_WALLET = await fetchSigningWallet();
    DESTINATION_WALLET_1 = Keypair.generate();
    DESTINATION_WALLET_2 = Keypair.generate();
    latestBlockhash = await SOLANA_RPC.getLatestBlockhash('confirmed');
  });

  test('sign solana', async () => {
    SIGNER_WALLET = await fetchSigningWallet();
    const txInstructions: TransactionInstruction[] = [
      SystemProgram.transfer({
        fromPubkey: SIGNER_WALLET,
        toPubkey: DESTINATION_WALLET_1.publicKey,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      }),
    ];
    const messageV0 = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('sign solana multiple instructions', async () => {
    const txInstructions = [
      SystemProgram.transfer({
        fromPubkey: SIGNER_WALLET,
        toPubkey: DESTINATION_WALLET_1.publicKey,
        lamports: 0.005 * LAMPORTS_PER_SOL,
      }),
      SystemProgram.transfer({
        fromPubkey: SIGNER_WALLET,
        toPubkey: DESTINATION_WALLET_2.publicKey,
        lamports: 0.005 * LAMPORTS_PER_SOL,
      }),
    ];
    const message = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions,
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('sign solana zero lamport transfer', async () => {
    const txInstruction = SystemProgram.transfer({
      fromPubkey: SIGNER_WALLET,
      toPubkey: DESTINATION_WALLET_1.publicKey,
      lamports: 0,
    });
    const message = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [txInstruction],
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(message.serialize()));
    expect(signedTx).toBeTruthy();
  });

  test('simulate versioned solana transaction', async () => {
    await requestAirdrop(SIGNER_WALLET, 1);

    const txInstruction = SystemProgram.transfer({
      fromPubkey: SIGNER_WALLET,
      toPubkey: DESTINATION_WALLET_1.publicKey,
      lamports: 0.01 * LAMPORTS_PER_SOL,
    });

    const transaction = new Transaction();
    transaction.add(txInstruction);
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = SIGNER_WALLET;

    // Serialize the transaction to get the wire format
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    });

    // Create a VersionedTransaction from the serialized data
    const versionedTransaction = VersionedTransaction.deserialize(
      serializedTransaction,
    );

    // Simulate the versioned transaction
    const simulatedResult = await SOLANA_RPC.simulateTransaction(
      versionedTransaction,
      { commitment: 'confirmed' },
    );
    // Expects real value to be in the wallet
    expect(simulatedResult.value.err).toBeNull();

    const signedTx = await signSolanaTx(
      Buffer.from(versionedTransaction.serialize()),
    );
    expect(signedTx).toBeTruthy();
  });

  test('simulate versioned solana transaction with multiple instructions', async () => {
    const payer = Keypair.generate();
    await requestAirdrop(payer.publicKey, 1);

    const [transactionInstruction, pubkey] =
      await AddressLookupTableProgram.createLookupTable({
        payer: payer.publicKey,
        authority: payer.publicKey,
        recentSlot: await SOLANA_RPC.getSlot(),
      });

    await AddressLookupTableProgram.extendLookupTable({
      payer: payer.publicKey,
      authority: payer.publicKey,
      lookupTable: pubkey,
      addresses: [
        DESTINATION_WALLET_1.publicKey,
        DESTINATION_WALLET_2.publicKey,
      ],
    });

    const messageV0 = new TransactionMessage({
      payerKey: SIGNER_WALLET,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [transactionInstruction],
    }).compileToV0Message();

    const signedTx = await signSolanaTx(Buffer.from(messageV0.serialize()));

    expect(signedTx).toBeDefined();
  });

  const nuFiTests = [
    {
      name: 'sign tx',
      payload:
        '800100131b7154e1c10d16949038dd040363bca1f9d6501c694f6e0325ad817166fb2e91ee0c503f9578fb1f7621e5a0c2c384547f22cd4116be06e523219f332b61d41644801401dbe3c1c1f14a4eca5605ce5071e3301e79a79d95ecc50c73b977286be44ffdb307c4cce0aa81999d925e13f482e6deb72c8cc1d31ebf6b95478bd11f4f0cd8b42c34cd1d82beaec835fd525d1e90c248cf6849b277e78015a46e48789107a241e063d943cba135e306d4f8059f2ecf7a69744b993531a9d767674c85c7f6d2eabe47377602308731d0ac6ee6483c3a0f34b6aff13d37e53e00719032e928a52bdc5c44449874879e44c88ed5eb62b77a2b5e672ab9f50010479abc43e10306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a4000000006b5efb175d780346c18fa61f588190e5981c4668d651d67ad73c36e31180fdf9aca3abb5a18a0fe31a5031e7765dc6264a19fa84b3925e256dc2b4e53974b3c06b43c95041249ed7dedfc195aec0bc3ff2760a53409c79a7607b29fa3a12ad61393a26044ecc1adf84705420dd79ceeeca7be0dc63cd55a3994d9aba59b0e4303da8d1d21a468a26ba2183fd61de731ca4d5d61fd81296f97d916d81fd074ba18a633ac3c601aff49b0ffb943b9cdc1d89793f880bd8765868fd1ab42aa3b670286c0be1afb0442e17ee761789fe71c6e6914dd5771f7993092c9ca8bb05f3ae77546322de214d7944e9846236fe15e4f47731268ee9d6f60dcd058c96ea60a930890e9e6be0f4b35f0bf2f4c373f074ecc0404d221729981f11bb0dd5586fa55ac0b630d53e1fbf40c31f6163a1fed819daad6c34ec6eebbd2c9094ab8f0868ad7baf66ee465a9f41bc1fb7e3f72b663d4bfd34fe585e91fbd1f2753437cbad2569d176621a5d281ef6683261d8cc0da378f1139f1c01996edda54eb109ac4348ea0872c378762af7b1423c9c5b5ad1dd48584fcdbdb10e4922e01573228b8cd362cd18826752b72a9bf8c3d1fd7e3faeec4d44bd0f8988a902511c22b6ab46ba8557b567c6cbcd3e23efe17a9df8269dddf11d65a8f703314b84688b0bb9954004e7014187f35fb8aa37fc7e7cfe9c21e1e3def76baa18ab0668b61cf8bb66c55c082dfa8853bec08eeb7402096300a48b0b7259205ca703a1eaa032a21f6dcf2b4502abaead6d2b5495f0ea97222e2cd76aefb60c8d59d435e7a51cab236333b989b9593098437cfe28786fd22445b730c237a17d1110c8fef327d5f058e0308000502882502000800090333000000000000000922010a021b1c1d1e09030000040909040b0506070c0d0e0f101112131415161718191a7166063d1201daebea164609000000000016460900b9b0b7828d68598fa5ddf8fd4e8ba1315b7afae1785fb6ce5632d8699dd56fb15e4372ff949cf950d5dd678d5622184bc37b32d3a396f9d41ab609e65b1496b3040000000017262704000000010000008a02585c0a0000000000016400017b6eea3282722d20e3d0b0ce1eef6cf588aa519c82103084255fc33deb476d72000416170015',
    },
    {
      name: 'sign msg',
      payload:
        '6d616769636564656e2e696f2077616e747320796f7520746f207369676e20696e207769746820796f757220536f6c616e61206163636f756e743a0a386451393746414e6368337a75346348426942793556365a716478555365547858465873624b62436e6451710a0a57656c636f6d6520746f204d61676963204564656e2e205369676e696e6720697320746865206f6e6c79207761792077652063616e207472756c79206b6e6f77207468617420796f752061726520746865206f776e6572206f66207468652077616c6c657420796f752061726520636f6e6e656374696e672e205369676e696e67206973206120736166652c206761732d6c657373207472616e73616374696f6e207468617420646f6573206e6f7420696e20616e79207761792067697665204d61676963204564656e207065726d697373696f6e20746f20706572666f726d20616e79207472616e73616374696f6e73207769746820796f75722077616c6c65742e0a0a5552493a2068747470733a2f2f6d616769636564656e2e696f2f706f70756c61722d636f6c6c656374696f6e730a56657273696f6e3a20310a436861696e2049443a206d61696e6e65740a4e6f6e63653a2038373066313166646234373734353962393433353730316463366532353035350a4973737565642041743a20323032342d30372d30325431353a32383a34382e3736305a0a526571756573742049443a2063313331346235622d656365382d346234662d613837392d333839346464613336346534',
    },
    {
      name: 'orca',
      payload:
        '800200090d7154e1c10d16949038dd040363bca1f9d6501c694f6e0325ad817166fb2e91ee36b68d3e804ff4fecc56f17c75bd5310f9884f214ecdf7bf34a2e69f604aea1d1dbb12310704ea541ff67fe19834e0f79f567e442b73e1bdc6ebdff990b6a092f6e3af5408f1ba3db3821ce41f1fc47ac9a295f098f90f370222ba96748005c700000000000000000000000000000000000000000000000000000000000000000306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a40000000069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f0000000000106a7d517192c5c51218cc94c3d4af17f58daee089ba1fd44e3dbd98a0000000006ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a90c00d0afeb8614da7f19aba02d40f18c692585f65020dfced3d5e5f9a9c0c4e10e03685f8e909053e458121c66f5a76aedc7706aa11c82f8aa952a8f2b7879a98c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859bc07c56e60ad3d3f177382eac6548fba1fd32cfd90ca02b3e7cfa185fdce73983338460aac2d001f6f6963378ce4d44f8448ff5b0b9bbce4fb232c8b816ae36b090500050228bb030005000903000000000000000004020001340000000090a4200000000000a50000000000000006ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a908040106000701010b060003000c040801010b0600020009040801010a1408000e15010d030f02130317111210141816191a3bc360ed6c44a2dbe6a0860100000000001527000000000000010100503b0100010000000000000000000000af331ba8327fbb35b1c4feff00000000080303000001090803010000010902ff408c9c37fda304f00f3d735cb1e4f1c78e1a8f5706a43d85e7f085133ed3da065b5a5c525453015f26f7bacbc0080070826b557d217e60c1ea8f60a43b5662a4f43e6fff53811a8c060b020a040c03010f',
    },
    {
      name: 'raydium',
      payload:
        '80010004197154e1c10d16949038dd040363bca1f9d6501c694f6e0325ad817166fb2e91ee29f226060b1ad54d9415221c0c7ad303b456670b026a27507572ae01ed6e411f069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f00000000001de7a12ff28bad4db39808bf1a28dd7638e45ab7a186dcd2881df7242ea1b1408f86a04a1cc96ccc94f8a63795d914d2246cfbd13d5fd67cc5b1206cf1e9ffef945c3593aef1e4483ecbc859a5393442338b5b7111e1c70b12f86015828a1e0e3eb00d9f5b292b4214ac7d037b4d6f06450b964600df373052bb5e84f2f8e9a67b3213fba8bf9c87fa91e47819628c383e00bea7e98c7a03e03ba1069cfc3f6f3bcb06a251997acd4ebf0af23d008312b82b1f39d099e58c8a4aaab8bd683967d384c1840220bca5819ae9e262b026db1c70e17eb51b70d9c68a8c4bb7b804e4542caca8b61114eb54885cc56e3d3a68166f31ec4995e7f67defd8017fce43822172cd8bc97e15aded4eed4afb20221cc0cf5e73380c48453ad68c8c87b1dfdc437998ccbf2d0458b615cbcc6b1a367c4749e9fef7306622e1b1b58910120bc9ac273a410f39a1d7888c51ca3a54652727925d52662fcbdbd5480ecec6c93d53fa56b5c8353c5a742092e955bd5aa9874691d5e3c4de246bd76f4d0ee60929514c1093eab9f670278463a21d473819c00d2de04fd36798b9e6805a912234868ceec7978f512c7837284e94831479874181bfc22371ab28206a69b696593af18325e1336cf45decfc50f556352284ef198345d6d2435f2c3aea358988488918cb1dc3f3a5d34c4336bf1b840990340871f9d0d21fa1703f7af992737dd197127a1f92c464b9e3bbff500305bc70d3d8d59283bae2740f73aaffcc3a12ea36484433800510fdc4c47e63a2f586e53e71c74c1f037fa77639cc8921a6a4868f317900cc280cb6be3192c50383801cf4430180f9e3f8663223ac801069710dbf7d507a92a5a8b4f295952842550aa93fd5b95b5ace6a8eb920c93942e43690c20ec73054a535a992921064d24e87160da387c7c35b5ddbc92bb81e41fa8404105448d0306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a40000000cf141e02375d5640c761e27b8cd0a5d061aa53e7ccd4a9726964a6e82b6f785b051506000102191a1b0905a086010000000000151e191c1a1b00010316040205060708090a0b1d03050c0d0e0f1011171213142100a0860100000000005420000000000000fdfd92e807642d1d73040100000000001506000100191a1b0106180009030ef3060000000000180005027298040001198f1f4c3a452263d413b2cd17ebcbc1a0e5887364e6261a12a81792ea165a3e00050207000310',
    },
    {
      name: 'jup.ag',
      payload:
        '800100070f7154e1c10d16949038dd040363bca1f9d6501c694f6e0325ad817166fb2e91ee042d63da7e00ed2476967a6970ac982a0492b3456a76276f58d6ea3dc547e98e219c26bf5c0a882c347e7c4576a991831df293f01793f5bbc29c872d10ac01c529f226060b1ad54d9415221c0c7ad303b456670b026a27507572ae01ed6e411f5782453d0a170a4e1c932b7c8853d78b05ed7e2551d1d4d5262cafc691c55ad7c6aa5709af3f12338ce543e40ff6f1af4c12105140451bd6500877f16e9a425bc84f758fe1c28c755dd79a227ef10909ddfece2abd15fad007f7c49ca2b4b19ed8f1cd1dc850fb7a187a4afed3d2b03e0581025ed7777a997279a7177215dc0100000000000000000000000000000000000000000000000000000000000000000306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a400000000479d55bf231c06eee74c56ece681507fdb1b2dea3f48e5102b1cda256bc138f06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a98c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859b43ffa27f5d7f64a74c09b1f295879de4b09ab36dfc9dd514b321aa7b38ce5e8b8cb8facd9c8c6764f36df36b675d27e65fce06adbfa4520dae4570e067f6d09430fc651a5415c702784ea3a232fffc0245e3188bfa6b545eecf693db89364270809000502b2c206000900090348381100000000000c0600030023080b0101080200030c02000000a0860100000000000b010301110c0600040026080b01010a470b0e000306070423260a0a0d0a22162219170601252318220e0b0b242202151a0a221422120f0105252113220e0b0b242211100a221c221b1e0507212620220e0b0b24221d1f0a2cc1209b3341d69c810903000000266400012664010226640203a08601000000000056360000000000000a00000b030300000109035b27b44d146a05f5dd2be2bad768e62c41163213de9e13f8d4cac3201cb4c08e06ccca5bcb595a055c5ec2cd58e65fba782b180891d2ab9ed997789b23b60e8a8f5260388aed805991480acf460682888b868a89002482488fd533148ddba20aed781dec620657df24ade1163e2817be927df808140670787472767a0177',
    },
    {
      name: 'kamino',
      payload:
        '80010009117154e1c10d16949038dd040363bca1f9d6501c694f6e0325ad817166fb2e91ee29f226060b1ad54d9415221c0c7ad303b456670b026a27507572ae01ed6e411f5782453d0a170a4e1c932b7c8853d78b05ed7e2551d1d4d5262cafc691c55ad70a052441a1584e578c7005f6a7be1e0574197757700f241900f25f4afd8a19ceb985ae3cba081e3d6bb4f74b357dfe32a028c0bd42de67e72a6059fe01d9394d5361012abf55ad1a9c06cfac5041da38900969a726140e60b4409582482e5574c95aebe080670df0e7d45e2922cc33c116b875c3068a34079503cbbc70967276c771b217c909af6782fe507d2685724f648b824e1b1a308d606623015ea9a9590306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a400000008c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859000000000000000000000000000000000000000000000000000000000000000006ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a90479d55bf231c06eee74c56ece681507fdb1b2dea3f48e5102b1cda256bc138fe2f877e83daec6888f43abb5ae7b311bb78c34960897fce5a7b82c16e20ff197b43ffa27f5d7f64a74c09b1f295879de4b09ab36dfc9dd514b321aa7b38ce5e8181fb024d480fcfa02b4c4a2a795c4b08dd42b7759ea7f51796e0aa4874d301d690e4009742c9db9c6a6f039909dad347f3b55c4b4bc911d8d6447593e080a80ffe7d615569dcbfcefa036af426b1efda8b57b9718e26da5f9c0244ad3c0ab5d08080005023e9c070008000903fa500500000000000906000100260a0b01010a0200010c0200000010270000000000000b010101110906000200290a0b01010c410b0d000103040226290c0c0e0c2d2e210d0305222324250b0f0f102711050612131415161718191a0d280b0c0c2a1b2a1c1d06042b291e2a0d0b0b2c2a1f20070c2cc1209b3341d69c810003000000196400011364010226640203102700000000000072050000000000003200000b03010000010903be41ecfc81fd6752d2eaa4302a64601991b35d43166463382dcf964558a0cdc10a373b353940383d34363e030e333fb51d9861b940e87704edb0e9c79ad5e57c85ebb21e2f885997be5256295c74f9062d32152c140f0413112e10ae1049ea9491d5e5e7c62f7bad3a92a3b33bf3caee1825a63b58bc7313a2c4ca055b575e586002315d',
    },
  ];

  describe('simulate versioned solana transactions from nufi', async () => {
    for (const nuFiTest of nuFiTests) {
      test(nuFiTest.name, async () => {
        const signedTx = await sign(null, {
          data: {
            signerPath: [2147483692, 2147484149, 2147483649, 2147483648],
            curveType: Constants.SIGNING.CURVES.ED25519,
            encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
            hashType: Constants.SIGNING.HASHES.NONE,
            payload: Buffer.from(nuFiTest.payload, 'hex'),
          },
        });
        expect(signedTx).toBeTruthy();
      });
    }
  });
});
