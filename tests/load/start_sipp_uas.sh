#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

sudo sipp -i 127.0.0.1 -p 5070 -sf uas.xml
