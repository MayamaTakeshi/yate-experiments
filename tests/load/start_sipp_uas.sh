#!/bin/bash

#set -o errexit
set -o nounset
set -o pipefail

while [[ 1 ]]
do
    sudo timeout --foreground -k 660 -s HUP 600 sipp -i 127.0.0.1 -p 5070 -sf uas.xml -timeout 180s
    reset
    sleep 1
done

