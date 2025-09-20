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

    console.log("t1", t1)

    var domain = 'test1.com'
    var caller = '0312341234'
    var called = '09011112222'

    // here we create the oc (outgoing call)
    oc = sip.call.create(t1.id, {from_uri: `sip:${caller}@${domain}`, to_uri: `sip:${called}@127.0.0.1`})

    // the call will be informed by yate to us for routing decision (routing means, what to do with it)
    await z.wait([
        {
            event: 'call.route',
            msg: m.collect('msg', m.partial_match({
                module: 'sip',
                status: 'incoming',
                answered: false,
                direction: 'incoming',
                caller, 
                called,
                connection_id: 'general',
                sip_from: `sip:${caller}@${domain}`,
                sip_to: `sip:${called}@!{_}`,
                newcall: true,
                domain,
            })),
            resolve: m.collect('resolve')
        },
    ], 1000)

    var msg = z.store.msg
    delete z.store.msg

    msg.retValue("dumb/");
    msg.autoanswer = true;
    let chan = new YateChannel(msg);

    z.store.resolve(true)
    delete z.store.resolve

    console.log('before await chan.init()')
    await chan.init()
    console.log('after  await chan.init()')

    // We instruct yate to route the call to wave module
    chan.callTo('wave/play//usr/local/src/git/yate/audio/dtmf.123.mulaw')
    .then(msg => {
        z.push_event({
            event: 'callTo.completed',
            msg,
        })
    })

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
                $fU: caller,
                $fd: domain,
                $tU: called,
                '$hdr(content-type)': 'application/sdp',
            }),
        },
    ], 1000)

    // here we start inband DTMF detection at the oc side
    sip.call.start_inband_dtmf_detection(oc.id)

    // then we wait for the dtmf event
    await z.wait([
        {
            event: 'dtmf',
            call_id: oc.id,
            digits: '123',
            mode: 1,
        },
        {
            event: 'callTo.completed',
            msg: {
                //id: 'dumb/5',
                //targetid: 'next-yate-notify/1758335048091',
                reason: 'eof',
                handlers: 'queuesnotify:10,jingle:100,analog:100'
            },
        },
    ], 3000)

    chan.callTo('wave/play//usr/local/src/git/yate/audio/dtmf.456.mulaw')
    .then(msg => {
        z.push_event({
            event: 'callTo.completed',
            msg,
        })
    })

    // then we wait for the dtmf event
    await z.wait([
        {
            event: 'dtmf',
            call_id: oc.id,
            digits: '456',
            mode: 1,
        },
        {
            event: 'callTo.completed',
            msg: {
                //id: 'dumb/5',
                //targetid: 'next-yate-notify/1758335048091',
                reason: 'eof',
                handlers: 'queuesnotify:10,jingle:100,analog:100'
            },
        },
    ], 4000)

    // now ask yate to generate inband DTMF tones
    chan.callTo('tone/dtmfstr/789')
    .then(msg => {
        z.push_event({
            event: 'callTo.completed',
            msg,
        })
    })

    // then we wait for the dtmf event
    await z.wait([
        {
            event: 'dtmf',
            call_id: oc.id,
            digits: '789',
            mode: 1,
        },
        {
            event: 'callTo.completed',
            msg: {
                //id: 'sip/32',
                //notify: 'next-yate-notify/1758336162827',
                //handlers: 'sip:10,dbwave:90,analogdetect:100,mux:100,moh:100,analyzer:100,tone:100,pbx:100,wave:100,yrtp:100,tonedetect:100,filetransfer:100,mrcp:100',
                module: 'sip',
                status: 'answered',
                address: '127.0.0.1:5090',
                //targetid: 'dumb/16',
                //billid: '1758331915-37',
                //peerid: 'dumb/16',
                //lastpeerid: 'dumb/16',
                answered: true,
                direction: 'incoming',
                domain,
                //callid: 'sip/2e778cae-dbe1-4c44-bc88-e6c4a1d45f1f/30aade1e-2c86-4e64-9c52-bc92749a2ff1/745510068',
                reason: 'eof'
            }
        },
    ], 10000)
 
    // now we remove the filter as we don't need it anymmore
    z.remove_event_filter(trying_filter)

    // now we test reivinte
    sip.call.reinvite(oc.id, {media: [{type: 'audio'}]})

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
            call_id: 0,
            status: 'ok',
            media: [
                {
                    type: 'audio',
                    protocol: 'RTP/AVP',
                    local: {
                        addr: '127.0.0.1',
                        //port: 10000,
                        mode: 'sendrecv'
                    },
                    remote: {
                        addr: '127.0.0.1',
                        //port: 28326,
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

    sip.call.terminate(oc.id)

    await z.wait([
        {
            event: 'call_ended',
            call_id: oc.id,
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

