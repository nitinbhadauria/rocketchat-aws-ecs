#!/bin/sh
set -o errexit
set -o xtrace

export INSTANCE_IP=$(curl http://169.254.169.254/latest/meta-data/local-ipv4 2> /dev/null)
node main.js
