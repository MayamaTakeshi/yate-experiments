# Yate Experiments

## Overview

This repo documents our experiments with Yate (Yet Another Telephony Engine)

We use a Dockerfile to build a docker image containing yate, sngrep2 and node.

## Build the image
```
./build_image.sh
```
## Start the container
```
./start_container.sh
```

## Starting a tmux working session
Inside the container do:
```
./tmux_session.sh
```
## Running tests

In the tmux session switch to window 'tests/functional' and run one of the tests like this:
```
node simple.js
```

Then switch to the window 'sngre2' and inspect the messages exchanged between the test script and yate.

Also, switch to the window 'yate' and inspect its logs.

To run all tests do:
```
./runtests
```
Obs: however, currently, test subscribe_notify.js is failing (see https://github.com/MayamaTakeshi/yate-experiments/issues/2)
