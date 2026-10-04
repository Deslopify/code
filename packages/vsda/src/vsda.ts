import { TABLE_A, TABLE_B } from './vsda.tables.js';

function latin1ToBytes(s: string): Uint8Array {
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) {
		out[i] = s.charCodeAt(i) & 0xff;
	}
	return out;
}

const TABLE_A_BYTES: readonly Uint8Array[] = TABLE_A.map(latin1ToBytes);
const TABLE_B_BYTES: readonly Uint8Array[] = TABLE_B.map(latin1ToBytes);

class MsvcRand {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	public next(): number {
		this.state = (Math.imul(this.state, 0x343fd) + 0x269ec3) >>> 0;
		return (this.state >>> 0x10) & 0x7fff;
	}
}

function addressLikeEntropy(): number {
	return (Math.random() * 0x100000000) | 0;
}

function seedFor(input: Uint8Array): number {
	const firstFourBytes =
		input[0] | (input[1] << 8) | (input[2] << 0x10) | (input[3] << 0x18) | 0;
	const timeInSeconds = Math.floor(Date.now() / 1000);
	return (firstFourBytes + timeInSeconds + addressLikeEntropy()) | 0;
}

const K = new Uint32Array([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
	0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
	0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
	0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
	0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
	0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
	0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
	0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
	0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function hashBlocks(
	w: Int32Array,
	v: Int32Array,
	p: Uint8Array,
	pos: number,
	len: number,
): number {
	let a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
		g: number,
		h: number,
		u: number,
		i: number,
		j: number,
		t1: number,
		t2: number;
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
			w[i] =
				((p[j] & 0xff) << 24) |
				((p[j + 1] & 0xff) << 16) |
				((p[j + 2] & 0xff) << 8) |
				(p[j + 3] & 0xff);
		}

		for (i = 16; i < 64; i++) {
			u = w[i - 2];
			t1 =
				((u >>> 17) | (u << (32 - 17))) ^
				((u >>> 19) | (u << (32 - 19))) ^
				(u >>> 10);

			u = w[i - 15];
			t2 =
				((u >>> 7) | (u << (32 - 7))) ^
				((u >>> 18) | (u << (32 - 18))) ^
				(u >>> 3);

			w[i] = ((t1 + w[i - 7]) | 0) + ((t2 + w[i - 16]) | 0);
		}

		for (i = 0; i < 64; i++) {
			t1 =
				((((((e >>> 6) | (e << (32 - 6))) ^
					((e >>> 11) | (e << (32 - 11))) ^
					((e >>> 25) | (e << (32 - 25)))) +
					((e & f) ^ (~e & g))) |
					0) +
					((h + ((K[i] + w[i]) | 0)) | 0)) |
				0;

			t2 =
				((((a >>> 2) | (a << (32 - 2))) ^
					((a >>> 13) | (a << (32 - 13))) ^
					((a >>> 22) | (a << (32 - 22)))) +
					((a & b) ^ (a & c) ^ (b & c))) |
				0;

			h = g;
			g = f;
			f = e;
			e = (d + t1) | 0;
			d = c;
			c = b;
			b = a;
			a = (t1 + t2) | 0;
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

function sha256Base64(...parts: Uint8Array[]): string {
	const state = new Int32Array([
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
		0x1f83d9ab, 0x5be0cd19,
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

	const bitLenHi = Math.floor(bytesHashed / 0x20000000) | 0;
	const bitLenLo = bytesHashed << 3;
	const padLength = bytesHashed % 64 < 56 ? 64 : 128;

	buffer[bufferLength] = 0x80;
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

	let binary = '';
	for (const byte of digest) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function utf8(arg: string): Uint8Array {
	return new TextEncoder().encode(arg);
}

// the signer is a native module that for historical reasons uses a lower case class name
// eslint-disable-next-line @typescript-eslint/naming-convention
export class signer {
	sign(...args: [arg: string]): string {
		if (args.length !== 1) {
			throw new Error('Wrong number of arguments');
		}
		const arg = args[0];
		if (typeof arg !== 'string') {
			throw new Error('Wrong type of argment. Expects a string.');
		}

		const input = utf8(arg);
		if (input.length < 4) {
			return '';
		}

		const rand = new MsvcRand(seedFor(input));

		const d0 = rand.next() % 10;
		const d1 = rand.next() % 10;
		const d2 = rand.next() % 10;

		return (
			`${d0}${d1}${d2}` +
			sha256Base64(
				input,
				TABLE_A_BYTES[d0],
				TABLE_A_BYTES[d1],
				TABLE_B_BYTES[d2],
			)
		);
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export class validator {
	private state: string = '';

	createNewMessage(...args: [arg: string]): string {
		if (args.length !== 1) {
			throw new Error('Wrong number of arguments');
		}
		const arg = args[0];
		if (typeof arg !== 'string') {
			throw new Error('Wrong type of argment. Expects a string.');
		}

		const input = utf8(arg);
		if (input.length < 4) {
			return 'error';
		}

		const rand = new MsvcRand(seedFor(input));

		const length = (rand.next() % 50) + 30;
		const message = [...input];
		for (let i = 0; i < length; i++) {
			message.push(33 + (rand.next() % 93));
		}

		this.state = sha256Base64(Uint8Array.from(message));
		return this.state;
	}

	validate(...args: [arg: string]): 'ok' | 'error' {
		if (args.length !== 1) {
			throw new Error('Wrong number of arguments');
		}
		const arg = args[0];
		if (typeof arg !== 'string') {
			throw new Error('Wrong type of argment. Expects a string.');
		}

		const input = utf8(arg);
		if (input.length < 4) {
			return 'error';
		}

		const d0 = input[0] - 0x30;
		const d1 = input[1] - 0x30;
		const d2 = input[2] - 0x30;
		if (d0 < 0 || d0 > 9 || d1 < 0 || d1 > 9 || d2 < 0 || d2 > 9) {
			return 'error';
		}

		const expected =
			`${d0}${d1}${d2}` +
			sha256Base64(
				utf8(this.state),
				TABLE_A_BYTES[d0],
				TABLE_A_BYTES[d1],
				TABLE_B_BYTES[d2],
			);

		return arg === expected ? 'ok' : 'error';
	}
}

export default { signer, validator };
