# Nextflow Infrastructure provisioning via CDK (TypeScript)

## Setup

### Intall dependencies

`npm install`

### Deploy via CDK

Setup .env file, refered to the .env.local.
```
PROJECT_NAME=
USER_ID=
USER_EMAIL=

//existing bucket ARNs
OUTPUT_BUCKET_NAME=
ARTIFACT_BUCKET_NAME=

//comma seperated s3 ARNS
READ_BUCKET_ARNS=arn:aws:s3:::ngi-igenomes
READ_WRITE_BUCKET_ARNS=
```

Run,

`npm run cdk deploy`

### Generate Cloudformation YAML

`npm run cdk synth > cloudformation.yml`

## Project Structure

This project follows a specific directory structure to organize its files and resources. Here is an overview of the main directories:

### bin

The `bin` directory possess the bootstrap scripts for each infrastructure.

`permission (optional)`

Create permission policies for,

1. Provisioning `core` infrastructure via CDK script
2. Authorization to call WES REST API.



`core`

Setup core networking infrastructure, VPC and three pairs of public and private subnets for each availablity zone.

Along with S3 bucket, DynamoDB and SSM parameters (to use under compute infrastructure)

Setup Nextflow compute resources, AWS Batch queues, Lambda, AWS Gateway and such.


### lib

The `lib` directory contains all the coding scripts in modulrized manner.

### assets

The `assets` directory contains static files needed by CDK script, eg: wes-adapter.zip.
