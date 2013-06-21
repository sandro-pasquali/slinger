run make

NOTE: the automatic re-build on module file changes will NOT WORK ON OSX.

Most other *NIX's will work

By hand on .js or .css change:

delete file `module`
delete the .min. version of the file changed
run > make minify