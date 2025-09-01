#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

function usage() {
    cat <<EOF
Usage: $0 [-u git_user_name ] [-e git_user_email] [-C] [-v]

Details:
    -C : no cache (build image passing --no-cache to docker)
    -v : verbose progress
EOF
}

set +o errexit
git_user_name=`git config --global --get user.name`
git_user_email=`git config --global --get user.email`
set -o errexit

cache_option=""
progress_option=""
git=""
while getopts "Cvu:e:h" flag;do
case "$flag" in
C) cache_option="--no-cache";;
v) progress_option="--progress=plain";;
u) git_user_name="$OPTARG";;
e) git_user_email="$OPTARG";;
h) usage; exit 0;;
?) usage; exit 1;;
esac
done
shift $(($OPTIND - 1))

if [[ "$git_user_name" == "" ]]
then
    echo "I could not resolve your git global user.name. Please input it now:"
    read git_user_name
fi

if [[ "$git_user_email" == "" ]]
then
    echo "I could not resolve your git global user.email. Please input it now:"
    read git_user_email
fi

docker build \
	$progress_option \
	$cache_option \
	--build-arg user_name=$git_user_name \
	--build-arg git_user_name=$git_user_name \
	--build-arg git_user_email=$git_user_email \
	--tag="yate-experiments" \
	.

echo success
