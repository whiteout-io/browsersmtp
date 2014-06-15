'use strict';

if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {

    var chai = require('chai');
    var BrowserSMTP = require('browsersmtp');

    var expect = chai.expect;
    chai.Assertion.includeStack = true;

    describe('BrowserSMTP unit tests', function() {
        /* jshint indent:false */

        describe('#_ondata', function() {
            it('should send mail', function(done) {
                var server = new BrowserSMTP({
                    debug: false
                });
                server.onmail = function(mail) {
                    expect(mail).to.deep.equal({
                        hostname: 'foo',
                        from: 'sender@example.com',
                        to: [
                            'receiver1@example.com',
                            'receiver2@example.com'
                        ],
                        body: 'hallo\r\nhallo\r\nhelgi\r\nsallo!'
                    });
                    done();
                };
                var connection = server.connect();
                connection.onopen = function(e) {
                    expect(e.type).to.equal('open');

                    var str = 'EHLO foo\r\n' +
                        'AUTH PLAIN AHRlc3R1c2VyAGRlbW8=\r\n' +
                        'MAIL FROM:<sender@example.com>\r\n' +
                        'RCPT TO:<receiver1@example.com>\r\n' +
                        'RCPT TO:<receiver2@example.com>\r\n' +
                        'DATA\r\n' +
                        'hallo\r\n' +
                        'hallo\r\n' +
                        'helgi\r\n' +
                        'sallo!\r\n' +
                        '.\r\n' +
                        'quit\r\n';

                    for (var i = 0; i < str.length; i++) {
                        connection.send(str.charAt(i));
                    }
                };
            });
        });
    });
});