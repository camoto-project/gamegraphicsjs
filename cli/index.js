/*
 * Command line interface to the library.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import Debug from '../util/debug.js';
const debug = Debug.extend('cli');

import fs from 'fs';
import commandLineArgs from 'command-line-args';
import {
	Image,
	all as gamegraphicsFormats,
	findHandler as gamegraphicsFindHandler,
} from '../index.js';

class OperationsError extends Error {
}

class Operations
{
	constructor() {
		this.image = new Image();
	}

	log(action, ...params) {
		console.log(action.padStart(12) + ':', ...params);
	}

	parseOptions(md, opt) {
		if (!opt) return {};

		let result = {};
		opt.forEach(o => {
			const [name, value] = o.split('=');
			if (!md.options[name]) {
				throw new OperationsError(`Unknown option for ${md.id}: ${name}`);
			}
			result[name] = value;
		});

		return result;
	}

	readFile(params) {
		if (!params.target) {
			throw new OperationsError('read: missing filename');
		}

		let handler;
		if (params.format) {
			handler = gamegraphicsFormats.find(h => h.metadata().id === params.format);
			if (!handler) {
				throw new OperationsError(`Invalid format code: ${params.format}.`);
			}
		}

		let content = {
			main: fs.readFileSync(params.target),
		};
		if (!handler) {
			let handlers = gamegraphicsFindHandler(content.main, params.target);
			if (handlers.length === 0) {
				throw new OperationsError('read: unable to identify this file format.');
			}
			if (handlers.length > 1) {
				console.error('This file format could not be unambiguously identified.  It could be:');
				handlers.forEach(h => {
					const m = h.metadata();
					console.error(` * ${m.id} (${m.title})`);
				});
				throw new OperationsError('read: please use the -t option to specify the format.');
			}
			handler = handlers[0];
		}

		const suppList = handler.supps(params.target, content.main);
		if (suppList) {
			for (const [id, suppFilename] of Object.entries(suppList)) {
				debug(`Reading supp "${id}" from: ${suppFilename}`);
				try {
					content[id] = fs.readFileSync(suppFilename);
					content[id].filename = suppFilename;
				} catch (e) {
					throw new OperationsError(`read: unable to open supplementary file `
						+ `"${suppFilename}": ${e.message}`);
				}
			}
		}

		const md = handler.metadata();
		const options = this.parseOptions(md, params.options);

		return {
			image: handler.read(content, options),
			origFormat: md.id,
		};
	}

	read(params) {
		({ image: this.image, origFormat: this.origFormat } = this.readFile(params));
	}

	readpal(params) {
		const { image, origFormat } = this.readFile(params);
		const palNew = image.palette;
		if (!palNew) {
			throw new OperationsError('readpal: This file does not supply a palette.');
		}

		// Set the new palette globally for the image.
		this.image.palette = palNew;

		// Remove any per-frame palette overrides.
		for (const f of this.image.frames) {
			f.palette = null;
		}
		console.log(`Applied new "${origFormat}" palette.`);
	}

	async write(params) {
		if (!params.target) {
			throw new OperationsError('write: missing filename');
		}
		if (!params.format) params.format = this.origFormat;

		const handler = gamegraphicsFormats.find(h => h.metadata().id === params.format);
		if (!handler) {
			throw new OperationsError('write: invalid format code: ' + params.format);
		}

		const md = handler.metadata();
		const options = this.parseOptions(md, params.options);

		if (!params.force) {
			const problems = handler.checkLimits(this.image, options);
			if (problems.length) {
				console.log('There are problems preventing the requested changes from taking place:\n');
				for (let i = 0; i < problems.length; i++) {
					console.log((i + 1).toString().padStart(2) + ': ' + problems[i]);
				}
				console.log('\nPlease correct these issues and try again.\n');
				throw new OperationsError('write: cannot save due to file format limitations.');
			}
		}

		console.warn('Writing to', params.target, 'as', params.format);
		let outContent, warnings;
		try {
			({ content: outContent, warnings } = handler.write(this.image, options));
		} catch (e) {
			debug(e);
			throw new OperationsError(`save: write() failed - ${e.message}`);
		}

		let promises = [];
		const suppList = handler.supps(params.target, outContent.main);
		if (suppList) {
			for (const [id, suppFilename] of Object.entries(suppList)) {
				console.warn(` - Saving supplemental file "${id}" to ${suppFilename}`);
				promises.push(
					fs.promises.writeFile(suppFilename, outContent[id])
				);
			}
		}
		promises.push(fs.promises.writeFile(params.target, outContent.main));

		if (warnings.length) {
			console.log('There were warnings generated while saving:\n');
			for (let i in warnings) {
				console.log(((i >>> 0) + 1).toString().padStart(2) + '. ' + warnings[i]);
			}
		}

		return await Promise.all(promises);
	}

	identify(params) {
		if (!params.target) {
			throw new OperationsError('identify: missing filename');
		}

		console.log('Autodetecting file format...');
		const content = {
			main: fs.readFileSync(params.target),
		};
		let handlers = gamegraphicsFindHandler(content.main, params.target);

		console.log(handlers.length + ' format handler(s) matched');
		if (handlers.length === 0) {
			console.log('No file format handlers were able to identify this file format, sorry.');
			return;
		}
		for (const handler of handlers) {
			const m = handler.metadata();
			console.log(`\n>> Trying handler for ${m.id} (${m.title})`);

			try {
				const suppList = handler.supps(params.target, content.main);
				if (suppList) Object.keys(suppList).forEach(id => {
					try {
						content[id] = fs.readFileSync(suppList[id]);
					} catch (e) {
						throw new Error(`Unable to open supp file ${suppList[id]}:\n     ${e}`);
					}
				});
			} catch (e) {
				console.log(` - Skipping format due to error loading additional files `
					+ `required:\n   ${e}`);
				//throw e;
				continue;
			}

			const tempImg = handler.read(content);
			if (tempImg instanceof Image) {
				console.log(` - Handler reports file is a single image with dimensions `
					+ `${tempImg.width}x${tempImg.height}.`);
			} else {
				console.log(' - Handler reports file is a type that this utility does '
					+ 'not support:', tempImg.constructor.name);
			}
		}
	}

	info() {
		if (this.image.frames && this.image.frames.length === 0) {
			if (this.image.palette) {
				console.log('Type: Palette');
			} else {
				console.log('Type: Unknown (no frames or a palette)');
			}

		} else if (this.image.frames && this.image.frames.length === 1) {
			console.log('Type: Single image');
			const frameWidth = (this.image.frames[0].width === undefined) ? this.image.width : this.image.frames[0].width;
			const frameHeight = (this.image.frames[0].height === undefined) ? this.image.height : this.image.frames[0].height;
			console.log(`Size: ${frameWidth}x${frameHeight}`);

		} else if (this.image.frames) {
			const imgWithDelay = this.image.animation.find(i => i.postDelay !== undefined);
			if (imgWithDelay) {
				console.log('Type: Image list (animation)');
				console.log(`Number of frames: ${this.image.frames.length}`);

				let strDims = 'None';
				if ((this.image.width !== undefined) && (this.image.height !== undefined)) {
					strDims = this.image.width + 'x' + this.image.height;
				}
				console.log('Image dimensions:', strDims);

				for (let f = 0; f < this.image.frames.length; f++) {
					const frame = this.image.frames[f];

					let strDims = '(inherit from image)';
					if ((frame.width !== undefined) && (frame.height !== undefined)) {
						strDims = frame.width + 'x' + frame.height;
					}
					console.log(` - Frame ${f}: ${strDims}`);
				}

				for (let i = 0; i < this.image.animation.length; i++) {
					const anim = this.image.animation[i];
					console.log(` - Animation tick ${i}: Draw frame ${anim.index}, wait ${anim.postDelay} ms`);
				}

			} else {
				console.log('Type: Image list (tileset)');
				console.log(`Number of top-level images: ${this.image.frames.length}`);
				const fnCount = i => {
					let n = i.length;
					for (const j of i) {
						if (j instanceof Array) {
							n += fnCount(j);
						}
					}
					return n;
				};
				const totalImages = fnCount(this.image.frames);
				console.log(`Total number of images: ${totalImages}`);
			}

		} else {
			console.log('Type: Image array');

			// Make it always an array.
			let tileset;
			if (this.image.frames) {
				tileset = [this.image];
			} else {
				tileset = this.image;
			}

			for (let imgIndex = 0; imgIndex < tileset.length; imgIndex++) {
				const img = tileset[imgIndex];

				const fnList = (img, parentWidth, parentHeight, prefix = '') => {
					for (let i = 0; i < img.length; i++) {
						const j = img[i];
						const width = j.width || parentWidth;
						const height = j.height || parentHeight;
						if (j instanceof Array) {
							fnList(j, width, height, `${prefix}${i}.`);
						} else {
							let suffix = '';
							if (j.frames) {
								const imgWithDelay = j.frames.find(i => i.postDelay !== undefined);
								if (imgWithDelay) {
									suffix = ' (animation)';
								}
							}
							console.log(`${prefix}${i}: ${width}x${height}${suffix}`);
						}
					}
				};
				fnList(img.frames, img.width, img.height, `${imgIndex}.`);
			} // for (each image in array)
		} // if (image type)
	}

	select(params) {
		if (!params.target) {
			throw new OperationsError('select: missing image frame index (e.g. 1.2.3).');
		}

		function findIndex(img, indices, count) {
			let selProg = '';
			for (const i of indices) {
				const selIndex = parseInt(i, 10);
				if (img.frames) {
					if (selIndex >= img.frames.length) {
						throw new OperationsError(`select: invalid index "${params.target}", `
																			+ `item "${selProg.slice(1)}" does not have a ".${i}".`);
					}
					img = img.clone(selIndex, count);
				} else {
					img = img[selIndex];
				}
				selProg += `.${i}`;
			}
			return img;
		}

		const [ from, to ] = params.target.split(',');
		const count = parseInt(to, 10) || 1;
		this.image = findIndex(this.image, from.split('.'), count);
		console.log(`Selected ${this.image.frames.length} frame(s)`);
	}
}

Operations.names = {
	identify: [
		{ name: 'target', defaultOption: true },
	],
	info: [],
	read: [
		{ name: 'format', alias: 't' },
		{ name: 'options', alias: 'o', lazyMultiple: true },
		{ name: 'target', defaultOption: true },
	],
	readpal: [
		{ name: 'format', alias: 't' },
		{ name: 'options', alias: 'o', lazyMultiple: true },
		{ name: 'target', defaultOption: true },
	],
	select: [
		{ name: 'target', defaultOption: true },
	],
	write: [
		{ name: 'force', alias: 'f', type: Boolean },
		{ name: 'format', alias: 't' },
		{ name: 'options', alias: 'o', lazyMultiple: true },
		{ name: 'target', defaultOption: true },
	],
};

// Make some alises
const aliases = {
//	list: ['dir', 'ls'],
};
Object.keys(aliases).forEach(cmd => {
	aliases[cmd].forEach(alias => {
		Operations.names[alias] = Operations.names[cmd];
		Operations.prototype[alias] = Operations.prototype[cmd];
	});
});

function listFormats()
{
	for (const handler of gamegraphicsFormats) {
		const md = handler.metadata();
		console.log(`${md.id}: ${md.title}`);
		if (md.options) Object.keys(md.options).forEach(p => {
			console.log(`  * ${p}: ${md.options[p]}`);
		});
	}
}

async function processCommands()
{
	let cmdDefinitions = [
		{ name: 'help', type: Boolean },
		{ name: 'formats', type: Boolean },
		{ name: 'name', defaultOption: true },
	];
	let argv = process.argv;

	let cmd = commandLineArgs(cmdDefinitions, { argv, stopAtFirstUnknown: true });
	argv = cmd._unknown || [];

	if (cmd.formats) {
		listFormats();
		return;
	}

	if (!cmd.name || cmd.help) {
		// No params, show help.
		console.log(`Use: gamegfx --formats | [--debug] [command1 [command2...]]

Options:

  --formats
    List all available file formats.

Commands:

  identify <file>
    Read local <file> and try to work out what image format it is in.

  info
    Show details of last image read by 'read'.

  read [-t format] [-o option1=value [-o option2=value [...]] <file>
    Read <file> from the local filesystem and load it into memory. See
    --formats for available formats and options.

  readpal [-t format] [-o option1=value [-o option2=value [...]] <file>
    Use a different palette for the in-memory image, read from <file>.  To save
    a palette on its own, use the 'write' command and specify a palette format.

  select <index>
    Select an image from a list.  <index> is the number shown by 'info', e.g.
    0 for the first frame, 6.2.4.1 for a nested frame.

  write [-f] -t <format> <file>
    Write the in-memory image to the local file <file>, in the given format.
    -f forces writing even if there are warnings.

Examples:

  gamegfx read -t img-raw-vga -o width=320 vga.bin write -t img-png vga.png

  # The DEBUG environment variable can be used for troubleshooting.
  DEBUG='gamegraphics:*' gamegfx ...
`);
		return;
	}

	let proc = new Operations();
	//	while (argv.length > 2) {
	while (cmd.name) {
		const def = Operations.names[cmd.name];
		if (def) {
			let runOptions;
			try {
				runOptions = commandLineArgs(def, { argv, stopAtFirstUnknown: true });
			} catch (e) {
				console.error(`Error processing command line: ${e.message}`);
				process.exit(1);
			}
			argv = runOptions._unknown || [];
			try {
				await proc[cmd.name](runOptions);
			} catch (e) {
				if (e instanceof OperationsError) {
					console.error(e.message);
					process.exit(2);
				}
				throw e;
			}
		} else {
			console.error(`Unknown command: ${cmd.name}`);
			process.exit(1);
		}
		cmd = commandLineArgs(cmdDefinitions, { argv, stopAtFirstUnknown: true });
		argv = cmd._unknown || [];
	}
}

export default processCommands;
