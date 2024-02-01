#! /bin/bash
export ENGINE_NAME=nextflow # cromwell / miniwdl / snakemake / nextflow
export JOB_QUEUE=
export JOB_DEFINITION=
export ENGINE_LOG_GROUP=

export AWS_DEFAULT_REGION=ap-southeast-1
export AWS_REGION=ap-southeast-1

echo "Starting local WES endpoint at http://localhost:80/ga4gh/wes/v1/ui/"
./venv/bin/python ./local-server.py
