var vsda_web = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/vsda.ts
  var vsda_exports = {};
  __export(vsda_exports, {
    default: () => vsda_default,
    sha256Base64: () => sha256Base64,
    signer: () => signer,
    validator: () => validator
  });

  // src/vsda.tables.ts
  var TABLE_A = [
    "You may only use the C/C++ Extension for Visual Studio Code and C# Extension for Visual Studio Code",
    "with Visual Studio Code, Visual Studio or Xamarin Studio software to help you develop and test your applications.",
    "The software is licensed, not sold.",
    "This agreement only gives you some rights to use the software.",
    "Microsoft reserves all other rights",
    "You may not work around any technical limitations in the software;",
    "reverse engineer, decompile or disassemble the software",
    "remove, minimize, block or modify any notices of Microsoft or ",
    "its suppliers in the software share, publish, rent, or lease ",
    "the software, or provide the software as a stand-alone hosted as solution for others to use."
  ];
  var TABLE_B = [
    "V+y,(H`v&A\\@x+;4GuK<$z]..?8#wVZn'*+}j1E\\$k0$/lvkpb846K:kf\"CI\\Yl*d4 / .R,{ ",
    "B%&BH</'e{U`>F>ks3lkgSX>ETq{Vsu-i<kVc})P(H`wKlTvuPED>BLAX)C0X1sN\\[u4,H",
    "bk@wJr&7h+N\\`Jfk4D$nbcdKen^VkOH<'KN:%uVO'G3ev#).$gM$r/==qtY]PJ[",
    `.owCo\\1\\B:964'42){c0<q,>\\\\1" - !@1w}Xt`,
    "V'+|i5?}]WPLSze1WE6;'}Tg;83v8V2z}ov&x*",
    '$Xjm#X:vcKdYn0VnkrLQDOwy"; .3RBSW%RIdLOZ7(GKR / 1>(wcime:5qDs ? [l5b5DKR = 9',
    '1UHJ^7Qt.SPtc<Q>6>#$jE+>>e"P*Mb | bL / `H5\'h7nP:ow + }zaqDB2,"\\(86Xa',
    ";JNC{6bB,>R2GMy>t!&J^RSy}22@yP8|Q;ph:\\mjV=xL#y')y+N|c",
    "/vJ{#Oc$xgduO$\\6UR>C_5s?M2X[eXma:)UyrxbK",
    '?MY",4_b9Lp"yqGu37h4.}]w#(vbN0cK^?R]"v<XFg$\\NZ`[K6',
    'c_#Lef$VPZKR)R%f#YESdTOdP;q$bk+8`:,u)H"Rxf_\\ / NDOg'
  ];

  // src/vsda.ts
  function latin1ToBytes(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      out[i] = s.charCodeAt(i) & 255;
    }
    return out;
  }
  var TABLE_A_BYTES = TABLE_A.map(latin1ToBytes);
  var TABLE_B_BYTES = TABLE_B.map(latin1ToBytes);
  var MsvcRand = class {
    state;
    constructor(seed) {
      this.state = seed >>> 0;
    }
    next() {
      this.state = Math.imul(this.state, 214013) + 2531011 >>> 0;
      return this.state >>> 16 & 32767;
    }
  };
  function addressLikeEntropy() {
    return Math.random() * 4294967296 | 0;
  }
  function seedFor(input) {
    const firstFourBytes = input[0] | input[1] << 8 | input[2] << 16 | input[3] << 24 | 0;
    const timeInSeconds = Math.floor(Date.now() / 1e3);
    return firstFourBytes + timeInSeconds + addressLikeEntropy() | 0;
  }
  var K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  function hashBlocks(w, v, p, pos, len) {
    let a, b, c, d, e, f, g, h, u, i, j, t1, t2;
    while (len >= 64) {
      a = v[0];
      b = v[1];
      c = v[2];
      d = v[3];
      e = v[4];
      f = v[5];
      g = v[6];
      h = v[7];
      for (i = 0; i < 16; i++) {
        j = pos + i * 4;
        w[i] = (p[j] & 255) << 24 | (p[j + 1] & 255) << 16 | (p[j + 2] & 255) << 8 | p[j + 3] & 255;
      }
      for (i = 16; i < 64; i++) {
        u = w[i - 2];
        t1 = (u >>> 17 | u << 32 - 17) ^ (u >>> 19 | u << 32 - 19) ^ u >>> 10;
        u = w[i - 15];
        t2 = (u >>> 7 | u << 32 - 7) ^ (u >>> 18 | u << 32 - 18) ^ u >>> 3;
        w[i] = (t1 + w[i - 7] | 0) + (t2 + w[i - 16] | 0);
      }
      for (i = 0; i < 64; i++) {
        t1 = (((e >>> 6 | e << 32 - 6) ^ (e >>> 11 | e << 32 - 11) ^ (e >>> 25 | e << 32 - 25)) + (e & f ^ ~e & g) | 0) + (h + (K[i] + w[i] | 0) | 0) | 0;
        t2 = ((a >>> 2 | a << 32 - 2) ^ (a >>> 13 | a << 32 - 13) ^ (a >>> 22 | a << 32 - 22)) + (a & b ^ a & c ^ b & c) | 0;
        h = g;
        g = f;
        f = e;
        e = d + t1 | 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 | 0;
      }
      v[0] += a;
      v[1] += b;
      v[2] += c;
      v[3] += d;
      v[4] += e;
      v[5] += f;
      v[6] += g;
      v[7] += h;
      pos += 64;
      len -= 64;
    }
    return pos;
  }
  function sha256Base64(...parts) {
    const state = new Int32Array([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    const temp = new Int32Array(64);
    const buffer = new Uint8Array(128);
    let bufferLength = 0;
    let bytesHashed = 0;
    for (const part of parts) {
      let pos = 0;
      let len = part.length;
      bytesHashed += len;
      if (bufferLength > 0) {
        while (bufferLength < 64 && len > 0) {
          buffer[bufferLength++] = part[pos++];
          len--;
        }
        if (bufferLength === 64) {
          hashBlocks(temp, state, buffer, 0, 64);
          bufferLength = 0;
        }
      }
      if (len >= 64) {
        pos = hashBlocks(temp, state, part, pos, len);
        len %= 64;
      }
      while (len > 0) {
        buffer[bufferLength++] = part[pos++];
        len--;
      }
    }
    const bitLenHi = Math.floor(bytesHashed / 536870912) | 0;
    const bitLenLo = bytesHashed << 3;
    const padLength = bytesHashed % 64 < 56 ? 64 : 128;
    buffer[bufferLength] = 128;
    buffer.fill(0, bufferLength + 1, padLength - 8);
    buffer[padLength - 8] = bitLenHi >>> 24;
    buffer[padLength - 7] = bitLenHi >>> 16;
    buffer[padLength - 6] = bitLenHi >>> 8;
    buffer[padLength - 5] = bitLenHi;
    buffer[padLength - 4] = bitLenLo >>> 24;
    buffer[padLength - 3] = bitLenLo >>> 16;
    buffer[padLength - 2] = bitLenLo >>> 8;
    buffer[padLength - 1] = bitLenLo;
    hashBlocks(temp, state, buffer, 0, padLength);
    const digest = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      digest[i * 4] = state[i] >>> 24;
      digest[i * 4 + 1] = state[i] >>> 16;
      digest[i * 4 + 2] = state[i] >>> 8;
      digest[i * 4 + 3] = state[i];
    }
    let binary = "";
    for (const byte of digest) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  function utf8(arg) {
    return new TextEncoder().encode(arg);
  }
  var signer = class {
    sign(...args) {
      if (args.length !== 1) {
        throw new Error("Wrong number of arguments");
      }
      const arg = args[0];
      if (typeof arg !== "string") {
        throw new Error("Wrong type of argment. Expects a string.");
      }
      const input = utf8(arg);
      if (input.length < 4) {
        return "";
      }
      const rand = new MsvcRand(seedFor(input));
      const d0 = rand.next() % 10;
      const d1 = rand.next() % 10;
      const d2 = rand.next() % 10;
      return `${d0}${d1}${d2}` + sha256Base64(
        input,
        TABLE_A_BYTES[d0],
        TABLE_A_BYTES[d1],
        TABLE_B_BYTES[d2]
      );
    }
  };
  var validator = class {
    state = "";
    createNewMessage(...args) {
      if (args.length !== 1) {
        throw new Error("Wrong number of arguments");
      }
      const arg = args[0];
      if (typeof arg !== "string") {
        throw new Error("Wrong type of argment. Expects a string.");
      }
      const input = utf8(arg);
      if (input.length < 4) {
        return "error";
      }
      const rand = new MsvcRand(seedFor(input));
      const length = rand.next() % 50 + 30;
      const message = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        message[i] = 33 + rand.next() % 93;
      }
      this.state = sha256Base64(message);
      return this.state;
    }
    validate(...args) {
      if (args.length !== 1) {
        throw new Error("Wrong number of arguments");
      }
      const arg = args[0];
      if (typeof arg !== "string") {
        throw new Error("Wrong type of argment. Expects a string.");
      }
      const input = utf8(arg);
      if (input.length < 4) {
        return "error";
      }
      const d0 = input[0] - 48;
      const d1 = input[1] - 48;
      const d2 = input[2] - 48;
      if (d0 < 0 || d0 > 9 || d1 < 0 || d1 > 9 || d2 < 0 || d2 > 9) {
        return "error";
      }
      const expected = `${d0}${d1}${d2}` + sha256Base64(
        utf8(this.state),
        TABLE_A_BYTES[d0],
        TABLE_A_BYTES[d1],
        TABLE_B_BYTES[d2]
      );
      return arg === expected ? "ok" : "error";
    }
  };
  var vsda_default = { signer, validator };
  return __toCommonJS(vsda_exports);
})();
