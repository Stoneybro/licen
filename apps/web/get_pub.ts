import { ethers } from "ethers";

const privKeyHex = "0x327672ce2f423197aa9dcf528b9688fb9ef6dcfa340cdcadb9f119157538bef6";
const signingKey = new ethers.SigningKey(privKeyHex);
console.log(signingKey.compressedPublicKey);
