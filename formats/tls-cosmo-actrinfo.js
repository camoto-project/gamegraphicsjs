/*
 * Cosmo's Cosmic Adventure actor tileset handler.
 *
 * This file format is fully documented on the ModdingWiki:
 *   https://moddingwiki.shikadi.net/wiki/Cosmo_Tileset_Format
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

const FORMAT_ID = 'tls-cosmo-actrinfo';

import Debug from '../util/debug.js';
const debug = Debug.extend(FORMAT_ID);

import { RecordBuffer, RecordType } from '@camoto/record-io-buffer';
import { getBasename, replaceBasename } from '../util/supp.js';
import ImageHandler from '../interface/imageHandler.js';
import Image from '../interface/image.js';
import Frame from '../interface/frame.js';
import { fromPlanar, toPlanar } from '../util/frame-planar.js';
import { frameFromTileset, tilesetFromFrame } from '../util/frame-from_tileset.js';
import { paletteCGA16 } from '../util/palette-default.js';

const BYTES_PER_TILE = 8 * 5;

const recordTypes = {
	actorHeader: {
		height: RecordType.int.u16le,
		width: RecordType.int.u16le,
		frameOffset: RecordType.int.u32le,
	},
};

export default class Tileset_Cosmo_Masked extends ImageHandler
{
	static metadata() {
		let md = {
			...super.metadata(),
			id: FORMAT_ID,
			title: 'Cosmo\'s Cosmic Adventure Actor Tileset',
		};

		md.limits.minimumSize.x = 8;
		md.limits.minimumSize.y = 8;
		md.limits.maximumSize.x = undefined;
		md.limits.maximumSize.y = undefined;
		md.limits.sizePerFrame = true;
		md.limits.multipleSize.x = 8;
		md.limits.multipleSize.y = 8;
		md.limits.depth = 5;
		md.limits.hasPalette = false;
		md.limits.frameCount.min = 0; // some actors are empty?
		md.limits.frameCount.max = undefined; // no maximum
		md.limits.imageCount.min = 1;
		md.limits.imageCount.max = undefined; // no maximum

		return md;
	}

	static supps(name) {
		const basename = getBasename(name);
		return {
			info: replaceBasename(
				name,
				{
					'actors': 'actrinfo',
					'player': 'plyrinfo',
					'cartoon': 'cartinfo',
				}[basename] || `${basename}info`
			),
		};
	}

	static identify() {
		return {
			valid: undefined,
			reason: `Unable to autodetect without associated *INFO.MNI file.`,
		};
	}

	static read({main: contentTiles, info: contentFat}) {
		const tileW = 8, tileH = 8;

		if (!contentFat) {
			throw new Error('BUG: Caller did not supply suppdata for *info.mni');
		}

		let fat = new RecordBuffer(contentFat);
		let offset = fat.read(RecordType.int.u16le);
		let offsets = [];
		do {
			offset *= 2; // units of uint16le
			offsets.push(offset);
			offset = fat.read(RecordType.int.u16le);
			// Keep reading until we reach the first entry's offset.
		} while (offsets.length * 2 < offsets[0]);
		offsets.push(contentFat.length);

		let palette = paletteCGA16();

		// Add an entry for transparent.
		palette.push([255, 0, 255, 0]);

		let finalTileset = [];

		for (let actorIndex = 0; actorIndex < offsets.length - 1; actorIndex++) {
			const offset = offsets[actorIndex];
			const endOffset = offsets[actorIndex + 1];
			const numActorFrames = (endOffset - offset) / 8;
			fat.seekAbs(offset);

			let img = new Image({
				width: undefined,
				height: undefined,
				palette,
			});

			for (let actorFrame = 0; actorFrame < numActorFrames; actorFrame++) {
				let header = fat.readRecord(recordTypes.actorHeader);

				const tileCount = header.width * header.height;
				let imgActorTiles = new Image({
					width: tileW,
					height: tileH,
					//frames: sourceFrames.slice(tileIndex, tileIndex + tileCount),
					palette,
				});

				// The offsets assume 65535-byte blocks loaded into 65536-byte buffers, so
				// we need to remove one byte every 65536.
				const byteOffset = (
					header.frameOffset - ((header.frameOffset / 65536) >>> 0)
				);

				// Work out how many bytes in the tileset are used for this actor image.
				const lenTileData = tileCount * BYTES_PER_TILE;
				// Decode the frames.  We can't do this in bulk because there is padding
				// data in the middle of the tileset.
				const pixels = fromPlanar({
					content: contentTiles.slice(byteOffset, byteOffset + lenTileData),
					planeCount: 5,
					planeWidth: 8,
					lineWidth: 8,
					planeValues: [16, 1, 2, 4, 8],
					byteOrderMSB: true,
				});

				// Convert any colour over 15 to transparent.
				for (let p = 0; p < pixels.length; p++) {
					pixels[p] = Math.min(16, pixels[p]);
				}

				// Convert the pixel data into a frame.  It is an image one tile wide by
				// multiple tiles tall.
				const tilesFrame = new Frame({
					width: tileW,
					height: (pixels.length / tileW) >>> 0,
					pixels,
				});

				// tilesetFromFrame() needs a list of tiles to process.
				let tileDims = [];
				for (let i = 0; i < tileCount; i++) {
					tileDims.push({width: tileW, height: tileH});
				}

				// Split the single frame into individual tiles, with each tile as a
				// separate frame.
				imgActorTiles.frames = tilesetFromFrame({
					frame: tilesFrame,
					tileDims,
				});

				img.frames.push(
					frameFromTileset(imgActorTiles, header.width)
				);
			}
			finalTileset.push(img);
		}

		// Don't return an array if there's only one image.
		if (finalTileset.length === 1) {
			return finalTileset[0];
		}

		return finalTileset;
	}

	static write(images) {
		const tileW = 8, tileH = 8;

		// Create an array if we didn't get one.
		if (images.length === undefined) {
			images = [images];
		}

		let main = new RecordBuffer(4096);

		let actors = [];
		for (const img of images) {
			let frameInfo = [];
			let actorContent = new RecordBuffer(4096);
			for (const frame of img.frames) {
				// Convert pixels to tiles.
				const pxFrameWidth = frame.width || img.width;
				const pxFrameHeight = frame.height || img.height;
				const tlFrameWidth = (pxFrameWidth / 8) >>> 0;
				const tlFrameHeight = (pxFrameHeight / 8) >>> 0;

				frameInfo.push({
					width: tlFrameWidth,
					height: tlFrameHeight,
					frameOffset: actorContent.getPos(),
				});

				const tileCount = tlFrameWidth * tlFrameHeight;
				let tileDims = [];
				for (let i = 0; i < tileCount; i++) {
					tileDims.push({width: tileW, height: tileH});
				}

				// Convert the image back into a list of tiles.
				const tsFrame = tilesetFromFrame({
					frame,
					tileDims,
					// We need this in case the frame has no width and we're using the
					// image width instead.
					frameWidth: pxFrameWidth,
				});

				for (const frame of tsFrame) {
					const pixels = toPlanar({
						content: frame.pixels,
						planeCount: 5,
						planeWidth: 8,
						lineWidth: 8,
						planeValues: [16, 1, 2, 4, 8],
						byteOrderMSB: true,
					});

					actorContent.put(pixels);
				}
			}

			// Pad the output if needed.
			const currentIndex = Math.floor(main.length / 65535);
			const postIndex = Math.floor((main.length + actorContent.length) / 65535);
			if (currentIndex != postIndex) {
				// Writing this actor will wrap across a 64k boundary, so we have to pad.
				const lenPad = 65535 - (main.length % 65535);
				debug(`About to write ${actorContent.length} bytes at pos `
					+ `${main.length}, padding ${lenPad} bytes until 64 kB boundary`);
				main.write(RecordType.padding(lenPad));
			}

			// Update the offsets now padding has been done.
			const offMain = main.getPos();
			for (let i = 0; i < frameInfo.length; i++) {
				frameInfo[i].frameOffset += offMain;

				// The offsets assume 65535-byte blocks loaded into 65536-byte buffers, so
				// we need to remove one byte every 65536.
				frameInfo[i].frameOffset += ((frameInfo[i].frameOffset / 65536) >>> 0);
			}
			actors.push(frameInfo);
			main.put(actorContent);
		}

		let fatOffsets = [];
		let fatBody = new RecordBuffer(4096);
		for (const actor of actors) {
			fatOffsets.push(fatBody.getPos() / 2); // units of uint16le
			for (const frameInfo of actor) {
				fatBody.writeRecord(recordTypes.actorHeader, frameInfo);
			}
		}

		const offFatBody = fatOffsets.length; // units of uint16le
		let fat = new RecordBuffer(4096);
		for (const offActorHeader of fatOffsets) {
			fat.write(RecordType.int.u16le, offFatBody + offActorHeader);
		}
		fat.put(fatBody);

		return {
			content: {
				main: main.getU8(),
				info: fat.getU8(),
			},
			warnings: [],
		};
	}
}
