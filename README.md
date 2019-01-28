# gamegraphics.js
Copyright 2018-2019 Adam Nielsen <<malvineous@shikadi.net>>  

This is a Javascript library that can read and write the custom image formats
used by many MS-DOS games from the 1990s.  Both single-image files as well as
multi-image tilesets are supported.  This library is an attempt to provide a
unified interface for reading and writing these unique file formats.

## Installation as an end-user

If you wish to use the command-line `gamearch` utility to work with
game archives directly, you can install the library globally on your
system:

    npm install -g @malvineous/gamegraphics

### Command line interface

The `gamegfx` utility can be used to manipulate graphics files.  Commands are
specified one after the other as parameters.  Use the `--help` option to get a
list of all the available commands.  Some quick examples:

    # Convert a single image from one format to another
    gamegfx read apogee.pcx write -t img-png apogee.png
    
    # Apply a palette during conversion, for those formats that store the
    # palette in an separate file.
    gamegfx read apogee.raw readpal apogee.pal write -t img-png apogee.png

To get a list of supported file formats, run:

    gamegfx --formats

## Installation as a dependency

If you wish to make use of the library in your own project, install it
in the usual way:

    npm install @malvineous/gamegraphics

See `cli/index.js` for example use.  The quick start is:

    const GameGraphics = require('@malvineous/gamegraphics');
    
    // Some formats take options.  These are usually values that can vary
    // between files, but they aren't stored in the file itself so they can't
    // easily be deduced automatically.  Options are specific to the selected
    // format handler.
    const options = {
      width: 320,
      height: 200,
    };
    
    // Read an image into memory
    const handler = GameGraphics.getHandler('img-raw-vga');
    const content = fs.readFileSync('image.raw');
    let image = handler.read(content, options);
    
    // Change a pixel
    image.pixels[0] = 5;
    
    // Write the image back to disk with the modifications
    const outBuffer = handler.write(image);
    fs.writeFileSync('out.raw', outBuffer);

## Installation as a contributor

If you would like to help add more file formats to the library, great!
Clone the repo, and to get started:

    npm install --dev

Run the tests to make sure everything worked:

    npm test

You're ready to go!  To add a new file format:

 1. Create a new file in the `images/`, `/palettes` or `/tilesets` folder for
    your format.  Copying an existing file that covers a similar format will
    help considerably.  If you're not sure, `images/img-raw-vga.js` is a good
    starting point as it is fairly simple.
    
 2. Edit the main `index.js` and add a `require()` statement for your new file.
    
 3. Make a folder in `test/` for your new format and populate it with
    files similar to the other formats.  The tests work by creating
    a standard image/palette/tileset with some preset content, and
    comparing the result to what is inside this folder.
    
    You can either create these files by hand, with another utility, or if
    you are confident that your code is correct, from the code itself.  This is
    done by setting an environment variable when running the tests, which will
    cause the file produced by your code to be saved to a temporary file in the
    current directory:
    
        SAVE_FAILED_TEST=1 npm test
        mv error1.bin test/img-myformat/default.bin

If your file format has any sort of compression or encryption, these algorithms
should go into the `gamecomp` project instead.  This is to make it easier to
reuse the algorithms, as many of them (particularly the compression ones) are
used amongst many unrelated file formats.  All the `gamecomp` algorithms are
available to be used by any file format in this library.

During development you can test your code like this:

    # Convert a sample image to .png and view it with `xv`, with debug messages on
    $ ./bin/gamegfx --debug read -f img-myformat example.dat write -t img-png out.png && xv out.png

    # Make sure the format is identified correctly or if not why not
    $ ./bin/gamegfx --debug identify example.dat

If you use `Debug.log()` rather than `console.log()` then these messages can be
left in for future diagnosis as they will only appear when `--debug` is given.

## Known issues

pngjs cannot write indexed .png images, only 24-bit RGBA.  This means the
palette is lost when exporting to .png, and importing from .png is not possible
unless an external editor is used to reduce the file back to indexed while
matching the destination palette (practically impossible).  Hopefully at some
point full indexed support can be added to pngjs.
