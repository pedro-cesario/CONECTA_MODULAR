#!/bin/bash
export LD_LIBRARY_PATH=/media/SAAS/SAAS/CONECTA_MODULAR/instantclient-files:/tmp/ic19:$LD_LIBRARY_PATH
export OCI_LIB_DIR=/media/SAAS/SAAS/CONECTA_MODULAR/instantclient-files
exec node backend/server.js
