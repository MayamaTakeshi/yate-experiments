const { YateMessage } = require("next-yate");

const set_yate_msg_trap = async (yate, name, z) => {
    await yate.install(msg => {
        return new Promise((resolve, reject) => {
            z.push_event({
                event: name,
                msg,
                resolve,
                reject,
            })
        })
    }, name);
};

const hangup_all_yate_calls = async (yate) => {
    let msg = new YateMessage('engine.status', {module: 'cdrbuild'});
    let reply_msg = await yate.dispatch(msg)

    let retvalue = reply_msg._retvalue.trim()
    let cdrs = retvalue.split(";")[2]
    if(cdrs.length > 0) {
        cdrs = cdrs.split(",")
        for(var i=0 ; i<cdrs.length ; i++) {
            var cdr = cdrs[i]
            var call_id = cdrs[i].split("=")[0]
            console.log(`Sending call.drop for ${call_id}`)
            let m = new YateMessage('call.drop', {id: call_id})
            await yate.enqueue(m)
        }
    }
    console.log("finished")
}

module.exports = {
    set_yate_msg_trap,
    hangup_all_yate_calls,
}
