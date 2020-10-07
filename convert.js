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
// regular expression for @DEFINE NAME VALUE
var reDefine = /#DEFINE\s+([A-Z_]+[0-9_]*)\s+([^\n]+)/i;
var reDefineVars = null;
// string regular expression
var reString = /"[^"]+"/

var code = fs.readFileSync(src).toString().split('\r\n');
var ln = 10;
var res = [];
var labels = {};
var defines = {};
var vars = {};
var strings = [];
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


var match;
for (var i=0; i<code.length; i++)
{
	var line = code[i].trim();

	// remove Qbasic style commented lines
	line = line.replace(/^\s*['].*$/, '');

	// ignore blank lines
	if (line == '')
	{
		code[i] = line;
		continue;
	}

	// convert strings to {{123}} - a hack to ignore possible variable names
	// inside strings. These tags will be replaced at the end with the
	// original string.

	while (match = reString.exec(line))
	{
		line = line.replace(match[0], '{{' + strings.length + '}}');
		strings.push(match[0]);
	}

	match = reDefine.exec(line);
	if (match)
	{
		var name = match[1]
		var val = match[2];

		defines[name] = val;
		reDefineVars = new RegExp('(^|[^A-Z0-9_]+)(' + Object.keys(defines).join('|') + ')([^A-Z0-9_%!$]+|$)');

		code[i] = '';
		continue;
	}

	// convert define vars
	if (reDefineVars !== null)
	{
		while (match = reDefineVars.exec(line))
		{
			line = line.replace(match[2], defines[match[2]]);
		}
	}


	// convert full name variables into unique C64 2 character names
	// to avoid confliction
	reVarName.lastIndex = 0;

	while (true)
	{
		match = reVarName.exec(line);

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


	// replace line with any modifications
	code[i] = line;

	if (line == '')
		continue;

	match = reSubName.exec(line);

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

	if (line == '')
		continue;

	var match = reSubName.exec(line);
	if (match)
	{
		if (match[2] === ':')
		{
			res.push((ln - 1) + ' REM ');
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

// reduce multiple whitespaces to single space
str = str.replace(/[\t ]+/g, ' ');

// replace strings
for (var i=0; i<strings.length; i++)
	str = str.replace('{{' + i + '}}', strings[i]);

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
