#!/bin/bash

HOST=$SERVER_NAME
declare -A param   

app='mldt'

eval $(echo ${QUERY_STRING//&/;})

if [[ $embedded ]] 
then
  app=$embedded	
fi

cat << ENDOFFILE
Content-type: text/html

`cat index.html | sed -e 's/MOVIUS.moviuscorp.net/'${HOST}'/g' -e 's/mldt/'${app}'/g'`
ENDOFFILE
exit 0
