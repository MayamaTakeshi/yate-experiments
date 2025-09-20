#!/bin/bash

#set -o errexit
set -o nounset
set -o pipefail

while [[ 1 ]]
do
    sudo timeout --foreground -k 660 -s HUP 600 sipp -i 127.0.0.1 -p 5050 -sf uac.xml -inf invite.txt 127.0.0.1:5060 -r 10 -timeout 180s
    reset
    sleep 1
done

