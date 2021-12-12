const tl = require('tracing-log')

const sip = require ('sip-lab')
const Zester = require('zester')
const z = new Zester()
const m = require('data-matching')
const sip_msg = require('sip-matching')

const extmodule = require('yate-extmodule')

const connection = extmodule.connect({host: '127.0.0.1', port: 5040}, () => {
    console.log('connected')
})

connection.watch('call.route', (msg) => {
    console.log('call.route')
    console.log(msg)
})

connection.watch('call.execute', (msg) => {
    console.log('call.execute')
    console.log(msg)
})

connection.watch('chan.dtmf', (msg) => {
    z.push_event({
        event: 'chan.dtmf',
        data: msg,
    })
})


async function test() {
    await z.sleep(1000) // wait a little because connection.subscribe() needs to complete

    sip.dtmf_aggregation_on(500)

    sip.set_codecs("PCMU/8000/1:128")

    z.trap_events(sip.event_source, 'event', (evt) => {
        const e = evt.args[0]
        return e
    })

    console.log(sip.start((data) => { console.log(data)} ))

    const t1 = sip.transport.create("127.0.0.1", 5090, 1)

    console.log("t1", t1)

    connection.dispatch('call.execute', {
            direct: `sip/sip:user1@${t1.ip}:${t1.port}`,
            callto: "tone/dial;tonedetect_in=yes",
            caller: "0312341234",
        },  (msg) => {
        console.log("call.execute callback")
        console.dir(msg)
    })

    await z.wait([
        {
            event: 'incoming_call',
            transport_id: t1.id,
            call_id: m.collect('ic'),
            msg: sip_msg({
                '$rU': 'user1',
                '$fU': '0312341234',
            }),
        },
    ], 1000)

    const ic = z.store.ic

    sip.call.respond(ic, 200, 'OK')

    await z.wait([
        {
            event: 'media_status',
            call_id: ic,
            status: 'setup_ok',
            local_mode: 'sendrecv',
            remote_mode: 'unknown'
        },
    ], 1000)

    sip.call.send_dtmf(ic, '1', 0)

    await z.wait([
        {
            event: 'chan.dtmf',
            data: {
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

    await z.sleep(1000)

    console.log("Success")

    sip.stop()
}

test()
.catch(e => {
    console.error(e)
    process.exit(1)
})

