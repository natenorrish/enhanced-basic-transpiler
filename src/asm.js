/*
**  Copyright 2020 Nate Norrish
**
**  This source code is licensed under the MIT license found in the
**  LICENSE file in the root directory of this source tree.
*/

var fs = require('fs');
var { execSync } = require('child_process');

module.exports = (EBT) =>
{
	EBT.asm = {
		varDataStart: 0x7000,
		programStart: 0x7050,
		programOffset: 0,
		compiled: [],
		setVarSubsUsed: {},

		parse: function ()
		{
			var line = EBT.removeLine();
			line = line.replace('#ASM', '');

			var tok = EBT.tokenizer;
			tok.parse(line);

			var args = {}, argCount = 0, asmLines = [], varDataOffset = this.varDataStart;
			var argType, argName, argSize, argOffset, setVar, setVarSubPrefix, initLines = [];

			if (tok.valAndNext('('))
			{
				while (true)
				{
					if (EBT.asmValidArgTypes.indexOf(tok.val()) < 0)
					{
						EBT.error('Expecting type (BYTE, WORD, STRING[n])');
					}

					var argType = tok.valAndNext();
					if (argType === 'STRING')
					{
						if (!tok.valAndNext('['))
							EBT.error('Expecting STRING size (e.g: STRING[40])');

						if (!tok.type('number'))
							EBT.error('Expecting STRING size (e.g: STRING[40])');

						var argSize = parseInt(tok.valAndNext()) + 1;

						if (!tok.valAndNext(']'))
							EBT.error('Expecting ] after STRING size');

						if (!tok.type('name'))
							EBT.error('Expecting argument var name');

						argName = tok.valAndNext();
						setVar = 'ASM_STR$';
					}
					else if (argType === 'BYTE')
					{
						argName = tok.valAndNext();
						argSize = 1;
						setVar = 'ASM_NUM';
					}
					else if (argType === 'WORD')
					{
						argName = tok.valAndNext();
						argSize = 2;
						setVar = 'ASM_NUM';
					}

					setVarSubPrefix = argType;

					initLines.push(setVar + '= ' + argName + ' : GOSUB @ASM_SET_' + setVarSubPrefix);

					args[argName] = { name: argName, type: argType, size: argSize, offset: varDataOffset };
					varDataOffset += argSize;
					argCount++;

					this.setVarSubsUsed[setVarSubPrefix] = setVarSubPrefix;

					if (tok.valAndNext(','))
						continue;

					if (tok.val(')'))
						break;
				}
			}



			var argsRE = new RegExp('(^|[^A-Z0-9_]|\s)(' +
				Object.keys(args).join('|').replace(/\$/, '\\$') +
				')([^A-Z0-9_]|\s|$)', 'ig');

			// find #ENDASM
			var line;
			while (true)
			{
				line = EBT.getLine();

				if (line === false || /#ENDASM/i.test(line))
					break;

				asmLine = EBT.removeLine().trim();

				while (match = argsRE.exec(asmLine))
				{
					if (match[0].trim() == '')
						break;

					argName = match[2];
					var arg = args[argName];

					if (typeof(arg) !== 'undefined')
					{
						asmLine = asmLine.replace(match[0], match[1] + '$' + EBT.toHex(arg.offset) + match[3]);
					}
				}

				asmLine = asmLine.trim();

				if (asmLine !== '')
					asmLines.push(asmLine);
			}

			if (line != '#ENDASM')
			{
				EBT.error('Expecting #', EBT.ln);
			}
			else
			{
				EBT.removeLine();
			}

			if (argCount)
			{
				initLines.splice(0, 0, `ASM_DATA_ADDR = ${this.varDataStart}`);
			}

			EBT.insertLines(initLines);

			console.log(asmLines.join('\r\n'));
			this.compile(asmLines);
		},

		compile: function (asmLines)
		{
			// compile ASM 
			fs.writeFileSync(
				'temp.asm',
				'.org $' + EBT.toHex(this.programStart) + '\r\n' + 
				'.segment "STARTUP"\r\n' +
				'.segment "INIT"\r\n' +
				'.segment "ONCE"\r\n' +
				'.segment "CODE"\r\n' +
				asmLines.join('\r\n') + 
				'\r\nrts\r\n'
			);

			execSync(
				'cl65 -o temp.bin temp.asm',
				(err, stdout, stderr) =>
				{
					if (stderr)
					{
						throw 'Could not compile ASM: ' + stderr;
					}
				}
			);

			var programAddr = this.programStart + this.programOffset;
			var bin = fs.readFileSync('temp.bin').slice(14);
			this.compiled.push(bin);
			
			EBT.insertLine('SYS $' + EBT.toHex(programAddr, 4));
			this.programOffset += bin.length;
		},

		inject: function ()
		{
			EBT.lines.splice(0, 0, 'ASM_SRC=$1234');
			EBT.lines.splice(1, 0, 'GOSUB @ASM_BOOTSTRAP');

			var asmDstHex = '$' + EBT.toHex(this.programStart);
			var helperCode = '';

			if (this.setVarSubsUsed.BYTE)
			{
				helperCode += `
					@ASM_SET_BYTE:
						POKE ASM_DATA_ADDR, ASM_NUM AND $FF
						ASM_DATA_ADDR = ASM_DATA_ADDR + 1
						RETURN
				`;
			}

			if (this.setVarSubsUsed.WORD)
			{
				helperCode += `
					@ASM_SET_WORD:
						POKE ASM_DATA_ADDR, ASM_NUM AND $FF
						POKE ASM_DATA_ADDR + 1, INT(ASM_NUM / 256)
						ASM_DATA_ADDR = ASM_DATA_ADDR + 2
						RETURN
				`;
			}

			if (this.setVarSubsUsed.STRING)
			{
				helperCode += `
					@ASM_SET_STRING:
						ASM_STR_LEN = LEN(ASM_STR$)

						FOR ASM_I = 1 TO ASM_STR_LEN
							POKE ASM_DATA_ADDR + ASM_I - 1, ASC(MID$(ASM_STR$, ASM_I, 1))
						NEXT

						POKE ASM_DATA_ADDR + ASM_I - 1, 0
						ASM_DATA_ADDR = ASM_DATA_ADDR + ASM_STR_LEN + 1
						RETURN
				`;
			}

			EBT.lines = EBT.lines.concat(
				(`
				END
				@ASM_BOOTSTRAP:
					FOR ASM_I = 0 TO ${this.programOffset} - 1
						POKE ${asmDstHex} + ASM_I, PEEK(ASM_SRC + ASM_I)
					NEXT
					RETURN
				` + helperCode).split('\n')
			);
		}
	}
}	
