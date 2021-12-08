const tl = require('tracing-log')

const { Yate, YateMessage, YateChannel } = require("next-yate");

let yate = new Yate({host: "127.0.0.1"});
yate.init();

let location = {}

async function onTimer(msg) {
    tl.info('onTimer')
    //console.dir(msg)
}

async function onCallRoute(msg) {
    tl.info('onCallRoute')
    //tl.info(JSON.stringify(msg))

    //msg.retValue("sip/sip:b@127.0.0.1:5092")

    var key = `${msg.called}@${msg.domain}`
    var address = location[key]
    if(address) {
        tl.info(`key=${key} found address=${address}`)
        msg.retValue(address)
        return true
    } else {
        tl.info(`key=${key} not found`)
        return false
    }
}

async function onAuth(msg) {
    tl.info('onAuth')
    return true
}

async function onRegister(msg) {
    tl.info('onRegister')
    //tl.info(JSON.stringify(msg))
    var key = `${msg.username}@${msg.domain}`
    location[key] = msg.data

    tl.info(`location=${JSON.stringify(location)}`)
    return true
}

async function onUnregister(msg) {
    tl.info('onUnregister')
    //tl.info(JSON.stringify(msg))

    var key = `${msg.username}@${msg.domain}`
    delete location[key]

    tl.info(`location=${JSON.stringify(location)}`)
    return true
}

//yate.install(onTimer, "engine.timer");
yate.install(onCallRoute, 'call.route');

yate.install(onAuth, 'user.auth')
yate.install(onRegister, 'user.register')
yate.install(onUnregister, 'user.unregister')

