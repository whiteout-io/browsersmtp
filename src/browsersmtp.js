(function(root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define(['mimefuncs'], function(mimefuncs) {
            return factory(mimefuncs);
        });
    } else if (typeof exports === 'object') {
        module.exports = factory(require('mimefuncs'));
    } else {
        root.BrowserSMTP = factory(root.mimefuncs);
    }
}(this, function(mimefuncs) {
    'use strict';

    /* jshint indent:false */

    function BrowserSMTP(options) {
        this.options = options || {};

        this.users = this.options.users || {
            testuser: {
                password: 'demo',
                xoauth2: {
                    accessToken: 'testtoken',
                    sessionTimeout: 3600 * 1000
                }
            }
        };
    }

    BrowserSMTP.prototype.createTCPSocket = function() {
        var _self = this;
        return {
            open: function(host, port, options) {
                return _self.connect(options);
            }
        };
    };

    BrowserSMTP.prototype.connect = function(options) {
        options = options || {};
        if (!('debug' in options)) {
            options.debug = !!this.options.debug;
        }

        var connection = new SMTPConnection(this, options);

        setTimeout(function() {
            connection._state = 'open';
            connection.onopen({
                target: connection,
                type: 'open',
                data: null
            });
            connection._ondata('220 fake-mx.smtp.lan (More ESMTP than Crappysoft!)');
        }, 15);

        return connection;
    };

    BrowserSMTP.prototype.getCommandHandler = function(command) {
        command = (command || '').toString().toUpperCase();
        return typeof this.commandHandlers[command] === 'function' && this.commandHandlers[command] || false;
    };

    BrowserSMTP.prototype.onmail = function( /*mail*/ ) {};

    function SMTPConnection(server, options) {
        this.server = server;
        this.options = options || {};

        this._dataMode = false;
        this._remainder = '';
        this._literalRemaining = '';
        this._line = '';
        this._command = '';
        this._commandQueue = [];
        this._processing = false;

        this._currentCommand = null;

        this._envelope = {
            mail: false,
            rcpt: []
        };
        this.user = false;

        this.state = 'Not Authenticated';

        this.options.binaryType = this.options.binaryType || 'string';
        this._state = 'init';
    }

    SMTPConnection.prototype.onopen = function( /* evt */ ) {};
    SMTPConnection.prototype.onerror = function( /* evt */ ) {
        throw new Error('Unhandled error event');
    };
    SMTPConnection.prototype.ondata = function( /* evt */ ) {};
    SMTPConnection.prototype.onclose = function( /* evt */ ) {};

    SMTPConnection.prototype.send = function(data) {
        if (this._state !== 'open') {
            return this._onerror(new Error('Connection not open'));
        }

        if (this.options.binaryType === 'arraybuffer') {
            data = mimefuncs.fromTypedArray(data);
        }

        this._processInput(data);
    };

    SMTPConnection.prototype.close = function() {
        var _self = this;

        if (this._state !== 'open') {
            return this._onerror(new Error('Connection not open'));
        }
        this._state = 'close';
        setTimeout(function() {
            _self.onclose({
                target: _self,
                type: 'close',
                data: null
            });
        }, 15);
    };

    SMTPConnection.prototype._onerror = function(err, code) {
        if (code) {
            err.code = code;
        }
        this.onerror({
            target: this,
            type: 'error',
            data: err
        });
    };

    SMTPConnection.prototype._ondata = function(data) {
        var _self = this;

        if (this._state !== 'open') {
            return;
        }

        if (this.options.debug) {
            console.log('SERVER: %s', data.trim());
        }

        data += '\r\n';

        if (this.options.binaryType === 'string' && typeof data === 'object') {
            data = mimefuncs.fromTypedArray(data);
        } else if (this.options.binaryType === 'arraybuffer' && typeof data === 'string') {
            data = mimefuncs.toTypedArray(data);
        }

        setTimeout(function() {
            _self.ondata({
                target: _self,
                type: 'data',
                data: data
            });
        }, 15);
    };

    SMTPConnection.prototype._processInput = function(str) {
        var match;

        this._remainder = str = this._remainder + str;

        if (this._dataMode) {
            while ((match = str.match(/\r?\n\.\r?\n/))) {
                this.scheduleCommand({
                    data: this._line + str.substr(0, match.index)
                });
                this._dataMode = false;
                this._remainder = str = str.substr(match.index + match[0].length);
                this._line = '';
            }
        } else {

            while ((match = str.match(/\r?\n/))) {
                this.scheduleCommand({
                    request: this._line + str.substr(0, match.index)
                });

                this._remainder = str = str.substr(match.index + match[0].length);
                this._line = '';
            }
        }
    };

    SMTPConnection.prototype.scheduleCommand = function(payload) {
        var parts;

        if (this.options.debug) {
            console.log('CLIENT: %s', payload.request || payload.data || '');
        }

        if (this._currentCommand) {
            payload.handler = this._currentCommand;
            payload.args = payload.request;
            this._currentCommand = null;
            this._commandQueue.push(payload);
            this.processQueue(true);
            return;
        } else if (payload.request) {
            parts = payload.request.split(' ');
            payload.command = parts.shift().toUpperCase();
            payload.args = parts.join(' ');

            if ((payload.handler = this.server.getCommandHandler(payload.command))) {
                this._commandQueue.push(payload);
                this.processQueue();
                return;
            }
        }

        // default response
        this._ondata('500 Syntax error, command unrecognised');
        this.processQueue();
    };

    SMTPConnection.prototype.processQueue = function(force) {
        var _self = this;
        var element;

        if (!force && this._processing) {
            return;
        }

        if (!this._commandQueue.length) {
            this._processing = false;
            return;
        }

        this._processing = true;

        element = this._commandQueue.shift();
        try {
            element.handler(this, element, function() {
                _self.processQueue(true);
            });
        } catch (E) {
            this._currentCommand = null;
            this._ondata('501 ' + E.message);
            if (this.options.debug) {
                console.log(E.stack);
            }
            _self.processQueue(true);
        }
    };

    BrowserSMTP.prototype.commandHandlers = {

        HELO: function(connection, payload, callback) {
            var domain = payload.args.trim().split(/\s/).shift().toLowerCase();
            if (!domain) {
                connection._ondata('501 Syntax: HELO hostname');
            } else {
                connection._hostname = domain;
                connection._ondata('250 Hello ' + (domain || '127.0.0.1') + ', I am glad to meet you');
            }
            callback();
        },

        EHLO: function(connection, payload, callback) {
            var domain = payload.args.trim().split(/\s/).shift().toLowerCase();
            if (!domain) {
                connection._ondata('501 Syntax: HELO hostname');
            } else {
                connection._hostname = domain;
                connection._ondata('250-fake-mx.smtp.lan at your service, ' + domain + '\r\n250-AUTH LOGIN PLAIN XOAUTH2\r\n250 SIZE 35882577');
            }
            callback();
        },

        QUIT: function(connection, payload, callback) {
            connection.state = 'Logout';
            connection._ondata('221 Bye');
            connection.close();
            callback();
        },

        RSET: function(connection, payload, callback) {
            connection.state = 'Not Authenticated';
            connection._envelope = {
                mail: false,
                rcpt: []
            };
            connection.user = false;

            connection._ondata('250 Flushed');
            callback();
        },

        NOOP: function(connection, payload, callback) {
            connection._ondata('250 OK');
            callback();
        },

        AUTH: function(connection, payload, callback) {
            if (connection.state !== 'Not Authenticated') {
                connection._ondata('503 No identity changes permitted');
                callback();
                return;
            }

            payload.args = payload.args.split(' ');
            payload.method = payload.args.shift().toUpperCase();
            payload.args = payload.args.join(' ');

            switch (payload.method) {
                case 'PLAIN':
                    if (payload.args) {
                        return connection.server.commandHandlers['AUTH PLAIN'](connection, payload, callback);
                    } else {
                        connection._currentCommand = connection.server.commandHandlers['AUTH PLAIN'];
                        connection._ondata('334');
                    }
                    break;
                case 'LOGIN':
                    if (payload.args) {
                        return connection.server.commandHandlers['AUTH LOGIN :USER'](connection, payload, callback);
                    } else {
                        connection._currentCommand = connection.server.commandHandlers['AUTH LOGIN :USER'];
                        connection._ondata('334 VXNlcm5hbWU6');
                    }
                    break;
                case 'XOAUTH2':
                    return connection.server.commandHandlers['AUTH XOAUTH2'](connection, payload, callback);
                default:
                    connection._ondata('535 Authentication failed: no mechanism available');
            }

            callback();
        },

        'AUTH PLAIN': function(connection, payload, callback) {
            var userdata = mimefuncs.base64Decode(payload.args).split('\x00');
            var username, password;

            if (userdata.length !== 3) {
                connection._ondata('501 Invalid userdata to decode');
                callback();
                return;
            }

            username = userdata[1] || userdata[0];
            password = userdata[2];

            if (connection.server.users.hasOwnProperty(username) && connection.server.users[username].password === password) {
                connection.state = 'Authenticated';
                connection.user = connection.server.users[username];
                if (!connection.user.username) {
                    connection.user.username = username;
                }
                connection._ondata('235 Authentication successful');
            } else {
                connection._ondata('535 Authentication failed');
            }

            callback();
        },

        'AUTH LOGIN :USER': function(connection, payload, callback) {
            connection._username = mimefuncs.base64Decode(payload.args);
            connection._currentCommand = connection.server.commandHandlers['AUTH LOGIN :PASS'];
            connection._ondata('334 UGFzc3dvcmQ6');

            callback();
        },

        'AUTH LOGIN :PASS': function(connection, payload, callback) {
            var username = connection._username;
            var password = mimefuncs.base64Decode(payload.args);
            connection._username = false;

            if (connection.server.users.hasOwnProperty(username) && connection.server.users[username].password === password) {
                connection.state = 'Authenticated';
                connection.user = connection.server.users[username];
                if (!connection.user.username) {
                    connection.user.username = username;
                }
                connection._ondata('235 Authentication successful');
            } else {
                connection._ondata('535 Authentication failed');
            }

            callback();
        },

        'AUTH XOAUTH2': function(connection, payload, callback) {
            var userdata = mimefuncs.base64Decode(payload.args).split('\x01');
            var username, token;
            var user;

            if (userdata.length !== 4) {
                connection._ondata('501 Invalid userdata to decode');
                callback();
                return;
            }

            username = userdata[0].substr(5) || '';
            token = userdata[1].split(' ')[1] || '';
            user = connection.server.users.hasOwnProperty(username) && connection.server.users[username];

            if (user && user.xoauth2 && user.xoauth2.accessToken === token) {
                connection.state = 'Authenticated';
                connection.user = connection.server.users[username];
                if (!connection.user.username) {
                    connection.user.username = username;
                }
                connection._ondata('235 Authentication successful');
            } else {
                connection._currentCommand = connection.server.commandHandlers['AUTH XOAUTH2 :FAIL'];
                connection._ondata('334 eyJzdGF0dXMiOiI0MDEiLCJzY2hlbWVzIjoiYmVhcmVyIG1hYyIsInNjb3BlIjoiaHR0cHM6Ly9tYWlsLmdvb2dsZS5jb20vIn0K');
            }

            callback();
        },

        'AUTH XOAUTH2 :FAIL': function(connection, payload, callback) {
            if (payload.args) {
                connection._ondata('501 Empty response expected');
                callback();
            }
            connection._ondata('535 Username and Password not accepted');

            callback();
        },

        MAIL: function(connection, payload, callback) {
            var match;
            var address;

            if (!connection._hostname) {
                connection._ondata('503 Send EHLO first');
                return callback();
            }

            if (connection.state !== 'Authenticated') {
                connection._ondata('530 Authentication Required');
                return callback();
            }

            if (connection._envelope.mail !== false) {
                connection._ondata('503 Nested MAIL command');
                return callback();
            }

            match = payload.args.match(/^from\:\s*<([^@>]+\@([^@>]+))?>(\s|$)/i);
            if (!match) {
                connection._ondata('501 Bad sender address syntax');
                return callback();
            }

            address = match[1] || '';

            connection._envelope.mail = address;
            connection._ondata('250 Ok');

            callback();
        },

        RCPT: function(connection, payload, callback) {
            var match;
            var address;

            if (connection._envelope.mail === false) {
                connection._ondata('503 Need MAIL command');
                return callback();
            }

            match = payload.args.match(/^to\:\s*<([^@>]+\@([^@>]+))>(\s|$)/i);
            if (!match) {
                connection._ondata('501 Bad sender address syntax');
                return callback();
            }
            address = match[1] || '';

            // only include unseen addresses
            if (!connection._envelope.rcpt.filter(function(rcpt) {
                return rcpt.toLowerCase().trim() === address.toLowerCase().trim();
            }).length) {
                connection._envelope.rcpt.push(address);
            }

            connection._ondata('250 Ok');

            callback();
        },

        DATA: function(connection, payload, callback) {
            if (!connection._envelope.rcpt.length) {
                connection._ondata('503 Need RCPT command');
                return callback();
            }

            connection._dataMode = true;
            connection._currentCommand = connection.server.commandHandlers['DATA :BODY'];
            connection._ondata('354 End data with <CR><LF>.<CR><LF>');
            callback();
        },

        'DATA :BODY': function(connection, payload, callback) {

            connection.server.onmail({
                hostname: connection._hostname,
                from: connection._envelope.mail,
                to: connection._envelope.rcpt,
                body: payload.data
            });

            connection._envelope = {
                mail: false,
                rcpt: []
            };

            connection._ondata('250 Ok: queued as 12345');
            callback();
        }
    };

    return BrowserSMTP;
}));