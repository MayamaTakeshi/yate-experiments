#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

set +o errexit
git_user_name=`git config --global --get user.name`
set -o errexit


if [[ "$git_user_name" == "" ]]
then
    echo "I could not resolve your git global user.name. Please input it now:"
    read git_user_name
fi

docker run \
  --rm \
  -it \
  --net=host \
  -v /etc/localtime:/etc/localtime:ro \
  -v `pwd`/..:/home/$git_user_name/src/git \
  -v `pwd`/conf.d:/usr/local/src/git/yate/conf.d \
  -v `pwd`/audio/:/usr/local/src/git/yate/audio \
  -v `pwd`/scripts/:/usr/local/src/git/yate/scripts \
  -w /home/$git_user_name/src/git/yate-experiments \
  yate-experiments
