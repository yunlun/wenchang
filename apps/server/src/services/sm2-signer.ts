/**
 * secp256k1 签名服务 - 文昌链（IRITA v4.0.0）上传链账户模式
 *
 * 使用 @cosmjs/crypto + @cosmjs/proto-signing 做标准 Cosmos secp256k1 签名
 * 广播接口：POST /rpc broadcast_tx_sync（Protobuf 编码）
 */

import { logger } from '../config/logger';
import { Secp256k1, sha256 } from '@cosmjs/crypto';
import { fromHex, toBase64 } from '@cosmjs/encoding';
import { TxRaw, TxBody, AuthInfo, SignerInfo, Fee, ModeInfo, ModeInfo_Single } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { Any } from 'cosmjs-types/google/protobuf/any';

/**
 * 手动 Protobuf 编码 bytes 字段
 * message PubKey { bytes key = 1; }
 */
function encodeProtobufBytes(fieldNum: number, data: Uint8Array): Uint8Array {
  const tag = (fieldNum << 3) | 2;
  const tagBuf = encodeVarint(tag);
  const lenBuf = encodeVarint(data.length);
  const result = new Uint8Array(tagBuf.length + lenBuf.length + data.length);
  result.set(tagBuf, 0);
  result.set(lenBuf, tagBuf.length);
  result.set(data, tagBuf.length + lenBuf.length);
  return result;
}

function encodeVarint(value: number): Uint8Array {
  const buf: number[] = [];
  while (value > 0x7f) {
    buf.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  buf.push(value & 0x7f);
  return new Uint8Array(buf);
}

/**
 * 构建 secp256k1 签名的 Protobuf 交易
 * 签名格式：Amino JSON (SIGN_MODE_LEGACY_AMINO_JSON)
 * 广播格式：Protobuf binary base64
 */
export async function buildSignedTx(params: {
  privateKey: string;  // hex
  publicKey: string;   // compressed hex 33bytes
  fromAddress: string;
  toAddress: string;
  amount: string;
  denom: string;
  fee: string;
  feeDenom: string;
  gas: string;
  memo: string;
  chainId: string;
  accountNumber: string;
  sequence: string;
}): Promise<{ txBytes: Uint8Array; txBytesBase64: string }> {
  const {
    privateKey, publicKey, fromAddress, toAddress,
    amount, denom, fee, feeDenom, gas, memo,
    chainId, accountNumber, sequence,
  } = params;

  const seqNum = parseInt(sequence, 10);
  const accNum = parseInt(accountNumber, 10);
  const gasNum = parseInt(gas, 10);

  const privKeyBytes = fromHex(privateKey);
  const pubKeyBytes = fromHex(publicKey);

  // ── 1. Amino JSON 签名文档 ────────────────────────────────
  const signDoc = {
    chain_id: chainId,
    account_number: accountNumber,
    sequence,
    fee: {
      amount: [{ denom: feeDenom, amount: fee }],
      gas,
    },
    msgs: [
      {
        type: 'cosmos-sdk/MsgSend',
        value: {
          from_address: fromAddress,
          to_address: toAddress,
          amount: [{ denom, amount }],
        },
      },
    ],
    memo,
  };

  const signBytes = JSON.stringify(sortObjectKeys(signDoc));
  logger.debug(`[secp256k1] signDoc: ${signBytes}`);

  // ── 2. secp256k1 签名 ─────────────────────────────────────
  const msgHash = sha256(Buffer.from(signBytes, 'utf8'));
  const extSig = await Secp256k1.createSignature(msgHash, privKeyBytes);
  const signatureBytes = extSig.toFixedLength().slice(0, 64); // 取 r+s 各32字节，共64字节
  logger.debug(`[secp256k1] sig length: ${signatureBytes.length}`);

  // ── 3. Protobuf 编码 ─────────────────────────────────────
  const msgSendBytes = MsgSend.encode(
    MsgSend.fromPartial({
      fromAddress,
      toAddress,
      amount: [{ denom, amount }],
    })
  ).finish();

  const txBodyBytes = TxBody.encode(
    TxBody.fromPartial({
      messages: [
        Any.fromPartial({
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: msgSendBytes,
        }),
      ],
      memo,
    })
  ).finish();

  // secp256k1 公钥 Any
  const pubKeyProtoBytes = encodeProtobufBytes(1, pubKeyBytes);
  const pubKeyAny = Any.fromPartial({
    typeUrl: '/cosmos.crypto.secp256k1.PubKey',
    value: pubKeyProtoBytes,
  });

  const signerInfo = SignerInfo.fromPartial({
    publicKey: pubKeyAny,
    modeInfo: ModeInfo.fromPartial({
      single: ModeInfo_Single.fromPartial({
        mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
      }),
    }),
    sequence: BigInt(seqNum) as any,
  });

  const authInfoBytes = AuthInfo.encode(
    AuthInfo.fromPartial({
      signerInfos: [signerInfo],
      fee: Fee.fromPartial({
        amount: [{ denom: feeDenom, amount: fee }],
        gasLimit: BigInt(gasNum) as any,
      }),
    })
  ).finish();

  const txRaw = TxRaw.fromPartial({
    bodyBytes: txBodyBytes,
    authInfoBytes,
    signatures: [signatureBytes],
  });

  const txBytes = TxRaw.encode(txRaw).finish();
  const txBytesBase64 = Buffer.from(txBytes).toString('base64');

  logger.debug(`[secp256k1] txBytes length: ${txBytes.length}`);

  return { txBytes, txBytesBase64 };
}

function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortObjectKeys(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}
