#!/bin/bash
# Run this script in the mcp/*/build/ directory to create a link to the common lib/
if [ -e "lib" ]; then
   echo "lib already exists here"
   exit 1
fi
PWD=$(/bin/pwd)
HERE=$(basename ${PWD})
if [ "${HERE}" != "build" ]; then
   echo "${PWD} is not a build directory"
   exit 1
fi
echo "lib svn+ssh://svn.gems.glenayre.com/svn/mcp/build/trunk/build/lib" > /tmp/$$
svn propset svn:externals . -F /tmp/$$
rm /tmp/$$
