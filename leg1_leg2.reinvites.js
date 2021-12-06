var sip = require ('sip-lab')
var Zester = require('zester')
var z = new Zester()
var m = require('data-matching')
var sip_msg = require('sip-matching')

async function test() {
    //sip.set_log_level(6)
    sip.dtmf_aggregation_on(500)

    sip.set_codecs("PCMU/8000/1:128")

    z.trap_events(sip.event_source, 'event', (evt) => {
        var e = evt.args[0]
        return e
    })

    console.log(sip.start((data) => { console.log(data)} ))

    t1 = sip.transport.create("127.0.0.1", 5090, 1)
    t2 = sip.transport.create("127.0.0.1", 5092, 1)

    console.log("t1", t1)
    console.log("t2", t2)

    flags = 0

    oc = sip.call.create(t1.id, flags, 'sip:a@t', 'sip:b@127.0.0.1:5060')

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
                $fU: 'a',
                $fd: 't',
                $tU: 'b',
            }),
        },
        {
            event: "incoming_call",
            call_id: m.collect("call_id"),
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
                $fU: 'a',
                $fd: 't',
                $tU: 'b',
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

    console.log("Success")

    sip.stop()
}


test()
.catch(e => {
    console.error(e)
    process.exit(1)
})

