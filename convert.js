var fs = require('fs');

var args = process.argv;
var src = args[2] || null;
var dst = args[3] || null;

if (src === null || dst === null)
{
	console.log('Usage: convert src.bas dst.bas');
	console.log('   or: node convert src.bas dst.bas');
	return;
}

// regular expressions for parsing @LABEL and @LABEL:
var reSubName = /@([A-Z_]+[0-9_]*)(:)?/i;
// for parsing variable names NAME$, NAME%, NAME!
var reVarName = /(^|[^A-Z0-9_]|\s+)([A-Z_]+[0-9_]*)([%$!]{1})/ig;

var code = fs.readFileSync(src).toString().split('\r\n');
var ln = 10;
var res = [];
var labels = {};
var vars = {};
var varCount = 0;

// first letter of the generated var names, must be a letter
var varHiChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// second letter can be a number
var varLoChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// if a generated variable name contains one of the following,
// it'll be disgarded and another name will be generated
var reservedWords = [
	'TO'
];


for (var i=0; i<code.length; i++)
{
	var line = code[i].trim();

	// remove Qbasic style commented lines
	line = line.replace(/^\s*['].*$/, '');

	// ignore blank lines
	if (line == '')
		continue;

	// convert full name variables into unique C64 2 character names
	// to avoid confliction
	reVarName.lastIndex = 0;

	while (true)
	{
		var match = reVarName.exec(line);

		if (match)
		{
			var name = match[2];
			var type = match[3];
			var alias = getVarAlias(name, type);

			line = line.replace(new RegExp('([^A-Z0-9_]|^|\s+)' + name + '\\' + type), match[1] + alias);
			code[i] = line;

			reVarName.lastIndex = match.index + alias.length + match[1].length;
		}
		else
		{
			break;
		}
	}


	if (line == '')
		continue;

	var match = reSubName.exec(line);

	if (match)
	{
		if (match[2] === ':')
		{
			var label = match[1];
			labels[label] = ln;
		}
	}

	ln += 10;
}

ln = 10;
for (var i=0; i<code.length; i++)
{
	var line = code[i].trim();
	line = line.replace(/^\s*['].*$/, '');

	if (line == '')
		continue;

	var match = reSubName.exec(line);
	if (match)
	{
		if (match[2] === ':')
		{
			res.push((ln - 1) + ' REM '); // + '*'.repeat(match[1].length + 6));
			line = 'REM ** ' + match[1] + ' **';
		}
		else
		{
			line = line.replace(match[0], labels[match[1]]);
		}
	}



	res.push(ln + ' ' + line);
	ln += 10;
}

var str = 'PRINT CHR$($0F)\r\n' + res.join('\r\n') + '\r\nCLS\r\nRUN\r\n';
fs.writeFileSync(dst, str);

function getVarAlias(name, type)
{
	var _name = name + type;

	if (typeof(vars[_name]) === 'undefined')
	{
		var alias;

		while (true)
		{
			var hi = Math.floor(varCount / varLoChars.length);
			var lo = varCount % varLoChars.length;
			alias = varHiChars[hi] + varLoChars[lo];

			var found = false;
			for (var i=0; i<reservedWords.length; i++)
			{
				if (reservedWords[i].indexOf(alias) > -1)
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

		if (type === '!') type = '';
		vars[_name] = alias.trim() + type;
		varCount++;
	}

	return vars[_name];
}
