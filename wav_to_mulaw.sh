#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

function usage() {
	cat <<EOF
Usage: $0 wav_file
Ex:    $0 dtmv.123.wav 

So, calling '$0 dtmf.123.wav' will generate dtmf.123.mulaw.
EOF
}

if [[ $# -ne 1 ]]
then
	usage;
	exit 1;
fi

wav_file=$1

mulaw_file=`basename $wav_file ".wav"`.mulaw

sox $wav_file -t raw -r 8000 -e mu-law -b 8 $mulaw_file

echo "Success: file $mulaw_file was craeted."
