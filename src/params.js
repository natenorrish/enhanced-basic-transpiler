/*
**  Copyright 2020 Nate Norrish
**
**  This source code is licensed under the MIT license found in the
**  LICENSE file in the root directory of this source tree.
*/


module.exports = (EBT) =>
{
	EBT.binaryMap = {
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
		'TAB'     : 163,
		'TO'      : 164,
		'FN'      : 165,
		'SPC'     : 166,
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

	EBT.reserved = Object.keys(EBT.binaryMap);

	// reserved words but don't have a binary token
	EBT.reservedRaw = [
		'TIME',
		'TIME$'
	];

	// if a generated variable name contains one of the following,
	// it'll be disgarded and another name will be generated
	EBT.reservedTwoLenWords = [
		'TO', 'GO', 'IF', 'OR', 'ST', 'TI'
	];

	EBT.reservedVars = [
		'GET#', 'INPUT#', 'PRINT#'
	];

	// first letter of the generated var names, must be a letter
	EBT.varHiChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	// second letter can be a number
	EBT.varLoChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

	// #ASM argument types
	EBT.asmValidArgTypes = [ 'BYTE', 'WORD', 'STRING' ];
}

