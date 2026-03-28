declare module 'sm-crypto' {
  export const sm2: {
    generateKeyPairHex(): { privateKey: string; publicKey: string };
    doSignature(msg: string, privateKey: string, options?: { hash?: boolean; der?: boolean }): string;
    doVerifySignature(msg: string, signature: string, publicKey: string, options?: { hash?: boolean; der?: boolean }): boolean;
  };
  export const sm3: {
    (msg: string): string;
  };
}
