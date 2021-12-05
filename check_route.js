/**
 * @file check_route.js
 * @license Apache-2.0
 * @author Anton <aucyxob@gmail.com>
 * @description The test routing rmanager utility is based on core API of "next-yate"
 * @example 
 * >telnet localhost 5038
 * >route 99991001
 */

const tl = require('tracing-log')

const { Yate, YateMessage, YateChannel } = require("next-yate");

let yate = new Yate({host: "127.0.0.1"});
yate.init();

async function onTimer(msg) {
    tl.info('onTimer')
    //console.dir(msg)
}

async function onCallRoute(msg) {
    tl.info('onCallRoute')
    //console.dir(msg)

    msg.retValue("dumb/");
    msg.autoanswer = true;
    let chan = new YateChannel(msg)
    chan.caller = msg.caller; // Remember the callerid
    chan.init(async () => { await chan.callTo("wave/play/./share/sounds/words/hello.wav") })
    return true
}

//yate.install(onTimer, "engine.timer");
yate.install(onCallRoute, 'call.route');
