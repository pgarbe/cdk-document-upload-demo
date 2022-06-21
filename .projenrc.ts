import * as pj from 'projen';

const project = new pj.awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.25.0',
  defaultReleaseBranch: 'main',
  name: '@pgarbe/cdk-document-upload-demo',
  repository: 'https://github.com/pgarbe/cdk-document-upload-demo.git',

  projenrcTs: true,

  deps: [
    '@pgarbe/cdk-ecr-sync',
    '@aws-solutions-constructs/aws-s3-stepfunctions',
    'gotenberg-js-client',
    'aws-sdk',
  ],
});

project.synth();
