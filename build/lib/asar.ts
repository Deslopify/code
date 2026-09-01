/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'path';
import es from 'event-stream';
import pickle from 'chromium-pickle-js';
import Filesystem from 'asar/lib/filesystem.js';
import VinylFile from 'vinyl';
import minimatch from 'minimatch';

export function createAsar(folderPath: string, unpackGlobs: string[], skipGlobs: string[], duplicateGlobs: string[], destFilename: string): NodeJS.ReadWriteStream {

	const shouldUnpackFile = (file: VinylFile): boolean => {
		for (let i = 0; i < unpackGlobs.length; i++) {
			if (minimatch(file.relative, unpackGlobs[i])) {
				return true;
			}
		}
		return false;
	};

	const shouldSkipFile = (file: VinylFile): boolean => {
		for (const skipGlob of skipGlobs) {
			if (minimatch(file.relative, skipGlob)) {
				return true;
			}
		}
		return false;
	};

	// Files that should be duplicated between
	// node_modules.asar and node_modules
	const shouldDuplicateFile = (file: VinylFile): boolean => {
		for (const duplicateGlob of duplicateGlobs) {
			if (minimatch(file.relative, duplicateGlob)) {
				return true;
			}
		}
		return false;
	};

	const filesystem = new Filesystem(folderPath);
	const out: Buffer[] = [];

	// Keep track of pending inserts
	let pendingInserts = 0;
	let onFileInserted = () => { pendingInserts--; };

	// Do not insert twice the same directory
	const seenDir: { [key: string]: boolean } = {};
	const insertDirectoryRecursive = (dir: string) => {
		const normalizedDir = dir.replace(/\\/g, '/');
		if (seenDir[normalizedDir]) {
			return;
		}

		const lastSlash = normalizedDir.lastIndexOf('/');
		if (lastSlash !== -1) {
			insertDirectoryRecursive(normalizedDir.substring(0, lastSlash));
		}
		seenDir[normalizedDir] = true;
		filesystem.insertDirectory(normalizedDir);
	};

	const insertDirectoryForFile = (file: string) => {
		const normalizedFile = file.replace(/\\/g, '/');
		const lastSlash = normalizedFile.lastIndexOf('/');
		if (lastSlash !== -1) {
			insertDirectoryRecursive(normalizedFile.substring(0, lastSlash));
		}
	};

	const insertFile = (relativePath: string, stat: { size: number; mode: number }, shouldUnpack: boolean) => {
		const normalizedPath = relativePath.replace(/\\/g, '/');
		insertDirectoryForFile(normalizedPath);
		pendingInserts++;
		filesystem.insertFile(normalizedPath, shouldUnpack, { stat: stat }, {}).then(() => onFileInserted(), () => onFileInserted());
	};

	return es.through(function (file) {
		if (file.stat.isDirectory()) {
			return;
		}
		if (!file.stat.isFile()) {
			throw new Error(`unknown item in stream!`);
		}
		if (shouldSkipFile(file)) {
			this.queue(new VinylFile({
				base: '.',
				path: file.path,
				stat: file.stat,
				contents: file.contents
			}));
			return;
		}
		if (shouldDuplicateFile(file)) {
			this.queue(new VinylFile({
				base: '.',
				path: file.path,
				stat: file.stat,
				contents: file.contents
			}));
		}
		const shouldUnpack = shouldUnpackFile(file);
		insertFile(file.relative, { size: file.contents.length, mode: file.stat.mode }, shouldUnpack);

		if (shouldUnpack) {
			// The file goes outside of xx.asar, in a folder xx.asar.unpacked
			const relative = path.relative(folderPath, file.path);
			this.queue(new VinylFile({
				base: '.',
				path: path.join(destFilename + '.unpacked', relative),
				stat: file.stat,
				contents: file.contents
			}));
		} else {
			// The file goes inside of xx.asar
			out.push(file.contents);
		}
	}, function () {

		const finish = () => {
			{
				const headerPickle = pickle.createEmpty();
				headerPickle.writeString(JSON.stringify(filesystem.header));
				const headerBuf = headerPickle.toBuffer();

				const sizePickle = pickle.createEmpty();
				sizePickle.writeUInt32(headerBuf.length);
				const sizeBuf = sizePickle.toBuffer();

				out.unshift(headerBuf);
				out.unshift(sizeBuf);
			}

			const contents = Buffer.concat(out);
			out.length = 0;

			this.queue(new VinylFile({
				base: '.',
				path: destFilename,
				contents: contents
			}));
			this.queue(null);
		};

		// Call finish() only when all file inserts have finished...
		if (pendingInserts === 0) {
			finish();
		} else {
			onFileInserted = () => {
				pendingInserts--;
				if (pendingInserts === 0) {
					finish();
				}
			};
		}
	});
}
