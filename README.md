browsersmtp
===========

Incredibly hacky SMTP integration test server in the browser.

See demo [here](http://tahvel.info/browsersmtp/example/client.html).

### Hook BrowserSMTP server with [SmtpClient](https://github.com/whiteout-io/smtpclient)

Create server instance

    server = new BrowserSMTP({});

Create client instance

    client = new SmtpClient(false, false, {
        auth: {
            user: "testuser",
            pass: "demo"
        },
        useSSL: false
    });

Replace TCPSocket constructor with a mock object from the server

    client._TCPSocket = server.createTCPSocket();

Connect to the server and start hacking

    client.connect();

Thats it!