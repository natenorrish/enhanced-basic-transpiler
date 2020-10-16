/*
**  Copyright 2020 Nate Norrish
**
**  This source code is licensed under the MIT license found in the
**  LICENSE file in the root directory of this source tree.
*/

var EBT = require('./src/main.js');
require('./src/params.js')(EBT);
require('./src/cli.js')(EBT);
require('./src/asm.js')(EBT);
require('./src/tokenizer.js')(EBT);

EBT.transpile();

