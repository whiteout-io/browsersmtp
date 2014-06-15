module.exports = function(grunt) {
    'use strict';

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: ['*.js', 'src/*.js', 'test/unit/*.js'],
            options: {
                jshintrc: '.jshintrc'
            }
        },

        mocha_phantomjs: {
            all: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/unit/unit.html']
            }
        },

        watch: {
            js: {
                files: ['src/*.js'],
                tasks: ['deps']
            }
        },

        copy: {
            npm: {
                expand: true,
                flatten: true,
                cwd: 'node_modules/',
                src: [
                    'mocha/mocha.js',
                    'mocha/mocha.css',
                    'chai/chai.js',
                    'sinon/pkg/sinon.js',
                    'requirejs/require.js',
                    'stringencoding/dist/stringencoding.js',
                    'mimefuncs/src/mimefuncs.js'
                ],
                dest: 'test/lib/'
            },
            app: {
                expand: true,
                flatten: true,
                cwd: 'src/',
                src: [
                    '*.js',
                ],
                dest: 'test/lib/'
            }
        },
        clean: ['test/lib/**/*']
    });

    // Load the plugin(s)
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-phantomjs');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('dev', ['jshint', 'deps']);
    grunt.registerTask('deps', ['clean', 'copy']);
    grunt.registerTask('test', ['jshint', 'mocha_phantomjs']);
    grunt.registerTask('default', ['deps', 'test']);
};