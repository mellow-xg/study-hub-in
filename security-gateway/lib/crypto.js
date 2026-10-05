import crypto from "node:crypto";
function key(){const raw=process.env.SESSION_ENCRYPTION_KEY;if(!raw)throw new Error("Missing encryption key");const k=Buffer.from(raw,"base64");if(k.length!==32)throw new Error("Invalid encryption key");return k}
export function newSessionId(){return crypto.randomBytes(32).toString("base64url")}
export function hash(v){return crypto.createHash("sha256").update(v).digest("hex")}
export function encrypt(v){const iv=crypto.randomBytes(12);const c=crypto.createCipheriv("aes-256-gcm",key(),iv);const d=Buffer.concat([c.update(v,"utf8"),c.final()]);return [iv,c.getAuthTag(),d].map(x=>x.toString("base64url")).join(".")}
export function decrypt(v){const [i,t,d]=v.split(".");const c=crypto.createDecipheriv("aes-256-gcm",key(),Buffer.from(i,"base64url"));c.setAuthTag(Buffer.from(t,"base64url"));return Buffer.concat([c.update(Buffer.from(d,"base64url")),c.final()]).toString("utf8")}