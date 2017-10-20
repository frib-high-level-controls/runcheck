module.exports = function(grunt) {
    'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    eslint: {
      target: ['gruntfile.js', 'lib/**/*.js', 'routes/**/*.js', 'public/javascripts/*.js', 'test/**/*.js']
    },
    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/**/*.js']
      }
    },
    shell: {
      templateSource: 'views/client-side/*.pug',
      templateOutput: 'public/javascripts/template',
      options: {
        stderr: false
      },
      template: {
        command: './node_modules/.bin/pug <%= shell.templateSource %> -D -c --name-after-file -o <%= shell.templateOutput %>'
      },
      puglint: {
        command: './node_modules/.bin/pug-lint ./views/*.pug ./views/client-side/*.pug'
      }
    },
    ts: {
      app: {
        tsconfig: {
           tsconfig: './src/app',
           passThrough: true,
        },
        // The additional flags specified below seems like it should be equivalent
        // to using the outDir option, but when the outDir option is used then the
        // Typescript compiler fails for find the source files (grunt-ts v5.5.1).
        //outDir: './app',
        options: {
            additionalFlags: '--outDir ./app'
        },
      },
      apptest: {
        tsconfig: {
           tsconfig: './src/apptest',
           passThrough: true,
        },
        options: {
            additionalFlags: '--outDir ./test'
        },
      },
      tools: {
        tsconfig: {
            tsconfig: './src/tools',
            passThrough: true,
        },
        // The additional flags specified below seems like it should be equivalent
        // to using the outDir option, but when the outDir option is used then the
        // Typescript compiler fails for find the source files (grunt-ts v5.5.1).
        //outDir: './app',
        options: {
            additionalFlags: '--outDir ./tools'
        },
      },
      web: {
        tsconfig: {
           tsconfig: './src/web/ts',
           passThrough: true,
        },
        options: {
            additionalFlags: '--outDir ./public/js'
        },
      },
    },
        tslint: {
            options: {
                configuration: "tslint.json",
                // If set to true, tslint errors will be reported, but not fail the task 
                // If set to false, tslint errors will be reported, and the task will fail 
                force: false,
                fix: false
            },
            files: {
                src: [
                    "src/**/*.ts"
                ]
            }
        },
        clean: {
            app: [ './app' ],
            test: [ './test' ],
            tools: [ './tools' ],
            public: [ './public/js' ],
        }
    });

  grunt.loadNpmTasks("grunt-shell");
  grunt.loadNpmTasks("grunt-ts");
  grunt.loadNpmTasks("grunt-tslint");
  grunt.loadNpmTasks("grunt-contrib-clean");

  grunt.registerTask('template', ['shell:template']);
  grunt.registerTask('test', ['mochaTest']);
  grunt.registerTask('puglint', ['shell:puglint']);

  grunt.registerTask("default", [
    'ts:app',
    'ts:web',
    'shell:template'
  ]);
};
