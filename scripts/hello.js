Channel.callTo("wave/play//usr/local/src/git/yate/audio/hello_good_morning.mulaw");
Channel.callTo("wave/record//tmp/recording.mulaw",{"maxlen": 80000, "blocking": 1, "nosilence": 1}); // attention maxlen is not duration! It is max number of bytes to be written to file.
Channel.callTo("wave/play//tmp/recording.mulaw");
