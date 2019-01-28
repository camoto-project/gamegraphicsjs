/**
 * @file Command line interface to the library.
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
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

const fs = require('fs');
const commandLineArgs = require('command-line-args');
const GameGraphics = require('../index.js');
const Debug = require('../util/utl-debug.js');

class OperationsError extends Error {
}

class Operations
{
	constructor() {
		this.image = new GameGraphics.Image();
	}

	log(action, ...params) {
		console.log(action.padStart(12) + ':', ...params);
	}

	readFile(params) {
		if (!params.target) {
			throw new OperationsError('read: missing filename');
		}

		let handler;
		if (params.format) {
			handler = GameGraphics.getHandler(params.format);
			if (!handler) {
				throw new OperationsError('Invalid format code: ' + params.format);
			}
		}

		let content = {
			main: fs.readFileSync(params.target),
		};
		if (!handler) {
			let handlers = GameGraphics.findHandler(content.main);
			if (handlers.length === 0) {
				throw new OperationsError('read: unable to identify this file format.');
			}
			if (handlers.length > 1) {
				console.error('This file format could not be unambiguously identified.  It could be:');
				handlers.forEach(h => {
					const m = h.metadata();
					console.error(` * ${m.id} (${m.title})`);
				});
				throw new OperationsError('read: please use the -f option to specify the format.');
			}
			handler = handlers[0];
		}

		const suppList = handler.supps(params.target, content.main);
		if (suppList) Object.keys(suppList).forEach(id => {
			try {
				content[id] = fs.readFileSync(suppList[id]);
			} catch (e) {
				throw new OperationsError(`read: unable to open supplementary file `
					+ `"${suppList[id]}": ${e}`);
			}
		});

		return {
			image: handler.read(content),
			origFormat: handler.metadata().id,
		};
		//this.image = handler.read(content);
		//this.origFormat = handler.metadata().id;
	}

	read(params) {
		({ image: this.image, origFormat: this.origFormat } = this.readFile(params));
	}

	readpal(params) {
		const { image, origFormat } = this.readFile(params);
		if (image instanceof GameGraphics.Image) {
			this.image.palette = image.palette;
		} else if (image instanceof GameGraphics.Palette) {
			this.image.palette = image;
		}
	}

	async write(params) {
		if (!params.target) {
			throw new OperationsError('write: missing filename');
		}
		if (!params.format) params.format = this.origFormat;

		const handler = GameGraphics.getHandler(params.format);
		if (!handler) {
			throw new OperationsError('write: invalid format code: ' + params.format);
		}

		/*
		const problems = handler.checkLimits(this.image);
		if (problems.length) {
			console.log('There are problems preventing the requested changes from taking place:\n');
			for (let i = 0; i < problems.length; i++) {
				console.log((i + 1).toString().padStart(2) + ': ' + problems[i]);
			}
			console.log('\nPlease correct these issues and try again.\n');
			throw new OperationsError('write: cannot save due to file format limitations.');
		}
		*/

		console.warn('Writing to', params.target, 'as', params.format);
		const outContent = handler.write(this.image);

		let promises = [];
		const suppList = handler.supps(params.target, outContent.main);
		if (suppList) Object.keys(suppList).forEach(id => {
			console.warn(' - Saving supplemental file', suppList[id]);
			promises.push(
				fs.promises.writeFile(suppList[id], outContent[id])
			);
		});
		promises.push(fs.promises.writeFile(params.target, outContent.main));
		return Promise.all(promises);
	}

	async extract(params) {
		if (!params.target) {
			throw new OperationsError('extract: missing filename');
		}

		const targetName = params.target.toUpperCase(); // nearly always ASCII
		const targetFile = this.archive.files.find(file => file.name.toUpperCase() == targetName);
		if (!targetFile) {
			throw new OperationsError(`extract: archive does not contain "${params.target}"`);
		}
		let data;
		if (params.raw) {
			data = targetFile.getRaw();
		} else {
			data = targetFile.getContent();
		}
		this.log('extracting', params.target, params.name ? 'as ' + params.name : '');
		return fs.promises.writeFile(params.name || params.target, data);
	}

	identify(params) {
		if (!params.target) {
			throw new OperationsError('identify: missing filename');
		}
		Debug.mute(false);

		console.log('Autodetecting file format...');
		const content = {
			main: fs.readFileSync(params.target),
		};
		let handlers = GameArchive.findHandler(content.main);

		console.log(handlers.length + ' format handler(s) matched');
		if (handlers.length === 0) {
			console.log('No file format handlers were able to identify this file format, sorry.');
			return;
		}
		handlers.forEach(handler => {
			const m = handler.metadata();
			console.log(`\n>> Trying handler for ${m.id} (${m.title})`);

			try {
				const suppList = handler.supps(params.target, content.main);
				Object.keys(suppList).forEach(id => {
					try {
						content[id] = fs.readFileSync(suppList[id]);
					} catch (e) {
						throw new Error(`Unable to open supp file ${suppList[id]}:\n     ${e}`);
					}
				});
			} catch (e) {
				console.log(` - Skipping format due to error loading additional files `
					+ `required:\n   ${e}`);
				return;
			}

			const tempArch = handler.parse(content);
			console.log(' - Handler reports archive contains', tempArch.files.length, 'files.');
			if (tempArch.files.length > 0) {
				console.log(' - First filename is:', tempArch.files[0].name);
				if (tempArch.files.length > 1) {
					console.log(' - Second filename is:', tempArch.files[1].name);
				}
			}
		});

		Debug.mute(true);
	}
}

Operations.names = {
	extract: [
		{ name: 'name', alias: 'n' },
		{ name: 'raw', alias: 'r', type: Boolean },
		{ name: 'target', defaultOption: true },
	],
	identify: [
		{ name: 'target', defaultOption: true },
	],
	read: [
		{ name: 'format', alias: 'f' },
		{ name: 'target', defaultOption: true },
	],
	readpal: [
		{ name: 'format', alias: 'f' },
		{ name: 'target', defaultOption: true },
	],
	write: [
		{ name: 'format', alias: 'f' },
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
	GameGraphics.listHandlers().forEach(handler => {
		const md = handler.metadata();
		console.log(`${md.id}: ${md.title}`);
		if (md.params) Object.keys(md.params).forEach(p => {
			console.log(`  * ${p}: ${md.params[p]}`);
		});
	});
}

async function processCommands()
{
	let cmdDefinitions = [
		{ name: 'debug', type: Boolean },
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

	if (cmd.debug) Debug.mute(false);

	if (!cmd.name || cmd.help) {
		// No params, show help.
		console.log(`Use: gamegfx --formats | [--debug] [command1 [command2...]]

Options:

  --formats
    List all available file formats.

  --debug
    Show additional debug information for troubleshooting.

Commands:

  identify <file>
    Read local <file> and try to work out what image format it is in.

  read [-t format] <file>
    Read <file> from the local filesystem and load it into memory.

  readpal [-t format] <file>
    Use a different palette for the in-memory image, read from <file>.  To save
    a palette on its own, use the 'write' command and specify a palette format.

  write -t <format> <file>
    Write the in-memory image to the local file <file>, in the given format.

Examples:

  gamegfx read -t img-raw-vga vga.bin write -t img-png vga.png
`);
		return;
	}

	let proc = new Operations();
	//	while (argv.length > 2) {
	while (cmd.name) {
		const def = Operations.names[cmd.name];
		if (def) {
			const runOptions = commandLineArgs(def, { argv, stopAtFirstUnknown: true });
			argv = runOptions._unknown || [];
			try {
				proc[cmd.name](runOptions);
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

processCommands();
