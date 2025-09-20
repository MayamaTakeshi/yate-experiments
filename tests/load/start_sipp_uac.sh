#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

sipp -i 127.0.0.1 -p 5050 -sf uac.xml -inf invite.txt 127.0.0.1:5060 -r 10

