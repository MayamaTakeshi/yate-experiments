
// Strangely we get here only if we set
// routing=hello.js
// in conf.d/javascript.js

// if we count on
// ^1234$=javascript/hello.js
// in the conf.d/regexroute.conf
// we can see the route is resolved by the script is not executed.



// the below doesn' work yet. We can hear the first and second prompts but recording ends after just one second.
Channel.callTo("wave/play//usr/local/src/git/yate/audio/hello_good_morning.mulaw");
Channel.callTo("wave/play//home/MayamaTakeshi/src/git/yate-experiments/hello_good_morning.mulaw");
Channel.callTo("wave/record//root/tmp/echo.mulaw",{"maxlen": 10000, "blocking": 1, "nosilence": 1});
Channel.callTo("wave/play//root/tmp/echo.mulaw");
