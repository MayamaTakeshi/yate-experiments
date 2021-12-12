const tl = require('tracing-log')

const { Yate, YateMessage, YateChannel } = require("next-yate");

let yate = new Yate({host: "127.0.0.1"});
yate.init();

let location = {}

async function onCallRoute(msg) {
    tl.info('onCallRoute')
    //tl.info(JSON.stringify(msg))

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

yate.install(onCallRoute, 'call.route');

yate.install(onAuth, 'user.auth')
yate.install(onRegister, 'user.register')
yate.install(onUnregister, 'user.unregister')

var sip = require ('sip-lab')
var Zester = require('zester')
var z = new Zester()
var m = require('data-matching')
var sip_msg = require('sip-matching')

const yate_server = "127.0.0.1:5060"
const domain = 'test1.com'

async function test() {
    await z.sleep(1000) // wait a little because yate.install() needs to complete

    //sip.set_log_level(6)
    sip.dtmf_aggregation_on(500)

    sip.set_codecs("PCMU/8000/1:128")

    z.trap_events(sip.event_source, 'event', (evt) => {
        var e = evt.args[0]
        return e
    })

    tl.info(sip.start((data) => { tl.info(data)} ))

    t1 = sip.transport.create("127.0.0.1", 5090, 1)
    t2 = sip.transport.create("127.0.0.1", 5092, 1)

    tl.info("t1", t1)
    tl.info("t2", t2)

    var a1 = sip.account.create(t1.id, domain, yate_server, 'user1', 'pass1')
    var a2 = sip.account.create(t2.id, domain, yate_server, 'user2', 'pass2')

    sip.account.register(a1, true)
    sip.account.register(a2, true)

    await z.wait([
        {
            event: 'registration_status',
            account_id: a1.id,
            code: 200,
            reason: 'OK',
            expires: 60
        },
        {
            event: 'registration_status',
            account_id: a2.id,
            code: 200,
            reason: 'OK',
            expires: 60
        },
    ], 1000)

    flags = 0

    oc = sip.call.create(t1.id, flags, `sip:user1@${domain}`, `sip:user2@${yate_server}`, `sip:user2@${yate_server}`, '', '', domain, 'user1', 'pass1')

    await z.wait([
        {
            event: 'response',
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
                '$(hdrcnt(via))': 1,
                '$hdr(call-id)': m.collect('sip_call_id'),
                $fU: 'user1',
                $fd: domain,
                $tU: 'user2',
            }),
        },
        {
            event: "incoming_call",
            call_id: m.collect("call_id"),
            msg: sip_msg({
                $fU: 'user1',
                $tU: 'user2',
            }),
        },
    ], 2000)

    var ic = {
        id: z.store.call_id,
        sip_call_id: z.store.sip_call_id,
    }

    sip.call.respond(ic.id, 200, 'OK')

    await z.wait([
        {
            event: 'media_status',
            call_id: oc.id,
            status: 'setup_ok',
            local_mode: 'sendrecv',
            remote_mode: 'unknown', // Yate doesn't send a=sendrecv so we set remote_mode='unknown'
        },
        {
            event: 'media_status',
            call_id: ic.id,
            status: 'setup_ok',
            local_mode: 'sendrecv',
            remote_mode: 'unknown', // Yate doesn't send a=sendrecv so we set remote_mode='unknown'
        },
        {
            event: 'response',
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '200',
                $rr: 'OK',
                '$(hdrcnt(VIA))': 1,
                $fU: 'user1',
                $fd: domain,
                $tU: 'user2',
                '$hdr(content-type)': 'application/sdp',
                //$rb: '!{_}a=sendrecv', // Yate doesn't send a=sendrecv
            }),
        },
    ], 1000)

    sip.call.send_dtmf(oc.id, '1234', 0)
    sip.call.send_dtmf(ic.id, '4321', 1)

    await z.wait([
        {
            event: 'dtmf',
            call_id: ic.id,
            digits: '1234',
            mode: 0,
        },
        {
            event: 'dtmf',
            call_id: oc.id,
            digits: '4321',
            mode: 1,
        },
    ], 2000)


    sip.call.reinvite(oc.id, true, 0)

    await z.wait([
        {
            event: 'response', // Yate sends '100 Trying' before '200 OK' for REINIVTE
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
            }),
        },
        {
            event: 'response',
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '200',
                $rr: 'OK',
                //$rb: '!{_}a=sendrecv', // Yate doesn't send a=sendrecv
            }),
        },
        {
            event: 'media_status',
            call_id: oc.id,
            status: 'setup_ok',
            local_mode: 'sendonly',
            remote_mode: 'unknown', // Yate doesn't send a=recvonly so we set remote_mode='unknown'
        },
    ], 500)

    sip.call.send_dtmf(oc.id, '1234', 0)
    sip.call.send_dtmf(ic.id, '4321', 1) // this will not generate event 'dtmf' as the call is on hold

    await z.wait([
        {
            event: 'dtmf',
            call_id: ic.id,
            digits: '1234',
            mode: 0,
        },
    ], 2000)

    sip.call.reinvite(ic.id, true, 0)

    await z.wait([
        {
            event: 'response',
            call_id: ic.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
            }),
        },
        {
            event: 'response',
            call_id: ic.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '200',
                $rr: 'OK',
            }),
        },
        {
            event: 'media_status',
            call_id: ic.id,
            status: 'setup_ok',
            local_mode: 'sendonly',
            remote_mode: 'unknown',
        },
    ], 500)

    // these will not generate event 'dtmf' because the call is on hold on both legs
    sip.call.send_dtmf(oc.id, '1234', 0)
    sip.call.send_dtmf(ic.id, '4321', 1)

    await z.sleep(1000)

    sip.call.reinvite(oc.id, false, 0)

    await z.wait([
        {
            event: 'response',
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
            }),
        },
        {
            event: 'response',
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '200',
                $rr: 'OK',
            }),
        },
        {
            event: 'media_status',
            call_id: oc.id,
            status: 'setup_ok',
            local_mode: 'sendrecv',
            remote_mode: 'unknown',
        },
    ], 500)

    sip.call.reinvite(ic.id, false, 0)

    await z.wait([
        {
            event: 'response',
            call_id: ic.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
            }),
        },
        {
            event: 'response',
            call_id: ic.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '200',
                $rr: 'OK',
            }),
        },
        {
            event: 'media_status',
            call_id: ic.id,
            status: 'setup_ok',
            local_mode: 'sendrecv',
            remote_mode: 'unknown',
        },
    ], 500)

    sip.call.send_dtmf(oc.id, '1234', 0)
    sip.call.send_dtmf(ic.id, '4321', 1)

    await z.wait([
        {
            event: 'dtmf',
            call_id: ic.id,
            digits: '1234',
            mode: 0,
        },
        {
            event: 'dtmf',
            call_id: oc.id,
            digits: '4321',
            mode: 1,
        },
    ], 2000)

    sip.call.terminate(oc.id)

    await z.wait([
        {
            event: 'call_ended',
            call_id: oc.id,
        },
        {
            event: 'call_ended',
            call_id: ic.id,
        },
        {
            event: 'response',
            call_id: oc.id,
            method: 'BYE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
            }),
        },
        {
            event: 'response',
            call_id: oc.id,
            method: 'BYE',
            msg: sip_msg({
                $rs: '200',
                $rr: 'OK',
            }),
        },
    ], 1000)

    await z.sleep(1000)

    sip.account.unregister(a1)
    sip.account.unregister(a2)

    await z.wait([
        {
            event: 'registration_status',
            account_id: a1.id,
            code: 200,
            reason: 'OK',
            expires: 0
        },
        {
            event: 'registration_status',
            account_id: a2.id,
            code: 200,
            reason: 'OK',
            expires: 0
        },
    ], 1000)

    tl.info("Success")

    sip.stop()
}


test()
.catch(e => {
    console.error(e)
    process.exit(1)
})

