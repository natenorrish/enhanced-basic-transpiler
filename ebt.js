var fs = require('fs');
var { exec } = require('child_process');
var args = process.argv;
var usePETSCII = false, runProg = false, invalidArgs = false,
    src, dst;

// parse command line arguments

if (args.length < 4)
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
			case '-p': usePETSCII = true; break;
			case '-r': runProg = true; break;
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

	if (nonFlagArgs.length !== 2)
	{
		invalidArgs = true;
	}
	else
	{
		src = nonFlagArgs[0];
		dst = nonFlagArgs[1];
	}
}

if (invalidArgs)
{
	console.log(
		[
			'',
			'Enhanced Basic Transpiler',
			'',
			'Usage: node ebt [-OPTIONS] src.bas dst.prg',
			'',
			'OPTIONS:',
			'--------',
			'',
			'-r    Run program',
			'-p    Use PETSCII character set'
		].join('\n')
	);

	return;
}


var binaryMap = {
	'END'     : 128,
	'FOR'     : 129,
	'NEXT'    : 130,
	'DATA'    : 131,
	'INPUT#'  : 132,
	'INPUT'   : 133,
	'DIM'     : 134,
	'READ'    : 135,
	'LET'     : 136,
	'GOTO'    : 137,
	'RUN'     : 138,
	'IF'      : 139,
	'RESTORE' : 140,
	'GOSUB'   : 141,
	'RETURN'  : 142,
	'REM'     : 143,
	'STOP'    : 144,
	'ON'      : 145,
	'WAIT'    : 146,
	'LOAD'    : 147,
	'SAVE'    : 148,
	'VERIFY'  : 149,
	'DEF'     : 150,
	'POKE'    : 151,
	'PRINT#'  : 152,
	'PRINT'   : 153,
	'CONT'    : 154,
	'LIST'    : 155,
	'CLR'     : 156,
	'CMD'     : 157,
	'SYS'     : 158,
	'OPEN'    : 159,
	'CLOSE'   : 160,
	'GET'     : 161,
	'NEW'     : 162,
	'TAB('    : 163,
	'TO'      : 164,
	'FN'      : 165,
	'SPC('    : 166,
	'THEN'    : 167,
	'NOT'     : 168,
	'STEP'    : 169,
	'+'       : 170,
	'-'       : 171,
	'*'       : 172,
	'/'       : 173,
	'^'       : 174,
	'AND'     : 175,
	'OR'      : 176,
	'>'       : 177,
	'='       : 178,
	'<'       : 179,
	'SGN'     : 180,
	'INT'     : 181,
	'ABS'     : 182,
	'USR'     : 183,
	'FRE'     : 184,
	'POS'     : 185,
	'SQR'     : 186,
	'RND'     : 187,
	'LOG'     : 188,
	'EXP'     : 189,
	'COS'     : 190,
	'SIN'     : 191,
	'TAN'     : 192,
	'ATN'     : 193,
	'PEEK'    : 194,
	'LEN'     : 195,
	'STR$'    : 196,
	'VAL'     : 197,
	'ASC'     : 198,
	'CHR$'    : 199,
	'LEFT$'   : 200,
	'RIGHT$'  : 201,
	'MID$'    : 202,
	'GO'      : 203,

	// X16 
	'CHAR'    : 0x8bce,
	'CLS'     : 0x90ce,
	'COLOR'   : 0x8dce,
	'DOS'     : 0x81ce,
	'FRAME'   : 0x89ce,
	'GEOS'    : 0x83ce,
	'JOY'     : 0x95ce,
	'LINE'    : 0x88ce,
	'MON'     : 0x80ce,
	'MOUSE'   : 0x8cce,
	'MX'      : 0x92ce,
	'MY'      : 0x93ce,
	'MB'      : 0x94ce,
	'OLD'     : 0x82ce,
	'PSET'    : 0x87ce,
	'RECT'    : 0x8ace,
	'RESET'   : 0x8fce,
	'SCREEN'  : 0x86ce,
	'VPOKE'   : 0x84ce,
	'VPEEK'   : 0x91ce,
	'VLOAD'   : 0x85ce
}

var reserved = Object.keys(binaryMap);

// reserved words but don't have a binary representation
var reservedRaw = [
	'TIME',
	'TIME$'
];

// if a generated variable name contains one of the following,
// it'll be disgarded and another name will be generated
var reservedTwoLenWords = [
	'TO', 'GO', 'IF', 'OR', 'ST', 'TI'
];

var reservedVars = [
	'GET#', 'INPUT#', 'PRINT#'
];

// first letter of the generated var names, must be a letter
var varHiChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// second letter can be a number
var varLoChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';


var strings = [];
var comments = [];
var labels = [];
var numbers = [];
var labelLineMap = {};
var memLocation = 0x0801

var vars = [];
var varAliases = [];
var varCount = 0;

var lines = fs.readFileSync(src).toString().split(/[\r\n]+/);

if (!usePETSCII)
	lines.unshift('PRINT CHR$(15)');

var parsed = parse(lines);
var output = build(parsed);

fs.writeFileSync(dst, output);

if (runProg)
{
	exec(
		'x16emu -prg ' + dst + ' -run',
		(error, stdout, stderr) =>
		{
			
		}
	);
}


function parse(lines)
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

	var match;
	for (var i=0; i<lines.length; i++)
	{
		var line = lines[i].trim();

		while (match = /['"]/.exec(line))
		{
			var start = match.index, end = -1;

			if (match[0] == '\'')
			{
				end = line.length;
				var comment = line.substr(start + 1);
				line = insertTag(line, 'c', comments.length, start, line.length - start);
				comments.push(comment);
			}
			else
			{
				end = line.indexOf('"', start + 1);

				if (end < 0)
					error('Could not find end of string', i);

				var str = line.substr(start + 1, end - start - 1);
				line = insertTag(line, 's', strings.length, start, end - start +1);
				strings.push(str);
			}
		}

		lines[i] = line.trim();
	}

	// SECOND PASS: Replace variables, labels and keywords
	var ln = 10;
	for (var i=0; i<lines.length; i++)
	{
		var line = lines[i];

		// numbers
		while (match = /\$[A-F0-9]+/i.exec(line))
		{
			var index = numbers.indexOf(match[0]);
			if (index < 0)
			{
				index = numbers.length;
				numbers.push(match[0]);
			}

			line = insertTag(line, 'n', index, match.index, match[0].length);
		}

		while (match = /(^|[^A-Z0-9_]|\s+)([A-Z_]+[A-Z0-9_]*)(?:([%$!#:])|(\s*[#(]{1}))?/.exec(line))
		{

			// check if it's a reserved keyword
			var checkReserved = match[0].replace(/[^A-Z0-9_(%$!#]+/g, '');
			if (reserved.indexOf(checkReserved) > -1)
			{
				var before = match[1].length;
				line = insertTag(line, 'r', binaryMap[checkReserved], match.index + before, match[0].length - before);
			}
			else if (reservedRaw.indexOf(checkReserved) > -1)
			{
				var index = reservedRaw.indexOf(checkReserved);
				var before = match[1].length;
				line = insertTag(line, 'a', index, match.index + before, match[0].length - before);
			}
			else
			{
				var start = match[1].trim();
				var end = match[3] ? match[3].trim() : '';

				if (start === '@')
				{
					var type = (match[3] === ':' ? 'l' : 'g');
					var label = match[2].trim();
					var index = labels.indexOf(label);

					if (index < 0)
					{
						index = labels.length;
						labels.push(label);
					}

					line = insertTag(line, type, index, match.index, match[0].length);

					if (type === 'l')
					{
						labelLineMap[label] = ln;
					}
				}
				else if (start === '#')
				{
					// skip directives for now
					line = '';
				}
				else if (['', '$', '!', '#', '%'].indexOf(end) > -1)
				{
					// variable
					var name = match[2].trim();
					var type = match[3] || '';
					var before = match[1].length;

					index = getVarIndex(name, type);
					line = insertTag(line, 'v', index, match.index + before, match[0].length - before);
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
			if (binaryMap[match[0]] === undefined)
			{
				console.log(match);
				return;
			}

			line = insertTag(line, 'o', binaryMap[match[0]], match.index, 1);
		}

		line = line.trim();
		if (line !== '')
			ln += 10;

		lines[i] = line.replace(/\s+/g, ' ');
	}

	lines = lines.filter(l => l !== '');

	// go through each line into an array of tags and characters
	for (var i=0; i<lines.length; i++)
	{
		var line = lines[i];
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

		lines[i] = _line;

	}

	return lines;
}

function build(lines)
{
	var buf = Buffer.allocUnsafe(64000).fill(0), pos = 0;
	var line, node, ln = 10;

	pos = writeWord(buf, pos, memLocation);

	for (var i=0; i<lines.length; i++)
	{
		var nextLineOffsetPos = pos;

		// 2 byte placeholder for next line offset
		pos += 2;

		// write line number
		pos = writeWord(buf, pos, ln);

		line = lines[i];
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
						if (val < 256) pos = writeByte(buf, pos, val);
						else pos = writeWord(buf, pos, val);
						break;

					case 'a':
						pos = writeRaw(buf, pos, reservedRaw[node[1]].toString());
						break;

					case 's':
						var val = strings[node[1]];
						pos = writeString(buf, pos, val);
						break;

					case 'l':
						pos = writeComment(buf, pos, '*** ' + labels[node[1]] + ' ***');
						break;

					case 'g':
						pos = writeRaw(buf, pos, labelLineMap[labels[node[1]]].toString());
						break;

					case 'v':
						var alias = varAliases[node[1]];
						pos = writeRaw(buf, pos, alias);
						break;

					case 'c':
						pos = writeComment(buf, pos, comments[node[1]]);
						break;

					case 'n':
						pos = writeRaw(buf, pos, numbers[node[1]].toString());
						break;
				}
			}
			else
			{
				pos = writeByte(buf, pos, node.charCodeAt(0));
			}
		}

		// back fill next line offset
		writeWord(buf, nextLineOffsetPos, memLocation + pos - 1);

		// add a zero char
		pos++;

		// increment line number
		ln += 10;
	}

	// add 2 zero chars to end
	pos += 2;


	// test = '';
	// for (var i=0; i<pos; i+=2)
	// {
	// 	test += buf[i].toString(16).padStart(2, '0') + buf[i + 1].toString(16).padStart(2, '0') + ' ';
	// }

	// console.log(test);

	// buf = fs.readFileSync('TIME.PRG');
	// test = '';
	// for (var i=0; i<buf.length - 1; i+=2)
	// {
	// 	test += buf[i].toString(16).padStart(2, '0') + buf[i + 1].toString(16).padStart(2, '0') + ' ';
	// }
	// console.log(test);

	return buf.slice(0, pos);
}

function writeByte(buf, pos, val)
{
	buf[pos++] = val;
	return pos;
}

function writeWord(buf, pos, val)
{
	var lo = val & 0xFF;
	var hi = (val & 0xFF00) >> 8;

	buf[pos++] = lo;
	buf[pos++] = hi;

	return pos;
}

function writeString(buf, pos, val)
{
	buf[pos++] = 0x22;

	for (var i=0; i<val.length; i++)
		buf[pos++] = val.charCodeAt(i);

	buf[pos++] = 0x22;

	return pos;
}

function writeRaw(buf, pos, val)
{
	for (var i=0; i<val.length; i++)
		buf[pos++] = val.charCodeAt(i);

	return pos;
}

function writeComment(buf, pos, val)
{
	buf[pos++] = 0x8F;
	buf[pos++] = 0x20;
	return writeRaw(buf, pos, val);
}

function insertTag(line, type, id, start, len)
{
	return line.substr(0, start) + '{' + type + ':' + id + '}' + line.substr(start + len);
}

function getVarAlias(name, type)
{
	var index = getVarIndex(name, type);
	
	if (index === false)
		return false;

	return varAliases[index];
}

function getVarIndex(name, type)
{
	var _name = name + type;

	if (reservedVars.indexOf(_name) > -1)
		return false;

	var index = vars.indexOf(_name);

	if (index < 0)
	{
		var alias;

		while (true)
		{
			var hi = Math.floor(varCount / varLoChars.length);
			var lo = varCount % varLoChars.length;
			alias = varHiChars[hi] + varLoChars[lo];

			var found = false;
			for (var i=0; i<reservedTwoLenWords.length; i++)
			{
				if (reservedTwoLenWords[i].indexOf(alias) > -1)
				{
					found = true;
					break;
				}
			}

			if (!found)
			{
				break;
			}

			varCount++;
		}

		if (type === '!' || type === '#') type = '';

		index = vars.length;
		vars.push(_name);
		varAliases.push(alias.trim() + type);
		varCount++;
	}

	return index;
}

function error(msg, line)
{
	throw 'ERROR: ' + msg + ' (line: ' + (line + 1) + ')';
}
