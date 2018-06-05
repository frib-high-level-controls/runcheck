module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
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
      options: {
        stderr: false
      },
      puglint: {
        command: './node_modules/.bin/pug-lint ./views/*.pug ./views/web/*.pug',
      },
      pugcompile: {
        command: './node_modules/.bin/pug ./views/web/*.pug -D -P -c --name-after-file -o ./public/js/templates',
      },
      pugrender: {
        command: './node_modules/.bin/pug ./views/docs/*.pug -O \'{ "basePath":".." }\' -D -P --name-after-file -o ./public/docs',
      },
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
        configuration: 'tslint.json',
        // If set to true, tslint errors will be reported, but not fail the task 
        // If set to false, tslint errors will be reported, and the task will fail 
        force: false,
        fix: false
      },
      files: {
        src: [
          'src/**/*.ts'
        ],
      },
    },
    copy: {
      pkg: {
        files: [{
          expand: true,
          src: 'package.json',
          dest: 'app/'
        }],
      },
    },
    clean: {
      app: [ './app' ],
      test: [ './test' ],
      tools: [ './tools' ],
      public: [ './public/js' ],
      docs: [ './public/docs/*.html' ]
    }
  });

  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-tslint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('template', ['shell:template']);
  grunt.registerTask('test', ['mochaTest']);
  grunt.registerTask('puglint', ['shell:puglint']);

  grunt.registerTask('default', [
    'build',
  ]);

  grunt.registerTask('build', [
    'ts:app',
    'copy:pkg',
    'ts:web',
    'ts:tools',
    'shell:pugcompile',
    'shell:pugrender',
  ]);

  grunt.registerTask('deploy', [
    'clean',
    'build',
  ]);

  grunt.registerTask('lint', [
    'tslint',
    'puglint',
  ]);
};
