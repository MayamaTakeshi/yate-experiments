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

    msg.retValue("sip/sip:b@127.0.0.1:5092")
    return true

    msg.retValue("dumb/");
    msg.autoanswer = true;
    let chan = new YateChannel(msg)
    chan.caller = msg.caller; // Remember the callerid
    await chan.callTo("tone/dtmf/1234")
    await Channel.answered()
    //chan.init(async () => { await chan.callTo("wave/play/./share/sounds/words/hello.wav") })
    await chan.callTo("sip/sip:b@127.0.0.1:5092")
    return true
}

//yate.install(onTimer, "engine.timer");
yate.install(onCallRoute, 'call.route');