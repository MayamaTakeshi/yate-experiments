const assert = require('assert')
const tl = require('tracing-log')

const { Yate, YateMessage, YateChannel } = require("next-yate");

let yate = new Yate({host: "127.0.0.1"});
yate.init();

let location = {}

async function onCallRoute(msg) {
    return new Promise((resolve, reject) => {
        z.push_event({
            event: 'call.route',
            msg,
            resolve,
            reject,
        })
    })
}

async function onUserAuth(msg) {
    return new Promise((resolve, reject) => {
        z.push_event({
            event: 'user.auth',
            msg,
            resolve,
            reject,
        })
    })
}

async function onUserRegister(msg) {
    return new Promise((resolve, reject) => {
        z.push_event({
            event: 'user.register',
            msg,
            resolve,
            reject,
        })
    })
}

async function onUserUnregister(msg) {
    return new Promise((resolve, reject) => {
        z.push_event({
            event: 'user.unregister',
            msg,
            resolve,
            reject,
        })
    })
}

yate.install(onCallRoute, 'call.route');
yate.install(onUserAuth, 'user.auth')
yate.install(onUserRegister, 'user.register')
yate.install(onUserUnregister, 'user.unregister')

var sip = require ('sip-lab')
var Zeq = require('@mayama/zeq')
var z = new Zeq()
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
        const e = evt.args[0]
        return e
    })

    tl.info(sip.start((data) => { tl.info(data)} ))

    t1 = sip.transport.create({address: "127.0.0.1", port: 5090, type: "udp"})
    t2 = sip.transport.create({address: "127.0.0.1", port: 5092, type: "udp"})

    tl.info("t1", t1)
    tl.info("t2", t2)

    const a_user2 = sip.account.create(t2.id, {
        domain, 
        server: yate_server,
        username: 'user2',
        password: 'pass2',
    })

    sip.account.register(a_user2, {auto_refresh: true})

    await z.wait([
        {
            event: 'user.auth',
            msg: {
                protocol: 'sip',
                method: 'REGISTER',
                uri: 'sip:127.0.0.1:5060',
                ip_host: '127.0.0.1',
                ip_port: '5092',
                ip_transport: 'UDP',
                address: '127.0.0.1:5092',
                connection_id: 'general',
                connection_reliable: false,
                newcall: false,
                domain,
                number: 'user2',
                expires: '60',
                handlers: 'monitoring:1,regfile:100,next-yate:100'
            },
            resolve: m.collect('resolve')
        },
    ], 1000)

    // resolve the user.auth promise saying the user is authorized
    z.store.resolve(true)

    delete z.store.resolve

    await z.wait([
        {
            event: 'user.register',
            msg: m.collect('msg', {
                number: 'user2',
                sip_uri: 'sip:127.0.0.1:5060',
                expires: '60',
                newcall: false,
                domain,
                username: 'user2',
                driver: 'sip',
                data: 'sip/sip:user2@127.0.0.1:5092',
                ip_host: '127.0.0.1',
                ip_port: '5092',
                ip_transport: 'UDP',
                address: '127.0.0.1:5092',
                connection_id: 'general',
                connection_reliable: false,
                route_params: 'oconnection_id',
                oconnection_id: 'general',
                sip_to: 'sip:user2@127.0.0.1:5092',
                sip_contact: '<sip:user2@127.0.0.1:5092>',
                sip_expires: '60',
                sip_allow: 'MESSAGE, SUBSCRIBE, NOTIFY, REFER, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK',
                handlers: 'monitoring:1,regfile:100,next-yate:100'
            }),
            resolve: m.collect('resolve')
        },
    ], 1000)

    // resolve the promise for user.register (but I am not sure if it is really needed)
    z.store.resolve(true)

    delete z.store.resolve

    var msg = z.store.msg

    delete z.store.msg

    var key = `${msg.username}@${msg.domain}`
    location[key] = msg.data

    await z.wait([
        {
            event: 'registration_status',
            account_id: a_user2.id,
            code: 200,
            reason: 'OK',
            expires: 60
        },
    ], 1000)

    oc = sip.call.create(t1.id, {from_uri: `sip:user1@${domain}`, to_uri: `sip:user2@${yate_server}`, request_uri: `sip:user2@${yate_server}`, 
        auth: {
            realm: domain,
            username: 'user1',
            password: 'pass1',
        },
    })

    await z.wait([
        {
            event: 'user.auth',
            msg: {
              protocol: 'sip',
              method: 'INVITE',
              uri: 'sip:user2@127.0.0.1:5060',
              ip_host: '127.0.0.1',
              ip_port: '5090',
              ip_transport: 'UDP',
              address: '127.0.0.1:5090',
              connection_id: 'general',
              connection_reliable: false,
              newcall: true,
              domain,
              //id: 'sip/6',
              caller: 'user1',
              called: 'user2',
              //billid: '1758315927-4',
              handlers: 'monitoring:1,regfile:100,next-yate:100'
            },
            resolve: m.collect('resolve')
        },
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
    ], 1000)

    // resolve the user.auth promise saying the user is authorized
    z.store.resolve(true)

    delete z.store.resolve

    await z.wait([
        {
            event: 'call.route',
            msg: m.collect('msg', {
              //id: 'sip/7',
              module: 'sip',
              status: 'incoming',
              address: '127.0.0.1:5090',
              //billid: '1758315927-5',
              answered: false,
              direction: 'incoming',
              //callid: 'sip/e5470fe6-01c8-4ff1-b771-3aefd34d74b2/44f37fde-1a11-4a41-aebd-75bcc145091a/',
              caller: 'user1',
              called: 'user2',
              antiloop: '19',
              ip_host: '127.0.0.1',
              ip_port: '5090',
              ip_transport: 'UDP',
              connection_id: 'general',
              connection_reliable: false,
              sip_uri: 'sip:user2@127.0.0.1:5060',
              sip_from: 'sip:user1@test1.com',
              sip_to: 'sip:user2@127.0.0.1',
              //sip_callid: 'e5470fe6-01c8-4ff1-b771-3aefd34d74b2',
              device: '',
              sip_contact: '<sip:user1@127.0.0.1:5090>',
              sip_allow: 'MESSAGE, SUBSCRIBE, NOTIFY, REFER, INVITE, ACK, BYE, CANCEL, UPDATE',
              'sip_content-type': 'application/sdp',
              newcall: true,
              domain,
              username: '',
              xsip_nonce_age: '0',
              rtp_addr: '127.0.0.1',
              media: 'yes',
              formats: 'mulaw',
              transport: 'RTP/AVP',
              rtp_rfc2833: '120',
              rtp_port: '10000',
              'sdp_BW-TIAS': '64000',
              sdp_rtcp: '10001 IN IP4 127.0.0.1',
              sdp_sendrecv: '',
              rtp_forward: 'possible',
              handlers: 'javascript:15,cdrbuild:50,fileinfo:90,subscription:100,sip:100,iax:100,regexroute:100,jingle:100,analog:100,sig:100,regfile:100,next-yate:100'
            }),
            resolve: m.collect('resolve')
          },
    ], 1000)

    msg = z.store.msg

    delete z.store.msg

    key = `${msg.called}@${msg.domain}`
    var address = location[key]

    // confirm we got the address in previous registration handling
    assert(address)

    msg.retValue(address)
    z.store.resolve(true)

    delete z.store.resolve
    
    await z.wait([
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

    sip.call.respond(ic.id, {code: 200, reason: 'OK'})

    await z.wait([
        {
            event: 'media_update',
            call_id: oc.id,
            status: 'ok',
            media: [
              {
                type: 'audio',
                protocol: 'RTP/AVP',
                local: {
                  addr: '127.0.0.1',
                  mode: 'sendrecv'
                },
                remote: {
                  addr: '127.0.0.1',
                  mode: 'unknown', // Yate doesn't send a=sendrecv so we set remote_mode='unknown'
                },
                fmt: [
                  '0 PCMU/8000',
                  '120 telephone-event/8000'
                ]
              }
            ],
        },
        {
            event: 'media_update',
            call_id: ic.id,
            status: 'ok',
            media: [
              {
                type: 'audio',
                protocol: 'RTP/AVP',
                local: {
                  addr: '127.0.0.1',
                  mode: 'sendrecv'
                },
                remote: {
                  addr: '127.0.0.1',
                  mode: 'unknown', // Yate doesn't send a=sendrecv so we set remote_mode='unknown'
                },
                fmt: [
                  '0 PCMU/8000',
                  '101 telephone-event/8000'
                ]
              }
            ],
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
            }),
        },
    ], 1000)

    sip.call.start_inband_dtmf_detection(oc.id)

    sip.call.send_dtmf(oc.id, {digits: '1234', mode: 0})
    sip.call.send_dtmf(ic.id, {digits: '4321', mode: 1})

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

    sip.call.reinvite(oc.id, {media: [{type: 'audio', fields: ['a=sendonly']}]})

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
            }),
        },
        {
            event: 'media_update',
            call_id: oc.id,
            status: 'ok',
            media: [
              {
                type: 'audio',
                protocol: 'RTP/AVP',
                local: {
                  addr: '127.0.0.1',
                  mode: 'sendonly'
                },
                remote: {
                  addr: '127.0.0.1',
                  mode: 'recvonly'
                },
                fmt: [
                  '0 PCMU/8000',
                  '120 telephone-event/8000'
                ]
              }
            ]
        },
    ], 500)

    sip.call.send_dtmf(oc.id, {digits: '1234', mode: 0})
    sip.call.send_dtmf(ic.id, {digits: '4321', mode: 1}) // this will not generate event 'dtmf' as the call is on hold

    await z.wait([
        {
            event: 'dtmf',
            call_id: ic.id,
            digits: '1234',
            mode: 0,
        },
    ], 2000)

    sip.call.reinvite(ic.id, {media: [{type: 'audio', fields: ['a=sendonly']}]})

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
            event: 'media_update',
            call_id: ic.id,
            status: 'ok',
            media: [
              {
                type: 'audio',
                protocol: 'RTP/AVP',
                local: {
                  addr: '127.0.0.1',
                  mode: 'sendonly'
                },
                remote: {
                  addr: '127.0.0.1',
                  mode: 'recvonly'
                },
                fmt: [
                  '0 PCMU/8000',
                  '101 telephone-event/8000'
                ]
              }
            ]
        },
    ], 500)

    // these will not generate event 'dtmf' because the call is on hold on both legs
    sip.call.send_dtmf(oc.id, {digits: '1234', mode: 0})
    sip.call.send_dtmf(ic.id, {digits: '4321', mode: 1})

    await z.sleep(1000)

    // now unhold leg1
    sip.call.reinvite(oc.id)

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
            event: 'media_update',
            call_id: oc.id,
            status: 'ok',
            media: [
              {
                type: 'audio',
                protocol: 'RTP/AVP',
                local: {
                  addr: '127.0.0.1',
                  mode: 'sendrecv'
                },
                remote: {
                  addr: '127.0.0.1',
                  mode: 'sendrecv'
                },
                fmt: [
                  '0 PCMU/8000',
                  '120 telephone-event/8000'
                ]
              }
            ]
        },
    ], 500)

    // now unhold leg2
    sip.call.reinvite(ic.id)

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
            event: 'media_update',
            call_id: ic.id,
            status: 'ok',
            media: [
              {
                type: 'audio',
                protocol: 'RTP/AVP',
                local: {
                  addr: '127.0.0.1',
                  mode: 'sendrecv'
                },
                remote: {
                  addr: '127.0.0.1',
                  mode: 'sendrecv'
                },
                fmt: [
                  '0 PCMU/8000',
                  '101 telephone-event/8000'
                ]
              }
            ]
        },
    ], 500)

    sip.call.send_dtmf(oc.id, {digits: '1234', mode: 0})
    sip.call.send_dtmf(ic.id, {digits: '4321', mode: 1})

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

    sip.account.unregister(a_user2)

    await z.wait([
        {
            event: 'user.auth',
            msg: {
                protocol: 'sip',
                method: 'REGISTER',
                uri: 'sip:127.0.0.1:5060',
                ip_host: '127.0.0.1',
                ip_port: '5092',
                ip_transport: 'UDP',
                address: '127.0.0.1:5092',
                connection_id: 'general',
                connection_reliable: false,
                newcall: false,
                domain,
                number: 'user2',
                expires: '0',
                handlers: 'monitoring:1,regfile:100,next-yate:100'
            },
            resolve: m.collect('resolve'),
        },
    ], 1000)

    // resolve the user.auth promise saying the user is authorized
    z.store.resolve(true)

    delete z.store.resolve

    await z.wait([
        {
            event: 'user.unregister',
            msg: m.collect('msg', {
                number: 'user2',
                sip_uri: 'sip:127.0.0.1:5060',
                //sip_callid: 'a3e9244e-349f-4810-a91e-f6bb6693bdea',
                expires: '0',
                newcall: false,
                domain: 'test1.com',
                username: 'user2',
                driver: 'sip',
                data: 'sip/sip:user2@127.0.0.1:5092',
                ip_host: '127.0.0.1',
                ip_port: '5092',
                ip_transport: 'UDP',
                address: '127.0.0.1:5092',
                connection_id: 'general',
                connection_reliable: false,
                sip_contact: '<sip:user2@127.0.0.1:5092>',
                sip_expires: '0',
                handlers: 'regfile:100,next-yate:100'
            }),
            resolve: m.collect('resolve'),
        },
    ], 1000)

    msg = z.store.msg

    delete z.store.msg

    // resolving the user.unregister promive. Not sure if it is really necessary
    z.store.resolve(true)

    var key = `${msg.username}@${msg.domain}`
    assert(location[key])
    delete location[key]

    await z.wait([
        {
            event: 'registration_status',
            account_id: a_user2.id,
            code: 200,
            reason: 'OK',
            expires: 0
        },
    ], 1000)

    tl.info("Success")

    sip.stop()
    process.exit(0)
}


test()
.catch(e => {
    console.error(e)
    process.exit(1)
})

