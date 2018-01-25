#!/bin/sh
set -o errexit
set -o xtrace

export INSTANCE_IP=$(curl http://169.254.169.254/latest/meta-data/local-ipv4 2> /dev/null)
port="$(curl https://raw.githubusercontent.com/nitinbhadauria/rocketchat-aws-ecs/master/ecs-port-mapping.js | node)"
eval "$port"
node main.js
