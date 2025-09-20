if (message.called == "12345678") {
    Channel.callTo("wave/play//usr/local/src/git/yate/audio/hello_good_morning.mulaw");
    Channel.callTo("wave/record//tmp/recording.mulaw",{"maxlen": 80000, "blocking": 1, "nosilence": 1}); // attention maxlen is not duration! It is max number of bytes to be written to file.
    Channel.callTo("wave/play//tmp/recording.mulaw");
} else if (message.called == "11112222") {
    Channel.callTo("wave/play//usr/local/src/git/yate/audio/hello_good_morning.mulaw");
} else if (message.called == "33334444") {
    Channel.callTo("sip/sip:33334444@127.0.0.1:5070");
}
