const { secp256k1 } = require('@noble/curves/secp256k1');

const privKeyHex = "327672ce2f423197aa9dcf528b9688fb9ef6dcfa340cdcadb9f119157538bef6";
const pubKeyBytes = secp256k1.getPublicKey(privKeyHex, true);
console.log("0x" + Buffer.from(pubKeyBytes).toString("hex"));
