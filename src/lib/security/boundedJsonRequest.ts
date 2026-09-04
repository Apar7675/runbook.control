export const MAXIMUM_SECURITY_JSON_REQUEST_BYTES = 16 * 1024;

export type ExactJsonFieldType = "string" | "number" | "boolean";
export type ExactJsonSchema = Readonly<Record<string, ExactJsonFieldType>>;

export class SecurityJsonRequestError extends Error {
  readonly status: 400 | 413 | 415;

  constructor(message: string, status: 400 | 413 | 415 = 400) {
    super(message);
    this.name = "SecurityJsonRequestError";
    this.status = status;
  }
}

function invalidRequest(message = "The JSON request body is invalid.") {
  return new SecurityJsonRequestError(message, 400);
}

function parseDeclaredLength(req: Request) {
  const raw = req.headers.get("content-length");
  if (raw === null) return null;
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) {
    throw invalidRequest("The request Content-Length is invalid.");
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw invalidRequest("The request Content-Length is invalid.");
  }
  if (value > MAXIMUM_SECURITY_JSON_REQUEST_BYTES) {
    throw new SecurityJsonRequestError("The JSON request body is too large.", 413);
  }
  return value;
}

function validateContentType(req: Request) {
  const contentEncoding = (req.headers.get("content-encoding") ?? "").trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    throw new SecurityJsonRequestError("Encoded JSON request bodies are not supported.", 415);
  }

  const contentType = req.headers.get("content-type") ?? "";
  const parts = contentType.split(";");
  if (parts.shift()?.trim().toLowerCase() !== "application/json") {
    throw new SecurityJsonRequestError("The request Content-Type must be application/json.", 415);
  }

  let sawCharset = false;
  for (const rawParameter of parts) {
    const parameter = rawParameter.trim();
    if (!parameter) continue;
    const separator = parameter.indexOf("=");
    const name = (separator >= 0 ? parameter.slice(0, separator) : parameter).trim().toLowerCase();
    if (name !== "charset") continue;
    if (sawCharset || separator < 0) {
      throw new SecurityJsonRequestError("The request charset is invalid.", 415);
    }
    sawCharset = true;
    let charset = parameter.slice(separator + 1).trim();
    if (charset.startsWith('"') || charset.endsWith('"')) {
      if (charset.length < 2 || !charset.startsWith('"') || !charset.endsWith('"')) {
        throw new SecurityJsonRequestError("The request charset is invalid.", 415);
      }
      charset = charset.slice(1, -1);
    }
    charset = charset.toLowerCase();
    if (charset !== "utf-8" && charset !== "utf8") {
      throw new SecurityJsonRequestError("The request charset must be UTF-8.", 415);
    }
  }
}

async function readBoundedBytes(req: Request, declaredLength: number | null) {
  if (!req.body) return new Uint8Array(0);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAXIMUM_SECURITY_JSON_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new SecurityJsonRequestError("The JSON request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (declaredLength !== null && total !== declaredLength) {
    throw invalidRequest("The request Content-Length did not match its body.");
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function skipWhitespace(text: string, start: number) {
  let index = start;
  while (index < text.length && /[\u0009\u000a\u000d\u0020]/.test(text[index])) index += 1;
  return index;
}

function findStringEnd(text: string, start: number) {
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === '"') return index + 1;
    if (text[index] === "\\") {
      index += 2;
      continue;
    }
    index += 1;
  }
  throw invalidRequest();
}

function collectTopLevelPropertyNames(text: string) {
  const names: string[] = [];
  const seen = new Set<string>();
  let index = skipWhitespace(text, 0);
  if (text[index] !== "{") throw invalidRequest("The JSON request body must be an object.");
  index = skipWhitespace(text, index + 1);
  if (text[index] === "}") {
    index = skipWhitespace(text, index + 1);
    if (index !== text.length) throw invalidRequest();
    return names;
  }

  while (index < text.length) {
    if (text[index] !== '"') throw invalidRequest();
    const keyEnd = findStringEnd(text, index);
    let name: string;
    try {
      name = JSON.parse(text.slice(index, keyEnd)) as string;
    } catch {
      throw invalidRequest();
    }
    if (seen.has(name)) throw invalidRequest("The JSON request body contains a duplicate field.");
    seen.add(name);
    names.push(name);

    index = skipWhitespace(text, keyEnd);
    if (text[index] !== ":") throw invalidRequest();
    index += 1;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let separatorFound = false;
    for (; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
      } else if (character === "{" || character === "[") {
        depth += 1;
      } else if (character === "}" || character === "]") {
        if (character === "}" && depth === 0) {
          index = skipWhitespace(text, index + 1);
          if (index !== text.length) throw invalidRequest();
          return names;
        }
        depth -= 1;
      } else if (character === "," && depth === 0) {
        index = skipWhitespace(text, index + 1);
        separatorFound = true;
        break;
      }
    }
    if (!separatorFound) throw invalidRequest();
  }

  throw invalidRequest();
}

function assertNoUnpairedUtf16Surrogates(text: string) {
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= text.length) throw invalidRequest("The JSON request body contains invalid Unicode.");
      const nextCodeUnit = text.charCodeAt(index + 1);
      if (nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
        throw invalidRequest("The JSON request body contains invalid Unicode.");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw invalidRequest("The JSON request body contains invalid Unicode.");
    }
  }
}

function validateParsedUnicode(root: object) {
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === "string") {
      assertNoUnpairedUtf16Surrogates(value);
    } else if (Array.isArray(value)) {
      for (const child of value) pending.push(child);
    } else if (value !== null && typeof value === "object") {
      for (const [name, child] of Object.entries(value)) {
        assertNoUnpairedUtf16Surrogates(name);
        pending.push(child);
      }
    }
  }
}

export async function readBoundedExactJsonObject(req: Request, schema: ExactJsonSchema) {
  validateContentType(req);
  const declaredLength = parseDeclaredLength(req);
  const bytes = await readBoundedBytes(req, declaredLength);

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalidRequest("The JSON request body is not valid UTF-8.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalidRequest();
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw invalidRequest("The JSON request body must be an object.");
  }
  validateParsedUnicode(parsed);

  const rawNames = collectTopLevelPropertyNames(text);
  const expectedNames = Object.keys(schema);
  if (
    rawNames.length !== expectedNames.length ||
    rawNames.some((name) => !Object.prototype.hasOwnProperty.call(schema, name))
  ) {
    throw invalidRequest("The JSON request body fields are invalid.");
  }

  const record = parsed as Record<string, unknown>;
  for (const name of expectedNames) {
    if (!Object.prototype.hasOwnProperty.call(record, name) || typeof record[name] !== schema[name]) {
      throw invalidRequest("The JSON request body field types are invalid.");
    }
  }
  return record;
}
