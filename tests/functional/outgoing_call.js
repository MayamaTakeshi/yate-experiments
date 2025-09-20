const tl = require('tracing-log')

const sip = require ('sip-lab')
const Zeq = require('@mayama/zeq')
const z = new Zeq()
const m = require('data-matching')
const sip_msg = require('sip-matching')

const extmodule = require('yate-extmodule')

const connection = extmodule.connect({host: '127.0.0.1', port: 5040}, () => {
    console.log('connected')
})

connection.watch('chan.dtmf', (msg) => {
    z.push_event({
        event: 'chan.dtmf',
        msg,
    })
})

let callee = '05012341234'
let caller = '09011112222'

async function test() {
    sip.dtmf_aggregation_on(500)

    sip.set_codecs("PCMU/8000/1:128")

    z.trap_events(sip.event_source, 'event', (evt) => {
        const e = evt.args[0]
        return e
    })

    console.log(sip.start((data) => { console.log(data)} ))

    const t1 = sip.transport.create({address: "127.0.0.1", port: 5090, type: 'udp'})

    console.log("t1", t1)

    connection.dispatch('call.execute', {
            direct: `sip/sip:${callee}@${t1.address}:${t1.port}`,
            callto: "tone/dial;tonedetect_in=yes",
            caller,
        },  (msg) => {
        z.push_event({
            event: 'call.execute.response',
            msg,
        })
    });

    await z.wait([
        {
            event: 'incoming_call',
            transport_id: t1.id,
            call_id: m.collect('ic'),
            msg: sip_msg({
                '$rU': callee,
                '$fU': caller,
            }),
        },
        {
            event: 'call.execute.response',
            msg: '',
        },
    ], 1000)

    const ic = z.store.ic

    sip.call.respond(ic, {code: 200, reason:'OK'})

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
    ], 1000)

    sip.call.send_dtmf(ic, {digits:'1', mode:0})

    await z.wait([
        {
            event: 'chan.dtmf',
            msg: {
                text: '1',
            },
        }
    ], 5000)

    sip.call.terminate(ic)

    await z.wait([
        {
            event: 'call_ended',
            call_id: ic,
        },
        {
            event: 'response',
            call_id: ic,
            method: 'BYE',
            msg: sip_msg({
                $rs: '100',
                $rr: 'Trying',
            }),
        },
        {
            event: 'response',
            call_id: ic,
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

