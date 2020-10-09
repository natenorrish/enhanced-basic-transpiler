# Enhanced BASIC Transpiler
 Convert an enhanced version of BASIC to standard BASIC tokenized PRG file.
 
 Line numbers are not currently supported in this version - future versions will allow adding line numbers.

## Usage
NOTE: NodeJS is required

From a command prompt:
```
node ebt input.bas output.prg
node ebt -r input.bas output.prg
ebt input.bas output.bas
```

```
Enhanced Basic Transpiler

Usage: node ebt [-OPTIONS] src.bas dst.prg

OPTIONS:
--------

-r    Run program
-p    Use PETSCII character set

```
 
## Syntax

### Variables
```
SOME_STRING$ = "testing"           ' AA$ = "testing"
INT_VAR% = 10                      ' AB% = 10
NUM_VAR = 20                       ' AC = 20
```


### Labels

```
X% = 10
IF X% = 10 THEN GOSUB @SUB_ROUTINE_LABEL

END

@SUB_ROUTINE_LABEL:
    PRINT "Inside a subroutine", X%
    RETURN
```

### Define

C/C++ style define directive - all references to the defined variable will be replaced with the actual value:

```
#DEFINE SOME_DEF_VAR    10
```

