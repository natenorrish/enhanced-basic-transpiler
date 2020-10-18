/*
**  Copyright 2020 Nate Norrish
**
**  This source code is licensed under the MIT license found in the
**  LICENSE file in the root directory of this source tree.
*/


module.exports = (EBT) =>
{
	EBT.tokenizer = {
		parse: function (str)
		{
			var get = null, tok = '', tokens = [], next = false, i = 0;

			while (i < str.length)
			{
				var c = str[i];
				if (/[ \s\t]/.test(c))
				{
					next = true;
					i++;
				}
				else if (get === null)
				{
					if (/[A-Z]/.test(c))
					{
						get = 'name';
					}
					else if (/[0-9]/.test(c))
					{
						get = 'number';
					}
					else
					{
						tokens.push([ c, 'char' ]);
						i++;
						continue;
					}
				}
				else
				{
					

					if (get === 'name' && !/[A-Z_0-9$#!%]/.test(c) ||
						get === 'number' && !/[0-9]/.test(c))
					{
						next = true;
					}
				}

				if (next)
				{
					if (get !== null)
					{
						tokens.push([ tok, get ]);
						get = null;
					}

					tok = '';
					next = false;
				}
				else
				{
					tok += c;
					i++;
				}
			}

			if (get !== null)
			{
				tokens.push([ tok, get ]);
			}

			this.tokens = tokens;
			this.pos = 0;

			console.log(tokens);
		},

		type: function (isType=false)
		{
			if (this.pos >= this.tokens.length)
				return false;

			var type = this.tokens[this.pos][1];

			if (isType !== false)
				return (isType === type);

			return type;
		},

		val: function (isVal=false)
		{
			if (this.pos >= this.tokens.length)
				return false;

			var val = this.tokens[this.pos][0];

			if (isVal !== false)
				return (isVal === val);

			return val;
		},

		typeAndNext: function (isType=false)
		{
			var type = this.type(isType);

			if (type !== false)
				this.next();

			return type;
		},

		valAndNext: function (isVal=false)
		{
			var val = this.val(isVal);

			if (val !== false)
				this.next();

			return val;
		},

		next: function ()
		{
			if (this.pos >= this.tokens.length)
				return false;

			this.pos++;
			return true;
		},

		prev: function ()
		{
			if (this.pos === 0)
				return false;

			this.pos--;
			return true;
		},

		reset: function ()
		{
			this.pos = 0;
		}
	};
}	
