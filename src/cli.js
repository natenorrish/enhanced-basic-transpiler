/*
**  Copyright 2020 Nate Norrish
**
**  This source code is licensed under the MIT license found in the
**  LICENSE file in the root directory of this source tree.
*/

var fs = require('fs');

module.exports = (EBT) =>
{
	EBT.parseArgs = function (args)
	{
		var invalidArgs = false;

		if (args.length < 3)
		{
			invalidArgs = true;
		}
		else
		{
			var nonFlagArgs = [];

			for (var i=2; i<args.length; i++)
			{
				switch (args[i])
				{
					case '-p': this.usePETSCII = true; break;
					case '-r': this.runProg = true; break;
					case '-l': this.loadEmulator = true; break;
					default:
						if (args[i][0] === '-')
						{
							invalidArgs = true;
						}
						else
						{
							nonFlagArgs.push(args[i]);
						}
				}

				if (invalidArgs) break;
			}

			if (nonFlagArgs.length === 1)
			{
				this.src = nonFlagArgs[0];
				var ext = /\.[a-z0-9]+$/i.exec(this.src);
				if (!ext)
				{
					this.src += '.bas';
					ext = '.bas';
				}
				else
				{
					ext = ext[0];
				}

				if (ext.toLowerCase() == '.prg')
				{
					invalidArgs = true;
					reason = 'Invalid source file, must be a text BASIC file.';
				}
				else
				{
					this.dst = this.src.substr(0, this.src.length - ext.length) + '.prg';
				}
			}
			else if (nonFlagsArgs.length === 2)
			{
				this.src = nonFlagArgs[0];
				var ext = /\.[a-z0-9]+$/i.exec(src);
				ext = ext ? ext[0] : '.bas';

				if (ext.toLowerCase() == '.prg')
				{
					invalidArgs = true;
					reason = 'Invalid destination file, must be a text BASIC file.';
				}

				this.dst = nonFlagArgs[1];
			}
			else
			{
				invalidArgs = true;
			}
		}

		if (!invalidArgs)
		{
			// check source file exists
			if (!fs.existsSync(this.src))
			{
				invalidArgs = true;
				reason = 'Source file does not exist: ' + this.src;
			}
		}

		if (invalidArgs)
		{
			console.log(
				[
					'',
					'Enhanced Basic Transpiler',
					'',
					'Usage: node ebt [-OPTIONS] src[.bas] [dst.prg]',
					'',
					'NOTE: Currently requires the Commander X16 Emulator to run.',
					'      Using inline assembly requires CC65.',
					'',
					'Examples:',
					'   ebt src',
					'   ebt src.bas',
					'   ebt src.bas dst.prg',
					'',
					'OPTIONS:',
					'--------',
					'',
					'-r    Run program (in Commander X16 Emulator)',
					'-e    Load program (in Commander X16 Emulator)',
					'-p    Use PETSCII character set',
					'',
					''
				].join('\n')
			);

			if (reason)
			{
				console.log('ERROR: ' + reason);
			}

			return;
		}

	}
}



