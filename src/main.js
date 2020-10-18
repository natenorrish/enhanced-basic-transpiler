/*
**  Copyright 2020 Nate Norrish
**
**  This source code is licensed under the MIT license found in the
**  LICENSE file in the root directory of this source tree.
*/


var fs = require('fs');
var { execSync } = require('child_process');
var args = process.argv;

// parse command line arguments
var EBT = {
	usePETSCII   : false,
	runProg      : false,
	loadEmulator : false,

	vars         : [],
	varAliases   : [],
	varCount     : 0,
	strings      : [],
	comments     : [],
	labels       : [],
	numbers      : [],
	defines      : {},
	labelLineMap : {},
	memLocation  : 0x0801,
	ln           : 0,
	useASM       : false,

	transpile: function ()
	{
		this.parseArgs(args);
		this.lines = fs.readFileSync(this.src).toString().split(/[\r\n]+/);

		if (!this.usePETSCII)
			this.lines.unshift('PRINT CHR$(15)');

		this.parse();
		this.output = this.build();



		// Address pointers - zero page
		// $00FB	251		Unused
		// $00FC	252		Unused
		// $00FD	253		Unused
		// $00FE	254		Unused

		if (this.asm.compiled.length > 0)
		{
			var basicLen = this.toHex(this.output.length + 0x801 - 2, 4);
			console.log(basicLen);
			for (var i=0; i<4; i++)
				this.output[10 + i] = basicLen.charCodeAt(i);

			this.output = Buffer.concat([ this.output, ...this.asm.compiled ]);
		}

		fs.writeFileSync(this.dst, this.output);

		if (this.runProg || this.loadEmulator)
		{
			execSync(
				'x16emu -prg ' + this.dst + (this.runProg ? ' -run' : ''),
				(error, stdout, stderr) =>
				{
					if (stderr)
					{
						console.log('ERROR: X16 Emulator is required to run this program');
						console.log('       Make sure the emulator directory is in your PATH environment var');
					}
				}
			);
		}

	},

	getLine: function ()
	{
		if (this.ln >= this.lines.length)
			return false;

		var line = this.lines[this.ln];

		if (typeof(line) === 'string')
			line = line.trim();

		return line;
	},

	nextLine: function ()
	{
		if (this.ln < this.lines.length)
		{
			this.ln++;
			return this.getLine();
		}
		else
		{
			return false;
		}
	},

	setLine: function (line)
	{
		if (typeof(line) === 'string')
			line = line.trim();

		this.lines[this.ln] = line;
	},

	removeLine: function ()
	{
		return this.lines.splice(this.ln, 1)[0];
	},

	replaceLine: function (line)
	{
		this.lines[this.ln] = line;
	},

	parse: function()
	{
		// replace comments, strings and reserved keywords with tags {x:0}
		// r - reserved keyword
		// a - reserved raw
		// v - variable
		// l - label
		// g - goto / label ref
		// c - comment
		// n - number

		// FIRST PASS: Find comments and strings
		var match, line;
		while ((line = this.getLine()) !== false)
		{
			match = /#ASM|#DEFINE|['"]/.exec(line);

			if (match)
			{
				if (match[0] === '#ASM')
				{
					this.useASM = true;
					this.asm.parse();
				}
				else if (match[0] === '#DEFINE')
				{
					var def = /#DEFINE\s+([A-Z][A-Z0-9_]+)\s+(.*)/i.exec(line);

					if (!def)
					{
						this.error('Invalid #DEFINE');
					}
					else
					{
						this.defines[def[1]] = def[2];
						this.removeLine();
					}
				}
				else
				{
					var start = match.index, end = -1;

					if (match[0] === '\'')
					{
						end = line.length;
						var comment = line.substr(start + 1);
						line = this.insertTag(line, 'c', this.comments.length, start, line.length - start);
						this.comments.push(comment);
					}
					else
					{
						end = line.indexOf('"', start + 1);

						if (end < 0)
							this.error('Could not find end of string', i);

						var str = line.substr(start + 1, end - start - 1);
						line = this.insertTag(line, 's', this.strings.length, start, end - start +1);
						this.strings.push(str);
					}

					this.setLine(line);
				}
			}

			this.nextLine();
		}

		if (this.useASM) this.asm.inject();

		this.definesRE = new RegExp('(^|[^A-Z0-9_]|\\s)(' + Object.keys(this.defines).join(')|(') + ')($|[^A-Z0-9_]|\\s)');

		// SECOND PASS: Replace variables, labels and keywords
		var labelLineNum = 10;
		var match, line;
		this.ln = 0;
		while ((line = this.getLine()) !== false)
		{
			// replace defines
			line = this.replaceDefines(line);

			// numbers
			while (match = /\$[A-F0-9]+/i.exec(line))
			{
				var index = this.numbers.indexOf(match[0]);
				if (index < 0)
				{
					index = this.numbers.length;
					this.numbers.push(match[0]);
				}

				line = this.insertTag(line, 'n', index, match.index, match[0].length);
			}

			while (match = /(^|[^A-Z0-9_]|\s+)([A-Z_]+[A-Z0-9_]*([%$!#:]{1})?)/.exec(line))
			{

				// check if it's a reserved keyword
				var before = match[1].length;
				var checkReserved = match[2];


				if (this.reserved.indexOf(checkReserved) > -1)
				{
					line = this.insertTag(line, 'r', this.binaryMap[checkReserved], match.index + before, checkReserved.length);
				}
				else if (this.reservedRaw.indexOf(checkReserved) > -1)
				{
					var index = this.reservedRaw.indexOf(checkReserved);
					var before = match[1].length;
					line = this.insertTag(line, 'a', index, match.index + before, match[0].length - before);
				}
				else
				{

					var start = match[1].trim();
					var end = match[3] ? match[3].trim() : '';

					if (start === '@')
					{
						var type = (match[3] === ':' ? 'l' : 'g');
						var label = match[2].trim().replace(':', '');
						var index = this.labels.indexOf(label);

						if (index < 0)
						{
							index = this.labels.length;
							this.labels.push(label);
						}

						line = this.insertTag(line, type, index, match.index, match[0].length);

						if (type === 'l')
						{
							this.labelLineMap[label] = labelLineNum;
						}
					}
					else if (start === '#')
					{
						line = '';
					}
					else if (['', '$', '!', '#', '%'].indexOf(end) > -1)
					{
						// variable
						var name = match[2].trim();
						var type = match[3] || '';
						var before = match[1].length;

						index = this.getVarIndex(name, type);
						line = this.insertTag(line, 'v', index, match.index + before, match[0].length - before);
					}
					else
					{
						console.log(match);
						return;
					}
				}
			}

			// replace operators
			while (match = /[+*/^<>=-]/.exec(line))
			{
				if (this.binaryMap[match[0]] === undefined)
				{
					console.log(match);
					return;
				}

				line = this.insertTag(line, 'o', this.binaryMap[match[0]], match.index, 1);
			}

			if (line !== false)
			{
				line = line.trim();
				if (line !== '')
					labelLineNum += 10;

				line = line.replace(/\s+/g, ' ');
				this.setLine(line);
			}

			this.nextLine();
		}

		this.lines = this.lines.filter(l => l !== '');

		// go through each line into an array of tags and characters
		this.ln = 0;
		while ((line = this.getLine()) !== false)
		{
			var _line = [];
			var p = 0, c, type, end, id;

			while (p < line.length)
			{
				var c = line[p];

				if (c === '{')
				{
					// next char 
					p++;
					// get type
					type = line[p];
					// skip type char and :
					p += 2;
					// find end of tag
					end = line.indexOf('}', p);

					// throw error if one isn't found - shouldn't happen
					if (end < 0)
						throw 'Invalid tag';

					// extract the ID from the tag
					id = line.substr(p, end - p);

					// set position to end tag position
					p = end;

					_line.push([ type, id ]);
				}
				else
				{
					// not a tag so add char to array
					_line.push(c);
				}

				// next char
				p++;
			}

			this.setLine(_line);
			this.nextLine();
		}
	},

	replaceDefines: function (str)
	{
		var match;
		while (match = this.definesRE.exec(str))
		{
			str = str.replace(match[0], match[1] + this.defines[match[2]] + match[3]);
		}

		return str;
	},

	build: function()
	{
		var buf = Buffer.allocUnsafe(64000).fill(0), pos = 0;
		var line, node, ln = 10;

		pos = this.writeWord(buf, pos, this.memLocation);

		this.ln = 0;
		while ((line = this.getLine()) !== false)
		{
			var nextLineOffsetPos = pos;

			// 2 byte placeholder for next line offset
			pos += 2;

			// write line number
			pos = this.writeWord(buf, pos, ln);

			for (var j=0; j<line.length; j++)
			{
				node = line[j];

				if (typeof(node) === 'object')
				{
					switch (node[0])
					{
						case 'o':
						case 'r':
							var val = node[1];
							if (val < 256) pos = this.writeByte(buf, pos, val);
							else pos = this.writeWord(buf, pos, val);
							break;

						case 'a':
							pos = this.writeRaw(buf, pos, this.reservedRaw[node[1]].toString());
							break;

						case 's':
							var val = this.strings[node[1]];
							pos = this.writeString(buf, pos, val);
							break;

						case 'l':
							pos = this.writeComment(buf, pos, '*** ' + this.labels[node[1]] + ' ***');
							break;

						case 'g':
							pos = this.writeRaw(buf, pos, '' + this.labelLineMap[this.labels[node[1]]]);
							break;

						case 'v':
							var alias = this.varAliases[node[1]];
							pos = this.writeRaw(buf, pos, alias);
							break;

						case 'c':
							pos = this.writeComment(buf, pos, this.comments[node[1]]);
							break;

						case 'n':
							pos = this.writeRaw(buf, pos, this.numbers[node[1]].toString());
							break;
					}
				}
				else
				{
					pos = this.writeByte(buf, pos, node.charCodeAt(0));
				}
			}

			// back fill next line offset
			this.writeWord(buf, nextLineOffsetPos, this.memLocation + pos - 1);

			// add a zero char
			pos++;

			// increment line number
			ln += 10;

			this.nextLine();
		}

		// add 2 zero chars to end
		pos += 2;

		return buf.slice(0, pos);
	},

	writeByte: function(buf, pos, val)
	{
		buf[pos++] = val;
		return pos;
	},

	writeWord: function(buf, pos, val)
	{
		var lo = val & 0xFF;
		var hi = (val & 0xFF00) >> 8;

		buf[pos++] = lo;
		buf[pos++] = hi;

		return pos;
	},

	writeString: function(buf, pos, val)
	{
		buf[pos++] = 0x22;

		for (var i=0; i<val.length; i++)
			buf[pos++] = val.charCodeAt(i);

		buf[pos++] = 0x22;

		return pos;
	},

	writeRaw: function(buf, pos, val)
	{
		for (var i=0; i<val.length; i++)
			buf[pos++] = val.charCodeAt(i);

		return pos;
	},

	writeComment: function(buf, pos, val)
	{
		buf[pos++] = 0x8F;
		buf[pos++] = 0x20;
		return this.writeRaw(buf, pos, val);
	},

	insertTag: function(line, type, id, start, len)
	{
		return line.substr(0, start) + '{' + type + ':' + id + '}' + line.substr(start + len);
	},

	insertLine: function (line, index=false)
	{
		if (index === false)
			index = this.ln;

		this.lines.splice(index, 0, line);
		this.ln = index + 1;
	},

	insertLines: function(lines, index=false)
	{
		if (index === false)
			index = this.ln;

		for (var i=0; i<lines.length; i++)
		{
			this.lines.splice(index + i, 0, lines[i]);
		}

		this.ln = index + i;
	},


	getVarAlias: function(name, type)
	{
		var index = getVarIndex(name, type);
		
		if (index === false)
			return false;

		return varAliases[index];
	},

	getVarIndex: function(name, type)
	{
		var _name = name + type;

		if (this.reservedVars.indexOf(_name) > -1)
			return false;

		var index = this.vars.indexOf(_name);

		if (index < 0)
		{
			var alias;

			while (true)
			{
				var hi = Math.floor(this.varCount / this.varLoChars.length);
				var lo = this.varCount % this.varLoChars.length;
				alias = this.varHiChars[hi] + this.varLoChars[lo];

				var found = false;
				for (var i=0; i<this.reservedTwoLenWords.length; i++)
				{
					if (this.reservedTwoLenWords[i].indexOf(alias) > -1)
					{
						found = true;
						break;
					}
				}

				if (!found)
				{
					break;
				}

				this.varCount++;
			}

			if (type === '!' || type === '#') type = '';

			index = this.vars.length;
			this.vars.push(_name);
			this.varAliases.push(alias.trim() + type);
			this.varCount++;
		}

		return index;
	},

	error: function(msg, line=-1)
	{
		if (line < 0) line = this.ln;

		throw 'ERROR: ' + msg + ' (line: ' + (line + 1) + ')';
	},

	toHex: function(num, len=4)
	{
		return (num || 0).toString(16).padStart(len, '0').toUpperCase();
	}

};



module.exports = EBT;

