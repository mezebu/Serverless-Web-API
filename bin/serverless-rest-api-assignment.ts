#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServerlessRestApiAssignmentStack } from "../lib/stacks/serverless-rest-api-assignment-stack";
import { CertStack } from "../lib/stacks/acm-cert-stacks";
import { Account, Region } from "../env";

const app = new cdk.App();

const certStack = new CertStack(app, "Stack1", {
  env: {
    region: "us-east-1",
    account: Account,
  },
  crossRegionReferences: true,
});

new ServerlessRestApiAssignmentStack(app, "Fullstack", {
  env: {
    region: Region,
    account: Account,
  },
  crossRegionReferences: true,
  certificate: certStack.certificate,
  zone: certStack.zone,
});
