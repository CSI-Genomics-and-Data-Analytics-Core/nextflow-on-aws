#! /bin/bash
export ENGINE_NAME=nextflow # cromwell / miniwdl / snakemake / nextflow
export JOB_QUEUE=arn:aws:batch:ap-southeast-1:026171442599:job-queue/BatchTaskBatchJobQueue15-Z8ChW8TCIoRovf6l
export JOB_DEFINITION=arn:aws:batch:ap-southeast-1:026171442599:job-definition/nextflowNextflowEngineN-901d0b4fa72e023:1
export ENGINE_LOG_GROUP=

export AWS_DEFAULT_REGION=ap-southeast-1
export AWS_REGION=ap-southeast-1

echo "Starting local WES endpoint at http://localhost:80/ga4gh/wes/v1/ui/"
./venv/bin/python ./local-server.py
