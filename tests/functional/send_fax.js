var sip = require ('sip-lab')
var Zeq = require('@mayama/zeq')
var z = new Zeq()
var m = require('data-matching')
var sip_msg = require('sip-matching')
var sdp = require('sdp-matching')
var fs = require('fs')
var assert = require('assert')

async function test() {
    //sip.set_log_level(6)
    sip.dtmf_aggregation_on(500)

    z.trap_events(sip.event_source, 'event', (evt) => {
        var e = evt.args[0]
        return e
    })

    console.log(sip.start((data) => { console.log(data)} ))

    t1 = sip.transport.create({address: "127.0.0.1", type: 'udp'})

    console.log("t1", t1)

    oc = sip.call.create(t1.id, {from_uri: 'sip:alice@test.com', to_uri: `sip:99991012@127.0.0.1`})

    await z.wait([
        {
            event: 'response',
            call_id: oc.id,
            method: 'INVITE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
                '$hdr(call-id)': m.collect('sip_call_id'),
            }),
        },
    ], 1000)

    await z.wait([
        {
            event: 'media_update',
            call_id: oc.id,
            status: 'ok',
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
    ], 1000)

    await z.sleep(1000)

    var in_file = '../../media/sample.tiff'

    // transmit_on_idle: true/true: OK, true/false: OK, false/true: OK, false/false: NG
    sip.call.start_fax(oc.id, {is_sender: true, file: in_file, transmit_on_idle: false})

    await z.wait([
        {
            event: 'fax_result',
            call_id: oc.id,
            result: 0,
        },
    ], 180 * 1000)

    await z.sleep(2000)

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

    await z.sleep(1000)

    console.log(`Success. Fax file ${in_file} was transmitted.`)

    sip.stop()
    process.exit(0)
}


test()
.catch(e => {
    console.error(e)
    process.exit(1)
})

