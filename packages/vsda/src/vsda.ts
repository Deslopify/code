import { TABLE_A, TABLE_B } from './vsda.tables.js';

function latin1ToBytes(s: string): Uint8Array {
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) { out[i] = s.charCodeAt(i) & 0xff; }
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
		this.state = (Math.imul(this.state, 0x343FD) + 0x269EC3) >>> 0;
		return (this.state >>> 0x10) & 0x7FFF;
	}
}

const ssoBufferAddressStandIn: number = (Math.random() * 0x100000000) | 0;

function addressLikeEntropy(utf8Length: number): number {
	if (utf8Length <= 15) {
		return ssoBufferAddressStandIn;
	}
	return (Math.random() * 0x100000000) | 0;
}

function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

function seedFor(input: Uint8Array): number {
	const firstFourBytes = (input[0] | (input[1] << 8) | (input[2] << 0x10) | (input[3] << 0x18)) | 0;
	const timeInSeconds = Math.floor(Date.now() / 1000);
	return (firstFourBytes + timeInSeconds + addressLikeEntropy(input.length)) | 0;
}

const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
const padding = [-2147483648, 8388608, 32768, 128];
const shift = [24, 16, 8, 0];
const salt = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256(message: Uint8Array): string {
	const state: [number, number, number, number, number, number, number, number] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

	const blocks = new Uint32Array(64);
	let block = 0, start = 0, bytes = 0, high = 0;
	let index = 0, i = 0;
	const length = message.length;
	let hashed = false;
	let last = 0;

	const hash = (): void => {
		let a = state[0], b = state[1], c = state[2], d = state[3], e = state[4], f = state[5], g = state[6], h = state[7];
		let round: number, sigma1: number, sigma2: number, majority: number, acc1: number, acc2: number, choose: number;
		const cache: [number | undefined, number | undefined, number | undefined, number | undefined] = [undefined, undefined, undefined, undefined];

		for (round = 16; round < 64; ++round) {
			acc1 = blocks[round - 15]!; sigma1 = ((acc1 >>> 7) | (acc1 << 25)) ^ ((acc1 >>> 18) | (acc1 << 14)) ^ (acc1 >>> 3);
			acc1 = blocks[round - 2]!; sigma2 = ((acc1 >>> 17) | (acc1 << 15)) ^ ((acc1 >>> 19) | (acc1 << 13)) ^ (acc1 >>> 10);
			blocks[round] = blocks[round - 16]! + sigma1 + blocks[round - 7]! + sigma2 << 0;
		}

		cache[3] = b & c;

		for (round = 0; round < 64; round += 4) {
			sigma1 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
			sigma2 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
			cache[0] = a & b;
			majority = cache[0] ^ (a & c) ^ cache[3];
			choose = (e & f) ^ (~e & g);
			acc1 = h + sigma2 + choose + salt[round]! + blocks[round]!;
			acc2 = sigma1 + majority;
			h = d + acc1 << 0;
			d = acc1 + acc2 << 0;

			sigma1 = ((d >>> 2) | (d << 30)) ^ ((d >>> 13) | (d << 19)) ^ ((d >>> 22) | (d << 10));
			sigma2 = ((h >>> 6) | (h << 26)) ^ ((h >>> 11) | (h << 21)) ^ ((h >>> 25) | (h << 7));
			cache[1] = d & a;
			majority = cache[1] ^ (d & b) ^ cache[0];
			choose = (h & e) ^ (~h & f);
			acc1 = g + sigma2 + choose + salt[round + 1]! + blocks[round + 1]!;
			acc2 = sigma1 + majority;
			g = c + acc1 << 0;
			c = acc1 + acc2 << 0;

			sigma1 = ((c >>> 2) | (c << 30)) ^ ((c >>> 13) | (c << 19)) ^ ((c >>> 22) | (c << 10));
			sigma2 = ((g >>> 6) | (g << 26)) ^ ((g >>> 11) | (g << 21)) ^ ((g >>> 25) | (g << 7));
			cache[2] = c & d;
			majority = cache[2] ^ (c & a) ^ cache[1];
			choose = (g & h) ^ (~g & e);
			acc1 = f + sigma2 + choose + salt[round + 2]! + blocks[round + 2]!;
			acc2 = sigma1 + majority;
			f = b + acc1 << 0;
			b = acc1 + acc2 << 0;

			sigma1 = ((b >>> 2) | (b << 30)) ^ ((b >>> 13) | (b << 19)) ^ ((b >>> 22) | (b << 10));
			sigma2 = ((f >>> 6) | (f << 26)) ^ ((f >>> 11) | (f << 21)) ^ ((f >>> 25) | (f << 7));
			cache[3] = b & c;
			majority = cache[3] ^ (b & d) ^ cache[2];
			choose = (f & g) ^ (~f & h);
			acc1 = e + sigma2 + choose + salt[round + 3]! + blocks[round + 3]!;
			acc2 = sigma1 + majority;
			e = a + acc1 << 0;
			a = acc1 + acc2 << 0;
		}

		state[0] = state[0] + a << 0;
		state[1] = state[1] + b << 0;
		state[2] = state[2] + c << 0;
		state[3] = state[3] + d << 0;
		state[4] = state[4] + e << 0;
		state[5] = state[5] + f << 0;
		state[6] = state[6] + g << 0;
		state[7] = state[7] + h << 0;
	};

	while (index < length) {
		if (hashed) {
			hashed = false;
			blocks[0] = block;
			block = blocks[16]! = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
		}

		for (i = start; index < length && i < 64; ++index) {
			blocks[i >>> 2]! |= message[index]! << shift[i++ & 3]!;
		}

		last = i; bytes += i - start; if (i >= 64) {
			block = blocks[16]!; start = i - 64; hash(); hashed = true;
		} else { start = i; }

		if (bytes > 4294967295) {
			high += (bytes / 4294967296) << 0;
			bytes = bytes % 4294967296;
		}
	}

	blocks[16] = block; blocks[last >>> 2]! |= padding[last & 3]!; block = blocks[16]!;

	if (last >= 56) {
		if (!hashed) { hash(); }
		blocks[0] = block;
		blocks[16]! = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
	}

	blocks[14] = high << 3 | bytes >>> 29; blocks[15] = bytes << 3;
	hash();

	return (
		chars[(state[0] >>> 28) & 0x0F]! + chars[(state[0] >>> 24) & 0x0F]! +
		chars[(state[0] >>> 20) & 0x0F]! + chars[(state[0] >>> 16) & 0x0F]! +
		chars[(state[0] >>> 12) & 0x0F]! + chars[(state[0] >>> 8) & 0x0F]! +
		chars[(state[0] >>> 4) & 0x0F]! + chars[state[0] & 0x0F]! +
		chars[(state[1] >>> 28) & 0x0F]! + chars[(state[1] >>> 24) & 0x0F]! +
		chars[(state[1] >>> 20) & 0x0F]! + chars[(state[1] >>> 16) & 0x0F]! +
		chars[(state[1] >>> 12) & 0x0F]! + chars[(state[1] >>> 8) & 0x0F]! +
		chars[(state[1] >>> 4) & 0x0F]! + chars[state[1] & 0x0F]! +
		chars[(state[2] >>> 28) & 0x0F]! + chars[(state[2] >>> 24) & 0x0F]! +
		chars[(state[2] >>> 20) & 0x0F]! + chars[(state[2] >>> 16) & 0x0F]! +
		chars[(state[2] >>> 12) & 0x0F]! + chars[(state[2] >>> 8) & 0x0F]! +
		chars[(state[2] >>> 4) & 0x0F]! + chars[state[2] & 0x0F]! +
		chars[(state[3] >>> 28) & 0x0F]! + chars[(state[3] >>> 24) & 0x0F]! +
		chars[(state[3] >>> 20) & 0x0F]! + chars[(state[3] >>> 16) & 0x0F]! +
		chars[(state[3] >>> 12) & 0x0F]! + chars[(state[3] >>> 8) & 0x0F]! +
		chars[(state[3] >>> 4) & 0x0F]! + chars[state[3] & 0x0F]! +
		chars[(state[4] >>> 28) & 0x0F]! + chars[(state[4] >>> 24) & 0x0F]! +
		chars[(state[4] >>> 20) & 0x0F]! + chars[(state[4] >>> 16) & 0x0F]! +
		chars[(state[4] >>> 12) & 0x0F]! + chars[(state[4] >>> 8) & 0x0F]! +
		chars[(state[4] >>> 4) & 0x0F]! + chars[state[4] & 0x0F]! +
		chars[(state[5] >>> 28) & 0x0F]! + chars[(state[5] >>> 24) & 0x0F]! +
		chars[(state[5] >>> 20) & 0x0F]! + chars[(state[5] >>> 16) & 0x0F]! +
		chars[(state[5] >>> 12) & 0x0F]! + chars[(state[5] >>> 8) & 0x0F]! +
		chars[(state[5] >>> 4) & 0x0F]! + chars[state[5] & 0x0F]! +
		chars[(state[6] >>> 28) & 0x0F]! + chars[(state[6] >>> 24) & 0x0F]! +
		chars[(state[6] >>> 20) & 0x0F]! + chars[(state[6] >>> 16) & 0x0F]! +
		chars[(state[6] >>> 12) & 0x0F]! + chars[(state[6] >>> 8) & 0x0F]! +
		chars[(state[6] >>> 4) & 0x0F]! + chars[state[6] & 0x0F]! +
		chars[(state[7] >>> 28) & 0x0F]! + chars[(state[7] >>> 24) & 0x0F]! +
		chars[(state[7] >>> 20) & 0x0F]! + chars[(state[7] >>> 16) & 0x0F]! +
		chars[(state[7] >>> 12) & 0x0F]! + chars[(state[7] >>> 8) & 0x0F]! +
		chars[(state[7] >>> 4) & 0x0F]! + chars[state[7] & 0x0F]!
	);
}

function sha256Base64(...parts: Uint8Array[]): string {
	const totalLength = parts.reduce((n, p) => n + p.length, 0);
	const input = new Uint8Array(totalLength);

	let offset = 0;
	for (const part of parts) {
		input.set(part, offset);
		offset += part.length;
	}

	const digest = hexToBytes(sha256(input));

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
	sign(arg: string): string {
		if (arguments.length !== 1) {
			throw new Error('Wrong number of arguments');
		}
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

		return `${d0}${d1}${d2}` +
			sha256Base64(input, TABLE_A_BYTES[d0], TABLE_A_BYTES[d1], TABLE_B_BYTES[d2]);
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export class validator {
	private state: string = '';

	createNewMessage(arg: string): string {
		if (arguments.length !== 1) {
			throw new Error('Wrong number of arguments');
		}
		if (typeof arg !== 'string') {
			throw new Error('Wrong type of argment. Expects a string.');
		}

		const input = utf8(arg);
		if (input.length < 4) {
			return 'error';
		}

		const rand = new MsvcRand(seedFor(input));

		const length = (rand.next() % 50) + 30;
		const message = new Uint8Array(length);
		for (let i = 0; i < length; i++) {
			message[i] = 33 + (rand.next() % 93);
		}

		this.state = sha256Base64(message);
		return this.state;
	}

	validate(arg: string): 'ok' | 'error' {
		if (arguments.length !== 1) {
			throw new Error('Wrong number of arguments');
		}
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

		const expected = `${d0}${d1}${d2}` +
			sha256Base64(utf8(this.state), TABLE_A_BYTES[d0], TABLE_A_BYTES[d1], TABLE_B_BYTES[d2]);

		return arg === expected ? 'ok' : 'error';
	}
}

export default { signer, validator };
