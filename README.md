# runcheck
Check workflow before a run

Description
-----------
This repostiory provides a template for new web application projects
using [NodeJS](https://nodejs.org) (runtime), [Express](https://expressjs.com/) (routing),
[Pug](https://pugjs.org) (templating) and [TypeScript](https://www.typescriptlang.org/) (language).

## Style, linter, and formatter

We use [eslint](http://eslint.org/) for JS linter and style control. Please use the latest stable eslint release. The eslint config file is `.eslintrc`. The file name format is controlled by [eslint-plugin-filenames](https://github.com/selaux/eslint-plugin-filenames).

We use [pug-lint](https://github.com/pugjs/pug-lint) for pug template linter and style control. The pug-lint config file is `.pug-lintrc`.

If you are using [sublime text](https://www.sublimetext.com/), there are several plugins that support eslint in the editor: [sublimelinter](http://www.sublimelinter.com/en/latest/), [sublimelinter eslint](https://github.com/roadhump/SublimeLinter-eslint), and [eslint formatter](https://github.com/TheSavior/ESLint-Formatter). The plugin supporting pug-lint is [SublimeLinter-contrib-pug-lint](https://github.com/benedfit/SublimeLinter-contrib-pug-lint). 

## Default branch

The default branch will be updated with sprints. When a sprint is closed, the sprint will merge to master, and a new branch will be created from master to the next sprint. All commits or pull requests should be made to the current default branch. A sprint branch is name as `sn`, where `n` is the sprint number.
