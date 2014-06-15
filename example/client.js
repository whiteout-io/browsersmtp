'use strict';

var server = new BrowserSMTP({
    debug: true
});

var socket = server.connect();

socket.onopen = function() {
    log('Connection', 'opened');
};

socket.onclose = function() {
    log('Connection', 'closed');
};

socket.ondata = function(evt) {
    log('SERVER', evt.data);
};

socket.onerror = function(evt) {
    log('SERVER ERROR', evt.data);
};

document.getElementById('client-input-form').addEventListener('submit', function(e) {
    e.preventDefault();

    var data = document.getElementById('client-input-data').value;
    document.getElementById('client-input-data').value = '';

    log('CLIENT', data);
    socket.send(data + '\r\n');
}, false);

function log(type, str) {
    var box = document.getElementById('log');
    if (typeof str !== 'object' || !str) {
        box.value += type + ': ' + str.trim() + '\n';
    } else {
        box.value += type + ':\n' + (str.stack ? str.stack : JSON.stringify(str)) + '\n';
    }

    box.scrollTop = box.scrollHeight;
}