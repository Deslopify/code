#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { argv, exit } from 'node:process';
import { createRequire } from 'node:module';

interface Section {
	name: string;
	addr: bigint;
	size: bigint;
	rawOffset: number;
	rawSize: number;
	exec: boolean;
}

interface ParsedBinary {
	format: string;
	imageBase: bigint;
	sections: Section[];
}

interface RunEntry {
	ptr: bigint;
	bytes: Buffer;
}

interface Run {
	section: Section;
	addr: bigint;
	entries: RunEntry[];
}

interface Candidate {
	run: Run;
	start: number;
	bytes: Buffer[];
}

interface VerificationResult {
	ok: boolean;
	skipped?: boolean;
	reason?: string;
}

interface ExtractOptions {
	verify?: boolean;
	requireVerify?: boolean;
}

interface Provenance {
	binary: string;
	size: number;
	sha256: string;
	format: string;
	date: string;
	verified: boolean;
	aAddr: string;
	aSection: string;
	bAddr: string;
	bSection: string;
}

interface ExtractResult {
	tables: { A: string[]; B: string[] };
	warnings: string[];
	fingerprints: Record<string, boolean>;
	verification: VerificationResult;
	provenance: Provenance;
}

interface ElfSectionHeader {
	name: number;
	type: number;
	flags: bigint;
	addr: bigint;
	offset: bigint;
	size: bigint;
}

interface VsdaModule {
	signer?: new () => { sign(input: string): string };
	validator?: new () => {
		createNewMessage(prefix: string): string;
		validate(sig: string): string;
	};
}

function parseBinary(buf: Buffer): ParsedBinary {
	if (buf.length < 64) {
		throw new Error('file too small to be a binary');
	}
	if (buf.readUInt16LE(0) === 0x5a4d /* MZ */) {
		return parsePE32(buf);
	}
	if (buf[0] === 0x7f && buf[1] === 0x45 /* ELF */) {
		return parseELF64(buf);
	}
	if (buf.readUInt32LE(0) === 0xfeedfacf || buf.readUInt32BE(0) === 0xfeedfacf) {
		return parseMachO64(buf);
	}
	throw new Error('unrecognized binary format (expected PE32+, ELF64 or Mach-O 64)');
}

function parsePE32(buf: Buffer): ParsedBinary {
	const peOff = buf.readUInt32LE(0x3c);
	if (buf.readUInt32LE(peOff) !== 0x00004550 /* 'PE\0\0' */) {
		throw new Error('bad PE signature');
	}
	const machine = buf.readUInt16LE(peOff + 4);
	const numSections = buf.readUInt16LE(peOff + 6);
	const optSize = buf.readUInt16LE(peOff + 20);
	const opt = peOff + 24;
	const magic = buf.readUInt16LE(opt);
	if (magic !== 0x20b) {
		throw new Error('only PE32+ (x64) binaries are supported, got PE32');
	}
	if (machine !== 0x8664) {
		throw new Error(`unexpected PE machine type 0x${machine.toString(16)} (expected AMD64 0x8664)`);
	}
	const imageBase = buf.readBigUInt64LE(opt + 24);
	const sections: Section[] = [];
	const secTable = opt + optSize;
	for (let i = 0; i < numSections; i++) {
		const s = secTable + i * 40;
		const name = buf.subarray(s, s + 8).toString('latin1').replace(/\0.*$/, '');
		const virtualSize = buf.readUInt32LE(s + 8);
		const virtualAddress = buf.readUInt32LE(s + 12);
		const sizeOfRawData = buf.readUInt32LE(s + 16);
		const pointerToRawData = buf.readUInt32LE(s + 20);
		const characteristics = buf.readUInt32LE(s + 36);
		sections.push({
			name,
			addr: imageBase + BigInt(virtualAddress),
			size: BigInt(Math.max(virtualSize, sizeOfRawData)),
			rawOffset: pointerToRawData,
			rawSize: sizeOfRawData,
			exec: (characteristics & 0x20000000) !== 0, // IMAGE_SCN_MEM_EXECUTE
		});
	}
	return { format: `PE32+ (x64), image base 0x${imageBase.toString(16)}`, imageBase, sections };
}

function parseELF64(buf: Buffer): ParsedBinary {
	if (buf[4] !== 2) { throw new Error('only ELF64 binaries are supported'); }
	if (buf[5] !== 1) { throw new Error('only little-endian ELF is supported'); }
	const shoff = buf.readBigUInt64LE(0x28);
	const shentsize = buf.readUInt16LE(0x3a);
	const shnum = buf.readUInt16LE(0x3c);
	const shstrndx = buf.readUInt16LE(0x3e);
	const headers: ElfSectionHeader[] = [];
	for (let i = 0; i < shnum; i++) {
		const h = Number(shoff) + i * shentsize;
		headers.push({
			name: buf.readUInt32LE(h),
			type: buf.readUInt32LE(h + 4),
			flags: buf.readBigUInt64LE(h + 8),
			addr: buf.readBigUInt64LE(h + 16),
			offset: buf.readBigUInt64LE(h + 24),
			size: buf.readBigUInt64LE(h + 32),
		});
	}
	const strtab = headers[shstrndx];
	const names = buf.subarray(Number(strtab.offset), Number(strtab.offset) + Number(strtab.size));
	const nameAt = (off: number): string => {
		const end = names.indexOf(0, off);
		return names.subarray(off, end).toString('latin1');
	};
	const sections: Section[] = [];
	for (const h of headers) {
		if (h.type !== 1 /* SHT_PROGBITS */ || h.size === 0n || h.addr === 0n || h.offset === 0n) {
			continue;
		}
		sections.push({
			name: nameAt(h.name),
			addr: h.addr,
			size: h.size,
			rawOffset: Number(h.offset),
			rawSize: Number(h.size),
			exec: (h.flags & 0x4n) !== 0n, // SHF_EXECINSTR
		});
	}
	return { format: 'ELF64 (shared object)', imageBase: 0n, sections };
}

function parseMachO64(buf: Buffer): ParsedBinary {
	const littleEndian = buf.readUInt32LE(0) === 0xfeedfacf;
	const rd32 = (off: number): number => littleEndian ? buf.readUInt32LE(off) : buf.readUInt32BE(off);
	const rd64 = (off: number): bigint => littleEndian ? buf.readBigUInt64LE(off) : buf.readBigUInt64BE(off);
	const ncmds = rd32(16);
	const sections: Section[] = [];
	let off = 32;
	for (let i = 0; i < ncmds; i++) {
		const cmd = rd32(off);
		const cmdsize = rd32(off + 4);
		if (cmd === 0x19 /* LC_SEGMENT_64 */) {
			const segname = buf.subarray(off + 8, off + 24).toString('latin1').replace(/\0.*$/, '');
			const fileoff = Number(rd64(off + 40));
			const nsects = rd32(off + 64);
			let secOff = off + 72;
			for (let j = 0; j < nsects; j++) {
				const sectname = buf.subarray(secOff, secOff + 16).toString('latin1').replace(/\0.*$/, '');
				const addr = rd64(secOff + 32);
				const size = rd64(secOff + 40);
				const secFileOff = rd32(secOff + 48);
				const flags = rd32(secOff + 64);
				sections.push({
					name: `${segname},${sectname}`,
					addr,
					size,
					rawOffset: secFileOff === 0 ? fileoff : secFileOff,
					rawSize: Number(size),
					exec: segname === '__TEXT' || (flags & 0x80000100) !== 0, // PURE|SOME_INSTRUCTIONS
				});
				secOff += 80; // sizeof(struct section_64)
			}
		}
		off += cmdsize;
	}
	return { format: `Mach-O 64 (${littleEndian ? 'LE' : 'BE'})`, imageBase: 0n, sections };
}

function locate(bin: ParsedBinary, va: bigint): { off: number; section: Section } | null {
	for (const s of bin.sections) {
		if (va >= s.addr && va < s.addr + s.size) {
			const delta = va - s.addr;
			if (delta >= BigInt(s.rawSize)) {
				return null; // in BSS / beyond raw data
			}
			return { off: s.rawOffset + Number(delta), section: s };
		}
	}
	return null;
}

function readPrintableString(
	buf: Buffer,
	bin: ParsedBinary,
	va: bigint,
	minLen: number,
	maxLen: number,
): Buffer | null {
	const loc = locate(bin, va);
	if (!loc || loc.section.exec) {
		return null;
	}
	const limit = Math.min(loc.off + maxLen, buf.length);
	let end = -1;
	for (let i = loc.off; i < limit; i++) {
		if (buf[i] === 0) { end = i; break; }
	}
	if (end < 0) { return null; }
	const len = end - loc.off;
	if (len < minLen) { return null; }
	const s = buf.subarray(loc.off, end);
	for (let i = 0; i < len; i++) {
		if (s[i] < 0x20 || s[i] > 0x7e) { return null; }
	}
	return s;
}

const STRING_MIN_LEN = 20;
const STRING_MAX_LEN = 512;

function findPointerRuns(buf: Buffer, bin: ParsedBinary): Run[] {
	const runs: Run[] = [];
	for (const section of bin.sections) {
		if (section.rawSize < 16 || section.exec) { continue; }
		let run: Run | null = null;
		const end = section.rawOffset + section.rawSize;
		for (let off = section.rawOffset; off + 8 <= end; off += 8) {
			const ptr = buf.readBigUInt64LE(off);
			const bytes = readPrintableString(buf, bin, ptr, STRING_MIN_LEN, STRING_MAX_LEN);
			if (bytes) {
				if (!run) {
					run = { section, addr: section.addr + BigInt(off - section.rawOffset), entries: [] };
					runs.push(run);
				}
				run.entries.push({ ptr, bytes });
			} else {
				run = null;
			}
		}
	}
	return runs;
}

function letterRatio(bytes: Buffer): number {
	let n = 0;
	for (const b of bytes) {
		const c = String.fromCharCode(b);
		if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === ' ') {
			n++;
		}
	}
	return n / bytes.length;
}

function spaceCount(bytes: Buffer): number {
	let n = 0;
	for (const b of bytes) { if (b === 0x20) { n++; } }
	return n;
}

function isProse(bytes: Buffer): boolean {
	return letterRatio(bytes) >= 0.90 && spaceCount(bytes) >= 2;
}

const STRONG_SYMBOLS = new Set('!$%*+=?@[]{}\\^`|~<>'.split('').map(c => c.charCodeAt(0)));

function isSoup(bytes: Buffer): boolean {
	if (letterRatio(bytes) > 0.85) { return false; }
	const strong = new Set<number>();
	for (const b of bytes) {
		if (STRONG_SYMBOLS.has(b)) { strong.add(b); }
	}
	return strong.size >= 4;
}

function buildCandidates(runs: Run[], warnings: string[]): { a: Candidate[]; b: Candidate[] } {
	const a: Candidate[] = [];
	const b: Candidate[] = [];
	for (const run of runs) {
		const entries = run.entries;
		const prose = entries.filter(e => isProse(e.bytes)).length;
		const soup = entries.filter(e => isSoup(e.bytes)).length;
		if (prose >= Math.ceil(entries.length * 0.8) && entries.length >= 10) {
			if (entries.length > 10) {
				warnings.push(`prose run at 0x${run.addr.toString(16)} has ${entries.length} entries (expected 10) - trying all windows`);
			}
			for (let start = 0; start + 10 <= entries.length; start++) {
				a.push({ run, start, bytes: entries.slice(start, start + 10).map(e => e.bytes) });
			}
		} else if (soup >= Math.ceil(entries.length * 0.8) && entries.length >= 10) {
			const windowLen = Math.min(entries.length, 11);
			if (entries.length !== 11) {
				warnings.push(`obfuscated run at 0x${run.addr.toString(16)} has ${entries.length} entries (expected 11) - using ${windowLen}`);
			}
			for (let start = 0; start + windowLen <= entries.length; start++) {
				b.push({ run, start, bytes: entries.slice(start, start + windowLen).map(e => e.bytes) });
			}
		}
	}
	return { a, b };
}

async function loadModule(binaryPath: string): Promise<VsdaModule | null> {
	try {
		const require = createRequire(import.meta.url);
		const mod = require(resolve(binaryPath));
		return (mod.default ?? mod) as VsdaModule;
	} catch {
		return null;
	}
}

async function verifyTables(
	binaryPath: string,
	aBytes: string[],
	bBytes: string[],
): Promise<VerificationResult> {
	const vsda = await loadModule(binaryPath);
	if (!vsda || !vsda.signer || !vsda.validator) {
		return { ok: false, skipped: true, reason: 'module could not be loaded (wrong platform/arch?)' };
	}
	const A = aBytes.map(s => Buffer.from(s, 'latin1'));
	const B = bBytes.map(s => Buffer.from(s, 'latin1'));

	const sign = (input: string, d0: number, d1: number, d2: number): string =>
		`${d0}${d1}${d2}` + createHash('sha256')
			.update(Buffer.concat([Buffer.from(input, 'utf8'), A[d0], A[d1], B[d2]]))
			.digest('base64');

	const signer = new vsda.signer();
	for (const input of ['hello world', 'abcd', '0123456789abcdef']) {
		const sig = signer.sign(input);
		if (typeof sig !== 'string' || !/^[0-9]{3}/.test(sig) || sig.length !== 47) {
			return { ok: false, reason: `sign(${JSON.stringify(input)}) returned ${JSON.stringify(sig)} - unexpected format` };
		}
		let hit = false;
		for (let d0 = 0; d0 < 10 && !hit; d0++) {
			for (let d1 = 0; d1 < 10 && !hit; d1++) {
				for (let d2 = 0; d2 < 10 && !hit; d2++) {
					if (sign(input, d0, d1, d2) === sig) { hit = true; }
				}
			}
		}
		if (!hit) {
			return { ok: false, reason: `no digit combination reproduces the signature for input ${JSON.stringify(input)}` };
		}
	}

	const validator = new vsda.validator();
	const message = validator.createNewMessage('extract-tables-verification');
	if (typeof message !== 'string' || message.length !== 44) {
		return { ok: false, reason: `createNewMessage() returned ${JSON.stringify(message)}` };
	}
	for (const digits of [[0, 0, 0], [9, 9, 9], [3, 7, 5]]) {
		const expected = `${digits[0]}${digits[1]}${digits[2]}` + createHash('sha256')
			.update(Buffer.concat([Buffer.from(message, 'latin1'), A[digits[0]], A[digits[1]], B[digits[2]]]))
			.digest('base64');
		if (validator.validate(expected) !== 'ok') {
			return { ok: false, reason: `validate() rejected the signature reconstructed for digits ${digits.join('')}` };
		}
	}
	if (validator.validate('000' + 'x'.repeat(44)) === 'ok') {
		return { ok: false, reason: 'validate() accepted a junk signature' };
	}
	return { ok: true };
}

function fingerprintAlgorithm(buf: Buffer): Record<string, boolean> {
	const patterns: Record<string, number[]> = {
		'SHA-256 constant K[0] (0x428a2f98)': [0x98, 0x2f, 0x8a, 0x42],
		'SHA-256 constant K[63] (0xc67178f2)': [0xf2, 0x78, 0x71, 0xc6],
		'SHA-256 IV a (0x6a09e667)': [0x67, 0xe6, 0x09, 0x6a],
		'MSVC rand multiplier 0x343FD': [0xfd, 0x43, 0x03, 0x00],
		'MSVC rand increment 0x269EC3': [0xc3, 0x9e, 0x26, 0x00],
		'divide-by-10 magic 0x66666667': [0x67, 0x66, 0x66, 0x66],
		'divide-by-50 magic 0x51EB851F': [0x1f, 0x85, 0xeb, 0x51],
		'divide-by-93 magic 0x2C0B02C1': [0xc1, 0x02, 0x0b, 0x2c],
	};
	const result: Record<string, boolean> = {};
	for (const [name, bytes] of Object.entries(patterns)) {
		result[name] = buf.includes(Buffer.from(bytes));
	}
	return result;
}

function toLiteral(str: string): string {
	let out = '\'';
	for (let i = 0; i < str.length; i++) {
		const b = str.charCodeAt(i); // latin1: code unit == byte value
		if (b === 0x27) { out += '\\\''; }
		else if (b === 0x5c) { out += '\\\\'; }
		else if (b >= 0x20 && b <= 0x7e) { out += String.fromCharCode(b); }
		else { out += '\\x' + b.toString(16).padStart(2, '0'); }
	}
	return out + '\'';
}

function tableLiteral(strings: string[], indent = '\t'): string {
	const lines = strings.map(s => `${indent}${toLiteral(s)},`);
	return '[\n' + lines.join('\n') + '\n' + indent.slice(0, -1) + ']';
}

function generateFiles(result: ExtractResult): { ts: string; js: string } {
	const { tables } = result;
	const ts =
		`export const TABLE_A: readonly string[] = ${tableLiteral(tables.A)};\n` +
		`export const TABLE_B: readonly string[] = ${tableLiteral(tables.B)};\n`;
	const js = `export const TABLE_A = ${tableLiteral(tables.A)};\n\nexport const TABLE_B = ${tableLiteral(tables.B)};\n`;
	return { ts, js };
}

export async function extractTables(binaryPath: string, opts: ExtractOptions = {}): Promise<ExtractResult> {
	const verify = opts.verify !== false;
	const buf = readFileSync(binaryPath);
	const bin = parseBinary(buf);
	const warnings: string[] = [];
	const fingerprints = fingerprintAlgorithm(buf);
	const missing = Object.entries(fingerprints).filter(([, ok]) => !ok).map(([name]) => name);
	if (missing.length > 0) {
		warnings.push(`algorithm fingerprints not found in binary: ${missing.join('; ')} - the algorithm may have changed; re-analyze before trusting vsda.ts`);
	}

	const runs = findPointerRuns(buf, bin);
	const { a: aCandidates, b: bCandidates } = buildCandidates(runs, warnings);

	if (aCandidates.length === 0 || bCandidates.length === 0) {
		throw new Error(
			`could not find the key tables structurally (prose candidates: ${aCandidates.length}, ` +
			`obfuscated candidates: ${bCandidates.length}, pointer runs: ${runs.length}). ` +
			'The table format may have changed - manual re-analysis of the binary is needed.');
	}

	let selected: { a: Candidate; b: Candidate; verification: VerificationResult } | null = null;
	let verification: VerificationResult = { ok: false, skipped: true, reason: 'not attempted' };

	if (verify) {
		outer:
		for (const a of aCandidates) {
			for (const b of bCandidates) {
				verification = await verifyTables(binaryPath,
					a.bytes.map(x => x.toString('latin1')),
					b.bytes.map(x => x.toString('latin1')));
				if (verification.ok) {
					selected = { a, b, verification };
					break outer;
				}
			}
		}
	}

	if (!selected) {
		if (verify && !verification.skipped) {
			throw new Error(`live verification failed: ${verification.reason}. ` +
				'The tables or the wire format changed - vsda.ts needs re-analysis.');
		}
		if (aCandidates.length !== 1 || bCandidates.length !== 1) {
			throw new Error(
				`ambiguous tables without live verification (${aCandidates.length} prose / ` +
				`${bCandidates.length} obfuscated candidates). Run on a machine where the module loads, ` +
				'or inspect candidates via --json.');
		}
		if (opts.requireVerify) {
			throw new Error(`live verification was required but unavailable: ${verification.reason}`);
		}
		selected = { a: aCandidates[0], b: bCandidates[0], verification };
		warnings.push('tables extracted statically without live verification - run `node test-parity.mjs` where the module loads to confirm');
	}

	const tables = {
		A: selected.a.bytes.map(x => x.toString('latin1')),
		B: selected.b.bytes.map(x => x.toString('latin1')),
	};

	return {
		tables,
		warnings,
		fingerprints,
		verification: selected.verification,
		provenance: {
			binary: resolve(binaryPath),
			size: buf.length,
			sha256: createHash('sha256').update(buf).digest('hex'),
			format: bin.format,
			date: new Date().toISOString(),
			verified: selected.verification.ok === true,
			aAddr: `0x${(selected.a.run.addr + BigInt(selected.a.start) * 8n).toString(16)}`,
			aSection: selected.a.run.section.name,
			bAddr: `0x${(selected.b.run.addr + BigInt(selected.b.start) * 8n).toString(16)}`,
			bSection: selected.b.run.section.name,
		},
	};
}

export { parseBinary, findPointerRuns, buildCandidates, isProse, isSoup };

function usage(): void {
	console.log('usage: node extract-tables.mjs [path-to-vsda.node] [--out <base>] [--json] [--no-verify] [--require-verify]');
}

async function main(): Promise<void> {
	const args = argv.slice(2);
	let binary: string | null = null;
	let out = 'src/vsda.tables';
	let json = false;
	let verify = true;
	let requireVerify = false;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '--json') { json = true; }
		else if (arg === '--no-verify') { verify = false; }
		else if (arg === '--require-verify') { requireVerify = true; }
		else if (arg === '--out') { out = args[++i]; if (out === undefined) { usage(); exit(2); } }
		else if (arg === '--help' || arg === '-h') { usage(); exit(0); }
		else if (arg.startsWith('--')) { console.error(`unknown option ${arg}`); usage(); exit(2); }
		else { binary = arg; }
	}
	binary ??= 'vsda.node';

	try {
		const result = await extractTables(binary, { verify, requireVerify });

		for (const w of result.warnings) {
			console.warn(`warning: ${w}`);
		}

		if (json) {
			console.log(JSON.stringify({
				tables: result.tables,
				provenance: result.provenance,
				verification: result.verification,
				warnings: result.warnings,
			}, null, 2));
			return;
		}

		const { ts } = generateFiles(result);
		writeFileSync(`${out}.ts`, ts);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`error: ${message}`);
		exit(1);
	}
}

if (import.meta.url === pathToFileURL(resolve(argv[1] ?? '')).href) {
	await main();
}
