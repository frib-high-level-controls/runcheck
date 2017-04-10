module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);
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
        command: 'pug <%= shell.templateSource %> -D -c --name-after-file -o <%= shell.templateOutput %>'
      },
      puglint: {
        command: './node_modules/pug-lint/bin/pug-lint ./views/*.pug ./views/client-side/*.pug'
      }
    },
    ts: {
            app: {
                files: [{
                    src: ['src/app/\*\*/\*.ts', 'src/app/**/*.js', '!src/app/.baseDir.ts'],
                    dest: './app'
                }],
                tsconfig: 'src/app/tsconfig.json'
            }
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
                    "src/app/**/*.ts"
                ]
            }
        }
  
  });

  grunt.registerTask('template', ['shell:template']);
  grunt.registerTask('test', ['mochaTest']);
  grunt.registerTask('puglint', ['shell:puglint']);
  grunt.loadNpmTasks("grunt-ts");
  grunt.loadNpmTasks("grunt-tslint");

  grunt.registerTask('default', ['puglint', 'eslint']);
};
