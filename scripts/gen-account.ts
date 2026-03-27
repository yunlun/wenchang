import { Bip39, Random, stringToPath } from '@cosmjs/crypto';
import { Secp256k1HdWallet } from '@cosmjs/amino';

async function main() {
  const mnemonic = Bip39.encode(Random.getBytes(16)).toString();

  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'iaa',
    hdPaths: [stringToPath("m/44'/118'/0'/0/0")],
  });

  const [account] = await wallet.getAccounts();

  console.log('\n========== 文昌链账户信息 ==========');
  console.log('助记词 (MNEMONIC):  ', mnemonic);
  console.log('链上地址 (Address): ', account.address);
  console.log('公钥 (PubKey hex): ', Buffer.from(account.pubkey).toString('hex'));
  console.log('\n请将以下内容填入 apps/server/.env:');
  console.log(`WENCHANG_FROM_ADDRESS=${account.address}`);
  console.log(`WENCHANG_MNEMONIC="${mnemonic}"`);
  console.log('\n⚠️  助记词请妥善保存，切勿泄露！');
  console.log('=====================================\n');
}

main().catch(console.error);

