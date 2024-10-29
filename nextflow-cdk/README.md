# Nextflow Infrastructure provisioning via CDK TypeScript


## Project Structure

This project follows a specific directory structure to organize its files and resources. Here is an overview of the main directories:

### bin

The `bin` directory possess the bootstrap scripts for each infrastructure.

`permission (optional)`

Create permission policies for,

1. Provisioning `core` and `context` infrastructures via CDK script
2. Authorization to call WES REST API.



`core`

Setup core networking infrastructure, VPC and three pairs of public and private subnets for each availablity zone.

Along with S3 bucket, DynamoDB and SSM parameters (to use under compute infrastructure)

Configurations available in `cdk-typescript/lib/env/context-app-parameters.ts` (Namespaces,S3 bucket(s), instanceTypes, maxVCPUS, tags, and more)


`context`

Setup Nextflow compute resources, AWS Batch queues, Lambda, AWS Gateway and such.


### lib

The `lib` directory contains all the coding scripts in modulrized manner.

### assets

The `assets` directory contains static files needed by CDK script, eg: wes-adapter.zip.



## Commands

### Intall dependencies

`npm install`

### Deploy via CDK

Choose the bootstrap script on `cdk.json`  ( core or context)

` "app": "npx ts-node --prefer-ts-exts bin/core/app.ts" `

Run,

`npm run cdk deploy`

### Generate Cloudformation YAML

`npm run cdk synth > cloudformation.yml`
