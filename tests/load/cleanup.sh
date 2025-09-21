#!/bin/bash

while [[ 1 ]]
do
    echo deleting mulaw files from /tmp older than 1 minute.
    /usr/bin/find /tmp -type f -name '*.mulaw' -mmin +1 -delete
    sleep 30 
done

