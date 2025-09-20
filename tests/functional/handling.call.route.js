const tl = require('tracing-log')

const { Yate, YateMessage, YateChannel } = require("next-yate");

var sip = require ('sip-lab')
var Zeq = require('@mayama/zeq')
var z = new Zeq()
var m = require('data-matching')
var sip_msg = require('sip-matching')

var utils = require('./lib/utils.js')

let yate = new Yate({host: "127.0.0.1"});
yate.init();

// yate sends this before or after 'call.route' unpredictably and might resend 'call.route' if we don't reply fast enough
let trying_filter = {
    event: 'response',
    method: 'INVITE',
    msg: sip_msg({
        $rs: '100',
        $rr: 'Trying',
    }),
}

z.add_event_filter(trying_filter)

async function test() {
    await utils.hangup_all_yate_calls(yate)

    await utils.set_yate_msg_trap(yate, 'call.route', z);

    //sip.set_log_level(6)
    sip.dtmf_aggregation_on(500)

    sip.set_codecs("PCMU/8000/1:128")

    z.trap_events(sip.event_source, 'event', (evt) => {
        var e = evt.args[0]
        return e
    })

    console.log(sip.start((data) => { console.log(data)} ))

    var t1 = sip.transport.create({address: "127.0.0.1", port: 5090})
    var t2 = sip.transport.create({address: "127.0.0.1", port: 5092})

    console.log("t1", t1)
    console.log("t2", t2)

    flags = 0

    user_a = 'user1'
    user_b = 'user2'
    domain = 'test1.com'

    // here we create the oc (outgoing call)
    oc = sip.call.create(t1.id, {from_uri: `sip:${user_a}@${domain}`, to_uri: `sip:${user_b}@127.0.0.1`})

    // the call will be informed by yate to us for routing decision (routing means, what to do with it)
    await z.wait([
        {
            event: 'call.route',
            msg: m.collect('msg', m.partial_match({
                module: 'sip',
                status: 'incoming',
                answered: false,
                direction: 'incoming',
                caller: user_a,
                called: user_b,
                connection_id: 'general',
                sip_from: `sip:${user_a}@${domain}`,
                sip_to: `sip:${user_b}@!{_}`,
                newcall: true,
                domain,
            })),
            resolve: m.collect('resolve')
        },
    ], 1000)

    // We instruct yate to route the call to another sip endppoint
    z.store.msg.retValue(`sip/sip:${user_b}@${t2.address}:${t2.port}`)

    z.store.resolve(true)

    delete z.store.resolve

    // Then it will invite the other user
    await z.wait([
        {
            event: "incoming_call",
            call_id: m.collect("call_id"),
        },
    ], 2000)

    // now we organize the ic (incoming call) object
    var ic = {
        id: z.store.call_id,
        sip_call_id: z.store.sip_call_id,
    }

    // then we answer the call
    sip.call.respond(ic.id, {code: 200, reason: 'OK'})

    // then we get usual media_update events and '200 OK' at oc 
    await z.wait([
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
                  mode: 'unknown'
                },
                fmt: [
                  '0 PCMU/8000',
                  '101 telephone-event/8000'
                ]
              }
            ]
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
                  mode: 'unknown'
                },
                fmt: [
                  '0 PCMU/8000',
                  '120 telephone-event/8000'
                ]
              }
            ]
        },
        {
            event: 'response',
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '200',
                $rr: 'OK',
                '$(hdrcnt(VIA))': 1,
                $fU: user_a,
                $fd: domain,
                $tU: user_b,
                '$hdr(content-type)': 'application/sdp',
            }),
        },
    ], 1000)

    // here we start inband DTMF detection at the oc side
    sip.call.start_inband_dtmf_detection(oc.id)

    // then we send RFC2833 digits from the oc side
    sip.call.send_dtmf(oc.id, {digits: '1234', mode: 0})

    // then we send inband digits from the ic side
    sip.call.send_dtmf(ic.id, {digits: '4321', mode: 1})

    // then we wait for the dtmf events
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

    // now we remove the filter as we don't need it anymmore
    z.remove_event_filter(trying_filter)

    // now we test reivinte
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
                //$rb: '!{_}a=sendrecv', // Yate doesn't send a=sendrecv
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

    // unhold leg1
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

    // unhold leg2
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

    await z.sleep(100)

    console.log("Success")

    sip.stop()
    process.exit(0)
}


test()
.catch(e => {
    console.error(e)
    process.exit(1)
})

